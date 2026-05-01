const { SlashCommandBuilder } = require('discord.js');
const { getGuildClans, getWeeklyLegendLeaderboard, setLegendBoardL3 } = require('../database/queries');
const { getLegendWeek } = require('../utils/format');
const { weeklyLegendEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard3')
    .setDescription('Show Legend 3 weekly leaderboard (auto-updates)'),

  async execute(interaction) {
    const clans = getGuildClans.all(interaction.guildId);

    if (clans.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No clans tracked. Use `/clan add <tag>` to start.')],
        ephemeral: true,
      });
    }

    const yearWeek = getLegendWeek();

    let allEntries = [];
    for (const clan of clans) {
      const entries = getWeeklyLegendLeaderboard.all(yearWeek, clan.clan_tag, 'L3');
      allEntries.push(...entries);
    }
    allEntries.sort((a, b) => (b.end_trophies || b.trophies || 0) - (a.end_trophies || a.trophies || 0));

    const guildName = interaction.guild?.name || 'Server';
    const embed = weeklyLegendEmbed(guildName, allEntries, yearWeek, 'III');
    embed.setFooter({ text: 'Auto-updates every 1 min' });
    embed.setTimestamp();

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    setLegendBoardL3.run(interaction.guildId, interaction.channelId, reply.id);
  },
};
