import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

test('真实战斗：眩晕乱走、打昏停步、燃烧周期伤害、剧毒和落石进阶', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xiao&playtest`);
    await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
    const result = await page.evaluate(async () => {
      const bridge = (await import('/tools/playtest/bridge.js')).install(20261025);
      const { SKILLS } = await import('/src/config/skills.ts');
      const g = window.game.scene.getScene('game');
      g.build.skills.clear();
      g.spawnUpdate = () => {};
      g.pstats.crit = 0;
      g.pstats.dotMult = 1;
      const { x, y } = g.player;
      const spawn = (id, dx, dy) => g.enemies.spawn(id, x + dx, y + dy, { hpMult: 100, noXp: true });
      const e = spawn('shuigui', 110, 0);
      g.afflict(e, 'stun', 10);
      e.confuseAngle = 0;
      e.confuseTurnAt = g.now + 1;
      const start = e.x;
      bridge.advance('STAY', 12);
      const wandered = e.x > start + 5 && e.stunUntil <= g.now;
      g.pstats.advanceBonus.earth = 1;
      g.afflict(e, 'stun', 10);
      const stunnedAt = e.x;
      bridge.advance('STAY', 12);
      const stopped = Math.abs(e.x - stunnedAt) < 0.001 && e.stunUntil > g.now;
      bridge.advance('STAY', 60);
      const recovered = e.x < stunnedAt - 5 && e.confusedUntil <= g.now;
      e.speed = 0;

      const flame = spawn('shiyong', -150, -80);
      const near = spawn('shiyong', -122, -80);
      const far = spawn('shiyong', -220, -80);
      const toxic = spawn('shiyong', 100, 100);
      for (const o of [flame, near, far, toxic]) o.speed = 0;
      for (let i = 0; i < 3; i++) { g.burnEnemy(flame, 8); g.poisonEnemy(toxic, 10, 4); }
      const before = [flame.hp, near.hp, far.hp, toxic.hp];
      bridge.advance('STAY', 31);
      const loss = [flame, near, far, toxic].map((o, i) => before[i] - o.hp);
      const unlit = near.burnUntil <= g.now;

      const stoneTarget = spawn('shuigui', 40, -110);
      stoneTarget.speed = 0;
      const st = SKILLS.luoshi.stats(1);
      g.skills.boulder(stoneTarget.x, stoneTarget.y, 0, st.radius, st.dmg, st.daze);
      bridge.advance('STAY', 30);
      const stoneFirst = stoneTarget.confusedUntil > g.now && stoneTarget.stunUntil <= g.now;
      g.skills.boulder(stoneTarget.x, stoneTarget.y, 0, st.radius, st.dmg, st.daze);
      bridge.advance('STAY', 30);
      const stoneSecond = stoneTarget.stunUntil > g.now && stoneTarget.confusedUntil === 0;

      // 回收池重新出场，不能继承二阶毒火或眩晕。
      flame.poisonDeep = true;
      flame.poisonBuild = 3;
      flame.confusedUntil = g.now + 10;
      g.enemies.kill(flame);
      bridge.advance('STAY', 1);
      const reused = spawn('shiyong', -100, 100);
      const reset = reused === flame && !reused.burningDeep && !reused.poisonDeep && reused.poisonBuild === 0 && reused.confusedUntil === 0;
      return { wandered, stopped, recovered, loss, unlit, stoneFirst, stoneSecond, reset };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(result, { wandered: true, stopped: true, recovered: true,
      loss: [12, 6, 0, 10], unlit: true, stoneFirst: true, stoneSecond: true, reset: true });
  } finally { await browser.close(); }
});

test('正常生命值：早期小怪先被击杀，精英可承载二阶；Boss 短冰冻与二阶毒火到期退回一阶', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${process.env.PLAYTEST_URL || 'http://localhost:5180/'}?level=1&char=xiao&playtest`);
    await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
    const result = await page.evaluate(async () => {
      const bridge = (await import('/tools/playtest/bridge.js')).install(20261025);
      const { SKILLS } = await import('/src/config/skills.ts');
      const { LEVELS, DIFF } = await import('/src/config/levels.ts');
      const g = window.game.scene.getScene('game');
      g.build.skills.clear();
      g.spawnUpdate = () => {};
      const { x, y } = g.player;
      // 使用生产血量倍率；固定直接命中，去掉暴击和地气，明确区分单次命中与一轮技能。
      g.terrainMods = { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 };
      const small = g.enemies.spawn('tiejia', x + 180, y, { noXp: true });
      const elite = g.enemies.spawn('tiejia', x - 180, y, { elite: true, noXp: true });
      const minutes = 8;
      const late = g.enemies.spawn('tiejia', x, y + 180, { tier: 3, noXp: true,
        hpMult: LEVELS[7].hpMult * (1 + DIFF.hpLin * minutes + DIFF.hpQuad * minutes * minutes) });
      const boss = g.enemies.spawn('langyao', x, y - 180, { noXp: true });
      const hp = [small, elite, late, boss].map(e => e.maxHp);
      const fire = SKILLS.fireball.stats(1);
      const damage = g.hitEnemy(small, fire.dmg, 'fire', { noCrit: true, proc: SKILLS.fireball.proc });
      g.hitEnemy(small, fire.dmg, 'fire', { noCrit: true, proc: SKILLS.fireball.proc });
      const smallDeadBeforeTier = !small.alive && !small.burningDeep;
      // 强制施加仅用于验证存活窗口，不把此处当作随机触发率采样。
      for (let i = 0; i < 3; i++) {
        g.hitEnemy(elite, fire.dmg, 'fire', { noCrit: true });
        if (elite.alive) g.burnEnemy(elite, damage * 0.3);
      }
      const eliteCarriesTier = elite.alive && elite.burningDeep;
      const lateDamage = g.hitEnemy(late, SKILLS.fireball.stats(8).dmg, 'fire', { noCrit: true });

      const speeds = [];
      const behave = g.enemies.behave.bind(g.enemies);
      g.enemies.behave = (e, dt, nx, ny, dist, slow) => {
        if (e === boss) speeds.push(slow);
        return behave(e, dt, nx, ny, dist, slow);
      };
      g.afflict(boss, 'slow', 1);
      bridge.advance('STAY', 1);
      const first = speeds.at(-1);
      g.pstats.advanceBonus.water = 1;
      g.afflict(boss, 'slow', 1);
      g.slowEnemy(boss, 4);
      const freezeDuration = boss.stunUntil - g.now;
      const calls = speeds.length;
      const position = [boss.x, boss.y];
      bridge.advance('STAY', 12);
      const frozen = boss.frozenUntil > g.now && speeds.length === calls && boss.x === position[0] && boss.y === position[1];
      bridge.advance('STAY', 30);
      const recovered = boss.stunUntil <= g.now && speeds.length > calls && speeds.at(-1) === 0.75;
      for (let i = 0; i < 3; i++) g.afflict(boss, 'stun', 1);
      const sharedImmunity = boss.stunUntil <= g.now && boss.daze === 0;
      for (let i = 0; i < 3; i++) { g.poisonEnemy(boss, 10, 4); g.burnEnemy(boss, 8); }
      bridge.advance('STAY', 60);
      bridge.advance('STAY', 2);
      const burnExpiredFirst = !boss.burningDeep && boss.poisonDeep && boss.burnUntil > g.now;
      bridge.advance('STAY', 60);
      const poisonExpired = !boss.poisonDeep && boss.poisonUntil > g.now;
      return { hp, damage, lateDamage, smallDeadBeforeTier, eliteCarriesTier, first, freezeDuration, frozen, recovered,
        sharedImmunity, burnExpiredFirst, poisonExpired };
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(result.hp, [34, 340, 1382, 2600]);
    assert.equal(result.damage, 33);
    assert.equal(result.lateDamage, 61);
    assert.equal(result.smallDeadBeforeTier, true);
    assert.equal(result.eliteCarriesTier, true);
    assert.equal(result.first, 0.75);
    assert.ok(Math.abs(result.freezeDuration - 0.5) < 1e-9);
    for (const key of ['frozen', 'recovered', 'sharedImmunity', 'burnExpiredFirst', 'poisonExpired']) assert.equal(result[key], true, key);
  } finally { await browser.close(); }
});
