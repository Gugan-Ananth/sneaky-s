import {
  GuildChannel,
  GuildTextBasedChannel,
  OverwriteResolvable,
  PermissionFlagsBits,
} from 'discord.js';

export const CAGE_CATEGORY_ID = '1497956351480041632';
export const PUBLIC_CAGE_ROLE_ID = '1500220457843032214';
export const TEASING_TEAM_ROLE_ID = '1549489598810554439';

const BOUND_USER_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.UseApplicationCommands,
];

const VISITOR_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
];

export function buildCagePermissionOverwrites(
  guildId: string,
  userId: string,
  isPrivateCage: boolean,
  friendIds: string[] = [],
): OverwriteResolvable[] {
  const permissionOverwrites: OverwriteResolvable[] = [
    {
      id: guildId,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: userId,
      allow: BOUND_USER_PERMISSIONS,
    },
  ];

  if (!isPrivateCage) {
    permissionOverwrites.push({
      id: PUBLIC_CAGE_ROLE_ID,
      allow: VISITOR_PERMISSIONS,
    });
    return permissionOverwrites;
  }

  const uniqueFriendIds = [...new Set(friendIds)].filter(
    (friendId) => friendId && friendId !== userId,
  );

  for (const friendId of uniqueFriendIds) {
    permissionOverwrites.push({
      id: friendId,
      allow: VISITOR_PERMISSIONS,
    });
  }

  return permissionOverwrites;
}

export function formatUserMentions(userIds: string[]): string {
  return userIds.map((id) => `<@${id}>`).join(', ');
}

export function isPrivateCageChannel(channel: GuildChannel): boolean {
  const publicOverwrite =
    channel.permissionOverwrites.cache.get(PUBLIC_CAGE_ROLE_ID);

  return !publicOverwrite?.allow.has(PermissionFlagsBits.ViewChannel);
}

export async function notifyTeasingTeam(
  channel: GuildTextBasedChannel,
): Promise<void> {
  await channel.send({
    content: `Hi <@&${TEASING_TEAM_ROLE_ID}> (Teasing team), someone tied themselves up in self-bondage. Time to have some fun~`,
    allowedMentions: { roles: [TEASING_TEAM_ROLE_ID] },
  });
}
