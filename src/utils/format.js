/**
 * Normalize a player/clan tag: uppercase, ensure # prefix.
 */
function normalizeTag(tag) {
  tag = tag.trim().toUpperCase();
  if (!tag.startsWith('#')) tag = '#' + tag;
  return tag;
}

/**
 * Format trophies with + or - sign.
 */
function formatTrophyChange(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '0';
}

/**
 * Create a progress bar for attacks/defenses (out of 8).
 */
function progressBar(current, max = 8) {
  const filled = Math.min(current, max);
  const empty = max - filled;
  return '\u2B1B'.repeat(filled) + '\u2B1C'.repeat(empty) + ` ${current}/${max}`;
}

/**
 * Get today's legend day date string (YYYY-MM-DD).
 * Legend day resets at 5:00 AM UTC.
 */
function getLegendDay(date = new Date()) {
  const utcHours = date.getUTCHours();
  const d = new Date(date);
  // If before 5 AM UTC, it's still the previous legend day
  if (utcHours < 5) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().split('T')[0];
}

/**
 * Format a trophy number with the trophy emoji.
 */
function formatTrophies(n) {
  return `\uD83C\uDFC6 ${n.toLocaleString()}`;
}

/**
 * Get current legend week string (e.g. "2026-W16").
 * Weekly reset assumed Monday 5:00 AM UTC.
 */
function getLegendWeek(date = new Date()) {
  const d = new Date(date);
  // Shift to anchor week at Monday 5 AM UTC
  // If before Monday 5 AM UTC, treat as previous week
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const hours = d.getUTCHours();
  // Subtract days to get to most recent Monday at 5 AM UTC
  let daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  if (daysSinceMonday === 0 && hours < 5) {
    // Before Monday 5 AM \u2014 count as previous week
    daysSinceMonday = 7;
  }
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  d.setUTCHours(5, 0, 0, 0);

  // Now d is Monday 5 AM UTC of current week.
  // Generate ISO week label
  const year = d.getUTCFullYear();
  // Calculate ISO week number
  const target = new Date(d);
  target.setUTCDate(target.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Detect Legend League tier from CoC API leagueTier object.
 * The API returns "Legend League" as name for all 3 tiers — differentiated by ID:
 *   105000036 = Legend 1
 *   105000035 = Legend 2
 *   105000034 = Legend 3
 * Returns 'L1', 'L2', 'L3', or '' if not in legends.
 */
function detectLegendTier(leagueTier) {
  if (!leagueTier) return '';
  // Support being called with either the full object or just the id
  const id = typeof leagueTier === 'object' ? leagueTier.id : leagueTier;
  if (id === 105000036) return 'L1';
  if (id === 105000035) return 'L2';
  if (id === 105000034) return 'L3';
  return '';
}

module.exports = {
  normalizeTag,
  formatTrophyChange,
  progressBar,
  getLegendDay,
  getLegendWeek,
  detectLegendTier,
  formatTrophies,
};
