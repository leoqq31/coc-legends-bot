const { db } = require('./db');

// ── Clans ──

const registerClan = db.prepare(`
  INSERT INTO clans (clan_tag, guild_id, clan_name, channel_id)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(clan_tag, guild_id) DO UPDATE SET
    clan_name = excluded.clan_name,
    channel_id = excluded.channel_id
`);

const removeClan = db.prepare(`
  DELETE FROM clans WHERE clan_tag = ? AND guild_id = ?
`);

const getGuildClans = db.prepare(`
  SELECT * FROM clans WHERE guild_id = ?
`);

const getAllClans = db.prepare(`
  SELECT * FROM clans
`);

// ── Players (auto-discovered from clan scrape) ──

const upsertPlayer = db.prepare(`
  INSERT INTO players (player_tag, player_name, clan_tag, trophies, legend_rank, is_legend, town_hall, legend_tier, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  ON CONFLICT(player_tag) DO UPDATE SET
    player_name = excluded.player_name,
    clan_tag = excluded.clan_tag,
    trophies = excluded.trophies,
    legend_rank = excluded.legend_rank,
    is_legend = excluded.is_legend,
    town_hall = excluded.town_hall,
    legend_tier = excluded.legend_tier,
    last_updated = unixepoch()
`);

const getClanPlayers = db.prepare(`
  SELECT * FROM players WHERE clan_tag = ?
`);

const getLegendPlayers = db.prepare(`
  SELECT * FROM players WHERE clan_tag = ? AND is_legend = 1 ORDER BY trophies DESC
`);

const removePlayer = db.prepare(`
  DELETE FROM players WHERE player_tag = ?
`);

const getPlayerByTag = db.prepare(`
  SELECT * FROM players WHERE player_tag = ?
`);

const getAllLegendPlayers = db.prepare(`
  SELECT * FROM players WHERE is_legend = 1
`);

// ── Daily Stats ──

const upsertDailyStats = db.prepare(`
  INSERT INTO daily_stats (player_tag, date, start_trophies, attack_count, attack_trophies, defense_count, defense_trophies, net_trophies, end_trophies)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_tag, date) DO UPDATE SET
    attack_count = excluded.attack_count,
    attack_trophies = excluded.attack_trophies,
    defense_count = excluded.defense_count,
    defense_trophies = excluded.defense_trophies,
    net_trophies = excluded.net_trophies,
    end_trophies = excluded.end_trophies
`);

const getDailyStats = db.prepare(`
  SELECT * FROM daily_stats WHERE player_tag = ? AND date = ?
`);

const getStatsHistory = db.prepare(`
  SELECT * FROM daily_stats WHERE player_tag = ? ORDER BY date DESC LIMIT ?
`);

const getClanLeaderboard = db.prepare(`
  SELECT p.player_name, p.player_tag, p.trophies, p.legend_rank,
         ds.start_trophies, ds.end_trophies, ds.net_trophies,
         ds.attack_count, ds.attack_trophies, ds.defense_count, ds.defense_trophies
  FROM players p
  LEFT JOIN daily_stats ds ON p.player_tag = ds.player_tag AND ds.date = ?
  WHERE p.clan_tag = ? AND p.trophies >= 4000
  ORDER BY COALESCE(ds.end_trophies, p.trophies) DESC
`);

// ── Boards (auto-updating leaderboard message) ──

const setBoard = db.prepare(`
  INSERT INTO boards (guild_id, channel_id, message_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    channel_id = excluded.channel_id,
    message_id = excluded.message_id
`);

const getBoard = db.prepare(`
  SELECT * FROM boards WHERE guild_id = ?
`);

const getAllBoards = db.prepare(`
  SELECT * FROM boards
`);

const updateBoardMessage = db.prepare(`
  UPDATE boards SET message_id = ? WHERE guild_id = ?
`);

// ── Weekly Legend Stats (L2 / L3) ──

const upsertWeeklyLegendStats = db.prepare(`
  INSERT INTO weekly_legend_stats (player_tag, year_week, tier, start_trophies, end_trophies, net_trophies, attack_trophies, defense_trophies)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(player_tag, year_week) DO UPDATE SET
    tier = excluded.tier,
    end_trophies = excluded.end_trophies,
    net_trophies = excluded.net_trophies,
    attack_trophies = excluded.attack_trophies,
    defense_trophies = excluded.defense_trophies
`);

const getWeeklyLegendStats = db.prepare(`
  SELECT * FROM weekly_legend_stats WHERE player_tag = ? AND year_week = ?
`);

const getWeeklyLegendLeaderboard = db.prepare(`
  SELECT p.player_name, p.player_tag, p.trophies, p.town_hall,
         w.start_trophies, w.end_trophies, w.net_trophies,
         w.attack_trophies, w.defense_trophies
  FROM players p
  LEFT JOIN weekly_legend_stats w ON p.player_tag = w.player_tag AND w.year_week = ?
  WHERE p.clan_tag = ? AND p.legend_tier = ?
  ORDER BY COALESCE(w.end_trophies, p.trophies) DESC
`);

// ── Legend Boards L2 / L3 ──

const setLegendBoardL2 = db.prepare(`
  INSERT INTO legend_boards_l2 (guild_id, channel_id, message_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    channel_id = excluded.channel_id,
    message_id = excluded.message_id
`);

const getAllLegendBoardsL2 = db.prepare(`SELECT * FROM legend_boards_l2`);

const updateLegendBoardL2Message = db.prepare(`
  UPDATE legend_boards_l2 SET message_id = ? WHERE guild_id = ?
`);

const deleteLegendBoardL2 = db.prepare(`
  DELETE FROM legend_boards_l2 WHERE guild_id = ?
`);

const setLegendBoardL3 = db.prepare(`
  INSERT INTO legend_boards_l3 (guild_id, channel_id, message_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    channel_id = excluded.channel_id,
    message_id = excluded.message_id
`);

const getAllLegendBoardsL3 = db.prepare(`SELECT * FROM legend_boards_l3`);

const updateLegendBoardL3Message = db.prepare(`
  UPDATE legend_boards_l3 SET message_id = ? WHERE guild_id = ?
`);

const deleteLegendBoardL3 = db.prepare(`
  DELETE FROM legend_boards_l3 WHERE guild_id = ?
`);

// ── Player Levels (upgrade tracking) ──

const getPlayerLevels = db.prepare(`
  SELECT * FROM player_levels WHERE player_tag = ?
`);

const upsertPlayerLevels = db.prepare(`
  INSERT INTO player_levels (player_tag, levels_json, updated_at)
  VALUES (?, ?, unixepoch())
  ON CONFLICT(player_tag) DO UPDATE SET
    levels_json = excluded.levels_json,
    updated_at = unixepoch()
`);

// ── Daily Summary Channels ──

const setDailyChannel = db.prepare(`
  INSERT INTO daily_channels (guild_id, channel_id)
  VALUES (?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
`);

const getAllDailyChannels = db.prepare(`
  SELECT * FROM daily_channels
`);

// ── Upgrade Channels ──

const setUpgradeChannel = db.prepare(`
  INSERT INTO upgrade_channels (guild_id, channel_id)
  VALUES (?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
`);

const getUpgradeChannel = db.prepare(`
  SELECT * FROM upgrade_channels WHERE guild_id = ?
`);

const getAllUpgradeChannels = db.prepare(`
  SELECT uc.guild_id, uc.channel_id, c.clan_tag
  FROM upgrade_channels uc
  JOIN clans c ON uc.guild_id = c.guild_id
`);

// ── War Stars Tracking ──

const addTrackedWarPlayer = db.prepare(`
  INSERT INTO tracked_war_players (player_tag, guild_id, player_name)
  VALUES (?, ?, ?)
  ON CONFLICT(player_tag, guild_id) DO UPDATE SET player_name = excluded.player_name
`);

const removeTrackedWarPlayer = db.prepare(`
  DELETE FROM tracked_war_players WHERE player_tag = ? AND guild_id = ?
`);

const getTrackedWarPlayers = db.prepare(`
  SELECT * FROM tracked_war_players WHERE guild_id = ?
`);

const getAllTrackedWarPlayers = db.prepare(`
  SELECT * FROM tracked_war_players
`);

const upsertWarStarSnapshot = db.prepare(`
  INSERT INTO war_star_snapshots (player_tag, year_month, start_stars, current_stars, attack_count)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(player_tag, year_month) DO UPDATE SET
    current_stars = excluded.current_stars,
    attack_count = excluded.attack_count
`);

const getWarStarSnapshot = db.prepare(`
  SELECT * FROM war_star_snapshots WHERE player_tag = ? AND year_month = ?
`);

const getWarLeaderboard = db.prepare(`
  SELECT twp.player_name, twp.player_tag,
         wss.start_stars, wss.current_stars, wss.attack_count,
         (wss.current_stars - wss.start_stars) AS stars_this_month,
         p.town_hall
  FROM tracked_war_players twp
  LEFT JOIN war_star_snapshots wss
    ON twp.player_tag = wss.player_tag AND wss.year_month = ?
  LEFT JOIN players p ON twp.player_tag = p.player_tag
  WHERE twp.guild_id = ?
  ORDER BY stars_this_month DESC NULLS LAST, twp.player_name ASC
`);

const getWarLeaderboardAllTime = db.prepare(`
  SELECT twp.player_name, twp.player_tag,
         COALESCE(SUM(wss.current_stars - wss.start_stars), 0) AS stars_this_month,
         COALESCE(SUM(wss.attack_count), 0) AS attack_count,
         COALESCE(MAX(wss.current_stars), 0) AS current_stars,
         MIN(wss.year_month) AS first_month,
         p.town_hall
  FROM tracked_war_players twp
  LEFT JOIN war_star_snapshots wss ON twp.player_tag = wss.player_tag
  LEFT JOIN players p ON twp.player_tag = p.player_tag
  WHERE twp.guild_id = ?
  GROUP BY twp.player_tag, twp.player_name, p.town_hall
  ORDER BY stars_this_month DESC, twp.player_name ASC
`);

const getEarliestWarMonth = db.prepare(`
  SELECT MIN(year_month) AS first_month FROM war_star_snapshots
`);

// ── War Boards (auto-updating war leaderboard) ──

const setWarBoard = db.prepare(`
  INSERT INTO war_boards (guild_id, channel_id, message_id)
  VALUES (?, ?, ?)
  ON CONFLICT(guild_id) DO UPDATE SET
    channel_id = excluded.channel_id,
    message_id = excluded.message_id
`);

const getAllWarBoards = db.prepare(`
  SELECT * FROM war_boards
`);

const updateWarBoardMessage = db.prepare(`
  UPDATE war_boards SET message_id = ? WHERE guild_id = ?
`);

const deleteWarBoard = db.prepare(`
  DELETE FROM war_boards WHERE guild_id = ?
`);

module.exports = {
  registerClan,
  removeClan,
  getGuildClans,
  getAllClans,
  upsertPlayer,
  getClanPlayers,
  getLegendPlayers,
  removePlayer,
  getPlayerByTag,
  getAllLegendPlayers,
  upsertDailyStats,
  getDailyStats,
  getStatsHistory,
  getClanLeaderboard,
  setBoard,
  getBoard,
  getAllBoards,
  updateBoardMessage,
  getPlayerLevels,
  upsertPlayerLevels,
  setDailyChannel,
  getAllDailyChannels,
  setUpgradeChannel,
  getUpgradeChannel,
  getAllUpgradeChannels,
  addTrackedWarPlayer,
  removeTrackedWarPlayer,
  getTrackedWarPlayers,
  getAllTrackedWarPlayers,
  upsertWarStarSnapshot,
  getWarStarSnapshot,
  getWarLeaderboard,
  getWarLeaderboardAllTime,
  getEarliestWarMonth,
  setWarBoard,
  getAllWarBoards,
  updateWarBoardMessage,
  deleteWarBoard,
  upsertWeeklyLegendStats,
  getWeeklyLegendStats,
  getWeeklyLegendLeaderboard,
  setLegendBoardL2,
  getAllLegendBoardsL2,
  updateLegendBoardL2Message,
  deleteLegendBoardL2,
  setLegendBoardL3,
  getAllLegendBoardsL3,
  updateLegendBoardL3Message,
  deleteLegendBoardL3,
};
