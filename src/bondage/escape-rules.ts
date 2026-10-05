export type ScenarioId = 'rope' | 'leather' | 'tape' | 'scarves' | 'chains';

export type EscapeMethod =
  | 'knot'
  | 'peel'
  | 'buckle'
  | 'ziptie'
  | 'chain'
  | 'lock'
  | 'stuffing';

export type EscapeAction =
  | 'pick'
  | 'yank'
  | 'edge'
  | 'peel'
  | 'rip'
  | 'pry'
  | 'tug'
  | 'shim'
  | 'snap'
  | 'rake'
  | 'lift'
  | 'heave'
  | 'tongue'
  | 'pull'
  | 'cut'
  | 'key';

export type RestraintKind = 'bondage' | 'gag' | 'blindfold';

export type Restraint = {
  id: string;
  label: string;
  material: string;
  method: EscapeMethod;
  kind: RestraintKind;
  progress: number;
  required: number;
  released: boolean;
  /** Higher gag layers have to come off before lower ones. */
  layer: number;
  blocksHands: boolean;
  hindersWrists: boolean;
  /** Captive progress is halved while their hands are still blocked. */
  selfNeedsHands: boolean;
  /** Captive cannot attempt this until these restraints are off. */
  selfAfter: string[];
  /** Yank is more likely to loosen silk and cloth than rope. */
  slippery: boolean;
  cuttable: boolean;
  keyed: boolean;
  edgeFound: boolean;
};

export type Inventory = {
  pins: number;
  scissors: number;
  keys: number;
};

export type EscapeState = {
  scenarioId: ScenarioId | null;
  restraints: Restraint[];
  boardMessageId: string | null;
  cooldowns: Record<string, number>;
  searchCooldowns: Record<string, number>;
  items: Record<string, Inventory>;
};

export type Rng = () => number;

export const ACTION_COOLDOWN_MS = 5_000;
export const SEARCH_COOLDOWN_MS = 120_000;
export const BLINDFOLD_MISS_CHANCE = 0.3;

const ESCAPE_ACTIONS: readonly EscapeAction[] = [
  'pick',
  'yank',
  'edge',
  'peel',
  'rip',
  'pry',
  'tug',
  'shim',
  'snap',
  'rake',
  'lift',
  'heave',
  'tongue',
  'pull',
  'cut',
  'key',
];

export function isEscapeAction(value: string): value is EscapeAction {
  return (ESCAPE_ACTIONS as readonly string[]).includes(value);
}

export function emptyInventory(): Inventory {
  return { pins: 0, scissors: 0, keys: 0 };
}

export function emptyEscapeState(
  scenarioId: ScenarioId | null,
  restraints: Restraint[],
): EscapeState {
  return {
    scenarioId,
    restraints,
    boardMessageId: null,
    cooldowns: {},
    searchCooldowns: {},
    items: {},
  };
}

export function inventoryOf(state: EscapeState, userId: string): Inventory {
  return state.items[userId] ?? emptyInventory();
}

export function isBoardClear(state: EscapeState): boolean {
  return state.restraints.every((restraint) => restraint.released);
}

export function handsBlocked(state: EscapeState): boolean {
  return state.restraints.some(
    (restraint) => !restraint.released && restraint.blocksHands,
  );
}

export function wristsHindered(state: EscapeState): boolean {
  return state.restraints.some(
    (restraint) => !restraint.released && restraint.hindersWrists,
  );
}

export function derivedRestrictions(state: EscapeState): {
  gag: boolean;
  blindfold: boolean;
} {
  return {
    gag: state.restraints.some(
      (restraint) => restraint.kind === 'gag' && !restraint.released,
    ),
    blindfold: state.restraints.some(
      (restraint) => restraint.kind === 'blindfold' && !restraint.released,
    ),
  };
}

export function progressBar(restraint: Restraint): string {
  const ratio =
    restraint.required <= 0 ? 1 : restraint.progress / restraint.required;
  const filled = Math.max(0, Math.min(8, Math.round(ratio * 8)));
  return `${'█'.repeat(filled)}${'░'.repeat(8 - filled)}`;
}

function outermostGagLayer(state: EscapeState): number | null {
  const layers = state.restraints
    .filter((restraint) => restraint.kind === 'gag' && !restraint.released)
    .map((restraint) => restraint.layer);
  if (layers.length === 0) return null;
  return Math.max(...layers);
}

export function isReachable(
  state: EscapeState,
  restraint: Restraint,
  isHelper: boolean,
): boolean {
  if (restraint.released) return false;

  if (restraint.kind === 'gag') {
    const outer = outermostGagLayer(state);
    if (outer === null || restraint.layer !== outer) return false;
  }

  if (!isHelper) {
    const blocked = restraint.selfAfter.some((id) => {
      const dependency = state.restraints.find((item) => item.id === id);
      return dependency !== undefined && !dependency.released;
    });
    if (blocked) return false;
  }

  return true;
}

export function getReachableRestraints(
  state: EscapeState,
  isHelper: boolean,
): Restraint[] {
  return state.restraints.filter((restraint) =>
    isReachable(state, restraint, isHelper),
  );
}

export function actionsFor(
  restraint: Restraint,
  isHelper: boolean,
  inventory: Inventory,
): EscapeAction[] {
  const actions: EscapeAction[] = [];

  switch (restraint.method) {
    case 'knot':
      actions.push('pick', 'yank');
      break;
    case 'peel':
      actions.push('edge');
      if (restraint.edgeFound) actions.push('peel');
      actions.push('rip');
      break;
    case 'buckle':
      actions.push('pry', 'tug');
      break;
    case 'ziptie':
      actions.push('shim', 'snap');
      break;
    case 'chain':
      actions.push('lift', 'heave');
      break;
    case 'lock':
      actions.push('rake');
      break;
    case 'stuffing':
      actions.push(isHelper ? 'pull' : 'tongue');
      break;
  }

  if (isHelper && restraint.cuttable && inventory.scissors > 0) {
    actions.push('cut');
  }
  if (isHelper && restraint.keyed && inventory.keys > 0) {
    actions.push('key');
  }

  return actions;
}

export type EscapeFailureReason =
  | 'cooldown'
  | 'unreachable'
  | 'bad-action'
  | 'no-item'
  | 'not-helper';

export type EscapeFailure = {
  ok: false;
  reason: EscapeFailureReason;
  retryInMs?: number;
  state?: EscapeState;
};

type OutcomeBase = {
  ok: true;
  state: EscapeState;
  allFree: boolean;
  gag: boolean;
  blindfold: boolean;
  actorIsHelper: boolean;
  hideActor: boolean;
};

export type EscapeSuccess = OutcomeBase &
  (
    | {
        kind: 'action';
        restraint: Restraint;
        action: EscapeAction;
        effect: 'progress' | 'regress' | 'free' | 'reset' | 'miss';
      }
    | {
        kind: 'search';
        found: 'nothing' | 'pin' | 'scissors' | 'key';
      }
  );

export type EscapeResult = EscapeSuccess | EscapeFailure;

type ActionInput = {
  actorId: string;
  captiveId: string;
  restraintId: string;
  action: EscapeAction;
  blindfolded: boolean;
  now: number;
  rng?: Rng;
};

type SearchInput = {
  actorId: string;
  captiveId: string;
  blindfolded: boolean;
  now: number;
  rng?: Rng;
};

function cloneState(state: EscapeState): EscapeState {
  return {
    scenarioId: state.scenarioId,
    restraints: state.restraints.map((restraint) => ({
      ...restraint,
      selfAfter: [...restraint.selfAfter],
    })),
    boardMessageId: state.boardMessageId,
    cooldowns: { ...state.cooldowns },
    searchCooldowns: { ...state.searchCooldowns },
    items: Object.fromEntries(
      Object.entries(state.items).map(([userId, inventory]) => [
        userId,
        { ...inventory },
      ]),
    ),
  };
}

function fail(reason: EscapeFailureReason, retryInMs?: number): EscapeFailure {
  return retryInMs === undefined
    ? { ok: false, reason }
    : { ok: false, reason, retryInMs };
}

function cooldownRemaining(
  state: EscapeState,
  actorId: string,
  now: number,
): number | null {
  const until = state.cooldowns[actorId] ?? 0;
  if (until <= now) return null;
  return until - now;
}

function finish<T extends Record<string, unknown>>(
  state: EscapeState,
  actorIsHelper: boolean,
  hideActor: boolean,
  extra: T,
): OutcomeBase & T {
  const restrictions = derivedRestrictions(state);
  return {
    ok: true,
    state,
    allFree: isBoardClear(state),
    gag: restrictions.gag,
    blindfold: restrictions.blindfold,
    actorIsHelper,
    hideActor,
    ...extra,
  };
}

function progressFactor(
  state: EscapeState,
  restraint: Restraint,
  isHelper: boolean,
): number {
  if (isHelper) return 2;
  let factor = 1;
  if (restraint.selfNeedsHands && handsBlocked(state)) factor *= 0.5;
  if (restraint.id === 'wrists' && wristsHindered(state)) factor *= 0.5;
  return factor;
}

function markReleased(restraint: Restraint): void {
  restraint.released = true;
  restraint.progress = restraint.required;
}

function addProgress(
  restraint: Restraint,
  gain: number,
  factor: number,
): 'progress' | 'regress' | 'free' {
  if (gain < 0) {
    restraint.progress = Math.max(0, restraint.progress + gain);
    return 'regress';
  }

  const amount = Math.max(1, Math.floor(gain * factor));
  restraint.progress += amount;
  if (restraint.progress >= restraint.required) {
    markReleased(restraint);
    return 'free';
  }
  return 'progress';
}

export function applyEscapeAction(
  original: EscapeState,
  input: ActionInput,
): EscapeResult {
  const state = cloneState(original);
  const isHelper = input.actorId !== input.captiveId;
  const remaining = cooldownRemaining(state, input.actorId, input.now);
  if (remaining !== null) return fail('cooldown', remaining);

  const restraint = state.restraints.find(
    (item) => item.id === input.restraintId,
  );
  if (!restraint || !isReachable(state, restraint, isHelper)) {
    return fail('unreachable');
  }

  const inventory = inventoryOf(state, input.actorId);
  const allowed = actionsFor(restraint, isHelper, inventory);
  if (!allowed.includes(input.action)) {
    if (
      isHelper &&
      ((input.action === 'cut' && restraint.cuttable) ||
        (input.action === 'key' && restraint.keyed))
    ) {
      return fail('no-item');
    }
    if (
      !isHelper &&
      (input.action === 'cut' ||
        input.action === 'key' ||
        input.action === 'pull')
    ) {
      return fail('not-helper');
    }
    return fail('bad-action');
  }

  const rng = input.rng ?? Math.random;
  const hideActor = isHelper && input.blindfolded;

  if (!isHelper && input.blindfolded && rng() < BLINDFOLD_MISS_CHANCE) {
    state.cooldowns[input.actorId] = input.now + ACTION_COOLDOWN_MS;
    return finish(state, false, false, {
      kind: 'action',
      restraint,
      action: input.action,
      effect: 'miss',
    });
  }

  const factor = progressFactor(state, restraint, isHelper);
  let effect: 'progress' | 'regress' | 'free' | 'reset' = 'progress';

  switch (input.action) {
    case 'pick':
      effect = addProgress(restraint, 25, factor);
      break;
    case 'yank': {
      const chance = restraint.slippery ? 0.7 : 0.5;
      effect = addProgress(restraint, rng() < chance ? 40 : -15, factor);
      break;
    }
    case 'edge':
      restraint.edgeFound = true;
      effect = addProgress(restraint, 15, factor);
      break;
    case 'peel':
      effect = addProgress(restraint, 25, factor);
      break;
    case 'rip':
      effect = addProgress(restraint, rng() < 0.5 ? 50 : -10, factor);
      break;
    case 'pry':
      effect = addProgress(restraint, 30, factor);
      break;
    case 'tug':
      effect = addProgress(restraint, 20, factor);
      break;
    case 'shim':
      effect = addProgress(restraint, 20, factor);
      break;
    case 'snap':
      if (rng() < 0.4) {
        markReleased(restraint);
        effect = 'free';
      } else {
        restraint.progress = 0;
        restraint.required += 20;
        effect = 'reset';
      }
      break;
    case 'rake':
      effect = addProgress(restraint, inventory.pins > 0 ? 40 : 20, factor);
      break;
    case 'lift':
      effect = addProgress(restraint, 20, factor);
      break;
    case 'heave':
      effect = addProgress(restraint, 35, factor);
      break;
    case 'tongue':
    case 'pull':
      effect = addProgress(restraint, 35, factor);
      break;
    case 'cut': {
      const items = inventoryOf(state, input.actorId);
      items.scissors -= 1;
      state.items[input.actorId] = items;
      markReleased(restraint);
      effect = 'free';
      break;
    }
    case 'key': {
      const items = inventoryOf(state, input.actorId);
      items.keys -= 1;
      state.items[input.actorId] = items;
      markReleased(restraint);
      effect = 'free';
      break;
    }
  }

  state.cooldowns[input.actorId] = input.now + ACTION_COOLDOWN_MS;
  return finish(state, isHelper, hideActor, {
    kind: 'action',
    restraint,
    action: input.action,
    effect,
  });
}

export function searchRoom(
  original: EscapeState,
  input: SearchInput,
): EscapeResult {
  const state = cloneState(original);
  const isHelper = input.actorId !== input.captiveId;
  if (!isHelper) return fail('not-helper');
  if (isBoardClear(state)) return fail('bad-action');

  const actionWait = cooldownRemaining(state, input.actorId, input.now);
  if (actionWait !== null) return fail('cooldown', actionWait);

  const searchUntil = state.searchCooldowns[input.actorId] ?? 0;
  if (searchUntil > input.now) {
    return fail('cooldown', searchUntil - input.now);
  }

  const rng = input.rng ?? Math.random;
  const roll = rng();
  const found: 'nothing' | 'pin' | 'scissors' | 'key' =
    roll < 0.4
      ? 'nothing'
      : roll < 0.7
        ? 'pin'
        : roll < 0.9
          ? 'scissors'
          : 'key';

  const items = inventoryOf(state, input.actorId);
  if (found === 'pin') items.pins += 1;
  if (found === 'scissors') items.scissors += 1;
  if (found === 'key') items.keys += 1;
  state.items[input.actorId] = items;
  state.cooldowns[input.actorId] = input.now + ACTION_COOLDOWN_MS;
  state.searchCooldowns[input.actorId] = input.now + SEARCH_COOLDOWN_MS;

  return finish(state, true, input.blindfolded, {
    kind: 'search',
    found,
  });
}
