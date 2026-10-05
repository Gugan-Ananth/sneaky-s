import { Command, Handler, InteractionEvent, On } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  StringSelectMenuInteraction,
} from 'discord.js';
import type { Interaction } from 'discord.js';
import { rejectForeignGuild, isHomeGuild } from 'src/helper/home-guild';
import { ActiveSession } from './active-session.entity';
import { BondageService } from './bondage.service';
import { describeFailure, describePublic } from './escape-flavor';
import {
  EscapeAction,
  EscapeResult,
  EscapeSuccess,
  isBoardClear,
  isEscapeAction,
} from './escape-rules';
import { renderEscapeView } from './escape-ui';

type MenuInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction;

type ParsedEscapeId =
  | { type: 'pick'; captiveId: string }
  | { type: 'act'; captiveId: string; restraintId: string; action: string };

function parseCustomId(customId: string): ParsedEscapeId | null {
  if (customId.startsWith('esc-pick:')) {
    const captiveId = customId.slice('esc-pick:'.length);
    if (!captiveId || captiveId.includes(':')) return null;
    return { type: 'pick', captiveId };
  }

  const [prefix, captiveId, restraintId, action] = customId.split(':');
  if (prefix !== 'esc' || !captiveId || !restraintId || !action) return null;
  return { type: 'act', captiveId, restraintId, action };
}

function displayName(interaction: MenuInteraction): string {
  const member = interaction.member;
  if (
    member &&
    typeof member === 'object' &&
    'displayName' in member &&
    typeof member.displayName === 'string'
  ) {
    return member.displayName;
  }
  return interaction.user.displayName ?? interaction.user.username;
}

function captiveMember(
  interaction: MenuInteraction,
  captiveId: string,
): GuildMember | undefined {
  if (interaction.user.id !== captiveId) return undefined;
  const member = interaction.member;
  if (member && 'guild' in member) return member;
  return undefined;
}

@Command({
  name: 'escape',
  description:
    'Struggle out of your restraints, or help the person in this cage',
})
@Injectable()
export class EscapeCommand {
  private readonly logger = new Logger(EscapeCommand.name);

  constructor(private readonly bondageService: BondageService) {}

  @Handler()
  async onEscape(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) return;

    await interaction.deferReply({ ephemeral: true });
    try {
      if (!interaction.channelId) {
        await interaction.editReply({
          content: 'You can only do this inside a cage.',
        });
        return;
      }

      const session = await this.bondageService.isCageChannel(
        interaction.channelId,
      );
      if (!session || session.status !== 'active' || !session.userId) {
        await interaction.editReply({
          content: 'You can only do this inside a cage.',
        });
        return;
      }

      await this.openMenu(interaction, session);
    } catch (error) {
      this.logger.error(
        'Escape command failed',
        error instanceof Error ? error.stack : String(error),
      );
      await interaction
        .editReply({ content: 'That struggle got tangled. Try again.' })
        .catch(() => null);
    }
  }

  @On('interactionCreate')
  async onComponent(interaction: Interaction): Promise<void> {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;
    if (!isHomeGuild(interaction.guildId)) return;

    try {
      await interaction.deferUpdate();
      const session = await this.bondageService.getActiveSession(
        parsed.captiveId,
      );
      if (
        !session?.userId ||
        !session.channelId ||
        session.channelId !== interaction.channelId
      ) {
        await interaction.editReply({
          content: 'That cage is already open.',
          components: [],
        });
        return;
      }

      if (!session.escapeState) {
        await interaction.editReply({
          content: 'This tie has no recorded restraints. Letting you go.',
          components: [],
        });
        await this.bondageService.endSession(
          session,
          captiveMember(interaction, session.userId),
        );
        return;
      }

      if (parsed.type === 'pick') {
        if (interaction.isStringSelectMenu()) {
          await this.showState(interaction, session, interaction.values[0]);
        }
        return;
      }

      if (parsed.restraintId === 'room' && parsed.action === 'search') {
        await this.play(interaction, session, { type: 'search' });
        return;
      }

      if (!isEscapeAction(parsed.action)) {
        await interaction.editReply({
          content: 'That is not one of the ways out.',
          components: [],
        });
        return;
      }

      await this.play(interaction, session, {
        type: 'action',
        restraintId: parsed.restraintId,
        action: parsed.action,
      });
    } catch (error) {
      this.logger.error(
        'Escape button failed',
        error instanceof Error ? error.stack : String(error),
      );
      await interaction
        .editReply({
          content: 'That struggle got tangled. Try `/escape` again.',
          components: [],
        })
        .catch(() => null);
    }
  }

  private async openMenu(
    interaction: MenuInteraction,
    session: ActiveSession,
  ): Promise<void> {
    if (!session.escapeState || !session.userId) {
      await interaction.editReply({
        content: 'This tie has no recorded restraints. Letting you go.',
        components: [],
      });
      await this.bondageService.endSession(
        session,
        captiveMember(interaction, session.userId ?? ''),
      );
      return;
    }

    if (isBoardClear(session.escapeState)) {
      await this.finishFree(interaction, session);
      return;
    }

    await this.showState(interaction, session);
  }

  private async play(
    interaction: MenuInteraction,
    session: ActiveSession,
    request:
      | { type: 'search' }
      | { type: 'action'; restraintId: string; action: EscapeAction },
  ): Promise<void> {
    if (!session.userId) return;
    const result = await this.bondageService.performEscape(
      session.userId,
      interaction.user.id,
      request,
    );
    await this.present(interaction, session, result);
  }

  private async present(
    interaction: MenuInteraction,
    session: ActiveSession,
    result: EscapeResult,
  ): Promise<void> {
    if (!session.userId) return;

    if (!result.ok) {
      if (!result.state || isBoardClear(result.state)) {
        if (result.state && isBoardClear(result.state)) {
          await this.finishFree(interaction, session);
          return;
        }
        await interaction.editReply({
          content: 'That cage is already open.',
          components: [],
        });
        return;
      }

      await this.replyMenu(
        interaction,
        result.state,
        session.userId,
        describeFailure(result),
      );
      return;
    }

    const line = this.publicLine(interaction, result);
    await this.bondageService.updateRestraintBoard(session.userId);
    if (session.channelId) {
      await this.bondageService.announce(session.channelId, line);
    }

    if (result.allFree) {
      await this.finishFree(interaction, session);
      return;
    }

    const focusId =
      result.kind === 'action' && result.effect !== 'free'
        ? result.restraint.id
        : undefined;
    await this.replyMenu(
      interaction,
      result.state,
      session.userId,
      line,
      focusId,
    );
  }

  private publicLine(
    interaction: MenuInteraction,
    result: EscapeSuccess,
  ): string {
    const actorName =
      result.actorIsHelper && !result.hideActor
        ? displayName(interaction)
        : null;
    const line = describePublic(result, actorName);
    if (!result.allFree) return line;
    return `${line} Nothing is holding you anymore.`;
  }

  private async showState(
    interaction: MenuInteraction,
    session: ActiveSession,
    focusId?: string,
  ): Promise<void> {
    if (!session.escapeState || !session.userId) return;
    await this.replyMenu(
      interaction,
      session.escapeState,
      session.userId,
      undefined,
      focusId,
    );
  }

  private async replyMenu(
    interaction: MenuInteraction,
    state: NonNullable<ActiveSession['escapeState']>,
    captiveId: string,
    notice?: string,
    focusId?: string,
  ): Promise<void> {
    const view = renderEscapeView({
      state,
      captiveId,
      actorId: interaction.user.id,
      isHelper: interaction.user.id !== captiveId,
      now: Date.now(),
      notice,
      focusId,
    });
    await interaction.editReply({
      content: view.content,
      components: view.components,
      allowedMentions: { parse: [] },
    });
  }

  private async finishFree(
    interaction: MenuInteraction,
    session: ActiveSession,
  ): Promise<void> {
    const captive = interaction.user.id === session.userId;
    await interaction.editReply({
      content: captive
        ? 'The last restraint gives. You are free.'
        : 'That was the last restraint. They are free.',
      components: [],
    });
    await this.bondageService.endSession(
      session,
      captiveMember(interaction, session.userId ?? ''),
    );
  }
}
