const { getPlayerLevels, upsertPlayerLevels, getAllUpgradeChannels } = require('../database/queries');
const { EmbedBuilder } = require('discord.js');

// Pet names from the CoC API (they're mixed into the troops array)
const PET_NAMES = new Set([
  'L.A.S.S.I', 'Mighty Yak', 'Electro Owl', 'Unicorn', 'Phoenix',
  'Poison Lizard', 'Diggy', 'Frosty', 'Spirit Fox', 'Angry Jelly',
  'Sneezy', 'Greedy Raven',
]);

/**
 * Extract a flat { name: level } map from player data for heroes, troops, spells, equipment.
 * Only home village items.
 */
function extractLevels(playerData) {
  const levels = {};

  // Experience Level
  if (playerData.expLevel) {
    levels['level:Experience Level'] = playerData.expLevel;
  }

  // League (from leagueTier API field — the actual in-game rank)
  if (playerData.leagueTier) {
    levels['league:League'] = playerData.leagueTier.id;
    levels['league_name:League'] = playerData.leagueTier.name;
  }

  // Town Hall
  if (playerData.townHallLevel) {
    levels['townhall:Town Hall'] = playerData.townHallLevel;
  }

  // Heroes
  for (const h of playerData.heroes || []) {
    if (h.village !== 'home') continue;
    levels[`hero:${h.name}`] = h.level;
  }

  // Troops (includes pets)
  for (const t of playerData.troops || []) {
    if (t.village !== 'home') continue;
    if (PET_NAMES.has(t.name)) {
      levels[`pet:${t.name}`] = t.level;
    } else {
      levels[`troop:${t.name}`] = t.level;
    }
  }

  // Spells
  for (const s of playerData.spells || []) {
    if (s.village !== 'home') continue;
    levels[`spell:${s.name}`] = s.level;
  }

  // Hero Equipment
  for (const e of playerData.heroEquipment || []) {
    if (e.village !== 'home') continue;
    levels[`equipment:${e.name}`] = e.level;
  }

  // Achievements (track stars 0-3)
  for (const a of playerData.achievements || []) {
    levels[`achievement:${a.name}`] = a.stars;
  }

  return levels;
}

/**
 * Compare old and new levels, return list of upgrades.
 */
function findUpgrades(oldLevels, newLevels) {
  const upgrades = [];

  for (const [key, newLevel] of Object.entries(newLevels)) {
    const oldLevel = oldLevels[key];
    const [type, name] = key.split(':');

    if (type === 'league') {
      // League ID changed — promotion or demotion
      if (oldLevel !== undefined && newLevel !== oldLevel) {
        const promoted = newLevel > oldLevel;
        upgrades.push({ type: 'league', name, oldLevel, newLevel, promoted });
      }
    } else if (type === 'league_name') {
      // Skip — we use league_name only for display, tracked via league ID
      continue;
    } else if (oldLevel === undefined) {
      // Brand new item obtained (new equipment, troop, spell, pet)
      // Skip level, townhall, achievements — only notify for actual new items
      if (['equipment', 'troop', 'spell', 'pet', 'hero'].includes(type)) {
        upgrades.push({ type: type + '_new', name, oldLevel: 0, newLevel });
      }
    } else {
      // Existing item level increased
      if (newLevel > oldLevel) {
        upgrades.push({ type, name, oldLevel, newLevel });
      }
    }
  }

  return upgrades;
}

/**
 * Get emoji for upgrade type.
 */
function getUpgradeEmoji(type) {
  switch (type) {
    case 'level': return '\u2B50';               // ⭐
    case 'league_up': return '\uD83D\uDD3C';   // 🔼
    case 'league_down': return '\uD83D\uDD3D'; // 🔽
    case 'achievement': return '\uD83C\uDFC5';  // 🏅
    case 'townhall': return '\uD83C\uDFE0';    // 🏠
    case 'hero': return '\uD83E\uDDB8';        // 🦸
    case 'hero_new': return '\uD83E\uDDB8';    // 🦸
    case 'troop': return '\u2694\uFE0F';       // ⚔️
    case 'troop_new': return '\u2694\uFE0F';   // ⚔️
    case 'spell': return '\uD83E\uDDEA';       // 🧪
    case 'spell_new': return '\uD83E\uDDEA';   // 🧪
    case 'pet': return '\uD83D\uDC3E';         // 🐾
    case 'pet_new': return '\uD83D\uDC3E';     // 🐾
    case 'equipment': return '\uD83D\uDEE1\uFE0F'; // 🛡️
    case 'equipment_new': return '\uD83C\uDF81'; // 🎁
    default: return '\u2B50';                   // ⭐
  }
}

/**
 * Get display name for upgrade type.
 */
function getTypeName(type) {
  switch (type) {
    case 'level': return 'Level Up';
    case 'league_up': return 'Promotion';
    case 'league_down': return 'Demotion';
    case 'achievement': return 'Achievement';
    case 'townhall': return 'Town Hall';
    case 'hero': return 'Hero';
    case 'troop': return 'Troop';
    case 'spell': return 'Spell';
    case 'pet': return 'Pet';
    case 'equipment': return 'Equipment';
    default: return 'Unknown';
  }
}

/**
 * Check a player for upgrades and return any found.
 * Updates stored levels in DB.
 */
function checkPlayerUpgrades(playerTag, playerData) {
  const newLevels = extractLevels(playerData);
  const existing = getPlayerLevels.get(playerTag);

  let upgrades = [];

  if (existing) {
    const oldLevels = JSON.parse(existing.levels_json);
    upgrades = findUpgrades(oldLevels, newLevels);

    // Attach league names for league change notifications
    for (const u of upgrades) {
      if (u.type === 'league') {
        u.newLeagueName = newLevels['league_name:League'] || 'Unknown';
        u.oldLeagueName = oldLevels['league_name:League'] || 'Unknown';
      }
    }
  }
  // First time seeing this player — just store levels, no notifications

  // Always update stored levels
  upsertPlayerLevels.run(playerTag, JSON.stringify(newLevels));

  return upgrades;
}

/**
 * Send upgrade notifications to all configured channels.
 */
async function sendUpgradeNotifications(client, playerName, upgrades) {
  if (upgrades.length === 0) return;

  const channels = getAllUpgradeChannels.all();

  for (const upgrade of upgrades) {
    let emoji = getUpgradeEmoji(upgrade.type);
    let typeName = getTypeName(upgrade.type);

    let description;
    let color = 0xFFD700; // gold default

    if (upgrade.type === 'level') {
      typeName = 'Ново Ниво';
      description = `\uD83C\uDF89 Поздравления, **${playerName}** достигна Ниво **${upgrade.newLevel}**!`;
    } else if (upgrade.type === 'achievement') {
      typeName = 'Постижение';
      const stars = '\u2B50'.repeat(upgrade.newLevel);
      description = `\uD83C\uDF89 Поздравления, **${playerName}** завърши **${upgrade.name}**! ${stars}`;
    } else if (upgrade.type === 'league') {
      if (upgrade.promoted) {
        emoji = '\uD83D\uDD3C'; // 🔼
        typeName = 'Промоция';
        description = `\uD83C\uDF89 Поздравления, **${playerName}** влезе в **${upgrade.newLeagueName}**!`;
        color = 0x2ecc71; // green
      } else {
        emoji = '\uD83D\uDD3D'; // 🔽
        typeName = 'Понижение';
        description = `\uD83D\uDE14 За съжаление, **${playerName}** беше понижен от **${upgrade.oldLeagueName}** до **${upgrade.newLeagueName}**.`;
        color = 0xe74c3c; // red
      }
    } else if (upgrade.type.endsWith('_new')) {
      typeName = 'Ново Придобиване';
      description = `\uD83C\uDF81 Поздравления, **${playerName}** получи **${upgrade.name}**!`;
      color = 0x9b59b6; // purple
    } else {
      typeName = 'Нов Ъпгрейд';
      description = `\uD83C\uDF89 Поздравления, **${playerName}** ъпгрейдна **${upgrade.name}** до Ниво **${upgrade.newLevel}**!`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${typeName}!`)
      .setDescription(description)
      .setTimestamp();

    for (const ch of channels) {
      try {
        const channel = await client.channels.fetch(ch.channel_id);
        if (channel) await channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(`[Upgrades] Failed to send to channel ${ch.channel_id}:`, err.message);
      }
    }
  }
}

module.exports = { checkPlayerUpgrades, sendUpgradeNotifications };
