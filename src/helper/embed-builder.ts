import { EmbedBuilder } from 'discord.js';
import { ActiveSession } from 'src/bondage/active-session.entity';
import { formatUserMentions } from 'src/bondage/cage-permissions';
import { progressBar } from 'src/bondage/escape-rules';
import { sceneName } from 'src/bondage/restraints';
import { UserSettings } from 'src/user/user-settings.entity';

export const ESCAPE_HINT = '-# use /escape to escape';

function formatFriendList(friendIds?: string[]): string {
  if (!friendIds?.length) {
    return 'None — use `/friends` to add people who can visit your private cages';
  }

  return formatUserMentions(friendIds);
}

function createRestrictionsValue(session?: ActiveSession): string {
  return `${session?.gag ? 'Gag\n' : 'Not Gagged\n'}${session?.blindfold ? 'Blindfold\n' : 'Not Blindfolded\n'}`;
}

function safewordValue(session?: ActiveSession): string {
  return `\`/safeword\` or **${session?.safeword ?? 'Red'}** still ends it immediately.`;
}

export function createSettingsEmbed(settings?: UserSettings): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Self-Bondage Settings')
    .setDescription('Your preferences have been saved')
    .addFields(
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
  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Bondage Session Started!')
    .addFields(
      {
        name: 'Scene',
        value: sceneName(session?.escapeState?.scenarioId ?? null),
        inline: true,
      },
      {
        name: 'Restrictions',
        value: createRestrictionsValue(session),
        inline: true,
      },
      {
        name: 'Safeword',
        value: safewordValue(session),
      },
    )
    .setFooter({ text: `Session ID: ${session?.id}` })
    .setTimestamp();
}

export function createRestraintBoardEmbed(
  session?: ActiveSession,
): EmbedBuilder {
  const lines = (session?.escapeState?.restraints ?? []).map((restraint) => {
    if (restraint.released) return `~~${restraint.label}~~ — free`;
    return `**${restraint.label}** — ${restraint.material}  \`${progressBar(restraint)}\``;
  });

  return new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Restraint board')
    .setDescription(lines.join('\n') || 'Nothing is holding you.')
    .addFields({
      name: 'Safeword',
      value: safewordValue(session),
    })
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
  const embed = new EmbedBuilder()
    .setColor(0x941900)
    .setTitle('Bondage Session Started!')
    .addFields({
      name: 'Restrictions',
      value: createRestrictionsValue(session),
    })
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
    value: safewordValue(session),
  });
}
