import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Client, Guild, GuildMember } from 'discord.js';
import { InjectDiscordClient } from '@discord-nestjs/core';

type RoleGroup = {
  name: string;
  sourceRoleIds: string[];
  separatorRoleId: string;
};

@Injectable()
export class RoleSeparatorService {
  private readonly logger = new Logger(RoleSeparatorService.name);

  private readonly channelId = '1409564314934841394';
  private readonly delayMs = 500;
  private readonly findomFlagRoleId = '1549478142656127086';
  private readonly findomNameTokens = new Set([
    'mistress',
    'goddess',
    'dominatrix',
    'mommy',
    'miss',
  ]);

  private readonly roleGroups: RoleGroup[] = [
    {
      name: 'general roles',
      separatorRoleId: '1518493372346798090',
      sourceRoleIds: [
        '1454009334777380997',
        '1409709988259037346',
        '1409709968453795890',
        '1409709996995772528',
        '1409709975386849371',
        '1409709980516483092',
        '1409709983289053294',
        '1409709985847578696',
        '1517823193719767040',
        '1409709990809178202',
        '1409709993984266335',
        '1515867421594882108',
        '1409579308934234195',
        '1409579227996749910',
        '1409579181062225960',
        '1409687324216004708',
        '1409579304303726592',
        '1409579306514124800',
        '1409579307600445471',
        '1409579629081264159',
        '1409579660194480260',
        '1409579764770930729',
        '1409579685826003076',
        '1409579792231039079',
        '1409579819741483078',
        '1409580034502692894',
        '1409580069722263693',
        '1409580109836587049',
        '1409580368159445093',
        '1409580427181559980',
        '1409580518974160920',
        '1425784879072677959',
        '1425784890246430834',
        '1425784895157829712',
        '1494574384860631182',
        '1494574558903275670',
        '1494574698841903155',
        '1443571716440981618',
        '1443571756152393781',
        '1443572044808585299',
        '1443572126115430492',
        '1443572150664429619',
        '1454736274744283138',
        '1454736496325296159',
        '1446633215333892096',
      ],
    },
    {
      name: 'gambling roles',
      separatorRoleId: '1518493689809342585',
      sourceRoleIds: [
        '1451222172537454804',
        '1458179526826655990',
        '1458177547048321098',
        '1452014804335067348',
        '1451975847878856849',
        '1451222288845508761',
        '1448449076541526049',
        '1448442822066831530',
        '1447208522679849030',
        '1443928319669178541',
        '1443927875739717743',
        '1443927433173536810',
        '1443926935234416660',
        '1443926337738903635',
        '1451977158045204583',
        '1443925568017141850',
      ],
    },
    {
      name: 'server-access roles',
      separatorRoleId: '1518493550000472094',
      sourceRoleIds: [
        '1448394399271751722',
        '1448394726846890075',
        '1448394816613257328',
        '1448394970296746065',
        '1492273863537463509',
        '1448395043349200927',
        '1448395124353536051',
        '1500220457843032214',
        '1468741055758336091',
        '1497994703050903735',
      ],
    },
    {
      name: 'engagement roles',
      separatorRoleId: '1518493737192259625',
      sourceRoleIds: [
        '1502072250222776422',
        '1502072527571255506',
        '1502072768475435173',
        '1502072940953473075',
        '1502073080212619315',
      ],
    },
  ];

  constructor(@InjectDiscordClient() private readonly client: Client) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleRoleSeparation(): Promise<void> {
    this.logger.log('Starting scheduled role separator sync...');

    try {
      const guild = await this.fetchGuild();

      if (!guild) {
        return;
      }

      await guild.members.fetch();

      let updated = 0;
      let flagged = 0;

      for (const member of guild.members.cache.values()) {
        if (member.user.bot) {
          continue;
        }

        if (this.hasFindomName(member)) {
          const restricted = await this.restrictToFindomRole(member);

          if (restricted) {
            flagged++;
          }

          await this.delay(this.delayMs);
          continue;
        }

        const isRelevant = this.roleGroups.some(
          (group) =>
            this.hasAnySourceRole(member, group) ||
            member.roles.cache.has(group.separatorRoleId),
        );

        if (!isRelevant) {
          continue;
        }

        const changed = await this.syncMemberRoles(member);

        if (changed) {
          updated++;
        }

        await this.delay(this.delayMs);
      }

      this.logger.log(
        `Role separator sync completed successfully. Updated ${updated} members. Flagged ${flagged} suspected findom accounts.`,
      );
    } catch (error) {
      this.logger.error(
        'Role separator sync failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async fetchGuild(): Promise<Guild | null> {
    const channel = await this.client.channels.fetch(this.channelId);

    if (!channel || !('guild' in channel) || !channel.guild) {
      this.logger.error(
        `Channel ${this.channelId} not found or is not in a guild`,
      );

      return null;
    }

    return channel.guild;
  }

  private hasAnySourceRole(member: GuildMember, group: RoleGroup): boolean {
    return group.sourceRoleIds.some((roleId) => member.roles.cache.has(roleId));
  }

  private hasFindomName(member: GuildMember): boolean {
    return [
      member.user.username,
      member.user.globalName,
      member.nickname,
      member.displayName,
    ].some((name) => this.nameHasFindomToken(name));
  }

  private nameHasFindomToken(name?: string | null): boolean {
    if (!name) {
      return false;
    }

    const tokens = name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean);

    return tokens.some((token) => {
      if (this.findomNameTokens.has(token)) {
        return true;
      }

      // "Miss" is too common as a prefix (mission, mississippi), so only exact.
      return ['mistress', 'goddess', 'dominatrix', 'mommy'].some((keyword) =>
        token.startsWith(keyword),
      );
    });
  }

  private async restrictToFindomRole(member: GuildMember): Promise<boolean> {
    if (!member.manageable) {
      this.logger.warn(
        `Cannot restrict ${member.user.tag} (${member.id}); member is not manageable`,
      );
      return false;
    }

    const extraRoles = member.roles.cache.filter(
      (role) =>
        role.id !== member.guild.id && role.id !== this.findomFlagRoleId,
    );
    const alreadyRestricted =
      extraRoles.size === 0 && member.roles.cache.has(this.findomFlagRoleId);

    if (alreadyRestricted) {
      return false;
    }

    this.logger.warn(
      `Restricting suspected findom account ${member.user.tag} (${member.id}) to role ${this.findomFlagRoleId}`,
    );

    try {
      await member.roles.set(
        [this.findomFlagRoleId],
        'Suspected findom scam account',
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `roles.set failed for ${member.user.tag}, falling back to per-role update: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    let changed = false;

    if (!member.roles.cache.has(this.findomFlagRoleId)) {
      try {
        await member.roles.add(
          this.findomFlagRoleId,
          'Suspected findom scam account',
        );
        changed = true;
      } catch (error) {
        this.logger.warn(
          `Failed to add findom flag role to ${member.user.tag}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    for (const role of extraRoles.values()) {
      try {
        await member.roles.remove(role, 'Suspected findom scam account');
        changed = true;
      } catch (error) {
        this.logger.warn(
          `Failed to remove role ${role.name} (${role.id}) from ${member.user.tag}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return changed;
  }

  private async syncMemberRoles(member: GuildMember): Promise<boolean> {
    let changed = false;

    for (const group of this.roleGroups) {
      const hasSourceRole = this.hasAnySourceRole(member, group);
      const hasSeparatorRole = member.roles.cache.has(group.separatorRoleId);

      try {
        if (hasSourceRole && !hasSeparatorRole) {
          await member.roles.add(group.separatorRoleId);
          changed = true;
        } else if (!hasSourceRole && hasSeparatorRole) {
          await member.roles.remove(group.separatorRoleId);
          changed = true;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to sync "${group.name}" separator for ${member.user.tag}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return changed;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
