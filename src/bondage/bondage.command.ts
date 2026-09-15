import { Command, Handler, InteractionEvent } from '@discord-nestjs/core/dist';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Injectable, PipeTransform, Type } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  GuildMember,
  GuildTextBasedChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
} from 'discord.js';
import { BondageService } from './bondage.service';
import { createSessionEmbed } from 'src/helper/embed-builder';
import { rejectForeignGuild } from 'src/helper/home-guild';
import { BindMeDto } from './dto/bind-me.dto';

@Command({
  name: 'bind-me',
  description: 'Start your bondage~',
})
@Injectable()
export class BondageCommand {
  constructor(private bondageService: BondageService) {}

  @Handler()
  async onBondage(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe as unknown as Type<PipeTransform>)
    options: BindMeDto,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply();
    try {
      const member = interaction.member as GuildMember;
      const isPrivateCage = this.isYes(options?.privateCage);

      const existingSession = await this.bondageService.getActiveSession(
        interaction.user.id,
      );

      if (existingSession) {
        await interaction.followUp({
          content: 'You are already tied up! Try escaping first~',
          ephemeral: true,
        });
        return;
      }
      const permissionOverwrites: OverwriteResolvable[] = [
        {
          id: interaction.guild!.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.UseApplicationCommands,
          ],
        },
      ];

      if (!isPrivateCage) {
        permissionOverwrites.push({
          id: '1500220457843032214',
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        });
      }

      const channel = await interaction.guild?.channels.create({
        name: `cage-${interaction.user.displayName}`,
        nsfw: true,
        type: 0,
        parent: '1497956351480041632',
        permissionOverwrites,
      });

      if (!channel) {
        await interaction.followUp({
          content: 'Error creating a new channel...',
          ephemeral: true,
        });
        return;
      }

      const session = await this.bondageService.startSession(
        interaction.user.id,
        interaction?.guildId ?? '',
        channel?.id,
        member,
        {
          gag: this.isYes(options?.gag),
          blindfold: this.isYes(options?.blindfold),
        },
      );

      const embed = createSessionEmbed(session);
      await interaction.followUp({ embeds: [embed] });

      await member.roles.set([]);
      await member.roles.add('1497994703050903735');

      if (channel && channel.isTextBased()) {
        if ((session.blindfold ?? false) && (session.gag ?? false)) {
          await this.sendLongMessage(
            channel,
            `Hello <@${interaction.user.id}>~\n\n${session.bondageDescription}`,
          );
          await channel.send(
            `** **\n${session.gagDescription}\n\n${session.blindfoldDescription}`,
          );
        } else if (session.blindfold ?? false) {
          await this.sendLongMessage(
            channel,
            `Hello <@${interaction.user.id}>~\n\n${session.bondageDescription}\n\n${session.blindfoldDescription}`,
          );
        } else if (session.gag ?? false) {
          await this.sendLongMessage(
            channel,
            `Hello <@${interaction.user.id}>~\n\n${session.bondageDescription}\n\n${session.gagDescription}`,
          );
        } else {
          await this.sendLongMessage(
            channel,
            `Hello <@${interaction.user.id}>~\n\n${session.bondageDescription}`,
          );
        }
      }
    } catch (error) {
      console.log(error);
      await interaction.followUp({
        content: 'Error saving settings. Please try again!',
        ephemeral: true,
      });
    }
  }

  private isYes(value?: number): boolean {
    return value === 0;
  }

  private async sendLongMessage(
    channel: GuildTextBasedChannel,
    content: string,
  ): Promise<void> {
    const MAX_LENGTH = 1700;
    let chunk = '';

    for (const line of content.split('\n')) {
      if ((chunk + '\n' + line).length > MAX_LENGTH) {
        await channel.send(chunk);
        chunk = line;
      } else {
        chunk += (chunk ? '\n' : '') + line;
      }
    }

    if (chunk) {
      await channel.send(chunk);
    }
  }
}
