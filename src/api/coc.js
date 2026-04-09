const { fetch } = require('undici');
const config = require('../config');

const BASE_URL = 'https://api.clashofclans.com/v1';

function encodeTag(tag) {
  return encodeURIComponent(tag.startsWith('#') ? tag : `#${tag}`);
}

async function apiRequest(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${config.cocApiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`CoC API ${res.status}: ${body}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

async function getPlayer(playerTag) {
  return apiRequest(`/players/${encodeTag(playerTag)}`);
}

async function getClan(clanTag) {
  return apiRequest(`/clans/${encodeTag(clanTag)}`);
}

async function getClanMembers(clanTag) {
  const data = await apiRequest(`/clans/${encodeTag(clanTag)}/members`);
  return data.items || [];
}

/**
 * Extract legend day stats from player data.
 * The CoC API returns legendStatistics with previousSeason, bestSeason,
 * and legendLog entries for the current season.
 */
function extractLegendStats(playerData) {
  const legends = playerData.legendStatistics;
  if (!legends) return null;

  const currentSeason = legends.currentSeason || {};
  const legendLog = legends.legendLog?.items || [];

  // Current day from the legend log (most recent entry)
  const today = legendLog[0] || null;

  return {
    trophies: playerData.trophies,
    currentSeason: {
      id: currentSeason.id,
      trophies: currentSeason.trophies,
      rank: currentSeason.rank,
    },
    todayLog: today,
    recentDays: legendLog.slice(0, 10),
  };
}

/**
 * Parse a single legend log entry into attack/defense stats.
 * Each log entry has: { attack: [{attackerTag, defenderTag, trophies}...], defense: [...] }
 */
function parseLegendDay(logEntry) {
  if (!logEntry) {
    return {
      attackCount: 0,
      attackTrophies: 0,
      defenseCount: 0,
      defenseTrophies: 0,
      netTrophies: 0,
    };
  }

  const attacks = logEntry.attack || [];
  const defenses = logEntry.defense || [];

  const attackTrophies = attacks.reduce((sum, a) => sum + a.trophies, 0);
  const defenseTrophies = defenses.reduce((sum, d) => sum + d.trophies, 0);

  return {
    attackCount: attacks.length,
    attackTrophies,
    defenseCount: defenses.length,
    defenseTrophies,
    netTrophies: attackTrophies - defenseTrophies,
  };
}

module.exports = {
  getPlayer,
  getClan,
  getClanMembers,
  extractLegendStats,
  parseLegendDay,
  encodeTag,
};
