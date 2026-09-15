import { EmbedBuilder } from 'discord.js';
import { ActiveSession } from 'src/bondage/active-session.entity';
import { formatUserMentions } from 'src/bondage/cage-permissions';
import { UserSettings } from 'src/user/user-settings.entity';

function formatFriendList(friendIds?: string[]): string {
  if (!friendIds?.length) {
    return 'None — use `/friends` to add people who can visit your private cages';
  }

  return formatUserMentions(friendIds);
}

function createRestrictionsValue(session?: ActiveSession): string {
  return `${session?.gag ? 'Gag\n' : 'Not Gagged\n'}${session?.blindfold ? 'Blindfold\n' : 'Not Blindfolded\n'}`;
}

export function createSettingsEmbed(settings?: UserSettings): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Self-Bondage Settings')
    .setDescription('Your preferences have been saved')
    .addFields(
      {
        name: 'Bondage Duration',
        value: `${settings?.defaultDuration ?? 30} minutes`,
        inline: true,
      },
      {
        name: 'Safeword',
        value: settings?.safeword ?? 'Red',
        inline: true,
      },
      {
        name: 'Private Cage Friends',
        value: formatFriendList(settings?.friendIds),
      },
    )
    .setFooter({ text: 'Settings saved successfully!' })
    .setTimestamp();
}

export function createProfileEmbed(settings?: UserSettings): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Self-Bondage Profile')
    .setDescription('Your preferences are as follows')
    .addFields(
      {
        name: 'Bondage Duration',
        value: `${settings?.defaultDuration ?? 30} minutes`,
        inline: true,
      },
      {
        name: 'Safeword',
        value: settings?.safeword ?? 'Red',
        inline: true,
      },
      {
        name: 'Private Cage Friends',
        value: formatFriendList(settings?.friendIds),
      },
    )
    .setFooter({ text: 'User bondage profile!' })
    .setTimestamp();
}

export function createSessionEmbed(session?: ActiveSession): EmbedBuilder {
  const date = new Date();
  date.setMinutes(date.getMinutes() + (session?.duration ?? 30));
  const endDate = new Date(session?.endTime?.getTime() ?? date.getTime());

  const endTimeUnix = Math.floor(endDate.getTime() / 1000);
  const endTime = `<t:${endTimeUnix}:t>`;
  const endTimeRelative = `<t:${endTimeUnix}:R>`;

  const durationMinutes = Math.round((date.getTime() - Date.now()) / 60000);

  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Bondage Session Started!')
    .addFields(
      {
        name: 'Duration',
        value: `${durationMinutes} minutes`,
        inline: true,
      },
      {
        name: 'End Time',
        value: `${endTime} (${endTimeRelative})`,
        inline: true,
      },
      {
        name: 'Restrictions',
        value: createRestrictionsValue(session),
      },
      {
        name: 'Safeword',
        value: `Use \`/safeword\` or **${session?.safeword ?? 'Red'}** if you need to escape`,
      },
    )
    .setFooter({ text: `Session ID: ${session?.id}` })
    .setTimestamp();
}

type BindQuestion = {
  target: string;
  prompt: string;
  options: readonly string[];
};

export function createCustomSessionEmbed(
  session?: ActiveSession,
  answers?: { question: BindQuestion; answer: string }[],
): EmbedBuilder {
  const date = new Date();
  date.setMinutes(date.getMinutes() + (session?.duration ?? 30));

  const endDate = new Date(session?.endTime?.getTime() ?? date.getTime());
  const endTimeUnix = Math.floor(endDate.getTime() / 1000);
  const endTime = `<t:${endTimeUnix}:t>`;
  const endTimeRelative = `<t:${endTimeUnix}:R>`;

  const durationMinutes = Math.round((date.getTime() - Date.now()) / 60000);

  const embed = new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Bondage Session Started!')
    .addFields(
      {
        name: 'Duration',
        value: `${durationMinutes} minutes`,
        inline: true,
      },
      {
        name: 'End Time',
        value: `${endTime} (${endTimeRelative})`,
        inline: true,
      },
      {
        name: 'Restrictions',
        value: createRestrictionsValue(session),
      },
    )
    .setFooter({ text: `Session ID: ${session?.id}` })
    .setTimestamp();

  if (answers?.length) {
    const fields = answers.map((a) => ({
      name: a.question.target,
      value: a.answer || 'No response',
      inline: true,
    }));

    embed.addFields(fields);
  }

  return embed.addFields({
    name: 'Safeword',
    value: `Use \`/safeword\` or **${session?.safeword ?? 'Red'}** if you need to escape`,
  });
}
