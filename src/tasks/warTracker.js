const { getPlayer } = require('../api/coc');
const {
  getAllTrackedWarPlayers,
  getWarStarSnapshot,
  upsertWarStarSnapshot,
  getAllWarBoards,
  getWarLeaderboard,
  getTrackedWarPlayers,
  updateWarBoardMessage,
} = require('../database/queries');
const { warLeaderboardEmbed } = require('../utils/embed');

/**
 * Get current year-month string in UTC (e.g. "2026-04").
 */
function getCurrentYearMonth(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Poll all tracked war players and update their war stars snapshots.
 */
async function pollWarStars() {
  const players = getAllTrackedWarPlayers.all();
  const yearMonth = getCurrentYearMonth();

  if (players.length === 0) return;

  console.log(`[War] Polling ${players.length} tracked war players for ${yearMonth}`);

  // Deduplicate by player_tag so we don't fetch the same player multiple times
  const uniquePlayers = new Map();
  for (const p of players) {
    if (!uniquePlayers.has(p.player_tag)) {
      uniquePlayers.set(p.player_tag, p);
    }
  }

  for (const player of uniquePlayers.values()) {
    try {
      const data = await getPlayer(player.player_tag);
      const currentStars = data.warStars || 0;

      // Check existing snapshot for this month
      const existing = getWarStarSnapshot.get(player.player_tag, yearMonth);
      const startStars = existing ? existing.start_stars : currentStars;

      upsertWarStarSnapshot.run(player.player_tag, yearMonth, startStars, currentStars);
    } catch (err) {
      console.error(`[War] Failed to fetch ${player.player_tag}:`, err.message);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('[War] Done.');
}

/**
 * Update all auto-updating war leaderboard messages.
 */
async function updateWarBoards(client) {
  const boards = getAllWarBoards.all();
  if (boards.length === 0) return;

  const yearMonth = getCurrentYearMonth();

  for (const board of boards) {
    try {
      const channel = await client.channels.fetch(board.channel_id);
      if (!channel) continue;

      const guild = channel.guild;
      const entries = getWarLeaderboard.all(yearMonth, guild.id);

      const embed = warLeaderboardEmbed(guild.name, entries, yearMonth);
      embed.setFooter({ text: 'Обновява се всяка минута' });
      embed.setTimestamp();

      if (board.message_id) {
        try {
          const msg = await channel.messages.fetch(board.message_id);
          await msg.edit({ embeds: [embed] });
          console.log(`[WarBoard] Updated message in ${guild.name}`);
          continue;
        } catch (err) {
          console.log(`[WarBoard] Message not found in ${guild.name}, posting new one`);
        }
      }

      const msg = await channel.send({ embeds: [embed] });
      updateWarBoardMessage.run(msg.id, guild.id);
      console.log(`[WarBoard] Posted new war leaderboard in ${guild.name}`);
    } catch (err) {
      console.error(`[WarBoard] Failed for guild ${board.guild_id}:`, err.message);
    }
  }
}

module.exports = { pollWarStars, updateWarBoards, getCurrentYearMonth };
