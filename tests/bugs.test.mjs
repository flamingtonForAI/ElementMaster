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

test('青龙印禁止暴击，普通构筑照常暴击', () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    for (const [mods, noCrit, expected] of [[{}, false, true], [{ noCrit: 1 }, false, false], [{}, true, false]]) {
      const scene = runScene('xiao', 1);
      scene.build = new Build(scene.char, LEVELS[0], {}, mods);
      scene.pstats = { ...scene.build.stats(), crit: 1 };
      scene.player = { x: 1000, y: 1000 };
      scene.dmgMult = () => 1;
      let crit;
      scene.fx = { number: (_x, _y, _dmg, _rel, value) => { crit = value; } };
      scene.hitEnemy({ alive: true, def: { el: 'metal' }, x: 0, y: 0, hp: 1000, armor: 0, flashUntil: 0, sprite: { displayHeight: 16 } }, 10, 'metal', { noCrit });
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

test('图鉴：结算把本局击杀累加进存档，未知敌人和非正数丢掉', () => {
  reset();
  assert.ok(importSlot(1, encode({ unlocked: 1, ver: 6, bestiary: { shiyong: 3, nobody: 5, shuigui: -2, huoya: 'x' } })));
  assert.deepEqual(readSlot(1).bestiary, { shiyong: 3 });
  const scene = runScene('xiao', 1);
  scene.killed = { shiyong: 2, langyao: 1 };
  scene.endRun(true);
  assert.deepEqual(loadSave().bestiary, { shiyong: 5, langyao: 1 });
  assert.deepEqual(scene.killed, {});
});

test('v3 最高关记录迁移保留已有点数，星图重绘清空已点星位，EM6 导出再导入保留逐关记录', () => {
  reset();
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 3, clears: { xiao: 2 }, wudao: { xiao: 1 }, tree: { xiao: ['metal.s1', 'metal.s2'] }, legacy: { xiao: ['xiao.a1'] } })));
  const save = readSlot(1);
  assert.equal(save.ver, 6);
  assert.deepEqual(save.clears.xiao, [1, 2]);
  assert.deepEqual(save.tree.xiao, []);
  assert.match(save.notice, /星图重绘.*萧寒锋/);
  assert.deepEqual(save.legacy.xiao, ['xiao.a1']);
  assert.equal(daoPoints(save, character('xiao')), 9);
  assert.equal(legacyPoints(save, character('xiao')), 1);
  const code = exportSlot(1);
  assert.ok(code.startsWith('EM6:'));
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
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 6, clears: { xiao: [1, 2], xuanyi: [1] }, tree, legacy })));
  let save = readSlot(1);
  assert.deepEqual(save.tree.xiao, ['metal.s1', 'metal.s2']);
  assert.deepEqual(save.tree.xuanyi, ['fire.gate']);
  assert.deepEqual(save.legacy.xiao, ['xiao.b1']);
  assert.equal(save.notice, '');
  assert.ok(importSlot(1, encode({ unlocked: 3, ver: 6, clears: {}, tree, legacy })));
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
  const available = LEVELS[4].available;
  LEVELS[4].available = true;
  try {
    const save = loadSave();
    // 第 6 关尚未开放，应落在第 5 关
    save.unlocked = 6;
    writeSave(save);
    const scene = new MenuScene();
    const chain = new Proxy({}, { get: () => () => chain });
    scene.add = { tileSprite: () => chain, rectangle: () => chain, text: () => chain, container: () => chain };
    scene.input = { keyboard: { on() {} } };
    scene.render = () => {};
    scene.create();
    assert.equal(LEVELS[scene.levelSel].id, 5);
  } finally {
    LEVELS[4].available = available;
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

test('有前置的心法：身上没有对应的术不会出现，学会后才会出现', () => {
  const build = new Build(character('xiao'), LEVELS[0]);
  const seen = (id) => {
    for (let i = 0; i < 400; i++) if (build.options(3).some((o) => o.kind === 'passive' && o.id === id)) return true;
    return false;
  };
  // 剑客开局只有剑气斩：金系的破军诀有，水系的玄冥诀、要穿透投射物的贯日诀没有
  assert.equal(seen('pojun'), true);
  assert.equal(seen('xuanming'), false);
  assert.equal(seen('guanri'), false);
  build.skills.set('hanbing', 1);
  build.skills.set('flysword', 1);
  assert.equal(seen('xuanming'), true);
  assert.equal(seen('guanri'), true);
});

const { isRidge, woodland } = await import('../src/game/terrain.ts');

test('各关山脊从出生点基本全图连通，第 1 关最稀、第 3 关最密', () => {
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

const { STAR, CENTER, hehuaPairs, blocked } = await import('../src/config/startree.ts');

/** 从起点到每个星位要花的道点（起点免费） */
function costs(start) {
  const d = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const id = q.shift();
    for (const l of STAR[id].links) if (!d.has(l)) d.set(l, d.get(id) + 1), q.push(l);
  }
  return d;
}

test('星图连线双向、星位不重叠，本命门到本系极境印 16 点，合化要穴 10 点，奇穴 7 点', () => {
  const nodes = Object.values(STAR);
  for (const a of nodes) for (const l of a.links) assert.ok(STAR[l].links.includes(a.id), `${a.id} ↔ ${l}`);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const [a, b] = [nodes[i], nodes[j]];
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 30, `${a.id} 与 ${b.id} 太近`);
    }
  }
  const glyphs = nodes.filter((n) => n.kind === 'notable' || n.kind === 'keystone').map((n) => n.glyph).filter((g) => g !== '破' && g !== '御');
  assert.equal(new Set(glyphs).size, glyphs.length);
  assert.equal(costs(CENTER).size, nodes.length);
  const wood = costs('wood.gate');
  assert.equal(wood.get('wood.k'), 16);
  assert.equal(wood.get('wood.kX'), 7);
  assert.equal(wood.get('wood.zan'), 7);
  assert.equal(wood.get('wood.zk'), 10);
  // 子一侧从御那支进合化区，路程相同
  assert.equal(wood.get('water.zbn'), 7);
  assert.equal(wood.get('water.zk'), 10);
  assert.equal(wood.get('fire.k'), 18);
  assert.equal(costs(CENTER).get('wood.k'), 17);
});

/** 按真实点星规则（别系本命门、中宫不能点）算从本命门出发的道点 */
function realCosts(start) {
  const d = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const id = q.shift();
    for (const l of STAR[id].links) if (!d.has(l) && !blocked(l, start)) d.set(l, d.get(id) + 1), q.push(l);
  }
  return d;
}

test('星图：去相邻元素的脉 3 点不变，去相克的元素多绕 2 点；御火在火的子一侧，剑客要 9 点', () => {
  const order = ['wood', 'fire', 'earth', 'metal', 'water'];
  order.forEach((el, i) => {
    const d = realCosts(`${el}.gate`);
    const next = order[(i + 1) % 5];
    const prev = order[(i + 4) % 5];
    assert.equal(d.get(`${next}.s1b`), 3);
    assert.equal(d.get(`${prev}.s1`), 3);
    assert.equal(d.get(`${order[(i + 2) % 5]}.s1b`), 7);
    assert.equal(d.get(`${order[(i + 3) % 5]}.s1`), 7);
    assert.equal(d.get(`${el}.k`), 16);
  });
  const xiao = realCosts('metal.gate');
  assert.equal(xiao.get('fire.yt'), 9);
  assert.equal(xiao.get('metal.yt'), 5);
  assert.ok(STAR['fire.yt'].mods['sres.burn'] > 0);
});

function comboScene(mods) {
  const scene = runScene('qingdai', 1);
  scene.build = new Build(scene.char, LEVELS[0], {}, mods);
  scene.hehua = hehuaPairs(mods);
  scene.terrainMods = { metal: 1, wood: 1, water: 1, fire: 1, earth: 1 };
  scene.pstats = { ...scene.build.stats(), crit: 0 };
  scene.player = { x: 1000, y: 1000, moving: true };
  scene.fx = { number() {}, text() {}, ring() {} };
  scene.enemies = { kill(e) { e.alive = false; } };
  scene.now = 1;
  return scene;
}
const enemy = (el, o = {}) => ({ alive: true, def: { el }, x: 0, y: 0, hp: 100, maxHp: 100, armor: 0, flashUntil: 0, bleedUntil: 0, bleedStacks: 0, bleedDps: 0, chill: 0, chillAt: 0, chillImmuneUntil: 0, frozenUntil: 0, daze: 0, dazeAt: 0, invulnUntil: 0, slowUntil: 0, stunUntil: 0, stunImmuneUntil: 0, poisonUntil: 0, burnUntil: 0, sprite: { displayHeight: 16 }, ...o });

test('水木滋荣：木术命中附带迟缓，同时迟缓、中毒的敌人受伤 +20%', () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    const mods = { 'hehua.water': 1 };
    const scene = comboScene(mods);
    const e = enemy('earth');
    const base = scene.dmgMult(e, 'wood');
    scene.hitEnemy(e, 10, 'wood');
    assert.ok(e.slowUntil > scene.now);
    assert.equal(scene.dmgMult(e, 'wood'), base);
    e.poisonUntil = scene.now + 2;
    assert.ok(Math.abs(scene.dmgMult(e, 'wood') / base - 1.2) < 1e-9);
    // 没点合化要穴就不附带
    const plain = comboScene({});
    const f = enemy('earth');
    plain.hitEnemy(f, 10, 'wood');
    assert.equal(f.slowUntil, 0);
  } finally {
    Math.random = random;
  }
});

test('相克奇穴：伐木斩杀残血木系敌人，Boss 和别系不受影响；盘根让土系护甲减半', () => {
  const scene = comboScene({ 'kx.metal': 1, 'kx.wood': 1 });
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    const w = enemy('wood', { hp: 20 });
    scene.dmgMult = () => 1;
    scene.hitEnemy(w, 10, 'metal');
    assert.equal(w.alive, false);
    const boss = enemy('wood', { hp: 20, boss: true });
    scene.hitEnemy(boss, 10, 'metal');
    assert.equal(boss.hp, 10);
    const rock = enemy('earth', { armor: 4 });
    scene.hitEnemy(rock, 10, 'metal');
    assert.equal(rock.hp, 92);
  } finally {
    Math.random = random;
  }
});

const { EnemyManager } = await import('../src/game/Enemies.ts');
const { ENEMIES } = await import('../src/config/enemies.ts');

/** 只够跑 EnemyManager.kill 的场景桩；later 的回调攒起来手动执行 */
function killScene() {
  const tasks = [];
  const chain = new Proxy({}, { get: (_t, k) => (k === 'active' ? true : () => chain) });
  const noop = new Proxy({}, { get: () => () => {} });
  const g = {
    now: 0, over: false, kills: 0, killed: {}, bossKilled: 0, build: { mods: {} }, fx: noop, pickups: noop, hud: noop, proj: noop,
    add: { image: () => chain }, tweens: { add() {} }, later: (_t, fn) => tasks.push(fn), hpScale: () => 1, cap: 999, spawnCap() { return this.cap; },
    onBossKilled() { this.bossKilled++; },
  };
  const mgr = new EnemyManager(g);
  const spawned = [];
  mgr.spawn = (id, x, y, o) => spawned.push({ id, x, y, o });
  return { g, mgr, spawned, run: () => tasks.splice(0).forEach((fn) => fn()) };
}
const sprite = () => ({ flipX: false, setVisible() { return this; }, setActive() { return this; }, setScale() { return this; }, anims: { stop() {} } });
const mob = (id, o = {}) => ({ alive: true, def: ENEMIES[id], x: 10, y: 20, hp: 0, maxHp: 100, xp: 2, elite: false, boss: !!ENEMIES[id].boss, lastEl: null, rose: false, sprite: sprite(), glyph: null, ...o });

test('残兵：非火系击杀 5 秒后原地复活且不再掉经验；火系击杀、精英不复活', () => {
  const { mgr, spawned, run } = killScene();
  mgr.kill(mob('canbing', { lastEl: 'metal' }));
  assert.equal(spawned.length, 0);
  run();
  assert.deepEqual(spawned.map((s) => [s.id, s.x, s.y, s.o.noXp]), [['canbing', 10, 20, true]]);
  mgr.kill(mob('canbing', { lastEl: 'fire' }));
  mgr.kill(mob('canbing', { lastEl: 'earth', elite: true }));
  run();
  assert.equal(spawned.length, 1);
});

test('复活的残兵再被打死不计击杀（不能刷灵石），同屏满了就晚点再起', () => {
  const { g, mgr, spawned, run } = killScene();
  mgr.kill(mob('canbing', { lastEl: 'metal' }));
  assert.equal(g.kills, 1);
  g.cap = 0;
  run();
  assert.equal(spawned.length, 0);
  run();
  assert.equal(spawned.length, 0);
  g.cap = 999;
  run();
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].o.noKill, true);
  mgr.kill(mob('canbing', { lastEl: 'metal', noKill: true }));
  assert.equal(g.kills, 1);
});

const { NavGrid: Nav } = await import('../src/game/nav.ts');

test('寻路只算玩家附近：窗口内和全图结果一致，窗口外当作没走到', () => {
  const full = new Nav(3000, 1e9);
  const near = new Nav(3000);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 3000;
  for (let i = 0; i < 800; i++) {
    const [x, y] = [rnd(), rnd()];
    full.addSolid(x, y, 9);
    near.addSolid(x, y, 9);
  }
  // 换两次源点，确认只清上次走到的格子也不会留下脏数据
  for (const [px, py] of [[-400, 300], [100, -50]]) {
    full.update(px, py);
    near.update(px, py);
  }
  for (let i = 0; i < 300; i++) {
    const [x, y] = [100 + rnd() / 3, -50 + rnd() / 4];
    const hx = 100 - x;
    const hy = -50 - y;
    const l = Math.hypot(hx, hy) || 1;
    assert.deepEqual(near.steer(x, y, hx / l, hy / l, true), full.steer(x, y, hx / l, hy / l, true), `(${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  assert.equal(near.steer(1400, 1400, -1, -1, true), null);
});

test('灼烧烧死算火系击杀，中毒毒死不算', () => {
  const scene = comboScene({});
  const a = enemy('metal', { hp: 1 });
  scene.dotEnemy(a, 0, 5);
  assert.equal(a.lastEl, 'fire');
  assert.equal(a.alive, false);
  const b = enemy('metal', { hp: 1 });
  scene.dotEnemy(b, 5, 0);
  assert.equal(b.lastEl, 'wood');
});

test('刑天：第一次非火系击杀带 35% 生命复起并短暂无敌，第二次才倒；火系一击即终结', () => {
  const { g, mgr } = killScene();
  const boss = mob('xingtian', { lastEl: 'metal', maxHp: 1000 });
  mgr.kill(boss);
  assert.equal(boss.alive, true);
  assert.equal(boss.hp, 350);
  assert.ok(boss.rose && boss.invulnUntil > g.now);
  assert.equal(g.bossKilled, 0);
  boss.hp = 0;
  mgr.kill(boss);
  assert.equal(boss.alive, false);
  assert.equal(g.bossKilled, 1);
  const burnt = mob('xingtian', { lastEl: 'fire', maxHp: 1000 });
  mgr.kill(burnt);
  assert.equal(burnt.alive, false);
  assert.equal(g.bossKilled, 2);
  // 无敌期间不吃伤害
  const scene = comboScene({});
  const e = enemy('metal', { invulnUntil: scene.now + 1 });
  assert.equal(scene.hitEnemy(e, 50, 'fire'), 0);
  assert.equal(e.hp, 100);
});

const { spotAt, ridgeDist, RIDGE_HALF } = await import('../src/game/terrain.ts');
const { World } = await import('../src/game/World.ts');

test('熔岩口、剑阵点位固定：离出生点够远、在地图内、不挨山脊，数量够用', () => {
  for (const [id, key, salt] of [[4, 'lava', 1], [5, 'swordZones', 2]]) {
    const level = LEVELS.find((l) => l.id === id);
    const def = level[key];
    const half = level.size / 2;
    const n = Math.ceil(half / def.cell);
    let count = 0;
    for (let iy = -n; iy < n; iy++)
      for (let ix = -n; ix < n; ix++) {
        const p = spotAt(ix, iy, level.id, salt, def, half, level.ridges);
        assert.deepEqual(p, spotAt(ix, iy, level.id, salt, def, half, level.ridges));
        if (!p) continue;
        count++;
        assert.ok(Math.hypot(p[0], p[1]) >= 200 + def.radius);
        assert.ok(Math.abs(p[0]) <= half - def.radius && Math.abs(p[1]) <= half - def.radius);
        assert.ok(ridgeDist(p[0], p[1], level.id, level.ridges) >= RIDGE_HALF + def.radius);
      }
    assert.ok(count >= 25, `第 ${id} 关 ${key} 只有 ${count} 个`);
  }
});

test('煞气剑阵里的敌人护甲 +3，出阵恢复', () => {
  const level = LEVELS.find((l) => l.id === 5);
  const world = Object.assign(Object.create(World.prototype), { level, half: level.size / 2, spotCache: new Map() });
  let spot = null;
  for (let i = 1; i < 20 && !spot; i++) spot = world.spotsIn('zone', -i * 420, -i * 420, i * 420, i * 420)[0];
  assert.ok(spot);
  const [x, y] = spot;
  const r = level.swordZones.radius;
  assert.equal(world.zoneArmor(x, y), 3);
  assert.equal(world.zoneArmor(x + r - 4, y), 3);
  assert.equal(world.zoneArmor(x + r + 4, y), 0);
  const scene = comboScene({});
  scene.dmgMult = () => 1;
  scene.world = world;
  const inside = enemy('metal', { x, y });
  scene.hitEnemy(inside, 10, 'fire');
  const outside = enemy('metal', { x: x + r + 40, y });
  scene.hitEnemy(outside, 10, 'fire');
  assert.equal(inside.hp, 93);
  assert.equal(outside.hp, 90);
});

test('第 1 关分批进场：开场只有石俑、藤怪，25/75/135 秒依次加入水鬼、铁甲兵、火鸦；其他关不受影响', async () => {
  const { enemyPool } = await import('../src/config/levels.ts');
  const ids = (level, t) => enemyPool(LEVELS.find((l) => l.id === level), t).map((e) => e.id).sort();
  assert.deepEqual(ids(1, 0), ['shiyong', 'tengguai']);
  assert.deepEqual(ids(1, 24.9), ['shiyong', 'tengguai']);
  assert.deepEqual(ids(1, 25), ['shiyong', 'shuigui', 'tengguai']);
  assert.deepEqual(ids(1, 75), ['shiyong', 'shuigui', 'tengguai', 'tiejia']);
  assert.deepEqual(ids(1, 135), ['huoya', 'shiyong', 'shuigui', 'tengguai', 'tiejia']);
  for (const l of LEVELS.filter((l) => l.available && l.id > 1)) assert.deepEqual(ids(l.id, 0), l.enemies.map((e) => e.id).sort());
  // 配置写错、一个都没到点时退回第一种
  assert.deepEqual(enemyPool({ enemies: [{ id: 'a', w: 1, from: 10 }, { id: 'b', w: 1, from: 20 }] }, 0).map((e) => e.id), ['a']);

  // pickEnemy（普通刷怪、成群来袭、精英共用）只从已解锁的池里抽
  const scene = runScene('xiao', 1);
  const random = Math.random;
  try {
    for (const [t, allowed] of [[10, ['shiyong', 'tengguai']], [100, ['shiyong', 'tengguai', 'shuigui', 'tiejia']]]) {
      scene.elapsed = t;
      const seen = new Set();
      for (let i = 0; i < 100; i++) {
        Math.random = () => i / 100;
        seen.add(scene.pickEnemy());
      }
      assert.deepEqual([...seen].sort(), allowed.sort());
    }
  } finally {
    Math.random = random;
  }

  // 到点亮相：刷 3 只新怪并提示
  const spawned = [];
  let toast = '';
  scene.player = { x: 1000, y: 1000 };
  scene.ringPos = () => [0, 0];
  scene.hpScale = () => 1;
  scene.enemies = { spawn: (id) => spawned.push(id) };
  Object.defineProperty(scene, 'hud', { value: { toast: (s) => { toast = s; } } });
  scene.introEnemy('shuigui');
  assert.deepEqual(spawned, ['shuigui', 'shuigui', 'shuigui']);
  assert.equal(toast, '水鬼出没');
});

test('Boss 远吼：元素加成叠上按 id 写的那条；没写的元素用 other', async () => {
  const { roarBuff } = await import('../src/config/levels.ts');
  const L = (id) => LEVELS.find((l) => l.id === id);
  assert.deepEqual(roarBuff(L(1), 'tiejia', 'metal'), { dmg: 0.08, windup: 0.15, dash: 0.15, cd: 0.1 });
  assert.deepEqual(roarBuff(L(1), 'shuigui', 'water'), { speed: 0.1 });
  assert.deepEqual(roarBuff(L(4), 'shiyong', 'earth'), { dmg: 0.08, armor: 2 });
  assert.deepEqual(roarBuff(L(5), 'canbing', 'metal'), { cd: 0.15, dash: 0.15, revive: 0.8 });
  assert.equal(roarBuff({}, 'shiyong', 'earth'), null);
  // 每关的台词和吼的次数对得上，吼都在 Boss 现身前
  for (const l of LEVELS.filter((l) => l.available)) {
    assert.ok(l.roar, `第 ${l.id} 关没配远吼`);
    assert.equal(l.roar.lines.length, l.roar.times.length);
    for (const t of l.roar.times) assert.ok(t < l.duration - 60);
  }
});

test('Boss 远吼：场上的怪一层层补差和出生直接带两层结果一致，Boss 不吃加成', () => {
  const g = { levelDef: LEVELS.find((l) => l.id === 2), roarStacks: 0, now: 5 };
  const mgr = new EnemyManager(g);
  const fresh = (id) => ({ ...mob(id), roarN: 0, maxHp: 100, hp: 60, speed: 30, dmg: 10, atkDps: 2, armor: 1, cdMul: 1, windMul: 1, dashMul: 1, blastMul: 1, regenMul: 1, trailAdd: 0, reviveSub: 0, chanceAdd: 0, hopAt: -1 });
  const a = fresh('tengguai');
  mgr.list.push(a);
  mgr.onRoar(1);
  mgr.onRoar(2);
  const b = fresh('tengguai');
  mgr.applyRoar(b, 2);
  for (const k of ['maxHp', 'hp', 'speed', 'dmg', 'regenMul']) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
  assert.equal(a.maxHp, 120);
  assert.equal(a.regenMul, 2);
  assert.equal(a.hopAt, 5);
  // 竹叶青另有冲刺间隔缩短，土系只吃 other 的伤害
  const snake = fresh('zhushe');
  mgr.applyRoar(snake, 2);
  assert.ok(Math.abs(snake.cdMul - 0.7) < 1e-9);
  const rock = fresh('shiyong');
  mgr.applyRoar(rock, 2);
  assert.equal(rock.maxHp, 100);
  assert.ok(Math.abs(rock.dmg - 11.6) < 1e-9);
  const boss = fresh('shuyao');
  mgr.list.push(boss);
  mgr.onRoar(3);
  assert.equal(boss.maxHp, 100);
  assert.equal(boss.hopAt, -1);
});

test('Boss 远吼：每吼一层，提示、全场加成、本关地形事件各一次；Boss 现身后不再吼', () => {
  const scene = runScene('xiao', 3);
  const calls = [];
  const toasts = [];
  scene.enemies = { onRoar: (n) => calls.push(['roar', n]) };
  scene.hazards = { rain: (n) => calls.push(['rain', n]), erupt: (n) => calls.push(['erupt', n]) };
  scene.cameras = { main: { shake() {} } };
  Object.defineProperty(scene, 'hud', { value: { toast: (s) => toasts.push(s) } });
  scene.roar();
  scene.roar();
  assert.deepEqual(calls, [['roar', 1], ['rain', 3], ['roar', 2], ['rain', 3]]);
  assert.equal(toasts[0], LEVELS[2].roar.lines[0]);
  assert.equal(toasts[2], LEVELS[2].roar.lines[1]);
  scene.boss = {};
  scene.roar();
  assert.equal(scene.roarStacks, 2);
});

test('Boss 狂暴：血量跌破 30% 且回到普通走位才触发，只触发一次，停顿期间无敌；全场小怪再叠一层', () => {
  const { g, mgr } = killScene();
  let rage = 0;
  g.cameras = { main: { shake() {} } };
  g.onBossRage = () => rage++;
  g.now = 10;
  const boss = mob('langyao', { maxHp: 1000, hp: 310, state: 0, lift: 0, timer: 0, raged: false });
  mgr.maybeEnrage(boss);
  assert.equal(rage, 0);
  boss.hp = 290;
  boss.state = 2;
  mgr.maybeEnrage(boss);
  assert.equal(rage, 0, '冲刺中不打断');
  boss.state = 0;
  mgr.maybeEnrage(boss);
  mgr.maybeEnrage(boss);
  assert.equal(rage, 1);
  assert.equal(boss.raged, true);
  assert.equal(boss.invulnUntil, 11);
  // 小怪不会狂暴
  const minion = mob('shiyong', { maxHp: 100, hp: 10, state: 0, lift: 0 });
  mgr.maybeEnrage(minion);
  assert.equal(rage, 1);

  const scene = runScene('xiao', 1);
  const stacks = [];
  scene.roarStacks = 2;
  scene.enemies = { onRoar: (n) => stacks.push(n) };
  Object.defineProperty(scene, 'hud', { value: { toast() {} } });
  scene.onBossRage({ def: ENEMIES.langyao });
  assert.deepEqual(stacks, [3]);
  assert.equal(scene.roarStacks, 3);
});

test('流血叠满撕裂，剩下的流血一次打完；同系打五折、被克的火系只剩三成，不再完全免疫', () => {
  const scene = comboScene({});
  scene.fx = { number() {}, text() {}, ring() {} };
  const e = enemy('earth');
  for (let i = 0; i < 4; i++) scene.bleedEnemy(e, 2);
  assert.equal(e.bleedStacks, 4);
  assert.equal(e.hp, 100);
  scene.bleedEnemy(e, 2);
  assert.equal(e.bleedStacks, 0);
  assert.equal(e.hp, 100 - 5 * 2 * 3);
  const m = enemy('metal');
  scene.bleedEnemy(m, 2);
  assert.equal(m.bleedStacks, 1);
  assert.equal(m.bleedDps, 1);
  const f = enemy('fire');
  scene.bleedEnemy(f, 10);
  assert.ok(Math.abs(f.bleedDps - 3) < 1e-9);
});

test('异常几率按五行缩放：克 ×1.5、同系 ×0.5、被克 ×0.3，没有 0', async () => {
  const { statusChance } = await import('../src/config/status.ts');
  assert.equal(statusChance('bleed', 'wood'), 1.5);
  assert.equal(statusChance('bleed', 'metal'), 0.5);
  assert.equal(statusChance('bleed', 'fire'), 0.3);
  for (const k of ['slow', 'poison', 'burn', 'bleed', 'stun']) for (const el of ['metal', 'wood', 'water', 'fire', 'earth']) assert.ok(statusChance(k, el) > 0);
});

test('水系迟缓命中攒寒意，满 3 层冰冻；别系的迟缓不攒；玄冥诀满级 2 层就冻', () => {
  // 水克火，寒意在火系敌人身上不打折
  const scene = comboScene({});
  const e = enemy('fire');
  scene.hitEnemy(e, 1, 'water', { slow: 1 });
  scene.hitEnemy(e, 1, 'water', { slow: 1 });
  assert.ok(!(e.stunUntil > scene.now));
  scene.hitEnemy(e, 1, 'water', { slow: 1 });
  assert.ok(e.stunUntil > scene.now && e.frozenUntil > scene.now);
  const w = enemy('fire');
  for (let i = 0; i < 5; i++) scene.hitEnemy(w, 1, 'wood', { slow: 1 });
  assert.equal(w.chill, 0);
  scene.build.passives.set('xuanming', 5);
  scene.pstats = scene.build.stats();
  const f = enemy('fire');
  scene.hitEnemy(f, 1, 'water', { slow: 1 });
  scene.hitEnemy(f, 1, 'water', { slow: 1 });
  assert.ok(f.stunUntil > scene.now);
});

test('几率触发的震慑攒满 3 层才打晕', () => {
  const random = Math.random;
  Math.random = () => 0;
  try {
    const scene = comboScene({});
    const e = enemy('water');
    scene.hitEnemy(e, 1, 'earth', { proc: 1 });
    scene.hitEnemy(e, 1, 'earth', { proc: 1 });
    assert.ok(!(e.stunUntil > scene.now));
    scene.hitEnemy(e, 1, 'earth', { proc: 1 });
    assert.ok(e.stunUntil > scene.now);
  } finally {
    Math.random = random;
  }
});
