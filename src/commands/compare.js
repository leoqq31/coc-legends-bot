const { SlashCommandBuilder } = require('discord.js');
const { getPlayerByTag, getDailyStats, getGuildClans, getLegendPlayers } = require('../database/queries');
const { getLegendDay, normalizeTag } = require('../utils/format');
const { compareEmbed, errorEmbed } = require('../utils/embed');

function findPlayer(input, guildId) {
  // Try as tag first
  if (input.startsWith('#') || /^[0-9A-Za-z]+$/.test(input)) {
    const player = getPlayerByTag.get(normalizeTag(input));
    if (player) return player;
  }

  // Search by name across tracked clans
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
    .setName('compare')
    .setDescription('Compare two Legend League players side by side')
    .addStringOption(opt =>
      opt.setName('player1')
        .setDescription('Player name or tag')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('player2')
        .setDescription('Player name or tag')
        .setRequired(true)
    ),

  async execute(interaction) {
    const input1 = interaction.options.getString('player1');
    const input2 = interaction.options.getString('player2');

    const p1 = findPlayer(input1, interaction.guildId);
    const p2 = findPlayer(input2, interaction.guildId);

    if (!p1) return interaction.reply({ embeds: [errorEmbed(`Player **${input1}** not found in tracked clans.`)], ephemeral: true });
    if (!p2) return interaction.reply({ embeds: [errorEmbed(`Player **${input2}** not found in tracked clans.`)], ephemeral: true });

    const today = getLegendDay();
    const stats1 = getDailyStats.get(p1.player_tag, today);
    const stats2 = getDailyStats.get(p2.player_tag, today);

    return interaction.reply({
      embeds: [compareEmbed(p1, p2, stats1, stats2, today)],
    });
  },
};
