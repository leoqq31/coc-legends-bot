// Saves attackWins/defenseWins for L2/L3 players to a snapshot file
// Run twice (now and later) to see if these counters change with tournament play

const fs = require('fs');
const path = require('path');
const { getPlayer } = require('./src/api/coc');
const { db } = require('./src/database/db');

const SNAPSHOT_FILE = path.join(__dirname, 'wins-snapshot.json');

(async () => {
  const rows = db.prepare(`
    SELECT player_tag, player_name, legend_tier, trophies
    FROM players
    WHERE legend_tier IN ('L2', 'L3')
  `).all();

  console.log(`Snapshotting ${rows.length} L2/L3 players...`);

  const snapshot = {
    takenAt: new Date().toISOString(),
    players: [],
  };

  for (const r of rows) {
    try {
      const p = await getPlayer(r.player_tag);
      snapshot.players.push({
        tag: r.player_tag,
        name: p.name,
        tier: r.legend_tier,
        trophies: p.trophies,
        attackWins: p.attackWins,
        defenseWins: p.defenseWins,
      });
    } catch (e) {
      console.log(`Failed: ${r.player_name}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 300));
  }

  // If a previous snapshot exists, compare and show diffs
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const previous = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    console.log(`\nComparing to snapshot from: ${previous.takenAt}`);
    console.log('Changes since previous snapshot:\n');
    let anyChange = false;
    for (const cur of snapshot.players) {
      const prev = previous.players.find(p => p.tag === cur.tag);
      if (!prev) continue;
      const trophyDiff = cur.trophies - prev.trophies;
      const atkDiff = cur.attackWins - prev.attackWins;
      const defDiff = cur.defenseWins - prev.defenseWins;
      if (trophyDiff !== 0 || atkDiff !== 0 || defDiff !== 0) {
        anyChange = true;
        console.log(`${cur.name} (${cur.tier}): trophies ${trophyDiff > 0 ? '+' : ''}${trophyDiff}, attackWins ${atkDiff > 0 ? '+' : ''}${atkDiff}, defenseWins ${defDiff > 0 ? '+' : ''}${defDiff}`);
      }
    }
    if (!anyChange) console.log('  (no changes)');

    // Write a "comparison-DATE" file so we keep history
    const compFile = path.join(__dirname, `wins-comparison-${Date.now()}.json`);
    fs.writeFileSync(compFile, JSON.stringify({ previous, current: snapshot }, null, 2));
    console.log(`\nFull comparison saved to: ${compFile}`);
  }

  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot saved. Run this script again later to see changes.`);
  process.exit(0);
})();
