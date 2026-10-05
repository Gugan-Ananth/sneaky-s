import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import {
  actionsFor,
  EscapeAction,
  EscapeState,
  escapePace,
  getReachableRestraints,
  inventoryOf,
  Inventory,
  progressBar,
  Restraint,
} from './escape-rules';

const ACTION_LABELS: Record<EscapeAction, string> = {
  pick: 'Pick the knot',
  yank: 'Yank',
  edge: 'Find an edge',
  peel: 'Peel',
  rip: 'Rip',
  pry: 'Pry the buckle',
  tug: 'Tug the strap',
  shim: 'Shim',
  snap: 'Tighten and snap',
  rake: 'Rake the lock',
  lift: 'Lift a loop',
  heave: 'Heave',
  tongue: 'Push with your tongue',
  pull: 'Pull it free',
  cut: 'Cut it',
  key: 'Use a key',
};

export type EscapeView = {
  content: string;
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
};

function styleFor(action: EscapeAction): ButtonStyle {
  if (action === 'yank' || action === 'rip' || action === 'snap') {
    return ButtonStyle.Danger;
  }
  if (action === 'cut' || action === 'key') return ButtonStyle.Success;
  if (action === 'edge' || action === 'tug' || action === 'heave') {
    return ButtonStyle.Secondary;
  }
  return ButtonStyle.Primary;
}

function labelFor(action: EscapeAction, restraint: Restraint): string {
  if (action === 'edge' && restraint.edgeFound) return 'Work the edge';
  return ACTION_LABELS[action];
}

function describeInventory(inventory: Inventory): string {
  const parts: string[] = [];
  if (inventory.pins > 0) {
    parts.push(
      inventory.pins === 1 ? 'a bobby pin' : `${inventory.pins} bobby pins`,
    );
  }
  if (inventory.scissors > 0) {
    parts.push(
      inventory.scissors === 1 ? 'scissors' : `${inventory.scissors} scissors`,
    );
  }
  if (inventory.keys > 0) {
    parts.push(inventory.keys === 1 ? 'a key' : `${inventory.keys} keys`);
  }
  if (parts.length === 0) return 'You are not holding any tools.';
  return `You are holding ${parts.join(', ')}.`;
}

export function renderEscapeView(input: {
  state: EscapeState;
  captiveId: string;
  actorId: string;
  isHelper: boolean;
  now: number;
  notice?: string;
  focusId?: string;
}): EscapeView {
  const reachable = getReachableRestraints(input.state);
  const focus =
    reachable.find((restraint) => restraint.id === input.focusId) ??
    (reachable.length === 1 ? reachable[0] : undefined);
  const inventory = inventoryOf(input.state, input.actorId);
  const lines: string[] = [];

  if (input.notice) lines.push(input.notice);

  if (
    !input.isHelper &&
    input.state.restraints.some(
      (restraint) => restraint.kind === 'blindfold' && !restraint.released,
    )
  ) {
    lines.push('The blindfold makes your hands miss.');
  }

  if (focus) {
    const pace = escapePace(input.state, focus, input.isHelper);
    if (input.isHelper) {
      lines.push('In your hands, this comes apart fast.');
    } else if (pace === 'hard' && focus.id !== 'arms') {
      const armPiece = ['forearms', 'elbows', 'upper-arms'].includes(focus.id);
      lines.push(
        armPiece
          ? 'Wrists, then forearms, then elbows, then upper arms. Out of order, this barely moves.'
          : 'This barely moves while the arms are still tied.',
      );
    } else if (
      pace === 'easy' &&
      input.state.restraints.some(
        (restraint) =>
          restraint.released &&
          (restraint.id === 'arms' ||
            ['wrists', 'forearms', 'elbows', 'upper-arms'].includes(
              restraint.id,
            )),
      )
    ) {
      lines.push('The arms are free, so this comes apart fast.');
    }
  }

  if (input.isHelper) lines.push(describeInventory(inventory));

  if (focus) {
    lines.push(
      `**${focus.label}** — ${focus.material}  \`${progressBar(focus)}\``,
    );
  } else if (reachable.length > 1) {
    lines.push(
      input.isHelper ? 'Pick something to work on.' : 'What can you reach?',
    );
  } else {
    lines.push("You can't reach anything else yet.");
  }

  const components: EscapeView['components'] = [];

  if (reachable.length > 1) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`esc-pick:${input.captiveId}`)
      .setPlaceholder(focus ? focus.label : 'Choose a restraint')
      .addOptions(
        reachable.map((restraint) => ({
          label: `${restraint.label} · ${restraint.material}`.slice(0, 100),
          description: restraint.released
            ? 'Free'
            : `${progressBar(restraint)} ${restraint.material}`.slice(0, 100),
          value: restraint.id,
          default: focus?.id === restraint.id,
        })),
      );
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    );
  }

  if (focus) {
    const buttons = actionsFor(focus, input.isHelper, inventory).map((action) =>
      new ButtonBuilder()
        .setCustomId(`esc:${input.captiveId}:${focus.id}:${action}`)
        .setLabel(labelFor(action, focus))
        .setStyle(styleFor(action)),
    );
    if (buttons.length > 0) {
      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
      );
    }
  }

  if (input.isHelper && reachable.length > 0) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`esc:${input.captiveId}:room:search`)
          .setLabel('Search the room')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return {
    content: lines.join('\n\n').slice(0, 2000),
    components,
  };
}
