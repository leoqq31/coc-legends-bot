const { EmbedBuilder } = require('discord.js');
const { formatTrophyChange } = require('./format');

const COLORS = {
  success: 0x2ecc71,
  info: 0x3498db,
  warning: 0xf1c40f,
  error: 0xe74c3c,
  legend: 0xf5c518,
};

function statsEmbed(playerName, playerTag, stats, date) {
  const net = stats.net_trophies;
  const netEmoji = net > 0 ? '\uD83D\uDD3C' : net < 0 ? '\uD83D\uDD3D' : '\u2796';

  const embed = new EmbedBuilder()
    .setColor(COLORS.legend)
    .setTitle(`${playerName} - Legend Day`)
    .setDescription(`Tag: \`${playerTag}\` | Date: \`${date}\``)
    .addFields(
      {
        name: '\uD83C\uDFC6 Current Trophies',
        value: `**${stats.end_trophies.toLocaleString()}**`,
        inline: true,
      },
      {
        name: '\uD83D\uDCCA Start of Day',
        value: `**${stats.start_trophies.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `${netEmoji} Net Change`,
        value: `**${formatTrophyChange(stats.net_trophies)}** trophies`,
        inline: true,
      }
    )
    .setTimestamp();

  return embed;
}

function historyEmbed(playerName, playerTag, days) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`${playerName} - Legend History`)
    .setDescription(`Tag: \`${playerTag}\` | Last ${days.length} days`);

  if (days.length === 0) {
    embed.addFields({ name: 'No Data', value: 'No legend day stats recorded yet.' });
    return embed;
  }

  for (const day of days) {
    const net = day.net_trophies;
    const netEmoji = net > 0 ? '\uD83D\uDD3C' : net < 0 ? '\uD83D\uDD3D' : '\u2796';

    embed.addFields({
      name: day.date,
      value: `\uD83C\uDFC6 ${day.start_trophies} \u2192 **${day.end_trophies}**  |  ${netEmoji} **${formatTrophyChange(net)}**`,
      inline: false,
    });
  }

  return embed;
}

function leaderboardEmbed(guildName, entries, date) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.legend)
    .setTitle(`\uD83C\uDFC6 ${guildName} - Legend Leaderboard`)
    .setDescription(`Legend Day: \`${date}\`\n\u2800`);

  if (entries.length === 0) {
    embed.addFields({ name: 'No Data', value: 'No legend players found in tracked clans.' });
    return embed;
  }

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  for (const [i, e] of entries.entries()) {
    const medal = medals[i] || `**${i + 1}.**`;
    const trophies = e.end_trophies ?? e.trophies ?? '?';
    const net = e.net_trophies != null ? e.net_trophies : 0;
    const atk = e.attack_trophies ?? 0;
    const def = e.defense_trophies ?? 0;

    const netStr = formatTrophyChange(net);
    const netEmoji = net > 0 ? '\uD83D\uDD3C' : net < 0 ? '\uD83D\uDD3D' : '\u2796';

    embed.addFields({
      name: `${medal} ${e.player_name} \u2014 \uD83C\uDFC6 ${trophies}`,
      value: `\u2694\uFE0F +${atk}  \u2502  \uD83D\uDEE1\uFE0F -${def}  \u2502  ${netEmoji} **${netStr}**`,
      inline: false,
    });
  }

  return embed;
}

function compareEmbed(p1, p2, stats1, stats2, date) {
  function formatPlayer(stats) {
    if (!stats) return 'No data';
    const net = stats.net_trophies;
    const netEmoji = net > 0 ? '\uD83D\uDD3C' : net < 0 ? '\uD83D\uDD3D' : '\u2796';
    return [
      `\uD83C\uDFC6 **${stats.end_trophies}**`,
      `Start: ${stats.start_trophies}`,
      `${netEmoji} **${formatTrophyChange(net)}** today`,
    ].join('\n');
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(`\u2694\uFE0F ${p1.player_name} vs ${p2.player_name}`)
    .setDescription(`Date: \`${date}\``)
    .addFields(
      { name: p1.player_name, value: formatPlayer(stats1), inline: true },
      { name: p2.player_name, value: formatPlayer(stats2), inline: true },
    );

  return embed;
}

function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setDescription(`\u274C ${message}`);
}

function successEmbed(message) {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setDescription(`\u2705 ${message}`);
}

function weeklyLegendEmbed(guildName, entries, yearWeek, tier) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.legend)
    .setTitle(`🏆 ${guildName} - Legend ${tier} Leaderboard`)
    .setDescription(`Week: \`${yearWeek}\``);

  if (entries.length === 0) {
    embed.addFields({ name: 'No Data', value: `No players in Legend ${tier}.` });
    return embed;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const topEntries = entries.slice(0, 50);

  const lines = topEntries.map((e, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    const trophies = e.end_trophies ?? e.trophies ?? '?';
    const net = e.net_trophies != null ? e.net_trophies : 0;
    const th = e.town_hall ? ` \`TH${e.town_hall}\`` : '';
    const netStr = formatTrophyChange(net);
    const netEmoji = net > 0 ? '🔼' : net < 0 ? '🔽' : '➖';
    return `${medal} **${e.player_name}**${th} — 🏆 ${trophies} | ${netEmoji} **${netStr}** this week`;
  });

  // Split into chunks if too long for one field
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + line + '\n').length > 1000) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }
  if (current) chunks.push(current);

  chunks.forEach((chunk, idx) => {
    embed.addFields({
      name: idx === 0 ? 'Rankings' : '​',
      value: chunk,
      inline: false,
    });
  });

  return embed;
}

function warLeaderboardEmbed(guildName, entries, label, isAllTime = false) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.legend)
    .setTitle(`\u2694\uFE0F ${guildName} - War Stars ${isAllTime ? '(All Time)' : 'Leaderboard'}`)
    .setDescription(`${isAllTime ? 'Tracking since' : 'Month'}: \`${label}\``);

  if (entries.length === 0) {
    embed.addFields({ name: 'No Data', value: 'No tracked players yet. Use `/add <tag>` or `/clan add` to start.' });
    return embed;
  }

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  const topEntries = entries.slice(0, 50);

  const lines = topEntries.map((e, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    const stars = e.stars_this_month ?? 0;
    const attacks = e.attack_count ?? 0;
    const total = e.current_stars ?? 0;
    const avg = attacks > 0 ? (stars / attacks).toFixed(2) : '0.00';
    const th = e.town_hall ? ` \`TH${e.town_hall}\`` : '';

    return `${medal} **${e.player_name}**${th} — \u2B50 ${stars} | ${attacks} atk | ${avg} avg | ${total} total`;
  });

  // Split into chunks if needed (embed value max 1024 chars per field)
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + line + '\n').length > 1000) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }
  if (current) chunks.push(current);

  chunks.forEach((chunk, idx) => {
    embed.addFields({
      name: idx === 0 ? 'Rankings' : '\u200B',
      value: chunk,
      inline: false,
    });
  });

  return embed;
}

module.exports = {
  statsEmbed,
  historyEmbed,
  leaderboardEmbed,
  warLeaderboardEmbed,
  weeklyLegendEmbed,
  compareEmbed,
  errorEmbed,
  successEmbed,
  COLORS,
};
