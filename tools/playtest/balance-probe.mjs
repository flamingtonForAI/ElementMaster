import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const out = process.argv[2];
if (!out) throw Error('Usage: balance-probe.mjs <new-output-directory>');
mkdirSync(out, { recursive: false });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [], errors = [];
try {
  for (const character of ['xiao', 'zhu', 'ruan', 'qingdai', 'moheng', 'xuanyi']) {
    for (const lv of [1, 8]) for (const element of ['metal', 'wood', 'water', 'fire', 'earth']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=${character}&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const row = await page.evaluate(async ({ character, lv, element }) => {
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261024, { character, level: 1 });
        const g = window.game.scene.getScene('game');
        g.build.level = lv;
        g.build.skills.set(g.char.startSkill, lv);
        g.build.recompute();
        g.pstats = g.build.stats();
        // Neutral terrain and no crits isolate skills/statuses. Character traits and elemental matchups remain.
        g.terrainMods = { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 };
        g.pstats.crit = 0;
        g.dbg.god = true;
        g.spawnUpdate = () => {};
        g.puppets.hurt = () => {};
        const x = g.player.x + 35, y = g.player.y;
        const target = g.enemies.spawn('shiyong', x, y, { hpMult: 10000, noXp: true });
        target.def = { ...target.def, el: element };
        target.armor = 0;
        target.speed = 0;
        const update = g.enemies.update.bind(g.enemies);
        g.enemies.update = dt => {
          target.x = x; target.y = y; target.kbx = target.kby = 0;
          update(dt);
        };
        const sums = { direct: 0, poison: 0, burn: 0, bleed: 0 };
        const hit = g.hitEnemy.bind(g), dot = g.dotEnemy.bind(g), bleed = g.bleedTick.bind(g);
        const counted = () => g.now >= 2; // exclude two seconds of summon/projectile warmup
        g.hitEnemy = (e, ...args) => {
          const value = hit(e, ...args);
          if (e === target && counted()) sums.direct += value;
          return value;
        };
        g.dotEnemy = (e, p, b) => {
          const hp = e.hp;
          dot(e, p, b);
          if (e !== target || !counted()) return;
          const weight = p * (e.poisonDeep ? 2 : 1) + b;
          sums.poison += (hp - e.hp) * p * (e.poisonDeep ? 2 : 1) / weight;
          sums.burn += (hp - e.hp) * b / weight;
        };
        g.bleedTick = (e, ...args) => {
          const hp = e.hp;
          bleed(e, ...args);
          if (e === target && counted()) sums.bleed += hp - e.hp;
        };
        for (let i = 0; i < 22; i++) bridge.advance('STAY', 60);
        return { character, lv, element, duration: 20, ...Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / 20])) };
      }, { character, lv, element });
      rows.push(row);
      await context.close();
    }
    console.log(`${character}: measured ${rows.length}/60`);
  }
  writeFileSync(`${out}/dps.json`, JSON.stringify({ method: '20s after 2s warmup, stationary single target at 35px, zero target armor, equal five elements, no crit/terrain/meta/passives, character level = skill level, invulnerable player/puppets. Tests sustained contact, not practical survival/coverage.', rows, errors }, null, 2));
  if (errors.length) throw Error(errors.join('\n'));
  for (const character of [...new Set(rows.map(r => r.character))]) {
    console.log(character, [1, 8].map(lv => {
      const group = rows.filter(r => r.character === character && r.lv === lv);
      const mean = key => group.reduce((s, r) => s + r[key], 0) / group.length;
      return { lv, direct: +mean('direct').toFixed(1), dot: +(mean('poison') + mean('burn') + mean('bleed')).toFixed(1) };
    }));
  }
} finally { await browser.close(); }
