const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getClan } = require('../api/coc');
const { registerClan, removeClan, getGuildClans } = require('../database/queries');
const { normalizeTag } = require('../utils/format');
const { successEmbed, errorEmbed } = require('../utils/embed');
const { pollAllClans } = require('../tasks/pollStats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Manage tracked clans')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a clan to track')
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('Clan tag (e.g. #ABC123)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel for daily summaries (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Stop tracking a clan')
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('Clan tag to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all tracked clans')
    )
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('Show detailed clan info')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const tag = normalizeTag(interaction.options.getString('tag'));
      const channel = interaction.options.getChannel('channel');

      try {
        const clan = await getClan(tag);
        registerClan.run(tag, interaction.guildId, clan.name, channel?.id || null);

        const msg = `Now tracking **${clan.name}** (${tag}).`
          + (channel ? ` Daily summaries in ${channel}.` : '')
          + '\nLegend players will be auto-discovered on the next poll.';

        await interaction.editReply({ embeds: [successEmbed(msg)] });

        pollAllClans().catch(err => console.error('[Poll] Post-add poll error:', err));
      } catch (err) {
        if (err.status === 404) {
          return interaction.editReply({ embeds: [errorEmbed(`Clan \`${tag}\` not found.`)] });
        }
        console.error('Clan add error:', err);
        return interaction.editReply({ embeds: [errorEmbed('Failed to fetch clan from CoC API.')] });
      }
    }

    if (sub === 'remove') {
      const tag = normalizeTag(interaction.options.getString('tag'));
      removeClan.run(tag, interaction.guildId);
      return interaction.reply({ embeds: [successEmbed(`Stopped tracking clan \`${tag}\`.`)], ephemeral: true });
    }

    if (sub === 'list') {
      const clans = getGuildClans.all(interaction.guildId);
      if (clans.length === 0) {
        return interaction.reply({ embeds: [errorEmbed('No clans tracked. Use `/clan add <tag>` to start.')], ephemeral: true });
      }
      const lines = clans.map(c => `**${c.clan_name}** — \`${c.clan_tag}\``);
      return interaction.reply({ embeds: [successEmbed(`Tracked clans:\n${lines.join('\n')}`)], ephemeral: true });
    }

    if (sub === 'info') {
      await interaction.deferReply({ ephemeral: true });
      const clans = getGuildClans.all(interaction.guildId);
      if (clans.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('No clans tracked.')] });
      }

      try {
        const clan = await getClan(clans[0].clan_tag);

        const embed = new EmbedBuilder()
          .setColor(0xf5c518)
          .setTitle(`${clan.name} — Level ${clan.clanLevel}`)
          .setDescription(`Tag: \`${clan.tag}\``)
          .setThumbnail(clan.badgeUrls?.medium || null)
          .addFields(
            {
              name: '\uD83D\uDC65 Members',
              value: `**${clan.members}**/50`,
              inline: true,
            },
            {
              name: '\uD83C\uDFC6 Clan Points',
              value: `**${clan.clanPoints?.toLocaleString()}**`,
              inline: true,
            },
            {
              name: '\u2694\uFE0F War Record',
              value: `W: **${clan.warWins}** | L: **${clan.warLosses ?? '?'}** | D: **${clan.warTies ?? '?'}**`,
              inline: true,
            },
            {
              name: '\uD83D\uDD25 War Streak',
              value: `**${clan.warWinStreak}**`,
              inline: true,
            },
            {
              name: '\uD83C\uDFDB\uFE0F Capital Hall',
              value: `Level **${clan.clanCapital?.capitalHallLevel || '?'}**`,
              inline: true,
            },
            {
              name: '\uD83C\uDF0D War League',
              value: `${clan.warLeague?.name || 'Unknown'}`,
              inline: true,
            },
            {
              name: '\uD83D\uDCDD Description',
              value: clan.description || 'No description',
              inline: false,
            },
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Clan info error:', err);
        return interaction.editReply({ embeds: [errorEmbed('Failed to fetch clan data.')] });
      }
    }
  },
};
