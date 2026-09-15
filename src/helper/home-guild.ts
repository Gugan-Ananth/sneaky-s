import { ChatInputCommandInteraction } from 'discord.js';

export const HOME_GUILD_ID =
  process.env.DISCORD_GUILD_ID ?? '1409559208059211971';

const FOREIGN_GUILD_REPLY =
  'This bot only works in its home server and ignores commands from other servers.';

export function isHomeGuild(guildId?: string | null): boolean {
  return guildId === HOME_GUILD_ID;
}

export async function rejectForeignGuild(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (isHomeGuild(interaction.guildId)) {
    return false;
  }

  const payload = {
    content: FOREIGN_GUILD_REPLY,
    ephemeral: true,
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }

  return true;
}
