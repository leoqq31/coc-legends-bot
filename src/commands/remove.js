const { SlashCommandBuilder } = require('discord.js');
const { removeTrackedWarPlayer, getTrackedWarPlayers } = require('../database/queries');
const { normalizeTag } = require('../utils/format');
const { successEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a player from the war stars tracking roster')
    .addStringOption(opt =>
      opt.setName('tag')
        .setDescription('Player tag (e.g. #ABC123)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const tag = normalizeTag(interaction.options.getString('tag'));

    const players = getTrackedWarPlayers.all(interaction.guildId);
    const match = players.find(p => p.player_tag === tag);

    if (!match) {
      return interaction.reply({
        embeds: [errorEmbed(`Player \`${tag}\` is not being tracked.`)],
        ephemeral: true,
      });
    }

    removeTrackedWarPlayer.run(tag, interaction.guildId);

    return interaction.reply({
      embeds: [successEmbed(`Removed **${match.player_name}** (${tag}) from war stars roster.`)],
      ephemeral: true,
    });
  },
};
