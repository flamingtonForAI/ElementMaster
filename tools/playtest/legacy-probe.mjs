import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const out = process.argv[2];
if (!out) throw Error('Usage: legacy-probe.mjs <new-output-directory>');
mkdirSync(out, { recursive: false });
const cases = [];
for (const lv of [4, 8]) for (const branch of ['none', 'chain']) cases.push({ character: 'xiao', lv, branch });
for (const lv of [5, 8]) for (const branch of ['none', 'early']) cases.push({ character: 'moheng', lv, branch });
for (const lv of [1, 8]) for (const branch of ['none', 'extra', 'sea']) cases.push({ character: 'zhu', lv, branch });
for (const fullBuild of ['balanced', 'focused']) for (const branch of ['none', 'cycle', 'taiji']) {
  cases.push({ character: 'xuanyi', lv: 4, branch, fullBuild, duration: 300 });
}
for (const boss of [false, true]) cases.push({ character: 'qingdai', lv: 8, branch: 'none', boss });
for (const skill of ['leaf', 'tengfu', 'crossbow', 'fireball']) for (const armor of [0, 9]) {
  cases.push({ character: skill === 'crossbow' ? 'ruan' : 'xuanyi', lv: 8, branch: 'none', skill, armor });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [], errors = [];
const method = 'Three seeds; real Phaser combat; stationary high-HP target at 35px; earth element except wood-vs-metal poison comparison; no crit/terrain/meta/star/passives except ningshen Lv4 in the 24-investment full build; 2s warmup. Player/puppets invulnerable. Does not measure survival, natural progression or moving-target uptime.';
const save = complete => writeFileSync(`${out}/dps.json`, JSON.stringify({ method, complete, rows, errors }, null, 2));
try {
  for (const c of cases) {
    for (const seed of [20261025, 20261026, 20261027]) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        // Match run.mjs: freeze loaded modules so unrelated workspace edits cannot restart a sample.
        await page.routeWebSocket(url => ['127.0.0.1', 'localhost'].includes(url.hostname), ws => {
          const server = ws.connectToServer();
          server.onMessage(message => {
            let payload;
            try { payload = JSON.parse(String(message)); } catch {}
            if (!['full-reload', 'update', 'prune'].includes(payload?.type)) ws.send(message);
          });
        });
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${process.env.PLAYTEST_URL || 'http://127.0.0.1:5180/'}?level=1&char=${c.character}&hd=0&playtest`);
        await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
        rows.push(await page.evaluate(async ({ c, seed }) => {
          const bridge = (await import('/tools/playtest/bridge.js')).install(seed, { character: c.character, level: 1 });
          const { LEGACIES } = await import('/src/config/legacy.ts');
          const { addMods } = await import('/src/config/startree.ts');
          const g = window.game.scene.getScene('game');
          const nodes = LEGACIES[c.character];
          const selection = c.branch === 'chain' ? [nodes[0].nodes[1]]
            : c.branch === 'early' ? [nodes[1].nodes[1]]
            : c.branch === 'extra' ? [nodes[1].nodes[0]]
            : c.branch === 'sea' || c.branch === 'taiji' ? nodes[1].nodes
            : c.branch === 'cycle' ? nodes[0].nodes : [];
          for (const node of selection) addMods(g.build.mods, node.mods);
          g.build.level = c.fullBuild ? 24 : c.lv;
          g.build.skills = new Map(c.fullBuild
            ? c.fullBuild === 'focused' ? [['fireball', 8], ['lihuo', 4], ['waterdragon', 8]]
              : ['fireball', 'flysword', 'leaf', 'waterdragon', 'stonespike'].map(id => [id, 4])
            : [[c.skill || g.char.startSkill, c.lv]]);
          if (c.fullBuild) g.build.passives.set('ningshen', 4);
          g.build.recompute();
          g.pstats = g.build.stats();
          g.pstats.crit = 0;
          g.terrainMods = { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 };
          // Short single-skill checks isolate legacy/armor; the full build runs complete rotation cycles.
          if (!c.fullBuild) g.zhoutian = null;
          else {
            if (g.build.mods['xuan.known'] && !g.zhoutianElements().includes(g.zhoutian)) g.zhoutian = g.zhoutianElements()[0];
            g.zhoutianAt = g.zhoutianPeriod();
          }
          g.dbg.god = true;
          g.spawnUpdate = () => {};
          g.puppets.hurt = () => {};
          g.gainXp = () => {};
          // Suppress level timeline only; scheduled skill effects continue using the real clock.
          g.timeline = [];
          g.nextEliteAt = g.nextItemAt = Infinity;
          const x = g.player.x + 35, y = g.player.y;
          const target = g.enemies.spawn('shiyong', x, y, { hpMult: 1e8, noXp: true });
          // Metal is the first boss's element; use identical stationary targets to isolate the boss flag.
          target.def = { ...target.def, el: c.character === 'qingdai' ? 'metal' : 'earth' };
          target.boss = !!c.boss;
          target.armor = c.armor ?? 0;
          target.speed = 0;
          const update = g.enemies.update.bind(g.enemies);
          g.enemies.update = dt => {
            target.x = x; target.y = y; target.kbx = target.kby = 0;
            // Earth confusion otherwise makes a nominally stationary target wander.
            target.confusedUntil = 0;
            update(dt);
          };
          const duration = c.duration ?? 30;
          const sums = { direct: 0, dot: 0, bleed: 0 };
          const wrap = (key, bucket) => {
            const original = g[key].bind(g);
            g[key] = (e, ...args) => {
              const hp = e.hp, result = original(e, ...args);
              if (e === target && g.now >= 2 && g.now < 2 + duration) sums[bucket] += hp - e.hp;
              return result;
            };
          };
          wrap('hitEnemy', 'direct'); wrap('dotEnemy', 'dot'); wrap('bleedTick', 'bleed');
          for (let i = 0; i < duration + 2; i++) bridge.advance('STAY', 60);
          const dps = Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / duration]));
          return { ...c, seed, duration, ...dps, total: Object.values(dps).reduce((a, b) => a + b, 0), mods: g.build.mods };
        }, { c, seed }));
        save(false);
      } finally { await context.close(); }
    }
    const group = rows.slice(-3);
    console.log(JSON.stringify({ ...c, direct: group.reduce((s, r) => s + r.direct, 0) / 3, total: group.reduce((s, r) => s + r.total, 0) / 3 }));
  }
  if (errors.length) throw Error(errors.join('\n'));
  save(true);
} catch (error) {
  errors.push(error.message);
  save(false);
  throw error;
} finally { await browser.close(); }
