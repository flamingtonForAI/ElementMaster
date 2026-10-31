import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const url = process.env.PLAYTEST_URL || 'http://localhost:5180/';
const out = 'output/cultivation';

test('修炼界面桌面与手机横屏均可购买两个新项目，说明不盖住按钮', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await mkdir(out, { recursive: true });
  try {
    for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 720 }, false], ['mobile', { width: 844, height: 390 }, true]]) {
      const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=xiao&hd=0`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      await page.evaluate(async () => {
        const { loadSave, writeSave } = await import('/src/game/save.ts');
        const save = loadSave(); save.lingshi = 100000; writeSave(save);
        window.game.scene.stop('hud'); window.game.scene.stop('game');
        window.game.scene.start('dongfu', { char: 'xiao' });
      });
      await page.waitForFunction(() => window.game.scene.isActive('dongfu'));
      for (const [id, title] of [['shuhai', '术海'], ['xingyun', '福缘']]) {
        await page.evaluate(async id => {
          const { UPGRADES } = await import('/src/config/meta.ts');
          const d = window.game.scene.getScene('dongfu');
          d.setTab('xiulian'); d.setSel(UPGRADES.findIndex(u => u.id === id));
        }, id);
        // 由真实键盘事件购买，沿用洞府购买/存档路径。
        for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
        const result = await page.evaluate(async id => {
          const { loadSave } = await import('/src/game/save.ts');
          const d = window.game.scene.getScene('dongfu');
          const texts = d.layer.list.filter(o => typeof o.text === 'string');
          const detail = texts.find(o => o.x === 416 && o.y === 174);
          return { lv: loadSave().meta[id], text: texts.map(t => t.text), detailBottom: detail.getBounds().bottom };
        }, id);
        assert.equal(result.lv, 5);
        assert.ok(result.text.includes(title));
        assert.ok(result.detailBottom < 268, `${name} ${title} 说明超出：${result.detailBottom}`);
        await page.screenshot({ path: `${out}/${name}-${id}.png` });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('真实战斗：自带术与大招左右大格，中间十小格，无觉醒说明；符箓十二秒且爆符不伤Boss', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await mkdir(out, { recursive: true });
  try {
    for (const char of ['xiao', 'zhu', 'ruan', 'qingdai', 'moheng', 'xuanyi']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=${char}&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const result = await page.evaluate(async char => {
        const { SKILLS, ULTIMATES } = await import('/src/config/skills.ts');
        const { CHARACTERS } = await import('/src/config/characters.ts');
        const c = CHARACTERS.find(c => c.id === char);
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261030, {
          character: char, level: 1, meta: { shuhai: 5, xingyun: 5 }, skills: { [c.startSkill]: 1 }, passives: {}, buildLevel: 50,
        });
        window.cultivationBridge = bridge;
        const g = window.game.scene.getScene('game'), hud = window.game.scene.getScene('hud');
        g.spawnUpdate = () => {}; g.dbg.god = true;
        const ids = [c.startSkill, ...Object.values(SKILLS).filter(s => !s.ultimate && !s.exclusive && s.id !== c.startSkill).map(s => s.id)].slice(0, 6);
        ids.forEach(id => g.applyOption({ kind: 'skill', id, lv: 1 }));
        ['ruijin', 'yanyang', 'changsheng', 'roushui', 'houtu'].forEach(id => g.applyOption({ kind: 'passive', id, lv: 1 }));
        bridge.advance('STAY', 1);
        const locked = !hud.slotIcons[11].visible;
        g.gainXp(g.build.xpNeeded() / g.pstats.xpMult);
        bridge.advance('STAY', 1);
        bridge.choose(0);
        const ultimate = g.build.ultimate, st = SKILLS[ultimate].stats(1);
        const expected = ULTIMATES[c.balanced ? g.build.benming : c.el];
        const unlockedAt = g.build.level;
        const lowLevels = [...g.build.skills].filter(([id]) => !SKILLS[id].ultimate).every(([, lv]) => lv <= 2);
        // 觉醒后仍能正常升级；同时保留原有满级标签的布局回归。
        ids.forEach(id => g.applyOption({ kind: 'skill', id, lv: 8 }));
        ['ruijin', 'yanyang', 'changsheng', 'roushui', 'houtu'].forEach(id => g.applyOption({ kind: 'passive', id, lv: 5 }));
        const victims = [];
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          const e = g.enemies.spawn('shiyong', g.player.x + Math.cos(a) * 110, g.player.y + Math.sin(a) * 70, { hpMult: 5000, noXp: true });
          e.speed = 0; victims.push(e);
        }
        const hit = g.hitEnemy.bind(g), hits = [];
        g.hitEnemy = (e, damage, el, opts) => {
          if (damage === st.dmg && el === SKILLS[ultimate].el) hits.push(e.id);
          return hit(e, damage, el, opts);
        };
        for (let i = 0; i < 3; i++) bridge.advance('STAY', 60);
        const labels = hud.slotLvs.map(t => t.getBounds());
        const normalRows = Object.values(Object.groupBy(hud.slotIcons.slice(1, 11), t => t.y)).map(row => row.length);
        return { ultimate, expected, unlockedAt, lowLevels, slots: hud.slotIcons.length,
          count: g.build.skills.size + g.build.passives.size, locked, icon: hud.slotIcons[11].texture.key, expectedIcon: `skill_icon_${ultimate}`,
          starter: hud.slotIcons[0].texture.key, expectedStarter: `skill_icon_${c.startSkill}`,
          hits: hits.length, cooldown: g.skills.timers.get(ultimate), hp: victims[0].hp, maxHp: victims[0].maxHp,
          normalRows, largerUltimate: hud.slotIcons[11].getBounds().width > hud.slotIcons[1].getBounds().width * 1.5,
          sameLargeSize: hud.slotIcons[0].displayWidth === hud.slotIcons[11].displayWidth,
          noAnnotations: !hud.children.list.some(o => typeof o.text === 'string' && /觉醒|十术满级/.test(o.text)),
          levelLabelsFit: labels.every((a, i) => labels.every((b, j) => i === j || a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)) };
      }, char);
      assert.equal(result.slots, 12); assert.equal(result.count, 12);
      assert.equal(result.starter, result.expectedStarter); assert.ok(result.sameLargeSize);
      assert.equal(result.locked, true);
      assert.equal(result.unlockedAt, 51); assert.ok(result.lowLevels);
      assert.equal(result.ultimate, result.expected);
      assert.equal(result.icon, result.expectedIcon);
      assert.ok(result.hits > 0 && result.hp < result.maxHp && result.cooldown > 0);
      assert.deepEqual(result.normalRows, [5, 5]);
      assert.ok(result.largerUltimate && result.noAnnotations);
      assert.ok(result.levelLabelsFit, '十二个满级标签不能相互重叠');
      await page.screenshot({ path: `${out}/ultimate-${char}.png` });
      if (char === 'xiao') {
        const runes = await page.evaluate(() => {
          const g = window.game.scene.getScene('game'), b = window.cultivationBridge;
          g.skills.update = () => {}; g.tasks = []; g.proj.list.length = 0;
          for (const e of [...g.enemies.list]) g.enemies.deactivate(e);
          g.enemies.list.length = 0; g.enemies.grid.clear();
          const normal = g.enemies.spawn('shiyong', g.player.x + 60, g.player.y, { hpMult: 5000, noXp: true });
          const elite = g.enemies.spawn('shiyong', g.player.x + 80, g.player.y, { hpMult: 5000, elite: true, noXp: true });
          const boss = g.enemies.spawn('langyao', g.player.x + 100, g.player.y, { hpMult: 50, noXp: true });
          for (const e of [normal, elite, boss]) { e.speed = 0; e.armor = 0; }
          g.pstats.meleeBonus = 0;
          b.advance('STAY', 1);
          g.pickups.talisman(g.player.x, g.player.y, 'ding', 120);
          b.advance('STAY', 1);
          const rootDuration = normal.stunUntil - g.now, bossSlow = boss.slowUntil - g.now;
          for (let i = 0; i < 7; i++) b.advance('STAY', 60);
          const stillRooted = normal.stunUntil > g.now;
          g.pickups.talisman(g.player.x, g.player.y, 'dun', 120);
          b.advance('STAY', 1);
          const before = [normal.hp, elite.hp, boss.hp];
          g.useTalisman('bao');
          const damage = [normal, elite, boss].map((e, i) => before[i] - e.hp);
          const duration = g.dunUntil - g.now, speed = g.dunSpeed;
          for (let i = 0; i < 6; i++) b.advance('STAY', 60);
          const rootExpired = normal.stunUntil <= g.now;
          return { rootDuration, bossSlow, stillRooted, rootExpired, damage, duration, speed };
        });
        assert.ok(Math.abs(runes.rootDuration - 12) < 1e-8); assert.ok(Math.abs(runes.bossSlow - 12) < 1e-8);
        assert.ok(runes.stillRooted && runes.rootExpired);
        assert.ok(runes.damage[0] > 0);
        assert.ok(Math.abs(runes.damage[1] * 2 - runes.damage[0]) <= 1);
        assert.equal(runes.damage[2], 0);
        assert.ok(Math.abs(runes.duration - 12) < 1e-8); assert.equal(runes.speed, 2);
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('大招冷却实战15秒/满减冷却加退射10秒，暂停不推进，木土大招不回血或加盾', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [char, id, boosted, expected] of [['xiao', 'senluo', false, 15], ['ruan', 'kunlun', true, 10]]) {
      const context = await browser.newContext();
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=${char}&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('game')?.player);
      const result = await page.evaluate(async ({ char, id, boosted }) => {
        // 单独隔离两种大招的循环，保留真实战斗时钟、减冷却与退射判定。
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261030, {
          character: char, level: 1, meta: { shuhai: 5 }, skills: { [id]: 1 },
          passives: boosted ? { ningshen: 5 } : {}, buildLevel: 80, lockXp: true,
        });
        const g = window.game.scene.getScene('game'), hud = window.game.scene.getScene('hud');
        g.spawnUpdate = () => {}; g.dbg.god = true;
        if (boosted) Object.assign(g.build.mods, { cd: 0.22, 'ruan.kite': 0.3 });
        g.pstats = g.build.stats(); g.player.hp = 50; g.shield = 7;
        const target = g.enemies.spawn('shiyong', g.player.x - 60, g.player.y, { hpMult: 5000, noXp: true });
        g.enemies.update = () => {
          // 目标始终在玩家身后，让原退射判定在每帧真实生效。
          target.x = g.player.x - 60; target.y = g.player.y;
          g.enemies.grid.clear(); g.enemies.grid.insert(target);
        };
        const casts = [], toast = hud.toast.bind(hud);
        hud.toast = (text, color) => { if (text.startsWith('神通 ·')) casts.push(g.now); toast(text, color); };
        for (let i = 0; i < 5; i++) bridge.advance(boosted ? 'RIGHT' : 'STAY', 60);
        const beforePause = g.now;
        g.scene.pause();
        bridge.advance('STAY', 60);
        const pausedTime = g.now - beforePause;
        g.scene.resume();
        for (let i = 0; i < 41; i++) bridge.advance(boosted ? 'RIGHT' : 'STAY', 60);
        return { casts, pausedTime, hp: g.player.hp, shield: g.shield, cdMult: g.pstats.cdMult };
      }, { char, id, boosted });
      assert.ok(result.casts.length >= 4);
      for (let i = 1; i < result.casts.length; i++) {
        const gap = result.casts[i] - result.casts[i - 1];
        assert.ok(Math.abs(gap - expected) < 0.04, `${id} 实际间隔 ${gap}`);
        assert.ok(gap >= 10 - 1e-8);
      }
      assert.equal(result.pausedTime, 0);
      assert.equal(result.hp, 50); assert.equal(result.shield, 7);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('散人拂尘实战对五行同伤；桌面与手机保持左右大格、中央十格，卡片无属性说明可读', async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await mkdir(out, { recursive: true });
  try {
    for (const [name, viewport, touch] of [['desktop', { width: 1280, height: 720 }, false], ['mobile', { width: 844, height: 390 }, true]]) {
      const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${url}?level=1&char=xuanyi&hd=0&playtest`);
      await page.waitForFunction(() => window.game?.scene.getScene('hud')?.slotIcons.length);
      const neutral = await page.evaluate(async () => {
        const { SKILLS } = await import('/src/config/skills.ts');
        const bridge = (await import('/tools/playtest/bridge.js')).install(20261031, {
          character: 'xuanyi', level: 1, meta: { shuhai: 5 }, skills: { fuchen: 8 }, passives: {}, buildLevel: 1, lockXp: true,
        });
        window.cultivationBridge = bridge;
        const g = window.game.scene.getScene('game'), hits = [];
        g.spawnUpdate = () => {}; g.dbg.god = true; g.pstats.crit = 0;
        g.pstats.elDmg = { metal: 2, wood: 3, water: 4, fire: 5, earth: 6 };
        g.pstats.vsEl = { metal: 6, wood: 5, water: 4, fire: 3, earth: 2 };
        const enemies = ['metal', 'wood', 'water', 'fire', 'earth'].map((el, i) => {
          const e = g.enemies.spawn('shiyong', g.player.x + 60, g.player.y - 20 + i * 10, { hpMult: 100, noXp: true });
          e.def = { ...e.def, el }; e.speed = 0; e.armor = 0;
          return e;
        });
        const hit = g.hitEnemy.bind(g);
        g.hitEnemy = (e, damage, el, opts) => {
          const hp = e.hp, result = hit(e, damage, el, opts);
          if (el === null) hits.push({ id: e.id, el: e.def.el, dmg: hp - e.hp, lastEl: e.lastEl });
          return result;
        };
        bridge.advance('STAY', 28);
        return { hits, expectedDamage: SKILLS.fuchen.stats(8).dmg, count: enemies.length, lingen: g.build.lingen, owned: [...g.build.skills.keys()] };
      });
      assert.deepEqual(neutral.owned, ['fuchen']);
      assert.deepEqual(Object.values(neutral.lingen), [0, 0, 0, 0, 0]);
      assert.equal(neutral.hits.length, 5);
      assert.equal(new Set(neutral.hits.map(h => h.id)).size, 5);
      assert.ok(neutral.hits.every(h => h.dmg === neutral.expectedDamage && h.lastEl === null));
      await page.screenshot({ path: `${out}/${name}-fuchen.png` });
      const layout = await page.evaluate(() => {
        const g = window.game.scene.getScene('game'), h = window.game.scene.getScene('hud');
        g.skills.update = () => {}; g.tasks = [];
        for (const e of [...g.enemies.list]) g.enemies.deactivate(e);
        g.enemies.list.length = 0; g.enemies.grid.clear();
        g.build.level = 51;
        for (const id of ['flysword', 'fireball', 'leaf', 'waterdragon', 'stonespike']) g.build.apply({ kind: 'skill', id, lv: 8 });
        for (const id of ['ruijin', 'yanyang', 'changsheng', 'roushui', 'houtu']) g.build.apply({ kind: 'passive', id, lv: 5 });
        window.cultivationBridge.advance('STAY', 30);
        g.scene.pause();
        const icons = h.slotIcons, bounds = icons.map(i => i.getBounds());
        const maxBounds = h.slotLvs.map(t => t.getBounds());
        const noOverlap = items => items.every((a, i) => items.every((b, j) => i === j || a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom));
        return { sizes: icons.map(i => i.displayWidth), names: icons.map(i => i.texture.key),
          rows: Object.values(Object.groupBy(icons.slice(1, 11), i => i.y)).map(row => row.length),
          maxLabels: h.slotLvs.map(t => t.text), noOverlap: noOverlap(bounds) && noOverlap(maxBounds),
          left: bounds[0].right < bounds[1].left, right: bounds[11].left > bounds[5].right };
      });
      assert.equal(layout.names.length, 12);
      assert.equal(layout.names[0], 'skill_icon_fuchen');
      assert.equal(layout.sizes[0], 32); assert.equal(layout.sizes[11], 32);
      assert.ok(layout.sizes.slice(1, 11).every(size => size === 16));
      assert.deepEqual(layout.rows, [5, 5]);
      assert.ok(layout.maxLabels.every(s => s === 'Max'));
      assert.ok(layout.noOverlap && layout.left && layout.right);
      await page.screenshot({ path: `${out}/${name}-twelve-slots.png` });
      if (!touch) await page.screenshot({ path: `${out}/twelve-slot-bar.png`, clip: { x: 0, y: 0, width: 460, height: 180 } });
      const card = await page.evaluate(() => {
        const h = window.game.scene.getScene('hud');
        h.showLevelUp([{ kind: 'skill', id: 'fuchen', lv: 1 }, { kind: 'skill', id: 'fireball', lv: 1 }, { kind: 'passive', id: 'ningshen', lv: 1 }]);
        window.game.step(window.game.loop.now, 0);
        const c = h.cards[0], desc = c.list.find(o => o.type === 'Text' && o.y === 100);
        const footer = c.list.find(o => o.text === '无属性 · 五行同伤');
        return { icon: c.list.find(o => o.type === 'Image').texture.key,
          fits: desc.getBounds().bottom < footer.getBounds().top, name: c.list.some(o => o.text === '清风拂尘') };
      });
      assert.equal(card.icon, 'skill_icon_fuchen'); assert.ok(card.fits && card.name);
      await page.screenshot({ path: `${out}/${name}-fuchen-card.png` });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});
