const { SlashCommandBuilder } = require('discord.js');
const { getGuildClans, getClanLeaderboard, setBoard } = require('../database/queries');
const { getLegendDay } = require('../utils/format');
const { leaderboardEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show Legend League leaderboard')
    .addIntegerOption(opt =>
      opt.setName('days_ago')
        .setDescription('Days ago (0 = today, 1 = yesterday, etc.)')
        .setMinValue(0)
        .setMaxValue(30)
        .setRequired(false)
    ),

  async execute(interaction) {
    const clans = getGuildClans.all(interaction.guildId);

    if (clans.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No clans tracked. Use `/clan add <tag>` to start.')],
        ephemeral: true,
      });
    }

    const daysAgo = interaction.options.getInteger('days_ago') || 0;

    // Calculate the target date
    const targetDate = new Date();
    targetDate.setUTCDate(targetDate.getUTCDate() - daysAgo);
    const dateStr = getLegendDay(targetDate);

    let allEntries = [];
    for (const clan of clans) {
      const entries = getClanLeaderboard.all(dateStr, clan.clan_tag);
      allEntries.push(...entries);
    }
    allEntries.sort((a, b) => (b.end_trophies || b.trophies || 0) - (a.end_trophies || a.trophies || 0));

    const guildName = interaction.guild?.name || 'Server';
    const embed = leaderboardEmbed(guildName, allEntries, dateStr);

    if (daysAgo === 0) {
      // Today's leaderboard — auto-update
      embed.setFooter({ text: 'Auto-updates every 2 min' });
      embed.setTimestamp();

      const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
      setBoard.run(interaction.guildId, interaction.channelId, reply.id);
    } else {
      // Historical — just show it, no auto-update
      embed.setFooter({ text: `${daysAgo} day(s) ago` });
      return interaction.reply({ embeds: [embed] });
    }
  },
};
