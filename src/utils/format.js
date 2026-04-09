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

module.exports = {
  normalizeTag,
  formatTrophyChange,
  progressBar,
  getLegendDay,
  formatTrophies,
};
