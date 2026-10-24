import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('真实 Phaser：地脉刺逐段向前，同轮只伤一次，连续施放只击退、不累积眩晕，动画回收', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xiao&hd=1&playtest`);
    await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
    const result = await page.evaluate(async () => {
      const bridge = (await import('/tools/playtest/bridge.js')).install(20261024);
      const { SKILLS } = await import('/src/config/skills.ts');
      const g = window.game.scene.getScene('game');
      g.build.skills.clear();
      g.spawnUpdate = () => {};
      const { x, y } = g.player;
      const e = g.enemies.spawn('shuigui', x + 40, y + 3, { hpMult: 100, noXp: true });
      const wing = g.enemies.spawn('shuigui', x + 150, y + 45, { hpMult: 100, noXp: true });
      const side = g.enemies.spawn('shuigui', x + 40, y + 65, { hpMult: 100, noXp: true });
      const back = g.enemies.spawn('shuigui', x - 60, y, { hpMult: 100, noXp: true });
      g.enemies.update = () => {
        g.enemies.grid.clear();
        for (const enemy of [e, wing, side, back]) g.enemies.grid.insert(enemy);
      };
      g.enemies.update();
      const hits = [], ridges = [], rounds = [];
      const hit = g.hitEnemy.bind(g), anim = g.fx.anim.bind(g.fx);
      g.hitEnemy = (...args) => { const dmg = hit(...args); if (dmg > 0) hits.push(args[0].id); return dmg; };
      g.fx.anim = (key, sx, sy, opts) => {
        if (key === 'fx_earth_ridge') ridges.push({ x: sx, y: sy, time: g.now });
        return anim(key, sx, sy, opts);
      };
      for (let round = 0; round < 3; round++) {
        g.player.facing = { x: 1, y: 0 };
        g.skills.fire('stonespike', SKILLS.stonespike.stats(8));
        g.player.facing = { x: 0, y: -1 };
        bridge.advance('STAY', 42);
        rounds.push({ hits: hits.length, daze: e.daze, stunned: e.stunUntil > g.now, kbx: e.kbx, kby: e.kby });
        bridge.advance('STAY', 54);
      }
      bridge.advance('STAY', 60);
      return { hits, rounds, ridges, id: e.id, wingId: wing.id, x, y,
        visible: g.children.list.filter(o => o.visible && ['fx_earth_ridge', 'fx_crack'].includes(o.texture?.key)).length };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(result.hits, [result.id, result.wingId, result.id, result.wingId, result.id, result.wingId]);
    assert.deepEqual(result.rounds.map(r => r.daze), [0, 0, 0]);
    assert.deepEqual(result.rounds.map(r => r.stunned), [false, false, false]);
    for (const round of result.rounds) { assert.ok(round.kbx > 0); assert.equal(round.kby, 0); }
    const rows = [...Map.groupBy(result.ridges, ridge => ridge.time).values()];
    assert.equal(rows.length, 27);
    for (let round = 0; round < 3; round++) {
      const path = rows.slice(round * 9, (round + 1) * 9);
      for (let i = 0; i < path.length; i++) {
        const row = path[i];
        assert.ok(row.every(p => p.x > result.x && Math.abs(p.x - row[0].x) < 1e-9));
        const minY = Math.min(...row.map(p => p.y)), maxY = Math.max(...row.map(p => p.y));
        assert.ok(Math.abs((minY + maxY) / 2 - result.y - 2) < 1e-9);
        if (i) assert.ok(row[0].x > path[i - 1][0].x);
      }
      assert.ok(path.at(-1).length > path[0].length);
      const tip = path.at(-1);
      assert.ok(Math.max(...tip.map(p => p.y)) - Math.min(...tip.map(p => p.y)) > 160);
    }
    assert.equal(result.visible, 0);
  } finally { await browser.close(); }
});

test('正常血量与实际移动：首次命中就推开普通怪，升级增强推力，精英减弱且 Boss 免疫', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const samples = [];
    for (const [lv, kind] of [[1, 'normal'], [4, 'normal'], [4, 'elite'], [4, 'boss']]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xiao&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const sample = await page.evaluate(async ({ lv, kind }) => {
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261024);
        const { SKILLS } = await import('/src/config/skills.ts');
        const g = window.game.scene.getScene('game');
        g.build.skills.clear();
        g.spawnUpdate = () => {};
        g.pstats.crit = 0;
        // 普通怪采用第一关第 1 / 3 分钟的真实血量倍率；保留原有 AI 和碰撞移动。
        const minute = lv === 1 ? 1 : 3;
        const hpMult = 1 + 0.2 * minute + 0.022 * minute * minute;
        const e = g.enemies.spawn(kind === 'boss' ? 'langyao' : 'shiyong', g.player.x + 75, g.player.y,
          { hpMult, elite: kind === 'elite', noXp: true });
        const hits = [];
        const hit = g.hitEnemy.bind(g);
        let atHit = 0, peakX = -Infinity;
        g.hitEnemy = (...args) => {
          const startX = args[0].x;
          const damage = hit(...args);
          if (args[0] === e && damage > 0) {
            hits.push({ damage, impulse: e.kbx, hp: e.hp });
            atHit = startX;
          }
          return damage;
        };
        bridge.advance('STAY', 1);
        g.player.facing = { x: 1, y: 0 };
        g.skills.fire('stonespike', SKILLS.stonespike.stats(lv));
        for (let frame = 0; frame < 60; frame++) {
          bridge.advance('STAY', 1);
          if (hits.length) peakX = Math.max(peakX, e.x);
        }
        return { lv, kind, hits, alive: e.alive, daze: e.daze, stunUntil: e.stunUntil,
          maxHp: e.maxHp, displacement: peakX - atHit };
      }, { lv, kind });
      assert.deepEqual(errors, []);
      assert.equal(sample.hits.length, 1, `${kind} Lv${lv} 被后续岩刺重复命中`);
      assert.equal(sample.alive, true);
      assert.equal(sample.daze, 0);
      assert.equal(sample.stunUntil, 0);
      samples.push(sample);
      await context.close();
    }
    const [first, upgraded, elite, boss] = samples;
    assert.equal(first.maxHp, 49);
    assert.equal(upgraded.maxHp, 72);
    assert.ok(first.displacement > 28, JSON.stringify(first));
    assert.ok(upgraded.displacement > first.displacement + 10, JSON.stringify(samples));
    assert.equal(elite.hits[0].impulse, upgraded.hits[0].impulse * 0.4);
    assert.ok(elite.displacement > 5 && elite.displacement < upgraded.displacement);
    assert.equal(boss.hits[0].impulse, 0);
    console.log('实际推开距离（保留敌人主动移动）:', samples.map(s => ({ lv: s.lv, kind: s.kind, distance: +s.displacement.toFixed(1) })));
  } finally { await browser.close(); }
});
