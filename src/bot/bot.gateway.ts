import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Once,
  InjectDiscordClient,
  On,
  DiscordCommandProvider,
} from '@discord-nestjs/core';
import {
  ApplicationCommandData,
  ApplicationIntegrationType,
  Client,
  Guild,
  GuildMember,
  InteractionContextType,
  Message,
  TextChannel,
  Webhook,
} from 'discord.js';
import { BondageService } from 'src/bondage/bondage.service';
import { HOME_GUILD_ID, isHomeGuild } from 'src/helper/home-guild';

@Injectable()
export class BotGateway implements OnModuleInit {
  private readonly logger = new Logger(BotGateway.name);
  private readonly webhookCache = new Map<string, Webhook>();

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private bondageService: BondageService,
    private discordCommandProvider: DiscordCommandProvider,
  ) {}

  onModuleInit(): void {
    this.restrictCommandPayloadsToGuild();
  }

  @Once('ready')
  async onReady() {
    this.logger.log(`Bot ${this.client.user?.tag} was started!`);
    this.restrictCommandPayloadsToGuild();
    await this.restrictToHomeGuild();
    void this.normalizeSlashCommandsAfterRegister().catch((error) => {
      this.logger.error(
        'Failed to normalize slash commands',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  @On('guildCreate')
  async onGuildCreate(guild: Guild): Promise<void> {
    await this.leaveIfForeignGuild(guild);
  }

  @On('messageCreate')
  async onMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!isHomeGuild(message.guildId)) return;
    if (message.channel.id === '1409564314934841394') {
      if (isAccountTooNew(message.author.createdTimestamp)) {
        await message.reply(
          'Only discord account that are 30 days old are allowed!',
        );
      } else if (
        !(
          (message.content?.includes('name') ?? false) ||
          (message.content?.includes('Name') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the name!\n*-# -- Please copy & post the entire template again in the same format to verify --*',
        );
      } else if (
        !(
          (message.content?.includes('age') ?? false) ||
          (message.content?.includes('Age') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the age!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (ageValidator(message.content)) {
        await message.reply(
          'Entered Age is not valid!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (
        !(
          (message.content?.includes('gender') ?? false) ||
          (message.content?.includes('Gender') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the gender!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (
        !(
          (message.content?.includes('kinks') ?? false) ||
          (message.content?.includes('Kinks') ?? false) ||
          (message.content?.includes('kink') ?? false) ||
          (message.content?.includes('Kink') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the kinks!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (
        !(
          (message.content?.includes('limits') ?? false) ||
          (message.content?.includes('Limits') ?? false) ||
          (message.content?.includes('limit') ?? false) ||
          (message.content?.includes('Limit') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the limits!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (message.author.avatar === null) {
        await message.reply(
          "It seems you don't have a discord profile picture!\n*-# -- Please add a profile picture, and then, copy & post the entire template again in the same format to verify  --*",
        );
      } else if (
        !(
          (message.content?.includes('secret code') ?? false) ||
          (message.content?.includes('secret Code') ?? false) ||
          (message.content?.includes('Secret Code') ?? false) ||
          (message.content?.includes('Secret code') ?? false) ||
          (message.content?.includes('secretcode') ?? false) ||
          (message.content?.includes('secretCode') ?? false) ||
          (message.content?.includes('SecretCode') ?? false) ||
          (message.content?.includes('Secretcode') ?? false) ||
          (message.content?.toLocaleLowerCase().includes('secret') ?? false) ||
          (message.content?.toLocaleLowerCase().includes('code') ?? false)
        )
      ) {
        await message.reply(
          'You are missing to mention the secret code!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (secretCodeValidator(message.content)) {
        await message.reply(
          'Your secret code is not valid. Please check the rules again to find the secret code!\n-# *-- There are 2 words hidden somewhere in the rules --*\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (
        !(
          message.member?.roles.cache?.has('1409579304303726592') ||
          message.member?.roles.cache?.has('1409579306514124800') ||
          message.member?.roles.cache?.has('1409579307600445471')
        )
      ) {
        await message.reply(
          'Have you grabbed Roles? It seems you are missing roles... \n*-# -- Grab the roles you missed to grab, and please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (bondageImageValidator(message)) {
        await message.reply(
          'You are missing to add your favourite bondage image!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (
        !(
          message.content.toLocaleLowerCase().includes('important') ||
          message.content.toLocaleLowerCase().includes('role') ||
          message.content.toLocaleLowerCase().includes('word')
        )
      ) {
        await message.reply(
          'You are missing to add the important rule!\n*-# -- Please copy & post the entire template again in the same format to verify  --*',
        );
      } else if (importantRuleValidator(message)) {
        await message.reply(
          'The important rule might be wrong or missing important details!\n*-# -- Please use the exact terms. Copy & post the entire template again in the same format to verify  --*',
        );
      } else {
        await message.react('✅');
        await message.member?.roles.add('1409579308934234195');
      }
    } else {
      const cageChannel = await this.bondageService.isCageChannel(
        message.channel.id,
      );
      if (message.content.toLocaleLowerCase() === cageChannel?.safeword) {
        await this.bondageService.handleSafeword(
          message.author.id,
          cageChannel.channelId,
          message.member ?? undefined,
        );
      }
      if (
        ((cageChannel?.gag ?? false) || (cageChannel?.blindfold ?? false)) &&
        message.channel instanceof TextChannel
      ) {
        const channel = message.channel;

        if (
          (cageChannel?.gag ?? false) &&
          cageChannel?.userId === message.author.id
        ) {
          const garbledText = garbleText(message);
          const webhook = await this.getOrCreateWebhook(
            channel,
            message.member?.displayName || message.author.username,
            message.author.displayAvatarURL(),
          );

          await Promise.all([
            message.delete().catch(() => null),
            webhook.send({ content: garbledText }),
          ]);
          return;
        } else if (
          (cageChannel?.blindfold ?? false) &&
          cageChannel?.userId !== message.author.id
        ) {
          const member = message.member;
          if (!member) {
            await message.delete().catch(() => null);
            return;
          }

          const webhook = await this.getOrCreateWebhook(
            channel,
            getPersonaName(member),
            getPersonaAvatar(member),
          );

          await Promise.all([
            message.delete().catch(() => null),
            webhook.send({ content: message.content }),
          ]);
          return;
        }

        await message.delete().catch(() => null);
      }
    }
  }

  private async restrictToHomeGuild(): Promise<void> {
    await this.lockApplicationToHomeGuild();
    await this.clearGlobalCommands();
    await this.leaveForeignGuilds();
  }

  private restrictCommandPayloadsToGuild(): void {
    for (const entry of this.discordCommandProvider.getAllCommands().values()) {
      entry.commandData.integrationTypes = [
        ApplicationIntegrationType.GuildInstall,
      ];
      entry.commandData.contexts = [InteractionContextType.Guild];
      entry.commandData.dmPermission = false;
    }
  }

  private async normalizeSlashCommandsAfterRegister(): Promise<void> {
    const timeoutMs = 15_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await sleep(1_500);
      const guild = this.client.guilds.cache.get(HOME_GUILD_ID);
      if (!guild) continue;

      const commands = await guild.commands.fetch();
      if (commands.size === 0) continue;

      this.restrictCommandPayloadsToGuild();
      await this.rewriteHomeGuildCommands();
      await sleep(2_500);
      await this.rewriteHomeGuildCommands();
      return;
    }

    this.logger.warn(
      'Timed out waiting for slash commands to register before normalizing',
    );
    await this.rewriteHomeGuildCommands();
  }

  private async rewriteHomeGuildCommands(): Promise<void> {
    try {
      await this.clearGlobalCommands();

      const guild =
        this.client.guilds.cache.get(HOME_GUILD_ID) ??
        (await this.client.guilds.fetch(HOME_GUILD_ID));
      const existing = await guild.commands.fetch();
      const unique = new Map<string, ApplicationCommandData>();

      for (const command of existing.values()) {
        if (unique.has(command.name)) continue;

        unique.set(command.name, {
          name: command.name,
          description: command.description,
          type: command.type,
          options: [...command.options],
          defaultMemberPermissions: command.defaultMemberPermissions,
          dmPermission: false,
          integrationTypes: [ApplicationIntegrationType.GuildInstall],
          contexts: [InteractionContextType.Guild],
        } as ApplicationCommandData);
      }

      const payload = [...unique.values()];
      if (payload.length === 0) {
        this.logger.warn('No home-guild slash commands found to rewrite');
        return;
      }

      await guild.commands.set(payload);
      this.logger.log(
        `Normalized ${payload.length} home-guild slash command(s); removed duplicates`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to rewrite home-guild slash commands',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async lockApplicationToHomeGuild(): Promise<void> {
    try {
      const application = await this.client.application?.fetch();

      if (!application) {
        this.logger.error('Could not fetch the Discord application');
        return;
      }

      this.logger.log(
        `Install counts before lockdown: ${application.approximateGuildCount ?? '?'} servers, ${application.approximateUserInstallCount ?? '?'} individual users`,
      );

      const guildInstall =
        application.integrationTypesConfig?.[
          ApplicationIntegrationType.GuildInstall
        ];
      const oauth2 = guildInstall?.oauth2InstallParams;
      const scopes = oauth2?.scopes?.length
        ? [...oauth2.scopes]
        : ['bot', 'applications.commands'];
      const permissions = oauth2?.permissions?.bitfield.toString() ?? '0';

      const guildInstallConfig = {
        [ApplicationIntegrationType.GuildInstall]: {
          oauth2_install_params: {
            scopes,
            permissions,
          },
        },
      };

      try {
        await this.client.rest.patch('/applications/@me', {
          body: {
            bot_public: false,
            integration_types_config: {
              ...guildInstallConfig,
              [ApplicationIntegrationType.UserInstall]: null,
            },
          },
        });
      } catch {
        await this.client.rest.patch('/applications/@me', {
          body: {
            bot_public: false,
            integration_types_config: guildInstallConfig,
          },
        });
      }

      this.logger.log(
        'Disabled user installs and public bot invites; only the home guild install remains enabled',
      );
    } catch (error) {
      this.logger.error(
        'Failed to lock application to the home guild',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async clearGlobalCommands(): Promise<void> {
    try {
      const application = this.client.application;

      if (!application) {
        this.logger.error('Could not fetch the Discord application');
        return;
      }

      const existing = await application.commands.fetch();
      if (existing.size > 0) {
        this.logger.log(
          `Clearing ${existing.size} global slash command(s): ${[...existing.values()].map((command) => command.name).join(', ')}`,
        );
      }

      await application.commands.set([]);
      this.logger.log(
        'Cleared global slash commands so they only exist in the home server',
      );
    } catch (error) {
      this.logger.error(
        'Failed to clear global slash commands',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async leaveForeignGuilds(): Promise<void> {
    try {
      await this.client.guilds.fetch();
    } catch (error) {
      this.logger.error(
        'Failed to fetch guild list',
        error instanceof Error ? error.stack : String(error),
      );
    }

    const guilds = [...this.client.guilds.cache.values()];
    this.logger.log(
      `Connected to ${guilds.length} server(s): ${guilds
        .map((guild) => `${guild.name} (${guild.id})`)
        .join(', ')}`,
    );

    for (const guild of guilds) {
      await this.leaveIfForeignGuild(guild);
    }

    const remaining = [...this.client.guilds.cache.values()];
    this.logger.log(
      `Remaining after leave: ${remaining.length} server(s): ${
        remaining.map((guild) => `${guild.name} (${guild.id})`).join(', ') ||
        'none'
      }`,
    );

    if (!this.client.guilds.cache.has(HOME_GUILD_ID)) {
      this.logger.error(
        `Home guild ${HOME_GUILD_ID} is not in the remaining server list`,
      );
    }
  }

  private async leaveIfForeignGuild(guild: Guild): Promise<void> {
    if (isHomeGuild(guild.id)) {
      return;
    }

    this.logger.warn(
      `Leaving unauthorized guild ${guild.name} (${guild.id}); this bot is restricted to ${HOME_GUILD_ID}`,
    );

    try {
      await guild.leave();
    } catch (error) {
      this.logger.error(
        `Failed to leave guild ${guild.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getOrCreateWebhook(
    channel: TextChannel,
    name: string,
    avatarUrl: string,
  ): Promise<Webhook> {
    const cacheKey = `${channel.id}:${name}`;
    const cached = this.webhookCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const webhook = await channel.createWebhook({ name, avatar: avatarUrl });
    this.webhookCache.set(cacheKey, webhook);
    return webhook;
  }
}

const PERSONA_AVATARS: Record<string, Record<string, string>> = {
  dominant: {
    male: 'https://i.pinimg.com/736x/62/3c/01/623c01462eb3f1a73fe8f5ba351ee0bd.jpg',
    female:
      'https://i.pinimg.com/1200x/bb/73/9e/bb739edbcb37cca64c6192f47087456d.jpg',
  },
  submissive: {
    male: 'https://i.pinimg.com/1200x/4c/e7/8a/4ce78ab700b0f8666f9800225dd851fe.jpg',
    female:
      'https://i.pinimg.com/736x/18/9e/cb/189ecb874785c12bf08082ee1ac02635.jpg',
  },
  switch: {
    male: 'https://i.pinimg.com/736x/b8/50/13/b850130b5c04fcce0c29aeb54481812d.jpg',
    female:
      'https://i.pinimg.com/736x/cb/0a/29/cb0a298f5910d76db400832f997b50f1.jpg',
  },
};

function getPersonaRoles(member: GuildMember): {
  power: string;
  identity: string;
} {
  const roles = member.roles.cache.map((r) => r.name.toLowerCase());

  const powerRoles = ['dominant', 'submissive', 'switch'];
  const identityRoles = ['male', 'female', 'other'];

  const power = powerRoles.find((r) => roles.includes(r));
  const identity = identityRoles.find((r) => roles.includes(r));

  return {
    power: power ?? 'mysterious',
    identity: identity ?? 'being',
  };
}

function getPersonaName(member: GuildMember): string {
  const { power, identity } = getPersonaRoles(member);
  return `A ${power} ${identity}`;
}

function getPersonaAvatar(member: GuildMember): string {
  const { power, identity } = getPersonaRoles(member);
  return PERSONA_AVATARS[power]?.[identity] ?? member.displayAvatarURL();
}

function garbleText(message: Message) {
  const text = message.content;
  const trimmed = text.trim();

  // Do not garble roleplay actions formatted as Discord italics (*action* or _action_).
  // These represent actions/descriptions rather than spoken words affected by a gag.
  const isItalicAction =
    trimmed.length > 2 &&
    ((trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed[1] !== '*') ||
      (trimmed.startsWith('_') && trimmed.endsWith('_') && trimmed[1] !== '_'));

  if (isItalicAction) {
    return text;
  }

  const vowels = 'aeiou';
  const muffledSounds = ['m', 'n', 'ng', 'mm', 'nn'];

  return `${text
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      if (!/[a-z]/i.test(char)) return char;
      if (vowels.includes(lower)) {
        return muffledSounds[Math.floor(Math.random() * muffledSounds.length)];
      }
      return Math.random() > 0.9 ? 'm' : char;
    })
    .join('')}\n\n||*${message.content}*||`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MIN_ACCOUNT_AGE_DAYS = 30;
const MIN_ACCOUNT_AGE_MS = MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;

function isAccountTooNew(createdTimestamp: number): boolean {
  return Date.now() - createdTimestamp < MIN_ACCOUNT_AGE_MS;
}

function ageValidator(content: string) {
  if (content.length === 0) return true;
  const ageMatch = content.match(/age\s*:?\s*[^0-9]*(\d+)/i);
  if (ageMatch != null) {
    const age = ageMatch[1];
    if (parseInt(age) >= 18 && parseInt(age) < 100) return false;
    return true;
  } else {
    return true;
  }
}

function secretCodeValidator(content: string) {
  if (content.length === 0) return true;
  const codeMatch = content.match(
    /\b(?:secret\s*)?(?:code|word|words)\s*:?\s*[^a-zA-Z]*([^\n\r]+)/i,
  );
  if (codeMatch != null) {
    const code = codeMatch[1].trim().toLowerCase().split('*')[0];
    return !(
      code.includes('ball gag') ||
      code.includes('ballgag') ||
      (code.includes('ball') && code.includes('gag'))
    );
  }
  return true;
}

function bondageImageValidator(message: Message<boolean>) {
  const content = message.content?.toLowerCase() || '';
  const hasKeyword =
    content.includes('favourite') ||
    content.includes('favorite') ||
    content.includes('image') ||
    content.includes('fav');
  const hasLink = /(https?:\/\/[^\s]+)/g.test(content);
  const hasAttachments = message.attachments.size > 0;
  return !(hasKeyword || hasLink || hasAttachments);
}

function importantRuleValidator(message: Message<boolean>) {
  const content = message.content?.toLowerCase() || '';
  return !(
    content.includes('dm') &&
    content.includes('server') &&
    content.includes('role') &&
    content.includes('ask')
  );
}
