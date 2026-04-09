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
  INSERT INTO players (player_tag, player_name, clan_tag, trophies, legend_rank, is_legend, last_updated)
  VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  ON CONFLICT(player_tag) DO UPDATE SET
    player_name = excluded.player_name,
    clan_tag = excluded.clan_tag,
    trophies = excluded.trophies,
    legend_rank = excluded.legend_rank,
    is_legend = excluded.is_legend,
    last_updated = unixepoch()
`);

const getLegendPlayers = db.prepare(`
  SELECT * FROM players WHERE clan_tag = ? AND is_legend = 1 ORDER BY trophies DESC
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
         ds.attack_trophies, ds.defense_trophies
  FROM players p
  LEFT JOIN daily_stats ds ON p.player_tag = ds.player_tag AND ds.date = ?
  WHERE p.clan_tag = ? AND p.is_legend = 1 AND p.trophies >= 3800
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

module.exports = {
  registerClan,
  removeClan,
  getGuildClans,
  getAllClans,
  upsertPlayer,
  getLegendPlayers,
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
};
