import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('真实战斗：成长后的Boss弹幕结算、复合词缀范围和召援，保存光环截图', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=10&char=qingdai&playtest`);
    await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
    const result = await page.evaluate(async () => {
      const bridge = (await import('/tools/playtest/bridge.js')).install(20261029, { level: 10, character: 'qingdai' });
      const { LEVELS } = await import('/src/config/levels.ts');
      const g = window.game.scene.getScene('game'), m = g.enemies;
      g.build.skills.clear(); g.spawnUpdate = () => {}; g.timeline = [];
      g.nextEliteAt = g.nextItemAt = Infinity; g.hazards.update = () => {}; g.gainXp = () => {};
      const clear = () => { for (const e of m.list) m.deactivate(e); m.update(0); };
      clear();
      g.elapsed = 240; g.roarStacks = 0;
      const rows = [];
      for (const level of [1, 6, 10]) {
        g.levelDef = { ...LEVELS[level - 1], eliteAffixes: 0 };
        for (const [kind, id, opts] of [['mob', 'shiyong', {}], ['elite', 'shiyong', { elite: true }], ['boss', g.levelDef.boss, {}]]) {
          const e = m.spawn(id, 0, 0, opts);
          rows.push({ level, kind, dmg: e.dmg, growth: e.attackGrowth });
          m.deactivate(e);
        }
      }
      m.update(0);
      g.levelDef = { ...LEVELS[9], eliteAffixes: 0 };
      const p = g.player, { x, y } = p;
      const boss = m.spawn('dijiang', x + 160, y);
      m.elementRing(boss, 'water', 1);
      const shot = g.proj.list.find(p => p.active && p.kind === 'enemy');
      const raw = shot.dmg;
      Object.assign(g.pstats, { armor: 10, maxHp: 200, regen: 0 });
      g.build.benming = 'water'; g.pstats.resist.water = 1;
      g.shield = 0; g.iframeUntil = 0; p.hp = 200; g.dbg.god = false;
      shot.x = p.x; shot.y = p.y - 6; shot.hurt = { crit: 0 };
      g.proj.update(0);
      const loss = 200 - p.hp;
      clear(); g.proj.clearEnemyShots(); g.status.clear();

      const elite = m.spawn('tiejia', x + 60, y, { elite: true });
      elite.affixes = ['guard', 'miasma', 'frost']; m.makeAura(elite);
      const ally = m.spawn('shiyong', elite.x + 90, y);
      const outside = m.spawn('shiyong', elite.x, y + 68);
      m.grid.clear(); for (const e of m.list) if (e.alive) m.grid.insert(e);
      const rng = Math.random;
      Math.random = () => 0; // Force successful proc, retaining actual elemental/status handling.
      m.updateAuras(0.5);
      Math.random = rng;
      const affixes = { poisoned: g.status.poisoned, slowed: g.status.slowed, armor: ally.guardArmor,
        outsideArmor: outside.guardArmor, textures: elite.auras.map(a => a.texture.key),
        diameters: elite.auras.map(a => [a.displayWidth, a.displayHeight]) };
      clear(); g.status.clear(); g.dbg.god = true;
      // Freeze individual actors for a readable screenshot; damage/affix checks above use real systems.
      const show = (dx, dy, affixes) => {
        const e = m.spawn('shiyong', x + dx, y + dy, { elite: true });
        e.affixes = affixes; e.stunUntil = Infinity; e.speed = 0; e.summonAt = Infinity;
        e.glyph.setText(`土·${affixes.map(k => ({ guard: '护', miasma: '瘴', frost: '寒', summon: '召' })[k]).join('·')}`);
        m.makeAura(e);
        return e;
      };
      show(-190, -70, ['guard']); show(0, -70, ['miasma']); show(190, -70, ['frost']);
      show(100, 90, ['guard', 'miasma', 'frost']);
      const summoner = show(-150, 90, ['summon']);
      summoner.summonAt = g.now;
      const count = m.count;
      m.updateAuras(0.5);
      const summons = m.list.filter(e => e.alive && !e.elite);
      for (const e of summons) e.stunUntil = Infinity;
      const summoned = m.count - count;
      bridge.advance('STAY', 1);
      return { rows, raw, loss, affixes, summoned, summonedXp: summons.map(e => e.xp) };
    });
    assert.deepEqual(errors, []);
    assert.ok(Math.abs(result.raw - 21.56) < 1e-9);
    assert.equal(result.loss, 10);
    assert.equal(result.affixes.poisoned, true);
    assert.equal(result.affixes.slowed, true);
    assert.equal(result.affixes.armor, 3);
    assert.equal(result.affixes.outsideArmor, 0);
    assert.deepEqual(result.affixes.textures, ['fx_ring', 'fx_fog', 'fx_ring', 'fx_frost']);
    assert.equal(result.summoned, 3);
    assert.deepEqual(result.summonedXp, [0, 0, 0]);
    const out = process.env.PLAYTEST_OUT || 'output/enemy-pressure-change-20261029';
    mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/affixes.png` });
    writeFileSync(`${out}/browser.json`, JSON.stringify({ method: 'Isolated actual Phaser damage/affix integration and staged visual check; no natural campaign or win-rate claim.', result, errors }, null, 2));
  } finally { await browser.close(); }
});
