import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const url = process.env.PLAYTEST_URL || 'http://localhost:5180/';

test('真实 Phaser：追踪、平行水龙、分区炮击与重叠藤蔓符合调整后的覆盖规则', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  await mkdir('output/skill-balance', { recursive: true });
  try {
    for (const id of ['leaf', 'flysword', 'waterdragon', 'fireball', 'luoshi', 'tengfu']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=xuanyi&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const row = await page.evaluate(async id => {
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261031, { character: 'xuanyi', level: 1 });
        const { SKILLS } = await import('/src/config/skills.ts');
        const g = window.game.scene.getScene('game');
        g.build.skills.clear(); g.spawnUpdate = () => {}; g.dbg.god = true;
        g.pstats.crit = 0; g.pstats.area = 1; g.dmgMult = () => 1;
        const { x, y } = g.player;
        const points = id === 'leaf' ? [[150, -2]] : id === 'flysword' ? [[40, -2], [110, 40]]
          : id === 'waterdragon' ? [[240, -2], [240, 50]] : id === 'fireball' ? [[80, 0], [82, 0], [-140, 0], [80, 56]]
          : id === 'luoshi' ? [[80, 0], [82, 0], [-140, 0]] : [[40, 0], [42, 0], [130, 0], [40, 70]];
        const targets = points.map(([dx, dy]) => g.enemies.spawn('shuigui', x + dx, y + dy, { hpMult: 10000, noXp: true }));
        const hitLists = targets.map(() => []), index = new Map(targets.map((e, i) => [e.id, i]));
        g.enemies.update = () => {
          g.enemies.grid.clear();
          targets.forEach((e, i) => {
            // 飞叶初始靶位缓慢横移，验证真实追踪；其余固定用于边界验证。
            e.x = x + points[i][0]; e.y = y + points[i][1] + (id === 'leaf' ? Math.sin(g.now * 2) * 8 : 0);
            e.kbx = e.kby = 0; e.armor = 0; e.sprite.setPosition(e.x, e.y); g.enemies.grid.insert(e);
          });
        };
        g.enemies.update();
        const hit = g.hitEnemy.bind(g);
        g.hitEnemy = (e, damage, el, opts) => {
          const actual = hit(e, damage, el, opts);
          if (index.has(e.id)) hitLists[index.get(e.id)].push({ damage, actual, time: g.now });
          return actual;
        };
        const st = SKILLS[id].stats(8);
        if (id === 'flysword') st.count = 1;
        if (id === 'tengfu') {
          // 圈外靶不参与选点；仍保留真实范围查询。
          g.enemies.randomIn = () => targets.slice(0, 3);
        }
        g.skills.fire(id, st);
        for (let frame = 0; frame < 180; frame++) {
          if (id === 'tengfu' && [20, 40].includes(frame)) g.skills.fire(id, st);
          bridge.advance('STAY', 1);
        }
        return { id, hitLists, vines: g.skills.vines.length, st };
      }, id);
      const counts = row.hitLists.map(h => h.length);
      if (id === 'leaf') assert.deepEqual(counts, [3]);
      if (id === 'flysword') assert.deepEqual(counts, [1, 1]);
      if (id === 'waterdragon') { assert.deepEqual(counts, [2, 0]); assert.equal(row.hitLists[0].reduce((s, h) => s + h.damage, 0), row.st.dmg * 1.5); }
      if (id === 'fireball' || id === 'luoshi') assert.ok(counts.every(n => n > 0), `${id}: ${counts}`);
      if (id === 'tengfu') {
        assert.equal(counts[3], 0);
        for (const hits of row.hitLists.slice(0, 3)) {
          assert.ok(hits.length >= 4 && hits.length <= 6);
          for (let i = 1; i < hits.length; i++) assert.ok(hits[i].time - hits[i - 1].time >= 0.5 - 1e-8);
        }
      }
      assert.deepEqual(errors, []);
      rows.push(row);
      await context.close();
    }
    await writeFile('output/skill-balance/browser-cases.json', JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});

test('六角色满配十二技能实际运行：全部术及五行大招可释放，高减冷却下无异常', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  await mkdir('output/skill-balance', { recursive: true });
  try {
    for (const character of ['xiao', 'zhu', 'ruan', 'qingdai', 'moheng', 'xuanyi']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=${character}&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const result = await page.evaluate(async character => {
        const { SKILLS, ULTIMATES } = await import('/src/config/skills.ts');
        const { CHARACTERS } = await import('/src/config/characters.ts');
        const c = CHARACTERS.find(c => c.id === character);
        const skills = Object.fromEntries(Object.values(SKILLS).filter(s => !s.exclusive && !s.ultimate).map(s => [s.id, 8]));
        skills[c.startSkill] = 8; skills[ULTIMATES[c.el]] = 1;
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261031, {
          character, level: 1, meta: { shuhai: 5 }, skills, passives: {}, buildLevel: 1, lockXp: true,
        });
        const g = window.game.scene.getScene('game');
        g.spawnUpdate = () => {}; g.dbg.god = true; g.pstats.cdMult = 0.25;
        for (let i = 0; i < 30; i++) {
          const a = i * Math.PI / 15, r = i < 10 ? 45 : 130;
          g.enemies.spawn('shiyong', g.player.x + Math.cos(a) * r, g.player.y + Math.sin(a) * r, { hpMult: 10000, noXp: true });
        }
        const casts = {}, fire = g.skills.fire.bind(g.skills);
        g.skills.fire = (id, st) => { const ok = fire(id, st); if (ok) (casts[id] ??= []).push(g.now); return ok; };
        for (let i = 0; i < 8; i++) bridge.advance('STAY', 60);
        return { character, casts, owned: [...g.build.skills.keys()], count: g.build.slots.length,
          puppets: g.puppets.list.map(p => ({ alive: p.alive, giant: p.giant })),
          projectiles: g.proj.list.length, vines: g.skills.vines.length, finite: g.proj.list.every(p => [p.x, p.y, p.vx, p.vy].every(Number.isFinite)) };
      }, character);
      assert.equal(result.owned.length, 12);
      assert.equal(result.count, 12);
      assert.deepEqual(result.owned.filter(id => id !== 'puppet' && !result.casts[id]?.length), [], character);
      if (character === 'moheng') {
        assert.equal(result.puppets.length, 3);
        assert.equal(result.puppets.filter(p => p.giant).length, 1);
        assert.ok(result.puppets.every(p => p.alive));
      }
      assert.ok(result.finite);
      assert.ok(result.projectiles < 200 && result.vines < 30);
      assert.deepEqual(errors, []);
      rows.push(result);
      if (character === 'xuanyi') await page.screenshot({ path: 'output/skill-balance/full-build.png' });
      await context.close();
    }
    await writeFile('output/skill-balance/full-builds.json', JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});
