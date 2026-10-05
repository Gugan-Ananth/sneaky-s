import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActiveSession } from './active-session.entity';
import { Repository } from 'typeorm';
import { UserSettings } from 'src/user/user-settings.entity';
import { scenarios } from './scenarios';
import {
  Client,
  DiscordAPIError,
  Guild,
  GuildMember,
  OverwriteType,
  TextBasedChannel,
} from 'discord.js';
import { BondageScenario } from './bondage-scenarios';
import { InjectDiscordClient } from '@discord-nestjs/core';
import { formatUserMentions, isPrivateCageChannel } from './cage-permissions';
import {
  createRestraintBoardEmbed,
  ESCAPE_HINT,
} from 'src/helper/embed-builder';
import {
  applyEscapeAction,
  EscapeAction,
  EscapeResult,
  EscapeState,
  searchRoom,
} from './escape-rules';

const CAGE_ROLE_ID = '1497994703050903735';

type StartSessionOptions = {
  bondageDescription?: string;
  gagDescription?: string;
  blindfoldDescription?: string;
  gag?: boolean;
  blindfold?: boolean;
  escapeState: EscapeState;
};

@Injectable()
export class BondageService {
  private readonly logger = new Logger(BondageService.name);
  private readonly escapeQueues = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(ActiveSession)
    private readonly activeSessionRepository: Repository<ActiveSession>,
    @InjectRepository(UserSettings)
    private userSettingsRepository: Repository<UserSettings>,
    @InjectDiscordClient()
    private readonly client: Client,
  ) {}

  async startSession(
    userId: string,
    guildId: string,
    channelId: string,
    member: GuildMember,
    options: StartSessionOptions,
  ) {
    let settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.userSettingsRepository.create({
        userId,
        safeword: 'red',
      });
      await this.userSettingsRepository.save(settings);
    }
    const needsFallback =
      options.bondageDescription === undefined ||
      options.gagDescription === undefined ||
      options.blindfoldDescription === undefined;
    const fallback = needsFallback ? this.rollScenario() : undefined;
    const originalRoles = member.roles.cache.map((role) => role.id);
    const session = this.activeSessionRepository.create({
      userId,
      guildId,
      channelId,
      originalRoles,
      startTime: new Date(),
      endTime: null,
      bondageDescription: options.bondageDescription ?? fallback?.bondage ?? '',
      gagDescription: options.gagDescription ?? fallback?.gag ?? '',
      blindfoldDescription:
        options.blindfoldDescription ?? fallback?.blindfold ?? '',
      gag: options.gag ?? false,
      blindfold: options.blindfold ?? false,
      duration: null,
      safeword: settings.safeword ?? 'red',
      status: 'active',
      escapeState: options.escapeState,
    });

    return this.activeSessionRepository.save(session);
  }

  async isCageChannel(channelId: string): Promise<ActiveSession | null> {
    const session = await this.activeSessionRepository.findOne({
      where: { channelId },
    });
    if (!session) return null;
    return session;
  }

  async handleSafeword(
    userId: string,
    _channelId?: string,
    member?: GuildMember,
  ): Promise<void> {
    const session = await this.activeSessionRepository.findOne({
      where: { userId },
    });

    if (!session) throw new Error('Session / Channel not found');
    await this.endSession(session, member);
  }

  async endSession(
    session: ActiveSession,
    member?: GuildMember,
  ): Promise<void> {
    try {
      const resolvedMember = await this.resolveMember(session, member);
      if (resolvedMember) {
        await this.restoreRoles(resolvedMember, session.originalRoles);
      } else {
        this.logger.warn(
          `Skipping role restore for ${session.userId}; member is no longer in the guild`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Role restore failed for ${session.userId}: ${this.errorMessage(error)}`,
      );
    }

    if (session.channelId) {
      try {
        const channel = await this.client.channels.fetch(session.channelId);
        if (channel?.isTextBased() && !channel.isDMBased()) {
          await channel.delete('Session ended');
        }
      } catch (error) {
        if (!this.isUnknownResource(error)) {
          this.logger.warn(
            `Failed to delete cage channel ${session.channelId}: ${this.errorMessage(error)}`,
          );
        }
      }
    }

    if (session.userId) {
      await this.activeSessionRepository.delete({ userId: session.userId });
    }
  }

  private async resolveMember(
    session: ActiveSession,
    member?: GuildMember,
  ): Promise<GuildMember | null> {
    if (member) {
      return member;
    }

    if (!session.guildId || !session.userId) {
      return null;
    }

    let guild: Guild;
    try {
      guild = await this.client.guilds.fetch(session.guildId);
    } catch (error) {
      if (!this.isUnknownResource(error)) {
        this.logger.warn(
          `Failed to fetch guild ${session.guildId}: ${this.errorMessage(error)}`,
        );
      }
      return null;
    }

    try {
      return await guild.members.fetch(session.userId);
    } catch (error) {
      if (!this.isUnknownResource(error)) {
        this.logger.warn(
          `Failed to fetch member ${session.userId}: ${this.errorMessage(error)}`,
        );
      }
      return null;
    }
  }

  private async restoreRoles(
    member: GuildMember,
    roleIds?: string[],
  ): Promise<void> {
    await member.guild.roles.fetch().catch(() => null);

    for (const roleId of roleIds ?? []) {
      if (roleId === member.guild.id) continue;
      if (!member.guild.roles.cache.has(roleId)) {
        this.logger.warn(
          `Skipping unknown role ${roleId} while releasing ${member.id}`,
        );
        continue;
      }

      try {
        await member.roles.add(roleId);
      } catch (error) {
        this.logger.warn(
          `Could not restore role ${roleId} for ${member.id}: ${this.errorMessage(error)}`,
        );
      }
    }

    if (!member.roles.cache.has(CAGE_ROLE_ID)) {
      return;
    }

    try {
      await member.roles.remove(CAGE_ROLE_ID);
    } catch (error) {
      this.logger.warn(
        `Could not remove cage role from ${member.id}: ${this.errorMessage(error)}`,
      );
    }
  }

  private isUnknownResource(error: unknown): boolean {
    return (
      error instanceof DiscordAPIError &&
      (error.code === 10007 ||
        error.code === 10011 ||
        error.code === 10003 ||
        error.code === 10004)
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async getActiveSession(userId: string): Promise<ActiveSession | null> {
    return await this.activeSessionRepository.findOne({
      where: { userId, status: 'active' },
    });
  }

  async getFriendIds(userId: string): Promise<string[]> {
    const settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });
    return settings?.friendIds ?? [];
  }

  async syncCageFriendAccess(userId: string): Promise<boolean> {
    const session = await this.getActiveSession(userId);
    if (!session?.channelId) {
      return false;
    }

    try {
      const channel = await this.client.channels.fetch(session.channelId);
      if (
        !channel ||
        channel.isDMBased() ||
        !('permissionOverwrites' in channel) ||
        !isPrivateCageChannel(channel)
      ) {
        return false;
      }

      const friendIds = new Set(await this.getFriendIds(userId));
      const overwrites = channel.permissionOverwrites.cache;

      for (const overwrite of overwrites.values()) {
        if (overwrite.type !== OverwriteType.Member) {
          continue;
        }
        if (overwrite.id === userId || friendIds.has(overwrite.id)) {
          continue;
        }

        await channel.permissionOverwrites.delete(overwrite.id);
      }

      for (const friendId of friendIds) {
        if (friendId === userId) {
          continue;
        }

        await channel.permissionOverwrites.edit(friendId, {
          ViewChannel: true,
          SendMessages: true,
          UseApplicationCommands: true,
        });
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to sync cage friends for ${userId}: ${this.errorMessage(error)}`,
      );
      return false;
    }
  }

  async notifyCageVisitors(userId: string, friendIds: string[]): Promise<void> {
    if (friendIds.length === 0) {
      return;
    }

    const session = await this.getActiveSession(userId);
    if (!session?.channelId) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(session.channelId);
      if (
        !channel?.isTextBased() ||
        channel.isDMBased() ||
        !('permissionOverwrites' in channel) ||
        !isPrivateCageChannel(channel)
      ) {
        return;
      }

      await channel.send(
        `${formatUserMentions(friendIds)}\nYou can visit this private cage~`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to notify cage visitors for ${userId}: ${this.errorMessage(error)}`,
      );
    }
  }

  rollScenario(): BondageScenario {
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  async releaseSessionsWithoutEscape(): Promise<void> {
    const sessions = await this.activeSessionRepository.find({
      where: { status: 'active' },
    });

    for (const session of sessions) {
      if (session.escapeState) continue;
      this.logger.warn(
        `Releasing ${session.userId} from a session that has no escape`,
      );
      try {
        await this.endSession(session);
      } catch (error) {
        this.logger.error(
          `Failed to release legacy session ${session.userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  async performEscape(
    captiveId: string,
    actorId: string,
    request:
      | { type: 'action'; restraintId: string; action: EscapeAction }
      | { type: 'search' },
  ): Promise<EscapeResult> {
    return this.enqueue(captiveId, async () => {
      const session = await this.getActiveSession(captiveId);
      if (!session?.escapeState) {
        return { ok: false, reason: 'unreachable' };
      }

      const blindfolded = session.blindfold ?? false;
      const now = Date.now();
      const result =
        request.type === 'search'
          ? searchRoom(session.escapeState, {
              actorId,
              captiveId,
              blindfolded,
              now,
            })
          : applyEscapeAction(session.escapeState, {
              actorId,
              captiveId,
              restraintId: request.restraintId,
              action: request.action,
              blindfolded,
              now,
            });

      if (!result.ok) {
        return { ...result, state: session.escapeState };
      }

      session.escapeState = result.state;
      session.gag = result.gag;
      session.blindfold = result.blindfold;
      await this.activeSessionRepository.save(session);
      return result;
    });
  }

  async postRestraintBoard(
    channel: TextBasedChannel,
    session: ActiveSession,
  ): Promise<void> {
    if (!session.escapeState || channel.isDMBased()) return;

    const message = await channel.send({
      content: ESCAPE_HINT,
      embeds: [createRestraintBoardEmbed(session)],
    });
    session.escapeState = {
      ...session.escapeState,
      boardMessageId: message.id,
    };
    await this.activeSessionRepository.save(session);
  }

  async updateRestraintBoard(userId: string): Promise<void> {
    const session = await this.getActiveSession(userId);
    if (!session?.channelId || !session.escapeState) return;

    try {
      const channel = await this.client.channels.fetch(session.channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) return;

      const board = {
        content: ESCAPE_HINT,
        embeds: [createRestraintBoardEmbed(session)],
      };
      const boardId = session.escapeState.boardMessageId;
      if (boardId) {
        try {
          const message = await channel.messages.fetch(boardId);
          await message.edit(board);
          return;
        } catch (error) {
          this.logger.warn(
            `Restraint board ${boardId} could not be edited: ${this.errorMessage(error)}`,
          );
        }
      }

      const message = await channel.send(board);
      session.escapeState = {
        ...session.escapeState,
        boardMessageId: message.id,
      };
      await this.activeSessionRepository.save(session);
    } catch (error) {
      this.logger.warn(
        `Failed to update restraint board for ${userId}: ${this.errorMessage(error)}`,
      );
    }
  }

  async announce(channelId: string, content: string): Promise<void> {
    if (!content) return;

    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) return;
      await channel.send({
        content,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to announce in ${channelId}: ${this.errorMessage(error)}`,
      );
    }
  }

  private enqueue<T>(userId: string, job: () => Promise<T>): Promise<T> {
    const previous = this.escapeQueues.get(userId) ?? Promise.resolve();
    const run = previous.then(job, job);
    this.escapeQueues.set(
      userId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}
