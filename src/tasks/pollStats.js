const cron = require('node-cron');
const { getPlayer, getClanMembers } = require('../api/coc');
const { getAllClans, upsertPlayer, upsertDailyStats, getDailyStats, getAllBoards, getGuildClans, getClanLeaderboard, updateBoardMessage } = require('../database/queries');
const { getLegendDay } = require('../utils/format');
const { leaderboardEmbed } = require('../utils/embed');
const config = require('../config');

/**
 * Scrape all registered clans, discover legends players, and track trophy changes.
 * isReset=true means this is the 5 AM UTC poll — lock in start-of-day trophies.
 */
async function pollAllClans(isReset = false) {
  const clans = getAllClans.all();
  const today = getLegendDay();

  console.log(`[Poll] Scraping ${clans.length} clan(s) for legend day ${today}${isReset ? ' (RESET POLL)' : ''}`);

  for (const clan of clans) {
    try {
      const members = await getClanMembers(clan.clan_tag);

      for (const member of members) {
        try {
          const playerData = await getPlayer(member.tag);
          const legendStats = playerData.legendStatistics;
          const isLegend = !!legendStats?.currentSeason;
          const currentTrophies = playerData.trophies;
          const legendRank = legendStats?.currentSeason?.rank || 0;

          upsertPlayer.run(
            member.tag,
            member.name,
            clan.clan_tag,
            currentTrophies,
            legendRank,
            isLegend ? 1 : 0
          );

          if (!isLegend) {
            await new Promise(r => setTimeout(r, 100));
            continue;
          }

          const existing = getDailyStats.get(member.tag, today);

          let startTrophies;
          let attackTrophies;
          let defenseTrophies;

          if (isReset || !existing) {
            // First poll of the day or reset: lock in start trophies
            startTrophies = currentTrophies;
            attackTrophies = 0;
            defenseTrophies = 0;
          } else {
            startTrophies = existing.start_trophies;

            // Compare current trophies to last polled trophies (end_trophies)
            // to figure out what happened since the last poll
            const diff = currentTrophies - existing.end_trophies;

            // Accumulate: if trophies went up = attacks, if down = defenses
            // (In reality both could happen between polls, but this is the
            // best approximation without per-attack data from the API)
            attackTrophies = existing.attack_trophies + (diff > 0 ? diff : 0);
            defenseTrophies = existing.defense_trophies + (diff < 0 ? Math.abs(diff) : 0);
          }

          const netTrophies = currentTrophies - startTrophies;

          upsertDailyStats.run(
            member.tag,
            today,
            startTrophies,
            0, // attack_count — not available from API
            attackTrophies,
            0, // defense_count — not available from API
            defenseTrophies,
            netTrophies,
            currentTrophies
          );
        } catch (err) {
          console.error(`[Poll] Failed to fetch player ${member.tag}:`, err.message);
        }

        await new Promise(r => setTimeout(r, 100));
      }

      console.log(`[Poll] ${clan.clan_tag}: scraped ${members.length} members`);
    } catch (err) {
      console.error(`[Poll] Failed to scrape clan ${clan.clan_tag}:`, err.message);
    }
  }

  console.log(`[Poll] Done.`);
}

/**
 * Update all auto-updating leaderboard messages.
 */
async function updateBoards(client) {
  const boards = getAllBoards.all();
  const today = getLegendDay();

  for (const board of boards) {
    try {
      const channel = await client.channels.fetch(board.channel_id);
      if (!channel) continue;

      const guild = channel.guild;
      const clans = getGuildClans.all(guild.id);

      let allEntries = [];
      for (const clan of clans) {
        const entries = getClanLeaderboard.all(today, clan.clan_tag);
        allEntries.push(...entries);
      }
      allEntries.sort((a, b) => (b.end_trophies || b.trophies || 0) - (a.end_trophies || a.trophies || 0));

      const embed = leaderboardEmbed(guild.name, allEntries, today);
      embed.setFooter({ text: 'Last updated' });
      embed.setTimestamp();

      if (board.message_id) {
        try {
          const msg = await channel.messages.fetch(board.message_id);
          await msg.edit({ embeds: [embed] });
          console.log(`[Board] Updated message in ${guild.name}`);
          continue;
        } catch (err) {
          console.log(`[Board] Message not found in ${guild.name}, posting new one`);
        }
      }

      const msg = await channel.send({ embeds: [embed] });
      updateBoardMessage.run(msg.id, guild.id);
      console.log(`[Board] Posted new leaderboard in ${guild.name}`);
    } catch (err) {
      console.error(`[Board] Failed for guild ${board.guild_id}:`, err.message);
    }
  }
}

/**
 * Start the polling cron jobs.
 */
function startPolling(client) {
  async function pollAndUpdate(isReset = false) {
    await pollAllClans(isReset);
    await updateBoards(client);
  }

  // Regular poll every 30 minutes
  cron.schedule(`*/${config.pollIntervalMinutes} * * * *`, () => {
    pollAndUpdate().catch(err => console.error('[Poll] Cron error:', err));
  });

  // Legend day reset poll at 5:01 AM UTC
  cron.schedule('1 5 * * *', () => {
    pollAndUpdate(true).catch(err => console.error('[Poll] Reset poll error:', err));
  }, { timezone: 'UTC' });

  // Initial poll on startup
  pollAndUpdate().catch(err => console.error('[Poll] Initial poll error:', err));

  console.log('[Poll] Cron jobs started (regular + 5:01 AM UTC reset).');
}

module.exports = { startPolling, pollAllClans };
