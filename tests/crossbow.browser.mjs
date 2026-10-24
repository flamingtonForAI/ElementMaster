import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('真实投射物：中后期连弩扩大群怪覆盖，孤立 Boss 输出保持', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [], errors = [];
  try {
    for (const scenario of ['crowd', 'boss']) for (const lv of scenario === 'crowd' ? [3, 5, 8] : [8]) {
      for (const before of [true, false]) {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=ruan&hd=0&playtest`);
        await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
        const result = await page.evaluate(async ({ scenario, lv, before }) => {
          const bridge = (await import('/tools/playtest/bridge.js')).install(20261025, { character: 'ruan', level: 1 });
          const { SKILLS } = await import('/src/config/skills.ts');
          const g = window.game.scene.getScene('game');
          g.build.skills.clear();
          g.spawnUpdate = () => {};
          g.pstats.crit = 0;
          g.dbg.god = true;
          g.terrainMods = { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 };
          const { x, y } = g.player;
          const targets = [];
          // 初期小水花只覆盖紧邻敌人；中后期另用更宽的 36px 行距验证分配目标。
          const spacing = lv === 3 ? 24 : 36;
          for (const dx of scenario === 'crowd' ? [90, 120, 150] : [120]) {
            for (const dy of scenario === 'crowd' ? [-spacing, 0, spacing] : [0]) {
              const e = g.enemies.spawn('shiyong', x + dx, y + dy, { hpMult: 10000, noXp: true });
              e.armor = 0;
              e.boss = scenario === 'boss';
              targets.push(e);
            }
          }
          // 只隔离移动/刷怪：真实空间查询、投射物碰撞、护甲/五行与特效仍照常执行。
          g.enemies.update = () => {
            g.enemies.grid.clear();
            for (const e of targets) g.enemies.grid.insert(e);
          };
          g.enemies.update();
          const hits = [], hit = g.hitEnemy.bind(g);
          g.hitEnemy = (e, ...args) => {
            const dmg = hit(e, ...args);
            if (dmg > 0) hits.push({ id: e.id, dmg, splash: !!args[2]?.noCrit });
            return dmg;
          };
          const st = SKILLS.crossbow.stats(lv);
          if (before) {
            // 复现调整前规则：只打最近目标，8 级才有半径 22 / 30% 水花，贯穿水花不去重。
            Object.assign(st, { targets: 1, splash: lv === 8 ? 0.3 : 0, splashRadius: 22, splashSlow: lv === 8 ? 0.8 : 0 });
            const splash = g.skills.boltSplash.bind(g.skills);
            g.skills.boltSplash = (e, dmg, radius, slow) => splash(e, dmg, radius, slow, new Set());
          }
          g.skills.fire('crossbow', st);
          bridge.advance('STAY', 60);
          bridge.advance('STAY', 60);
          return {
            spacing,
            targetsHit: new Set(hits.map(h => h.id)).size,
            damage: hits.reduce((s, h) => s + h.dmg, 0),
            directHits: hits.filter(h => !h.splash).length,
            splashHits: hits.filter(h => h.splash).length,
            activeBolts: g.proj.list.filter(p => p.active && p.kind === 'bolt').length,
          };
        }, { scenario, lv, before });
        rows.push({ scenario, lv, before, ...result });
        await context.close();
      }
      const [old, current] = rows.slice(-2);
      console.log(JSON.stringify({ old, current }));
      assert.equal(current.activeBolts, 0);
      if (scenario === 'boss') {
        assert.equal(current.damage, old.damage);
        assert.equal(current.directHits, 5);
        assert.equal(current.splashHits, 0);
      } else {
        assert.ok(current.targetsHit > old.targetsHit, `Lv${lv} 覆盖未扩大`);
        assert.ok(current.damage > old.damage, `Lv${lv} 群体总伤未提升`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
