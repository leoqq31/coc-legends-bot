const {
  getWarStarSnapshot,
  upsertWarStarSnapshot,
  getAllWarBoards,
  getWarLeaderboard,
  updateWarBoardMessage,
  deleteWarBoard,
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
 * Update a single player's war star snapshot.
 * Called from the main legend poll where we already have playerData.
 * Returns true if an attack was detected (stars increased).
 */
function updatePlayerWarStars(playerTag, playerData) {
  const yearMonth = getCurrentYearMonth();
  const currentStars = playerData.warStars || 0;

  const existing = getWarStarSnapshot.get(playerTag, yearMonth);

  let startStars;
  let attackCount;
  let attackHappened = false;

  if (!existing) {
    // First time this month — lock in start
    startStars = currentStars;
    attackCount = 0;
  } else {
    startStars = existing.start_stars;
    attackCount = existing.attack_count;

    // If stars increased since last poll, count as 1 attack
    if (currentStars > existing.current_stars) {
      attackCount += 1;
      attackHappened = true;
    }
  }

  upsertWarStarSnapshot.run(playerTag, yearMonth, startStars, currentStars, attackCount);
  return attackHappened;
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
      let channel;
      try {
        channel = await client.channels.fetch(board.channel_id);
      } catch (err) {
        // Channel deleted or no access — remove the stale entry
        deleteWarBoard.run(board.guild_id);
        console.log(`[WarBoard] Removed stale entry for guild ${board.guild_id} (channel inaccessible)`);
        continue;
      }
      if (!channel) {
        deleteWarBoard.run(board.guild_id);
        continue;
      }

      const guild = channel.guild;
      const entries = getWarLeaderboard.all(yearMonth, guild.id);

      const embed = warLeaderboardEmbed(guild.name, entries, yearMonth);
      embed.setFooter({ text: 'Обновява се всяка минута' });
      embed.setTimestamp();

      if (board.message_id) {
        try {
          const msg = await channel.messages.fetch(board.message_id);
          await msg.edit({ embeds: [embed] });
          continue;
        } catch (err) {
          // Message gone, post a new one
        }
      }

      try {
        const msg = await channel.send({ embeds: [embed] });
        updateWarBoardMessage.run(msg.id, guild.id);
      } catch (err) {
        if (err.code === 50001 || err.message?.includes('Missing Access')) {
          deleteWarBoard.run(board.guild_id);
          console.log(`[WarBoard] Removed entry for guild ${board.guild_id} (no send access)`);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`[WarBoard] Failed for guild ${board.guild_id}:`, err.message);
    }
  }
}

module.exports = { updatePlayerWarStars, updateWarBoards, getCurrentYearMonth };
