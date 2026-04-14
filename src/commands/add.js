const { SlashCommandBuilder } = require('discord.js');
const { getPlayer } = require('../api/coc');
const { addTrackedWarPlayer } = require('../database/queries');
const { normalizeTag } = require('../utils/format');
const { successEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a player to the war stars tracking roster')
    .addStringOption(opt =>
      opt.setName('tag')
        .setDescription('Player tag (e.g. #ABC123)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const tag = normalizeTag(interaction.options.getString('tag'));

    try {
      const player = await getPlayer(tag);
      addTrackedWarPlayer.run(tag, interaction.guildId, player.name);

      return interaction.editReply({
        embeds: [successEmbed(`Added **${player.name}** (${tag}) to war stars roster.`)],
      });
    } catch (err) {
      if (err.status === 404) {
        return interaction.editReply({ embeds: [errorEmbed(`Player \`${tag}\` not found.`)] });
      }
      console.error('Add error:', err);
      return interaction.editReply({ embeds: [errorEmbed('Failed to fetch player.')] });
    }
  },
};
