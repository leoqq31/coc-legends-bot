const { SlashCommandBuilder } = require('discord.js');
const { getPlayerByTag, getStatsHistory, getGuildClans, getLegendPlayers } = require('../database/queries');
const { normalizeTag } = require('../utils/format');
const { historyEmbed, errorEmbed } = require('../utils/embed');

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
    .setName('history')
    .setDescription('Show past Legend League stats for a player')
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Player name or tag')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('days')
        .setDescription('Number of days to show (default: 7)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction) {
    const input = interaction.options.getString('player');
    const days = interaction.options.getInteger('days') || 7;

    const player = findPlayer(input, interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed(`Player **${input}** not found in any tracked clan.`)],
        ephemeral: true,
      });
    }

    const history = getStatsHistory.all(player.player_tag, days);

    return interaction.reply({
      embeds: [historyEmbed(player.player_name, player.player_tag, history)],
    });
  },
};
