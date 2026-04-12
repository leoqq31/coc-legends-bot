const { SlashCommandBuilder } = require('discord.js');
const { setDailyChannel } = require('../database/queries');
const { successEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setdaily')
    .setDescription('Set a channel for the daily legend summary (posted at reset)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for daily summaries')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setDailyChannel.run(interaction.guildId, channel.id);

    return interaction.reply({
      embeds: [successEmbed(`Daily legend summary will be posted to ${channel} at legend day reset (5 AM UTC).`)],
      ephemeral: true,
    });
  },
};
