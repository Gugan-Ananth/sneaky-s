import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Injectable, PipeTransform, Type } from '@nestjs/common';
import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { rejectForeignGuild } from 'src/helper/home-guild';
import { WhitelistDto } from './dto/whitelist.dto';
import {
  RoleSeparatorService,
  WhitelistResult,
} from './role_separator.service';

@Command({
  name: 'whitelist',
  description:
    'Unflag a false-positive findom account, restore their old roles, and skip them on later scans',
  defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
  dmPermission: false,
})
@Injectable()
export class WhitelistCommand {
  constructor(private roleSeparatorService: RoleSeparatorService) {}

  @Handler()
  async onWhitelist(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe as unknown as Type<PipeTransform>)
    options: WhitelistDto,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.followUp({
        content: 'You need the Manage Roles permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    const userId = options.user;

    if (!userId) {
      await interaction.followUp({
        content: 'Pick a user to whitelist.',
        ephemeral: true,
      });
      return;
    }

    if (!interaction.guild) {
      await interaction.followUp({
        content: 'This command can only be used inside the server.',
        ephemeral: true,
      });
      return;
    }

    try {
      const result = await this.roleSeparatorService.whitelistFlaggedUser(
        userId,
        interaction.guild,
      );

      await interaction.followUp({
        content: this.buildReply(userId, result),
        ephemeral: true,
      });
    } catch (error) {
      console.log(error);
      await interaction.followUp({
        content: 'Error whitelisting that user. Please try again!',
        ephemeral: true,
      });
    }
  }

  private buildReply(userId: string, result: WhitelistResult): string {
    const lines = [
      result.alreadyWhitelisted
        ? `<@${userId}> was already on the whitelist.`
        : `Whitelisted <@${userId}>. Later hourly scans will not re-flag them.`,
    ];

    if (!result.inGuild) {
      lines.push(
        'They are not in the server right now, so I could not restore roles.',
      );
      return lines.join('\n');
    }

    if (result.previousRoleIds.length === 0) {
      lines.push(
        result.removedFindomFlag
          ? 'No previous roles were saved (they were likely flagged before this was added). I removed the findom flag.'
          : 'No previous roles were saved, and I could not remove the findom flag. They are still whitelisted.',
      );
      return lines.join('\n');
    }

    if (result.restoredRoleIds.length > 0) {
      lines.push(
        `Restored roles: ${result.restoredRoleIds.map((id) => `<@&${id}>`).join(' ')}`,
      );
    } else {
      lines.push('I could not restore their previous roles.');
    }

    if (result.skippedRoleIds.length > 0) {
      lines.push(
        `Skipped (deleted, managed, or above the bot): ${result.skippedRoleIds.map((id) => `<@&${id}>`).join(' ')}`,
      );
    }

    return lines.join('\n');
  }
}
