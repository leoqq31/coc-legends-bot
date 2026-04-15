const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'legends.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema creation immediately so prepared statements in queries.js work
(function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clans (
      clan_tag TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      clan_name TEXT NOT NULL DEFAULT '',
      channel_id TEXT,
      PRIMARY KEY (clan_tag, guild_id)
    );

    CREATE TABLE IF NOT EXISTS players (
      player_tag TEXT NOT NULL PRIMARY KEY,
      player_name TEXT NOT NULL,
      clan_tag TEXT NOT NULL,
      trophies INTEGER NOT NULL DEFAULT 0,
      legend_rank INTEGER NOT NULL DEFAULT 0,
      is_legend INTEGER NOT NULL DEFAULT 0,
      town_hall INTEGER NOT NULL DEFAULT 0,
      last_updated INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_tag TEXT NOT NULL,
      date TEXT NOT NULL,
      start_trophies INTEGER NOT NULL DEFAULT 0,
      attack_count INTEGER NOT NULL DEFAULT 0,
      attack_trophies INTEGER NOT NULL DEFAULT 0,
      defense_count INTEGER NOT NULL DEFAULT 0,
      defense_trophies INTEGER NOT NULL DEFAULT 0,
      net_trophies INTEGER NOT NULL DEFAULT 0,
      end_trophies INTEGER NOT NULL DEFAULT 0,
      UNIQUE(player_tag, date)
    );

    CREATE TABLE IF NOT EXISTS boards (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_channels (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_levels (
      player_tag TEXT NOT NULL PRIMARY KEY,
      levels_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS upgrade_channels (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tracked_war_players (
      player_tag TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      added_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (player_tag, guild_id)
    );

    CREATE TABLE IF NOT EXISTS war_star_snapshots (
      player_tag TEXT NOT NULL,
      year_month TEXT NOT NULL,
      start_stars INTEGER NOT NULL DEFAULT 0,
      current_stars INTEGER NOT NULL DEFAULT 0,
      attack_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (player_tag, year_month)
    );

    CREATE TABLE IF NOT EXISTS war_boards (
      guild_id TEXT NOT NULL PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
    CREATE INDEX IF NOT EXISTS idx_war_snapshots_month ON war_star_snapshots(year_month);
    CREATE INDEX IF NOT EXISTS idx_tracked_war_guild ON tracked_war_players(guild_id);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_player ON daily_stats(player_tag);
    CREATE INDEX IF NOT EXISTS idx_players_clan ON players(clan_tag);
  `);

  // Migration: add attack_count column if missing
  try {
    db.exec(`ALTER TABLE war_star_snapshots ADD COLUMN attack_count INTEGER NOT NULL DEFAULT 0`);
  } catch (e) { /* ignore */ }

  // Migration: add town_hall column to players if missing
  try {
    db.exec(`ALTER TABLE players ADD COLUMN town_hall INTEGER NOT NULL DEFAULT 0`);
  } catch (e) { /* ignore */ }
})();

module.exports = { db };
