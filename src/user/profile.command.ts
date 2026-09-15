import { Command, Handler, InteractionEvent } from '@discord-nestjs/core/dist';
import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { ChatInputCommandInteraction } from 'discord.js';
import { createSettingsEmbed } from 'src/helper/embed-builder';
import { rejectForeignGuild } from 'src/helper/home-guild';

@Command({
  name: 'profile',
  description: 'Your current status of the Bondage',
})
@Injectable()
export class UserProfileCommand {
  constructor(private userService: UserService) {}

  @Handler()
  async onSettings(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply();
    try {
      const userId = interaction.user.id;
      const savedSettings = await this.userService.getUserSettings(userId);
      const embed = createSettingsEmbed(savedSettings ?? undefined);
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
