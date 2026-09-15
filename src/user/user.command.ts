import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Injectable, PipeTransform, Type } from 'node_modules/@nestjs/common';
import { SettingsDto } from './dto/settings.dto';
import { ChatInputCommandInteraction } from 'discord.js';
import { createProfileEmbed } from 'src/helper/embed-builder';
import { rejectForeignGuild } from 'src/helper/home-guild';
import { UserService } from './user.service';

@Command({
  name: 'settings',
  description: 'Settings for your self-bondage',
})
@Injectable()
export class UserSettingsCommand {
  constructor(private userService: UserService) {}

  @Handler()
  async onSettings(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe as unknown as Type<PipeTransform>)
    options: SettingsDto,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply();
    try {
      const userId = interaction.user.id;
      const savedSettings = await this.userService.updateUserSettings(userId, {
        defaultDuration: options.duration,
        safeword: options.safeword,
      });
      const embed = createProfileEmbed(savedSettings);
      await interaction.followUp({ embeds: [embed] });
    } catch (error) {
      console.log(error);
      await interaction.followUp({
        content: 'Error saving settings. Please try again!',
        ephemeral: true,
      });
    }
  }
}
