const cron = require('node-cron');
const { getPlayer, getClanMembers } = require('../api/coc');
const { getAllClans, upsertPlayer, upsertDailyStats, getDailyStats, getAllBoards, getGuildClans, getClanLeaderboard, updateBoardMessage, getClanPlayers, removePlayer, getAllUpgradeChannels, getAllDailyChannels, addTrackedWarPlayer, upsertWeeklyLegendStats, getWeeklyLegendStats, getWeeklyLegendLeaderboard, getAllLegendBoardsL2, getAllLegendBoardsL3, updateLegendBoardL2Message, updateLegendBoardL3Message, deleteLegendBoardL2, deleteLegendBoardL3 } = require('../database/queries');
const { EmbedBuilder } = require('discord.js');
const { getLegendDay, getLegendWeek, detectLegendTier } = require('../utils/format');
const { leaderboardEmbed, weeklyLegendEmbed } = require('../utils/embed');
const { checkPlayerUpgrades, sendUpgradeNotifications } = require('./upgradeTracker');
const { updatePlayerWarStars, updateWarBoards } = require('./warTracker');
const config = require('../config');

// Store client reference for notifications
let _client = null;

/**
 * Send clan join/leave notification to upgrade channels.
 */
async function sendClanNotification(client, playerName, type) {
  const channels = getAllUpgradeChannels.all();

  let embed;
  if (type === 'join') {
    embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('\uD83D\uDC4B Нов член!')
      .setDescription(`\uD83C\uDF89 Добре дошъл, **${playerName}** в клана!`)
      .setTimestamp();
  } else {
    embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('\uD83D\uDEAA Напускане!')
      .setDescription(`\uD83D\uDE14 За съжаление, **${playerName}** напусна клана.`)
      .setTimestamp();
  }

  for (const ch of channels) {
    try {
      const channel = await client.channels.fetch(ch.channel_id);
      if (channel) await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[Clan] Failed to send notification:`, err.message);
    }
  }
}

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

      // Detect joins and leaves
      if (_client) {
        const oldPlayers = getClanPlayers.all(clan.clan_tag);
        const oldTags = new Set(oldPlayers.map(p => p.player_tag));
        const newTags = new Set(members.map(m => m.tag));

        // Only detect joins/leaves if we have a solid baseline
        // (at least 80% of current members already stored — prevents spam on fresh DB)
        if (oldPlayers.length >= members.length * 0.8) {
          // New members (joined)
          for (const m of members) {
            if (!oldTags.has(m.tag)) {
              console.log(`[Clan] ${m.name} joined ${clan.clan_tag}`);
              await sendClanNotification(_client, m.name, 'join');
            }
          }

          // Old members no longer in clan (left)
          for (const p of oldPlayers) {
            if (!newTags.has(p.player_tag)) {
              console.log(`[Clan] ${p.player_name} left ${clan.clan_tag}`);
              await sendClanNotification(_client, p.player_name, 'leave');
              removePlayer.run(p.player_tag);
            }
          }
        } else if (oldPlayers.length > 0) {
          console.log(`[Clan] Skipping join/leave — baseline incomplete (${oldPlayers.length}/${members.length})`);
        }
      }

      for (const member of members) {
        try {
          const playerData = await getPlayer(member.tag);
          const legendStats = playerData.legendStatistics;
          const currentTrophies = playerData.trophies;
          const isLegend = !!legendStats?.currentSeason || currentTrophies >= 4000;
          const legendRank = legendStats?.currentSeason?.rank || 0;
          const legendTier = detectLegendTier(playerData.leagueTier?.name);

          upsertPlayer.run(
            member.tag,
            member.name,
            clan.clan_tag,
            currentTrophies,
            legendRank,
            isLegend ? 1 : 0,
            playerData.townHallLevel || 0,
            legendTier
          );

          // Track weekly stats for L2/L3 players
          if (legendTier === 'L2' || legendTier === 'L3') {
            const yearWeek = getLegendWeek();
            const existing = getWeeklyLegendStats.get(member.tag, yearWeek);
            const startTrophies = existing ? existing.start_trophies : currentTrophies;
            const netTrophies = currentTrophies - startTrophies;

            let attackTrophies, defenseTrophies;
            if (!existing) {
              attackTrophies = 0;
              defenseTrophies = 0;
            } else {
              const diff = currentTrophies - existing.end_trophies;
              if (diff > 0) {
                attackTrophies = existing.attack_trophies + diff;
                defenseTrophies = existing.defense_trophies;
              } else if (diff < 0) {
                attackTrophies = existing.attack_trophies;
                defenseTrophies = existing.defense_trophies + Math.abs(diff);
              } else {
                attackTrophies = existing.attack_trophies;
                defenseTrophies = existing.defense_trophies;
              }
            }

            upsertWeeklyLegendStats.run(
              member.tag,
              yearWeek,
              legendTier,
              startTrophies,
              currentTrophies,
              netTrophies,
              attackTrophies,
              defenseTrophies
            );
          }

          // Auto-add to war stars roster (persists even if they leave clan)
          addTrackedWarPlayer.run(member.tag, clan.guild_id, member.name);

          // Update war star snapshot (uses playerData we already have)
          updatePlayerWarStars(member.tag, playerData);

          // Check for upgrades (all members, not just legends)
          if (_client) {
            const upgrades = checkPlayerUpgrades(member.tag, playerData);
            if (upgrades.length > 0) {
              console.log(`[Upgrades] ${member.name}: ${upgrades.map(u => `${u.name} -> ${u.newLevel}`).join(', ')}`);
              await sendUpgradeNotifications(_client, member.name, upgrades);
            }
          }

          if (!isLegend) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }

          const existing = getDailyStats.get(member.tag, today);

          let startTrophies;
          let attackTrophies;
          let defenseTrophies;
          let attackCount;
          let defenseCount;

          if (isReset || !existing) {
            startTrophies = currentTrophies;
            attackTrophies = 0;
            defenseTrophies = 0;
            attackCount = 0;
            defenseCount = 0;
          } else {
            startTrophies = existing.start_trophies;
            attackCount = existing.attack_count;
            defenseCount = existing.defense_count;

            const diff = currentTrophies - existing.end_trophies;

            if (diff > 0) {
              attackTrophies = existing.attack_trophies + diff;
              defenseTrophies = existing.defense_trophies;
              // Count how many attacks likely happened based on trophy gain
              // Each attack gives 5-40 trophies, so divide by 40 and ceil
              const newAttacks = Math.ceil(diff / 40);
              attackCount = Math.min(attackCount + newAttacks, 8);
            } else if (diff < 0) {
              attackTrophies = existing.attack_trophies;
              defenseTrophies = existing.defense_trophies + Math.abs(diff);
              const newDefenses = Math.ceil(Math.abs(diff) / 40);
              defenseCount = Math.min(defenseCount + newDefenses, 8);
            } else {
              attackTrophies = existing.attack_trophies;
              defenseTrophies = existing.defense_trophies;
            }
          }

          const netTrophies = currentTrophies - startTrophies;

          upsertDailyStats.run(
            member.tag,
            today,
            startTrophies,
            attackCount,
            attackTrophies,
            defenseCount,
            defenseTrophies,
            netTrophies,
            currentTrophies
          );
        } catch (err) {
          console.error(`[Poll] Failed to fetch player ${member.tag}:`, err.message);
        }

        await new Promise(r => setTimeout(r, 500));
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
 * Update L2 / L3 weekly leaderboards.
 */
async function updateWeeklyBoard(client, tier) {
  const getBoards = tier === 'L2' ? getAllLegendBoardsL2 : getAllLegendBoardsL3;
  const updateMsg = tier === 'L2' ? updateLegendBoardL2Message : updateLegendBoardL3Message;
  const deleteBoard = tier === 'L2' ? deleteLegendBoardL2 : deleteLegendBoardL3;
  const tierLabel = tier === 'L2' ? 'II' : 'III';

  const boards = getBoards.all();
  if (boards.length === 0) return;

  const yearWeek = getLegendWeek();

  for (const board of boards) {
    try {
      let channel;
      try {
        channel = await client.channels.fetch(board.channel_id);
      } catch (err) {
        deleteBoard.run(board.guild_id);
        continue;
      }
      if (!channel) {
        deleteBoard.run(board.guild_id);
        continue;
      }

      const guild = channel.guild;
      const clans = getGuildClans.all(guild.id);

      let allEntries = [];
      for (const clan of clans) {
        const entries = getWeeklyLegendLeaderboard.all(yearWeek, clan.clan_tag, tier);
        allEntries.push(...entries);
      }
      allEntries.sort((a, b) => (b.end_trophies || b.trophies || 0) - (a.end_trophies || a.trophies || 0));

      const embed = weeklyLegendEmbed(guild.name, allEntries, yearWeek, tierLabel);
      embed.setFooter({ text: 'Last updated' });
      embed.setTimestamp();

      if (board.message_id) {
        try {
          const msg = await channel.messages.fetch(board.message_id);
          await msg.edit({ embeds: [embed] });
          continue;
        } catch (err) { /* fall through to post new */ }
      }

      try {
        const msg = await channel.send({ embeds: [embed] });
        updateMsg.run(msg.id, guild.id);
      } catch (err) {
        if (err.code === 50001 || err.message?.includes('Missing Access')) {
          deleteBoard.run(board.guild_id);
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (err.code === 50001 || err.message?.includes('Missing Access')) {
        deleteBoard.run(board.guild_id);
      } else {
        console.error(`[Legend ${tier}] Failed for guild ${board.guild_id}:`, err.message);
      }
    }
  }
}

/**
 * Post yesterday's legend summary to all configured daily channels.
 */
async function postDailySummary(client) {
  const dailyChannels = getAllDailyChannels.all();
  if (dailyChannels.length === 0) return;

  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = getLegendDay(yesterday);

  for (const dc of dailyChannels) {
    try {
      const channel = await client.channels.fetch(dc.channel_id);
      if (!channel) continue;

      const guild = channel.guild;
      const clans = getGuildClans.all(guild.id);

      let allEntries = [];
      for (const clan of clans) {
        const entries = getClanLeaderboard.all(yesterdayStr, clan.clan_tag);
        allEntries.push(...entries);
      }

      // Only include entries that have stats
      allEntries = allEntries.filter(e => e.end_trophies != null);
      allEntries.sort((a, b) => (b.end_trophies || 0) - (a.end_trophies || 0));

      if (allEntries.length === 0) continue;

      const embed = leaderboardEmbed(guild.name, allEntries, yesterdayStr);
      embed.setTitle(`\uD83D\uDCCA ${guild.name} - Дневен отчет`);
      embed.setFooter({ text: `Legend Day: ${yesterdayStr}` });
      embed.setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log(`[Daily] Posted summary for ${yesterdayStr} in ${guild.name}`);
    } catch (err) {
      console.error(`[Daily] Failed for guild ${dc.guild_id}:`, err.message);
    }
  }
}

/**
 * Start the polling cron jobs.
 */
function startPolling(client) {
  _client = client;

  let pollInProgress = false;

  async function runPoll(isReset = false) {
    if (pollInProgress) {
      console.log('[Poll] Skipping — previous poll still running');
      return;
    }
    pollInProgress = true;
    try {
      await pollAllClans(isReset);
    } finally {
      pollInProgress = false;
    }
  }

  async function updateAllBoards() {
    await updateBoards(client).catch(err => console.error('[Board] Update error:', err));
    await updateWarBoards(client).catch(err => console.error('[WarBoard] Update error:', err));
    await updateWeeklyBoard(client, 'L2').catch(err => console.error('[L2] Update error:', err));
    await updateWeeklyBoard(client, 'L3').catch(err => console.error('[L3] Update error:', err));
  }

  // Poll every N minutes (fetches data, updates DB)
  cron.schedule(`*/${config.pollIntervalMinutes} * * * *`, () => {
    runPoll().catch(err => console.error('[Poll] Cron error:', err));
  });

  // Update boards every minute — independent of poll timing
  // Always shows the latest DB state even if poll takes > 1 minute
  cron.schedule('* * * * *', () => {
    updateAllBoards().catch(err => console.error('[Board] Cron error:', err));
  });

  // Post daily summary at 5:00 AM UTC (before reset)
  cron.schedule('0 5 * * *', () => {
    postDailySummary(client).catch(err => console.error('[Daily] Summary error:', err));
  }, { timezone: 'UTC' });

  // Legend day reset poll at 5:01 AM UTC
  // Note: weekly reset for L2/L3 happens automatically when getLegendWeek() returns a new value
  cron.schedule('1 5 * * *', () => {
    runPoll(true).catch(err => console.error('[Poll] Reset poll error:', err));
  }, { timezone: 'UTC' });

  // Initial poll on startup
  runPoll().catch(err => console.error('[Poll] Initial poll error:', err));
  updateAllBoards().catch(err => console.error('[Board] Initial update error:', err));

  console.log('[Poll] Cron jobs started (legend + war + reset).');
}

module.exports = { startPolling, pollAllClans };
