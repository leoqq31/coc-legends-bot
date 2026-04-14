const { SlashCommandBuilder } = require('discord.js');
const { getWarLeaderboard, getWarLeaderboardAllTime, getEarliestWarMonth, setWarBoard } = require('../database/queries');
const { warLeaderboardEmbed, errorEmbed } = require('../utils/embed');
const { getCurrentYearMonth } = require('../tasks/warTracker');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warleaderboard')
    .setDescription('Show monthly war stars leaderboard')
    .addStringOption(opt =>
      opt.setName('month')
        .setDescription('Specific month in YYYY-MM format (e.g. 2026-03)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('alltime')
        .setDescription('Show all-time stats (combines all tracked months)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const monthOption = interaction.options.getString('month');
    const allTime = interaction.options.getBoolean('alltime') || false;
    const guildName = interaction.guild?.name || 'Server';

    // ── All-time leaderboard ──
    if (allTime) {
      const entries = getWarLeaderboardAllTime.all(interaction.guildId);
      if (entries.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('No tracked players yet.')],
          ephemeral: true,
        });
      }

      const earliest = getEarliestWarMonth.get();
      const since = earliest?.first_month || 'now';
      const embed = warLeaderboardEmbed(guildName, entries, since, true);
      embed.setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── Specific month (historical, no auto-update) ──
    if (monthOption) {
      // Validate format
      if (!/^\d{4}-\d{2}$/.test(monthOption)) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid format. Use `YYYY-MM` (e.g. `2026-03`).')],
          ephemeral: true,
        });
      }

      const entries = getWarLeaderboard.all(monthOption, interaction.guildId);
      if (entries.length === 0 || entries.every(e => e.start_stars == null)) {
        return interaction.reply({
          embeds: [errorEmbed(`No data for **${monthOption}**.`)],
          ephemeral: true,
        });
      }

      const embed = warLeaderboardEmbed(guildName, entries, monthOption);
      embed.setFooter({ text: 'Historical snapshot' });
      embed.setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── Current month (auto-updating) ──
    const yearMonth = getCurrentYearMonth();
    const entries = getWarLeaderboard.all(yearMonth, interaction.guildId);

    if (entries.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No tracked players yet. Use `/add <tag>` or `/clan add` to start.')],
        ephemeral: true,
      });
    }

    const embed = warLeaderboardEmbed(guildName, entries, yearMonth);
    embed.setFooter({ text: 'Обновява се всяка минута' });
    embed.setTimestamp();

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    setWarBoard.run(interaction.guildId, interaction.channelId, reply.id);
  },
};
