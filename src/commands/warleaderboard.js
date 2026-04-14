const { SlashCommandBuilder } = require('discord.js');
const { getWarLeaderboard, setWarBoard } = require('../database/queries');
const { warLeaderboardEmbed, errorEmbed } = require('../utils/embed');
const { getCurrentYearMonth } = require('../tasks/warTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warleaderboard')
    .setDescription('Show monthly war stars leaderboard (auto-updates)'),

  async execute(interaction) {
    const yearMonth = getCurrentYearMonth();
    const entries = getWarLeaderboard.all(yearMonth, interaction.guildId);

    if (entries.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No tracked players yet. Use `/add <tag>` or `/clan add` to start.')],
        ephemeral: true,
      });
    }

    const guildName = interaction.guild?.name || 'Server';
    const embed = warLeaderboardEmbed(guildName, entries, yearMonth);
    embed.setFooter({ text: 'Обновява се всяка минута' });
    embed.setTimestamp();

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    setWarBoard.run(interaction.guildId, interaction.channelId, reply.id);
  },
};
