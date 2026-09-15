import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { SlashCommandPipe } from '@discord-nestjs/common';
import { Injectable, PipeTransform, Type } from '@nestjs/common';
import { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { BondageService } from 'src/bondage/bondage.service';
import { formatUserMentions } from 'src/bondage/cage-permissions';
import { rejectForeignGuild } from 'src/helper/home-guild';
import { FriendsDto } from './dto/friends.dto';
import { MAX_FRIENDS, UserService } from './user.service';

@Command({
  name: 'friends',
  description:
    'Add friends who can visit your private cages from /bind and /bind-me',
})
@Injectable()
export class FriendsCommand {
  constructor(
    private userService: UserService,
    private bondageService: BondageService,
  ) {}

  @Handler()
  async onFriends(
    @InteractionEvent() interaction: ChatInputCommandInteraction,
    @InteractionEvent(SlashCommandPipe as unknown as Type<PipeTransform>)
    options: FriendsDto,
  ): Promise<void> {
    if (await rejectForeignGuild(interaction)) {
      return;
    }

    await interaction.deferReply();

    try {
      const addIds = this.uniqueIds([
        options.add,
        options.add2,
        options.add3,
        options.add4,
        options.add5,
      ]);
      const removeIds = this.uniqueIds([options.remove]).filter(
        (id) => !addIds.includes(id),
      );

      if (addIds.length === 0 && removeIds.length === 0) {
        await interaction.followUp(
          await this.buildListMessage(interaction.user.id),
        );
        return;
      }

      const lines: string[] = [];
      let friendIds: string[] = await this.userService.getFriendIds(
        interaction.user.id,
      );
      let newlyAdded: string[] = [];
      let listChanged = false;

      if (removeIds.length > 0) {
        const result = await this.userService.removeFriends(
          interaction.user.id,
          removeIds,
        );
        friendIds = result.friendIds;
        listChanged = listChanged || result.removed.length > 0;

        if (result.removed.length > 0) {
          lines.push(`Removed: ${formatUserMentions(result.removed)}`);
        }
        if (result.notFriends.length > 0) {
          lines.push(
            `Not on your list: ${formatUserMentions(result.notFriends)}`,
          );
        }
      }

      if (addIds.length > 0) {
        const { accepted, rejected } = await this.filterAddableFriends(
          interaction,
          addIds,
        );

        if (rejected.length > 0) {
          lines.push(...rejected);
        }

        if (accepted.length > 0) {
          const result = await this.userService.addFriends(
            interaction.user.id,
            accepted,
          );
          friendIds = result.friendIds;
          newlyAdded = result.added;
          listChanged = listChanged || result.added.length > 0;

          if (result.added.length > 0) {
            lines.push(`Added: ${formatUserMentions(result.added)}`);
          }
          if (result.alreadyFriends.length > 0) {
            lines.push(
              `Already friends: ${formatUserMentions(result.alreadyFriends)}`,
            );
          }
          if (result.skippedLimit.length > 0) {
            lines.push(
              `Could not add ${formatUserMentions(result.skippedLimit)} — you already have ${MAX_FRIENDS} friends. Remove someone first.`,
            );
          }
        }
      }

      if (listChanged) {
        const cageUpdated = await this.bondageService.syncCageFriendAccess(
          interaction.user.id,
        );

        if (cageUpdated) {
          if (newlyAdded.length > 0) {
            await this.bondageService.notifyCageVisitors(
              interaction.user.id,
              newlyAdded,
            );
          }

          lines.push(
            newlyAdded.length > 0
              ? 'Your current cage was updated so those friends can come in.'
              : 'Your current cage was updated so your friends list applies there too.',
          );
        }
      }

      lines.push(this.formatFriendList(friendIds));
      await interaction.followUp(lines.join('\n'));
    } catch (error) {
      console.log(error);
      await interaction.followUp({
        content: 'Error updating friends. Please try again!',
        ephemeral: true,
      });
    }
  }

  private async buildListMessage(userId: string): Promise<string> {
    const friendIds = await this.userService.getFriendIds(userId);
    return [
      this.formatFriendList(friendIds),
      'Use `/friends add:@user` to let people visit your private cages. Use `remove` to take someone off the list.',
    ].join('\n');
  }

  private formatFriendList(friendIds: string[]): string {
    if (friendIds.length === 0) {
      return 'You have no friends yet.';
    }

    return `Private cage friends (${friendIds.length}/${MAX_FRIENDS}): ${formatUserMentions(friendIds)}`;
  }

  private async filterAddableFriends(
    interaction: ChatInputCommandInteraction,
    friendIds: string[],
  ): Promise<{ accepted: string[]; rejected: string[] }> {
    const accepted: string[] = [];
    const rejected: string[] = [];

    for (const friendId of friendIds) {
      if (friendId === interaction.user.id) {
        rejected.push('You cannot add yourself as a friend.');
        continue;
      }

      const member = await this.fetchMember(interaction, friendId);

      if (!member) {
        rejected.push(`<@${friendId}> is not in this server.`);
        continue;
      }

      if (member.user.bot) {
        rejected.push(`<@${friendId}> is a bot and cannot be added.`);
        continue;
      }

      accepted.push(friendId);
    }

    return { accepted, rejected };
  }

  private async fetchMember(
    interaction: ChatInputCommandInteraction,
    userId: string,
  ): Promise<GuildMember | null> {
    if (!interaction.guild) {
      return null;
    }

    try {
      return await interaction.guild.members.fetch(userId);
    } catch {
      return null;
    }
  }

  private uniqueIds(values: Array<string | undefined>): string[] {
    return [
      ...new Set(values.filter((value): value is string => Boolean(value))),
    ];
  }
}
