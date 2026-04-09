const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayerByTag, getGuildClans, getLegendPlayers } = require('../database/queries');
const { normalizeTag } = require('../utils/format');
const { errorEmbed } = require('../utils/embed');
const { getPlayer } = require('../api/coc');

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
    .setName('profile')
    .setDescription('Show full player profile')
    .addStringOption(opt =>
      opt.setName('player')
        .setDescription('Player name or tag')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const input = interaction.options.getString('player');

    // Try DB first for the tag
    let tag;
    const dbPlayer = findPlayer(input, interaction.guildId);
    if (dbPlayer) {
      tag = dbPlayer.player_tag;
    } else {
      tag = normalizeTag(input);
    }

    try {
      const p = await getPlayer(tag);
      const league = p.leagueTier?.name || 'Unranked';

      const heroes = (p.heroes || [])
        .filter(h => h.village === 'home')
        .map(h => `${h.name}: **${h.level}**/${h.maxLevel}`)
        .join('\n') || 'None';

      const pets = (p.troops || [])
        .filter(t => t.village === 'home' && [
          'L.A.S.S.I', 'Mighty Yak', 'Electro Owl', 'Unicorn', 'Phoenix',
          'Poison Lizard', 'Diggy', 'Frosty', 'Spirit Fox', 'Angry Jelly',
          'Sneezy', 'Greedy Raven',
        ].includes(t.name))
        .map(t => `${t.name}: **${t.level}**/${t.maxLevel}`)
        .join('\n') || 'None';

      const legendInfo = p.legendStatistics?.currentSeason
        ? `Rank: #${p.legendStatistics.currentSeason.rank?.toLocaleString() || '?'}`
        : 'Not in legends';

      const embed = new EmbedBuilder()
        .setColor(0xf5c518)
        .setTitle(`${p.name} — ${league}`)
        .setDescription(`Tag: \`${p.tag}\``)
        .addFields(
          {
            name: '\uD83C\uDFE0 Town Hall',
            value: `Level **${p.townHallLevel}**`,
            inline: true,
          },
          {
            name: '\u2B50 Exp Level',
            value: `**${p.expLevel}**`,
            inline: true,
          },
          {
            name: '\uD83C\uDFC6 Trophies',
            value: `**${p.trophies}** (Best: ${p.bestTrophies})`,
            inline: true,
          },
          {
            name: '\u2694\uFE0F War Stars',
            value: `**${p.warStars}**`,
            inline: true,
          },
          {
            name: '\uD83D\uDCE6 Donations',
            value: `Given: **${p.donations}** | Received: **${p.donationsReceived}**`,
            inline: true,
          },
          {
            name: '\uD83C\uDFC5 Legend Status',
            value: legendInfo,
            inline: true,
          },
          {
            name: '\uD83E\uDDB8 Heroes',
            value: heroes,
            inline: true,
          },
          {
            name: '\uD83D\uDC3E Pets',
            value: pets,
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      if (err.status === 404) {
        return interaction.editReply({ embeds: [errorEmbed(`Player \`${tag}\` not found.`)] });
      }
      console.error('Profile error:', err);
      return interaction.editReply({ embeds: [errorEmbed('Failed to fetch player data.')] });
    }
  },
};
