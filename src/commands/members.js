const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildClans } = require('../database/queries');
const { errorEmbed } = require('../utils/embed');
const { getClanMembers, getPlayer } = require('../api/coc');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Show all clan members with their league ranks'),

  async execute(interaction) {
    await interaction.deferReply();

    const clans = getGuildClans.all(interaction.guildId);
    if (clans.length === 0) {
      return interaction.editReply({ embeds: [errorEmbed('No clans tracked.')] });
    }

    try {
      const clanTag = clans[0].clan_tag;
      const members = await getClanMembers(clanTag);

      // Fetch league tier for each member
      const playerData = [];
      for (const m of members) {
        try {
          const p = await getPlayer(m.tag);
          playerData.push({
            name: p.name,
            trophies: p.trophies,
            league: p.leagueTier?.name || 'Unranked',
            townHall: p.townHallLevel,
            role: m.role,
          });
        } catch (err) {
          playerData.push({
            name: m.name,
            trophies: m.trophies,
            league: 'Unknown',
            townHall: '?',
            role: m.role,
          });
        }
        await new Promise(r => setTimeout(r, 80));
      }

      // Sort by league tier (trophies as proxy since higher trophies = higher league)
      playerData.sort((a, b) => {
        const leagueOrder = (l) => {
          if (l.includes('Legend')) return 10000;
          if (l.includes('Electro')) return 900 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Dragon')) return 700 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Titan')) return 500 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Champion')) return 400 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Master')) return 300 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Crystal')) return 200 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Gold')) return 150 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Silver')) return 100 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Bronze')) return 50 + parseInt(l.match(/\d+/)?.[0] || 0);
          if (l.includes('Barbarian')) return parseInt(l.match(/\d+/)?.[0] || 0);
          if (l === 'Unranked') return -1;
          return 0;
        };
        return leagueOrder(b.league) - leagueOrder(a.league);
      });

      const roleEmoji = (role) => {
        switch (role) {
          case 'leader': return '\uD83D\uDC51';     // 👑
          case 'coLeader': return '\u2B50';          // ⭐
          case 'admin': return '\uD83D\uDD36';       // 🔶
          default: return '\u2796';                   // ➖
        }
      };

      const lines = playerData.map((p, i) => {
        return `\`${String(i + 1).padStart(2)}.\` ${roleEmoji(p.role)} **${p.name}** — TH${p.townHall} | ${p.league}`;
      });

      // Split into chunks if too long (Discord embed limit)
      const embed = new EmbedBuilder()
        .setColor(0xf5c518)
        .setTitle(`\uD83D\uDC65 ${clans[0].clan_name} — Members (${playerData.length})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: '\uD83D\uDC51 Leader  \u2B50 Co-Leader  \uD83D\uDD36 Elder  \u2796 Member' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Members error:', err);
      return interaction.editReply({ embeds: [errorEmbed('Failed to fetch clan members.')] });
    }
  },
};
