import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// 只替换浏览器框架，直接执行项目中的构筑、存档及场景逻辑。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'phaser') return { url: 'data:text/javascript,export default { Scene: class {}, Geom: { Rectangle: class {} } }', shortCircuit: true };
    if (specifier === 'tweakpane') return { url: 'data:text/javascript,export class Pane {}', shortCircuit: true };
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) {
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform', sourceUrl: url }), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
const { Build } = await import('../src/game/Build.ts');
const { CHARACTERS } = await import('../src/config/characters.ts');
const { LEVELS } = await import('../src/config/levels.ts');
const { GameScene } = await import('../src/scenes/GameScene.ts');
const { DongfuScene } = await import('../src/scenes/DongfuScene.ts');
const { MenuScene } = await import('../src/scenes/MenuScene.ts');
const { loadSave, readSlot, importSlot, exportSlot, writeSave } = await import('../src/game/save.ts');
const { daoPoints, legacyPoints } = await import('../src/game/talents.ts');
const character = (id) => CHARACTERS.find((c) => c.id === id);
const encode = (s) => `EM${s.ver ?? 3}:` + Buffer.from(JSON.stringify(s)).toString('base64');
const reset = () => memory.clear();

function runScene(id, level) {
  const scene = new GameScene();
  scene.char = character(id);
  scene.levelDef = LEVELS.find((l) => l.id === level);
  scene.build = new Build(scene.char, scene.levelDef);
  scene.later = () => {};
  return scene;
}

test('玄一没有土系心法亲和，墨衡仍保留本系加成', () => {
  for (const [id, factor] of [['xuanyi', 1], ['moheng', 1.2]]) {
    const build = new Build(character(id), LEVELS[0]);
    build.apply({ kind: 'passive', id: 'houtu', lv: 5 });
    assert.equal(build.stats().maxHp, Math.round(build.char.hp * (1 + 0.12 * 5 * factor)));
    assert.equal(build.stats().armor, build.char.armor + Math.floor(5 * factor));
  }
});

test('青龙印禁止破绽带来的暴击，普通构筑仍可借破绽暴击', () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    for (const [mods, noCrit, expected] of [[{}, false, true], [{ noCrit: 1 }, false, false], [{}, true, false]]) {
      const scene = runScene('xiao', 1);
      scene.build = new Build(scene.char, LEVELS[0], {}, mods);
      scene.pstats = { ...scene.build.stats(), crit: 0 };
      scene.player = { x: 1000, y: 1000 };
      scene.dmgMult = () => 1;
      let crit;
      scene.fx = { number: (_x, _y, _dmg, _rel, value) => { crit = value; } };
      scene.hitEnemy({ alive: true, def: { el: 'metal' }, x: 0, y: 0, hp: 1000, armor: 0, flawUntil: 10, flashUntil: 0, sprite: { displayHeight: 16 } }, 10, 'metal', { noCrit });
      assert.equal(crit, expected);
    }
  } finally {
    Math.random = random;
  }
});

test('宝箱升级即时刷新玄一的四象和太极条件', () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    for (const taiji of [false, true]) {
      const scene = runScene('xuanyi', 1);
      scene.build = new Build(scene.char, LEVELS[0], {}, { 'xuan.even': 0.12, 'xuan.taiji': 1 });
      scene.build.skills = new Map([['fireball', taiji ? 1 : 4], ['flysword', taiji ? 2 : 1], ['leaf', taiji ? 2 : 1], ['waterdragon', taiji ? 2 : 1], ['stonespike', taiji ? 2 : 1]]);
      scene.build.recompute();
      scene.pstats = scene.build.stats();
      const before = scene.pstats;
      scene.player = { x: 0, y: 0, hp: before.maxHp };
      Object.defineProperty(scene, 'hud', { value: { toast() {} } });
      scene.pickups = { magnetAll() {} };
      scene.fx = { ring() {} };
      scene.openChest();
      assert.deepEqual(scene.pstats, scene.build.stats());
      assert.notEqual(scene.pstats.dmgMult, before.dmgMult);
      if (taiji) assert.ok(scene.pstats.cdMult < before.cdMult);
    }
  } finally {
    Math.random = random;
  }
});

test('首通只奖实际关卡，补关会给点，重复通关及失败不重复给点', () => {
  reset();
  const c = character('ruan');
  runScene(c.id, 2).endRun(true);
  let save = loadSave();
  assert.deepEqual(save.clears[c.id], [2]);
  assert.equal(daoPoints(save, c), 5);
  assert.equal(legacyPoints(save, c), 1);
  runScene(c.id, 2).endRun(true);
  runScene(c.id, 1).endRun(false);
  assert.equal(daoPoints(loadSave(), c), 5);
  runScene(c.id, 1).endRun(true);
  save = loadSave();
  assert.deepEqual(save.clears[c.id], [2, 1]);
  assert.equal(daoPoints(save, c), 8);
  assert.equal(legacyPoints(save, c), 1);
  assert.equal(daoPoints(save, character('xiao')), 2);
});

test('v3 最高关记录迁移保留已有点数，EM4 导出再导入保留逐关记录', () => {
  reset();
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 3, clears: { xiao: 2 }, wudao: { xiao: 1 }, tree: { xiao: ['metal.s1', 'metal.s2'] }, legacy: { xiao: ['xiao.a1'] } })));
  const save = readSlot(1);
  assert.equal(save.ver, 4);
  assert.deepEqual(save.clears.xiao, [1, 2]);
  assert.deepEqual(save.tree.xiao, ['metal.s1', 'metal.s2']);
  assert.deepEqual(save.legacy.xiao, ['xiao.a1']);
  assert.equal(daoPoints(save, character('xiao')), 9);
  assert.equal(legacyPoints(save, character('xiao')), 1);
  const code = exportSlot(1);
  assert.ok(code.startsWith('EM4:'));
  assert.ok(importSlot(2, code));
  assert.deepEqual(readSlot(2), save);
  writeSave(save);
  assert.deepEqual(loadSave(), { ...save, updatedAt: loadSave().updatedAt });
});

test('旧版悟道与修炼退款只迁移一次', () => {
  reset();
  assert.ok(importSlot(1, encode({ unlocked: 2, ver: 1, lingshi: 100, spent: 700, wudao: 2 })));
  const save = readSlot(1);
  assert.equal(save.lingshi, 2300);
  assert.equal(save.spent, 0);
  assert.deepEqual(save.meta, {});
  assert.equal(readSlot(1).lingshi, 2300);
});

test('导入限制等级、清理类型和重复关号，拒绝无效码且保留原槽位', () => {
  reset();
  assert.ok(importSlot(1, encode({ unlocked: 999, ver: 4, meta: { xuming: 99, huti: -2, qixue: '5', unknown: 12 }, clears: { xiao: [2, 2, -1, '1', 99] }, tree: { xiao: 'bad' }, legacy: false, wudao: { xiao: 99 }, runs: -5, playTime: 'bad' })));
  const save = readSlot(1);
  assert.deepEqual(save.meta, { qixue: 0, huti: 0, xuming: 2 });
  assert.deepEqual(save.clears.xiao, [2]);
  assert.deepEqual(save.tree.xiao, []);
  assert.deepEqual(save.legacy.xiao, []);
  assert.equal(save.wudao.xiao, 5);
  assert.equal(save.runs, 0);
  assert.equal(save.playTime, 0);
  assert.equal(save.unlocked, Math.max(...LEVELS.map((l) => l.id)) + 1);
  for (const code of ['bad', encode([]), encode({ unlocked: '2' }), encode({ unlocked: 2, ver: 99 })]) assert.equal(importSlot(1, code), false);
  assert.deepEqual(readSlot(1), save);
});

test('导入只保留连通的星图与按序的传承，超出点数则清空并提示', () => {
  reset();
  const tree = { xiao: ['metal.gate', 'center', 'metal.s1', 'metal.s2', 'water.s2'], xuanyi: ['center', 'fire.gate'] };
  const legacy = { xiao: ['xiao.a2', 'xiao.b1'] };
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 4, clears: { xiao: [1, 2], xuanyi: [1] }, tree, legacy })));
  let save = readSlot(1);
  assert.deepEqual(save.tree.xiao, ['metal.s1', 'metal.s2']);
  assert.deepEqual(save.tree.xuanyi, ['fire.gate']);
  assert.deepEqual(save.legacy.xiao, ['xiao.b1']);
  assert.equal(save.notice, '');
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 4, clears: {}, tree, legacy })));
  save = readSlot(1);
  assert.deepEqual(save.tree.xiao, []);
  assert.deepEqual(save.legacy.xiao, []);
  assert.deepEqual(save.tree.xuanyi, ['fire.gate']);
  assert.match(save.notice, /萧.*已清空/);
});

test('玄一星图从中宫开场，其他角色保留向本系外侧聚焦', () => {
  for (const id of ['xuanyi', 'xiao']) {
    const scene = new DongfuScene();
    scene.char = character(id);
    scene.drawMap = () => {};
    scene.focusStart();
    if (id === 'xuanyi') {
      assert.equal(scene.camX, 0);
      assert.equal(scene.camY, 0);
      assert.equal(scene.node, 'center');
    } else assert.ok(Math.hypot(scene.camX, scene.camY) > 0);
  }
});

test('默认选关取最高已解锁且开放的关卡，不再写死第二关', () => {
  reset();
  const available = LEVELS[2].available;
  LEVELS[2].available = true;
  try {
    const save = loadSave();
    save.unlocked = 4;
    writeSave(save);
    const scene = new MenuScene();
    const chain = new Proxy({}, { get: () => () => chain });
    scene.add = { tileSprite: () => chain, rectangle: () => chain, text: () => chain, container: () => chain };
    scene.input = { keyboard: { on() {} } };
    scene.render = () => {};
    scene.create();
    assert.equal(LEVELS[scene.levelSel].id, 3);
  } finally {
    LEVELS[2].available = available;
  }
});

const { itemSpot, ITEM_SPAWN } = await import('../src/config/map.ts');
const { rng } = await import('../src/art/painter.ts');

test('刷新道具落在玩家周围的环上、地图内、避开岩壁；贴边时也找得到点', () => {
  const half = 1800;
  const blocked = (x, y) => Math.abs(x - y) < 60;
  const [d0, d1] = ITEM_SPAWN.dist;
  for (const [px, py] of [[0, 0], [half - 30, half - 30], [-half + 30, 200]]) {
    for (let seed = 1; seed <= 30; seed++) {
      const spot = itemSpot(px, py, half, blocked, rng(seed));
      assert.ok(spot, `玩家在 (${px}, ${py}) 时找不到点`);
      const [x, y] = spot;
      const d = Math.hypot(x - px, y - py);
      assert.ok(d >= d0 - 1 && d <= d1 + 1, '不在刷新环上');
      assert.ok(Math.abs(x) <= half - 80 && Math.abs(y) <= half - 80, '贴边或出界');
      assert.ok(!blocked(x, y), '刷在岩壁上');
    }
  }
});

test('升级预览给出选后的灵根与本命，且不改动当前构筑', () => {
  const build = new Build(character('xiao'), LEVELS[0]);
  assert.equal(build.benming, 'metal');
  // 一口气给木系很多级，本命应翻成木
  build.skills.set('leaf', 1);
  build.recompute();
  const v0 = build.version;
  const lingen0 = { ...build.lingen };
  const pv = build.preview({ kind: 'skill', id: 'leaf', lv: 1 + build.lingen.metal });
  assert.equal(pv.benming, 'wood');
  assert.deepEqual(build.lingen, lingen0);
  assert.equal(build.skills.get('leaf'), 1);
  assert.equal(build.version, v0);
  assert.equal(build.benming, 'metal');
});

const { isRidge, woodland } = await import('../src/game/terrain.ts');

test('三关山脊从出生点基本全图连通，第 1 关最稀、第 3 关最密', () => {
  const ratio = {};
  for (const level of LEVELS.filter((l) => l.available)) {
    const def = level.ridges;
    assert.ok(def, `第 ${level.id} 关没有配山脊`);
    const cell = 16;
    const n = Math.floor(level.size / cell);
    const half = level.size / 2;
    const wall = new Uint8Array(n * n);
    let walls = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const wx = -half + (x + 0.5) * cell;
        const wy = -half + (y + 0.5) * cell;
        // 玩家半径约 6，按墙加厚 4 算更保守
        if (Math.hypot(wx, wy) >= 170 && isRidge(wx, wy, level.id, def, 4)) (wall[y * n + x] = 1), walls++;
      }
    const seen = new Uint8Array(n * n);
    const start = Math.floor(n / 2) * n + Math.floor(n / 2);
    const stack = [start];
    seen[start] = 1;
    let reach = 0;
    while (stack.length) {
      const i = stack.pop();
      reach++;
      const x = i % n;
      const y = (i / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const j = ny * n + nx;
        if (seen[j] || wall[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const open = n * n - walls;
    assert.ok(reach / open > 0.95, `第 ${level.id} 关只有 ${((reach / open) * 100).toFixed(1)}% 的空地走得到`);
    ratio[level.id] = walls / (n * n);
  }
  assert.ok(ratio[1] < ratio[2] && ratio[2] < ratio[3], `山脊密度应逐关上升：${JSON.stringify(ratio)}`);
  assert.ok(woodland(123, 456, 1) >= 0 && woodland(123, 456, 1) <= 1);
});

const { NavGrid } = await import('../src/game/nav.ts');

test('寻路距离场能带着被岩壁挡住的怪绕到缺口', () => {
  const nav = new NavGrid(800);
  // 横着一道墙，只在右端 x>200 留缺口
  const rocks = [];
  for (let x = -400; x <= 200; x += 14) nav.addSolid(x, 0, 9), rocks.push(x);
  const px = 0;
  const py = 150;
  nav.update(px, py);
  let x = -50;
  let y = -150;
  let hx = 0;
  let hy = 1;
  // 直线被挡，必须给出绕行方向
  assert.ok(nav.steer(x, y, hx, hy));
  for (let i = 0; i < 400 && Math.hypot(px - x, py - y) > 10; i++) {
    const d = Math.hypot(px - x, py - y);
    hx = (px - x) / d;
    hy = (py - y) / d;
    const st = nav.steer(x, y, hx, hy) ?? [hx, hy];
    x += st[0] * 6;
    y += st[1] * 6;
    // 身体半径 6，不能撞进石头
    assert.ok(rocks.every((rx) => Math.hypot(x - rx, y) >= 15), `撞上了岩石 (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  assert.ok(Math.hypot(px - x, py - y) <= 10, `没走到玩家身边，停在 (${x.toFixed(0)}, ${y.toFixed(0)})`);
  // 空地上直线走得通时不干预
  assert.equal(nav.steer(300, 300, 0, 1), null);
  assert.ok(!nav.clear(0, -100, 0, 100));
  assert.ok(nav.clear(300, -100, 300, 100));
});
