const { SlashCommandBuilder } = require('discord.js');
const { getPlayerByTag, getDailyStats, getGuildClans, getLegendPlayers } = require('../database/queries');
const { getLegendDay, normalizeTag } = require('../utils/format');
const { statsEmbed, errorEmbed } = require('../utils/embed');

function findPlayer(input, guildId) {
  if (input.startsWith('#') || /^[0-9A-Za-z]+$/.test(input)) {
    const player = getPlayerByTag.get(normalizeTag(input));
    if (player) return player;
  }

  const clans = getGuildClans.all(guildId);
  for (const clan of clans) {
    const legends = getLegendPlayers.all(clan.clan_tag);
    const match = legends.find(p => p.player_name.toLowerCase() === input.toLowerCase());
    if (match) return match;
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription("Show a Legend League player's daily stats")
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Player name or tag')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('player');
    const player = findPlayer(input, interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed(`Player **${input}** not found in any tracked clan.`)],
        ephemeral: true,
      });
    }

    const today = getLegendDay();
    const stats = getDailyStats.get(player.player_tag, today);

    if (!stats) {
      return interaction.reply({
        embeds: [errorEmbed(`No stats recorded yet for **${player.player_name}** today (${today}). Stats update every 5 minutes.`)],
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [statsEmbed(player.player_name, player.player_tag, stats, today)],
    });
  },
};
