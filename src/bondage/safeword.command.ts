import { Command, Handler, InteractionEvent } from '@discord-nestjs/core/dist';
import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { rejectForeignGuild } from 'src/helper/home-guild';
import { BondageService } from './bondage.service';

@Command({
  name: 'safeword',
  description: 'Use your safeword',
})
@Injectable()
export class SafewordCommand {
  constructor(private bondageService: BondageService) {}

  @Handler()
  async onSafeword(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply();
    try {
      const member = interaction.member as GuildMember;

      const activeSession = await this.bondageService.getActiveSession(
        interaction.user.id,
      );

      if (!activeSession) {
        await interaction.followUp({
          content: 'Your are not tied to use safeword',
          ephemeral: true,
        });
        return;
      }

      await interaction.followUp({
        content: 'You used your safeword to escape free!',
        ephemeral: true,
      });

      await this.bondageService.handleSafeword(
        interaction.user.id,
        interaction.channel?.id,
        member,
      );
    } catch (error) {
      console.log(error);
      await interaction.followUp({
        content: 'Error saving settings. Please try again!',
        ephemeral: true,
      });
    }
  }
}
