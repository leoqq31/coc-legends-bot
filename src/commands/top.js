const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildClans, getClanLeaderboard } = require('../database/queries');
const { getLegendDay, formatTrophyChange } = require('../utils/format');
const { errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Daily attack/defense leaderboards')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('What to rank by')
        .setRequired(true)
        .addChoices(
          { name: 'Attacks (most trophies gained)', value: 'attacks' },
          { name: 'Defenses (least trophies lost)', value: 'defenses' },
          { name: 'Net (best overall)', value: 'net' },
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const clans = getGuildClans.all(interaction.guildId);

    if (clans.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('No clans tracked.')], ephemeral: true });
    }

    const today = getLegendDay();
    let allEntries = [];
    for (const clan of clans) {
      const entries = getClanLeaderboard.all(today, clan.clan_tag);
      allEntries.push(...entries);
    }

    // Filter out entries with no stats
    allEntries = allEntries.filter(e => e.end_trophies != null);

    if (allEntries.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('No legend stats recorded yet today.')], ephemeral: true });
    }

    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
    let title, lines;

    if (type === 'attacks') {
      allEntries.sort((a, b) => (b.attack_trophies || 0) - (a.attack_trophies || 0));
      title = '\u2694\uFE0F Top Attacks — ' + today;
      lines = allEntries.map((e, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} **${e.player_name}** — \u2694\uFE0F +${e.attack_trophies || 0}`;
      });
    } else if (type === 'defenses') {
      allEntries.sort((a, b) => (a.defense_trophies || 0) - (b.defense_trophies || 0));
      title = '\uD83D\uDEE1\uFE0F Top Defenses — ' + today;
      lines = allEntries.map((e, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} **${e.player_name}** — \uD83D\uDEE1\uFE0F -${e.defense_trophies || 0}`;
      });
    } else {
      allEntries.sort((a, b) => (b.net_trophies || 0) - (a.net_trophies || 0));
      title = '\uD83D\uDCCA Top Net — ' + today;
      lines = allEntries.map((e, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} **${e.player_name}** — ${formatTrophyChange(e.net_trophies || 0)}`;
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xf5c518)
      .setTitle(title)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
