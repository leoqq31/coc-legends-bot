const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setBoard } = require('../database/queries');
const { successEmbed, errorEmbed } = require('../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setboard')
    .setDescription('Set a channel for the auto-updating legend leaderboard')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the leaderboard in')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    // Store the board config (message_id will be set on first post)
    setBoard.run(interaction.guildId, channel.id, null);

    return interaction.reply({
      embeds: [successEmbed(`Leaderboard will auto-update in ${channel}. It will post on the next poll cycle (every 30 min).`)],
    });
  },
};
