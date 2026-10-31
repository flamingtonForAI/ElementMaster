import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('离火环实战：上下扩大后的目标可命中，中心和圈外不受伤，高转速低帧率保留共享间隔', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await mkdir('output/skill-range', { recursive: true });
  try {
    for (const lv of [1, 8]) for (const fast of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xuanyi&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const result = await page.evaluate(async ({ lv, fast }) => {
        const { SKILLS } = await import('/src/config/skills.ts');
        (await import('/tools/playtest/bridge.js')).install(20261031, {
          character: 'xuanyi', level: 1, meta: {}, skills: { fuchen: 1, lihuo: lv }, passives: {}, buildLevel: 1, lockXp: true,
        });
        const g = window.game.scene.getScene('game'), st = SKILLS.lihuo.stats(lv);
        g.skills.timers.set('fuchen', Infinity);
        g.spawnUpdate = () => {}; g.dbg.god = true; g.pstats.crit = 0; g.pstats.area = 1;
        g.pstats.cdMult = fast ? 0.5 / st.period : 1;
        const px = g.player.x, py = g.player.y;
        const points = Array.from({ length: 24 }, (_, i) => {
          const a = i * Math.PI / 12;
          return [Math.cos(a) * st.orbit, Math.sin(a) * st.orbit * st.flat];
        });
        points.push([0, st.orbit * st.flat + 4], [0, -st.orbit * st.flat - 4], [0, 0], [st.orbit + st.hitRadius + 10, 0]);
        const targets = points.map(([x, y]) => g.enemies.spawn('shuigui', px + x, py + y, { hpMult: 10000, noXp: true }));
        const hits = targets.map(() => []), index = new Map(targets.map((e, i) => [e.id, i]));
        // 只固定靶位，使用真实空间索引、火团、命中与伤害流程。
        g.enemies.update = () => {
          g.enemies.grid.clear();
          targets.forEach((e, i) => {
            e.x = px + points[i][0]; e.y = py + points[i][1]; e.kbx = e.kby = 0;
            e.sprite.setPosition(e.x, e.y); g.enemies.grid.insert(e);
          });
        };
        g.enemies.update();
        const hit = g.hitEnemy.bind(g);
        g.hitEnemy = (e, damage, el, opts) => { hits[index.get(e.id)].push(g.now); return hit(e, damage, el, opts); };
        const hz = fast ? 20 : 60;
        let clock = window.game.loop.now;
        for (let frame = 0; frame < hz * 4; frame++) window.game.step(clock += 1000 / hz, 1000 / hz);
        return { hits, positions: g.skills.orbs.map(s => [s.x - px, s.y + 6 - py]), orbit: st.orbit, flat: st.flat, count: st.count };
      }, { lv, fast });
      assert.ok(result.hits.slice(0, 26).every(h => h.length), `Lv${lv} fast=${fast} 存在轨道漏判`);
      assert.deepEqual(result.hits.slice(26), [[], []]);
      assert.equal(result.positions.length, result.count);
      assert.ok(result.positions.every(([x, y]) => Math.abs((x / result.orbit) ** 2 + (y / (result.orbit * result.flat)) ** 2 - 1) < 1e-7));
      for (const h of result.hits) for (let i = 1; i < h.length; i++) assert.ok(h[i] - h[i - 1] >= 0.35 - 1e-8);
      await page.screenshot({ path: `output/skill-range/lihuo-lv${lv}-${fast ? 'fast' : 'normal'}.png` });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
