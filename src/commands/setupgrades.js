const { SlashCommandBuilder } = require('discord.js');
const { setUpgradeChannel } = require('../database/queries');
const { successEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupgrades')
    .setDescription('Set a channel to receive upgrade notifications for the clan')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for upgrade notifications')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    setUpgradeChannel.run(interaction.guildId, channel.id);

    return interaction.reply({
      embeds: [successEmbed(`Upgrade notifications will be sent to ${channel}.\nThe bot will detect when any clan member upgrades a hero, troop, spell, pet, or equipment.`)],
    });
  },
};
