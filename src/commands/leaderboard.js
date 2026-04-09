const { SlashCommandBuilder } = require('discord.js');
const { getGuildClans, getClanLeaderboard, setBoard } = require('../database/queries');
const { getLegendDay } = require('../utils/format');
const { leaderboardEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show Legend League leaderboard (auto-updates every 5 min)'),

  async execute(interaction) {
    const clans = getGuildClans.all(interaction.guildId);

    if (clans.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No clans tracked. Use `/clan add <tag>` to start.')],
        ephemeral: true,
      });
    }

    const today = getLegendDay();

    let allEntries = [];
    for (const clan of clans) {
      const entries = getClanLeaderboard.all(today, clan.clan_tag);
      allEntries.push(...entries);
    }
    allEntries.sort((a, b) => (b.end_trophies || b.trophies || 0) - (a.end_trophies || a.trophies || 0));

    const guildName = interaction.guild?.name || 'Server';
    const embed = leaderboardEmbed(guildName, allEntries, today);
    embed.setFooter({ text: 'Auto-updates every 1 min' });
    embed.setTimestamp();

    // Send the leaderboard message
    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

    // Save this message + channel for auto-updating
    setBoard.run(interaction.guildId, interaction.channelId, reply.id);
  },
};
