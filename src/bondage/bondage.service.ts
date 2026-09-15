import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActiveSession } from './active-session.entity';
import { Repository } from 'typeorm';
import { UserSettings } from 'src/user/user-settings.entity';
import { scenarios } from './scenarios';
import { Client, DiscordAPIError, Guild, GuildMember } from 'discord.js';
import { BondageScenario } from './bondage-scenarios';
import { InjectDiscordClient } from '@discord-nestjs/core';

const CAGE_ROLE_ID = '1497994703050903735';

type StartSessionOptions = {
  bondageDescription?: string;
  gag?: boolean;
  blindfold?: boolean;
};

@Injectable()
export class BondageService {
  private readonly logger = new Logger(BondageService.name);

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
    options: StartSessionOptions = {},
  ) {
    let settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      settings = this.userSettingsRepository.create({
        userId,
        defaultDuration: 30,
        safeword: 'red',
      });
      await this.userSettingsRepository.save(settings);
    }
    const scenarioDescription = this.getRandomScenario();
    const originalRoles = member.roles.cache.map((role) => role.id);
    const session = this.activeSessionRepository.create({
      userId,
      guildId,
      channelId,
      originalRoles,
      startTime: new Date(),
      endTime: new Date(
        Date.now() + (settings?.defaultDuration ?? 30) * 60 * 1000,
      ),
      bondageDescription:
        options.bondageDescription ?? `${scenarioDescription.bondage}`,
      gagDescription: `${scenarioDescription.gag}`,
      blindfoldDescription: `${scenarioDescription.blindfold}`,
      gag: options.gag ?? false,
      blindfold: options.blindfold ?? false,
      duration: settings.defaultDuration ?? 30,
      safeword: settings.safeword ?? 'red',
      status: 'active',
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

  private getRandomScenario(): BondageScenario {
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }
}
