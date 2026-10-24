import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// 需要本地 Vite、Chrome 与 Playwright；不调用模型 API，不使用日常存档。
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('真实 Phaser：剑雨、落石按模拟时间落地，等待与升级暂停不推进补间', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const samples = [];
    for (const waitMs of [0, 650]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xiao&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const sample = await page.evaluate(async waitMs => {
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261024);
        const { SKILLS } = await import('/src/config/skills.ts');
        const g = window.game.scene.getScene('game');
        g.build.skills.clear();
        const impacts = [];
        const add = g.tweens.add.bind(g.tweens);
        g.tweens.add = config => {
          const key = config.targets?.texture?.key;
          if (key !== 'pj_sword' && key !== 'fx_boulder') return add(config);
          return add({ ...config, onComplete: (...args) => {
            impacts.push({ key, time: +g.elapsed.toFixed(6) });
            config.onComplete?.(...args);
          } });
        };
        g.skills.fire('jinzhen', SKILLS.jinzhen.stats(1));
        g.skills.boulder(g.player.x + 100, g.player.y, 0, 36, 24, 0.6);
        for (let i = 0; i < 120; i++) {
          if (i === 6 && waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
          bridge.advance('STAY', 1);
        }
        const probe = { x: 0 };
        g.tweens.add({ targets: probe, x: 10, duration: 200 });
        g.gainXp(g.build.xpNeeded());
        bridge.advance('STAY', 1);
        const before = { x: probe.x, time: g.elapsed, options: bridge.snapshot().options.length };
        await new Promise(resolve => setTimeout(resolve, 250));
        const paused = { x: probe.x, time: g.elapsed };
        bridge.choose(0); // 内部 step(0) 也不能推进补间。
        const resumed = { x: probe.x, time: g.elapsed };
        bridge.advance('STAY', 30);
        return { impacts, before, paused, resumed, endX: probe.x };
      }, waitMs);
      assert.deepEqual(errors, []);
      assert.equal(sample.impacts.filter(i => i.key === 'pj_sword').length, 6);
      assert.equal(sample.impacts.filter(i => i.key === 'fx_boulder').length, 1);
      assert.ok(sample.impacts.every(i => i.time < 0.6), JSON.stringify(sample.impacts));
      assert.ok(sample.before.options > 0);
      assert.deepEqual(sample.paused, { x: sample.before.x, time: sample.before.time });
      assert.deepEqual(sample.resumed, sample.paused);
      assert.equal(sample.endX, 10);
      samples.push(sample.impacts);
      await context.close();
    }
    assert.deepEqual(samples[0], samples[1], 'API 等待时长不能改变伤害落地帧');
  } finally {
    await browser.close();
  }
});
