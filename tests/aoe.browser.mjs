import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// 使用隔离试玩时钟；验证新特效不会改变伤害节奏或留下失效对象。
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('范围技能：冰环即时结算、符爆保留回响、落石落地命中，临时特效完整回收', async () => {
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
      const { SFX } = await import('/src/audio/sfx.ts');
      const g = window.game.scene.getScene('game');
      g.build.skills.clear();
      g.spawnUpdate = () => {};
      const x = g.player.x, y = g.player.y;
      const target = g.enemies.spawn('shiyong', x + 40, y, { hpMult: 100, noXp: true });
      const outside = g.enemies.spawn('shiyong', x + 150, y, { hpMult: 100, noXp: true });
      // 固定靶位，只隔离敌人 AI；范围查询、伤害、技能和动画仍用实际代码。
      g.enemies.update = () => {
        g.enemies.grid.clear();
        for (const e of [target, outside]) g.enemies.grid.insert(e);
      };
      g.enemies.update();
      const hits = [];
      const hit = g.hitEnemy.bind(g);
      g.hitEnemy = (e, dmg, el, options) => {
        hits.push({ id: e.id, dmg, el, proc: options?.proc, time: g.elapsed });
        return hit(e, dmg, el, options);
      };
      const advance = frames => {
        while (frames > 0) { const n = Math.min(60, frames); bridge.advance('STAY', n); frames -= n; }
      };
      const instant = g.skills.fire('hanbing', SKILLS.hanbing.stats(1));
      const iceHits = hits.splice(0);
      advance(30);

      g.build.mods['zhu.echo'] = 0.4;
      g.skills.stickFu(target, 20, 'fire', 36);
      advance(12);
      const earlySealHits = hits.length;
      advance(23);
      const sealHits = hits.splice(0);
      advance(40);
      const echoHits = hits.splice(0);

      const shake = g.cameras.main.shake.bind(g.cameras.main);
      let shakes = 0;
      g.cameras.main.shake = (...args) => { shakes++; return shake(...args); };
      g.skills.boulder(target.x, target.y, 0, 36, 24, 0.6);
      advance(12);
      const earlyStoneHits = hits.length;
      advance(18);
      const stoneHits = hits.splice(0);
      g.skills.boulder(x - 150, y, 0, 36, 24, 0.6);
      advance(30);
      const emptyStoneHits = hits.splice(0);

      g.skills.fire('tengfu', SKILLS.tengfu.stats(1));
      advance(12);
      const firstVineHits = hits.splice(0);
      advance(24);
      const secondVineHits = hits.splice(0);
      advance(240);
      hits.length = 0;
      advance(60);
      const afterVineHits = hits.length;
      const stale = g.children.list.filter(o => o.visible && [
        'fx_ice_burst', 'fx_seal_burst', 'fx_dust_burst', 'fx_impact_crack', 'fx_vine',
      ].includes(o.texture?.key)).length;

      // 多次并发后池应复用，不会每轮增添一批精灵或遗留地面图。
      const burst = () => {
        for (let i = 0; i < 6; i++) for (const kind of ['fire', 'seal', 'ice', 'stone']) g.fx.impact(kind, x, y, 36);
        advance(90);
        return g.children.list.filter(o => /^(fx_(explosion|seal_burst|ice_burst|dust_burst|scorch|impact_crack))$/.test(o.texture?.key)).length;
      };
      const pooledFirst = burst(), pooledSecond = burst();
      const sounds = ['seal', 'frost', 'stoneImpact', 'vine'].map(key => {
        const samples = SFX[key].render();
        return samples.length > 0 && samples.every(n => Number.isFinite(n) && Math.abs(n) <= 1) && samples.some(n => Math.abs(n) > 0.01);
      });
      return { targetId: target.id, instant, iceHits, earlySealHits, sealHits, echoHits,
        earlyStoneHits, stoneHits, emptyStoneHits, shakes, firstVineHits, secondVineHits,
        afterVineHits, stale, vines: g.skills.vines.length, pooledFirst, pooledSecond, sounds };
    });
    assert.deepEqual(errors, []);
    assert.equal(result.instant, true);
    assert.equal(result.iceHits.length, 1);
    assert.equal(result.iceHits[0].id, result.targetId);
    assert.equal(result.iceHits[0].dmg, 14);
    assert.equal(result.earlySealHits, 0);
    assert.equal(result.sealHits.length, 1);
    assert.equal(result.sealHits[0].dmg, 20);
    assert.equal(result.echoHits.length, 1);
    assert.equal(result.echoHits[0].dmg, 8);
    assert.equal(result.echoHits[0].proc, result.sealHits[0].proc);
    assert.equal(result.earlyStoneHits, 0);
    assert.equal(result.stoneHits.length, 1);
    assert.equal(result.stoneHits[0].dmg, 24);
    assert.equal(result.emptyStoneHits.length, 0);
    assert.equal(result.shakes, 1);
    assert.equal(result.firstVineHits.length, 1);
    assert.equal(result.secondVineHits.length, 1);
    assert.equal(result.afterVineHits, 0);
    assert.equal(result.vines, 0);
    assert.equal(result.stale, 0);
    assert.equal(result.pooledFirst, result.pooledSecond);
    assert.ok(result.sounds.every(Boolean));
  } finally {
    await browser.close();
  }
});
