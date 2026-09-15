import { Injectable } from '@nestjs/common';
import {
  DiscordModuleOption,
  DiscordOptionsFactory,
} from '@discord-nestjs/core';
import { GatewayIntentBits } from 'discord.js';
import { Subject } from 'rxjs';
import { HOME_GUILD_ID } from './home-guild';

@Injectable()
export class DiscordConfigService implements DiscordOptionsFactory {
  createDiscordOptions(): DiscordModuleOption {
    return {
      token: process.env.DISCORD_TOKEN || '',
      discordClientOptions: {
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers,
        ],
      },
      registerCommandOptions: [
        {
          forGuild: HOME_GUILD_ID,
          // discord-nestjs also hooks `ready` and would race our lockdown,
          // registering leftover global copies. A trigger that never emits
          // disables that so BotGateway registers the guild set once.
          trigger: () => new Subject(),
        },
      ],
    };
  }
}
