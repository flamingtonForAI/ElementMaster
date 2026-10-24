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
  // 存档解锁到下一关（尚未开放），应落在最后一个开放的关卡
  const last = Math.max(...LEVELS.filter((l) => l.available).map((l) => l.id));
  const save = loadSave();
  save.unlocked = last + 1;
  writeSave(save);
  const scene = new MenuScene();
  const chain = new Proxy({}, { get: () => () => chain });
  scene.add = { tileSprite: () => chain, rectangle: () => chain, text: () => chain, container: () => chain };
  scene.input = { keyboard: { on() {} } };
  scene.render = () => {};
  scene.create();
  assert.equal(LEVELS[scene.levelSel].id, last);
  assert.ok(!LEVELS.find((l) => l.id === last + 1)?.available);
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
const enemy = (el, o = {}) => ({ alive: true, def: { el }, x: 0, y: 0, hp: 100, maxHp: 100, armor: 0, flashUntil: 0, bleedUntil: 0, bleedStacks: 0, bleedDps: 0, chill: 0, chillAt: 0, chillImmuneUntil: 0, frozenUntil: 0, daze: 0, dazeAt: 0, invulnUntil: 0, slowUntil: 0, poisonDeepUntil: 0, burnDeepUntil: 0, burnBuild: 0, stunUntil: 0, stunImmuneUntil: 0, poisonUntil: 0, poisonBuild: 0, poisonDeep: false, confusedUntil: 0, confuseAngle: 0, confuseTurnAt: 0, burningDeep: false, burnStacks: 0, burnDps: 0, burnUntil: 0, sprite: { displayHeight: 16 }, ...o });

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

const { EnemyManager, Enemy } = await import('../src/game/Enemies.ts');
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

test('熔岩口、剑阵、泥潭、冰面、流沙点位固定：离出生点够远、在地图内、不挨山脊，数量够用', () => {
  for (const [id, key, salt] of [[4, 'lava', 1], [5, 'swordZones', 2], [6, 'mud', 3], [7, 'ice', 4], [8, 'quicksand', 5]]) {
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

test('流血叠满撕裂，剩下的流血一次打完；不再重复按元素折损伤害', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
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
  assert.equal(m.bleedDps, 2);
  const f = enemy('fire');
  scene.bleedEnemy(f, 10);
  assert.equal(f.bleedDps, 10);
});

test('异常几率按五行缩放：克 ×1.5、同系 ×0.5、被克 ×0.3，没有 0', async () => {
  const { statusChance } = await import('../src/config/status.ts');
  assert.equal(statusChance('bleed', 'wood'), 1.5);
  assert.equal(statusChance('bleed', 'metal'), 0.5);
  assert.equal(statusChance('bleed', 'fire'), 0.3);
  for (const k of ['slow', 'poison', 'burn', 'bleed', 'stun']) for (const el of ['metal', 'wood', 'water', 'fire', 'earth']) assert.ok(statusChance(k, el) > 0);
});

test('水系三次积累保底冰冻；别系迟缓不攒；玄冥提高第二次触发率', (t) => {
  t.mock.method(Math, 'random', () => 0.65);
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

test('二阶判定未中时，土系三次积累保底打昏', () => {
  const random = Math.random;
  Math.random = () => 0.99;
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

test('泥潭：玩家移速乘 0.65；非水系普通敌人被拖慢，水系、Boss 不受影响', () => {
  const level = LEVELS.find((l) => l.id === 6);
  const world = Object.assign(Object.create(World.prototype), { level, half: level.size / 2, spotCache: new Map() });
  let spot = null;
  for (let i = 1; i < 20 && !spot; i++) spot = world.spotsIn('mud', -i * 300, -i * 300, i * 300, i * 300)[0];
  assert.ok(spot);
  const [x, y] = spot;
  const r = level.mud.radius;
  assert.equal(world.inMud(x, y)?.player, 0.65);
  assert.ok(world.inMud(x + r - 4, y));
  // 纵向压扁：正下方 r 处已经出了泥潭
  assert.equal(world.inMud(x, y + r * 0.8), null);
  assert.equal(world.inMud(x + r + 4, y), null);
  // 其他关没有泥潭
  const w1 = Object.assign(Object.create(World.prototype), { level: LEVELS[0], half: 1800, spotCache: new Map() });
  assert.equal(w1.inMud(x, y), null);
});

/** 跑 Hazards 的瘴雾用的场景桩 */
async function fogScene() {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const level = LEVELS.find((l) => l.id === 6);
  const img = () => { const o = new Proxy({}, { get: (_t, k) => (k === 'destroy' ? () => {} : () => o) }); return o; };
  const inflicts = [];
  const env = [];
  const list = [];
  const g = {
    levelDef: level, now: 0, elapsed: 0, over: false, player: { x: 0, y: 0 },
    add: { image: img }, hud: { toast() {} }, dmgScale: () => 1,
    status: { inflict: (f) => inflicts.push(f) },
    envDamage: (e, v, el) => env.push([e.def.id, v, el]),
    enemies: { inRadius: (_x, _y, _r, out) => { out.length = 0; out.push(...list); return out; } },
    world: { spotsIn: () => [], inMud: () => null },
  };
  const hz = new Hazards(g);
  return { g, hz, inflicts, env, list };
}

test('瘴雾：慢慢扩开，雾里玩家按 tick 中毒，非木系普通敌人掉血，木系和 Boss 不掉；到时散掉', async () => {
  const { g, hz, inflicts, env, list } = await fogScene();
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    hz.miasmaAt(0, 0, 80, 6, 16);
    list.push(
      { def: ENEMIES.shuigui, x: 10, y: 0, maxHp: 100, elite: false, boss: false },
      { def: ENEMIES.tengguai, x: 10, y: 0, maxHp: 100, elite: false, boss: false },
      { def: ENEMIES.xiangliu, x: 10, y: 0, maxHp: 1000, elite: false, boss: true },
    );
    // 刚冒出来还很小：离中心 40 的玩家不在雾里
    g.player = { x: 40, y: 0 };
    g.now = 0.5;
    hz.update();
    assert.equal(inflicts.length, 0);
    // 扩开之后就罩住了
    g.now = 4;
    hz.update();
    assert.equal(inflicts.length, 1);
    assert.equal(inflicts[0].kind, 'poison');
    g.now = 4.3;
    hz.update();
    assert.equal(inflicts.length, 1, '按 tick 结算，不是每帧');
    assert.deepEqual(env.map((e) => e[0]), ['shuigui', 'shuigui']);
    assert.equal(env[0][1], 5);
    assert.equal(env[0][2], 'wood');
    // 到时散掉，不再结算
    g.now = 17;
    hz.update();
    const n = inflicts.length;
    g.now = 18;
    hz.update();
    assert.equal(inflicts.length, n);
  } finally {
    Math.random = random;
  }
});

test('瘴雾：远吼从玩家附近的泥潭里冒，已经在冒的泥潭不重复冒', async () => {
  const { g, hz } = await fogScene();
  g.world.spotsIn = () => [[100, 0], [-200, 50], [300, 100]];
  assert.equal(hz.rise(2), 2);
  assert.equal(hz.rise(2), 1);
  assert.equal(hz.rise(2), 0);
  const scene = runScene('xiao', 6);
  const calls = [];
  scene.enemies = { onRoar() {} };
  scene.hazards = { rise: (n) => calls.push(n) };
  scene.cameras = { main: { shake() {} } };
  Object.defineProperty(scene, 'hud', { value: { toast() {} } });
  scene.roar();
  assert.deepEqual(calls, [2]);
});

const { TRICKS, AFFIXES } = await import('../src/config/enemies.ts');

test('难度曲线：第 1–3 关敌人不带新手段、精英没有词缀；第 4 关起逐关加，配的敌人都在本关刷怪池里', async () => {
  const { tricksOf } = await import('../src/config/levels.ts');
  for (const l of LEVELS.filter((l) => l.available)) {
    if (l.id <= 3) {
      assert.equal(l.tricks, undefined, `第 ${l.id} 关不该有手段`);
      assert.equal(l.eliteAffixes ?? 0, 0);
      for (const e of l.enemies) assert.deepEqual(tricksOf(l, e.id), []);
      continue;
    }
    assert.ok(Object.keys(l.tricks ?? {}).length >= 2, `第 ${l.id} 关手段太少`);
    for (const id of Object.keys(l.tricks)) assert.ok(l.enemies.some((e) => e.id === id), `第 ${l.id} 关的 ${id} 不在刷怪池里`);
    // 抛射只给会吐弹的
    for (const [id, ts] of Object.entries(l.tricks)) if (ts.includes('lob')) assert.equal(ENEMIES[id].behavior, 'spit');
  }
  const aff = (id) => LEVELS.find((l) => l.id === id).eliteAffixes;
  assert.ok(aff(4) >= 1 && aff(6) > aff(4), '精英词缀数逐关上升');
  // 同一种石俑：第 1 关朴素，第 4 关会震地
  assert.deepEqual(tricksOf(LEVELS[0], 'shiyong'), []);
  assert.deepEqual(tricksOf(LEVELS[3], 'shiyong'), ['quake']);
});

/** 跑 EnemyManager 手段逻辑的场景桩 */
function trickScene(level) {
  const { g, mgr, spawned, run } = killScene();
  const hurts = [];
  const patches = [];
  const fogs = [];
  const inflicts = [];
  const noop = new Proxy({}, { get: () => () => {} });
  Object.assign(g, {
    levelDef: LEVELS.find((l) => l.id === level), now: 10, player: { x: 0, y: 0, alive: true, moving: false, facing: { x: 0, y: 1 } }, pstats: { speed: 60 },
    hurtPlayer: (v, el, o) => hurts.push([v, el, o?.inflict?.kind]), status: { inflict: (f) => inflicts.push(f.kind) },
    hazards: { patch: (...a) => patches.push(a), miasmaAt: (...a) => fogs.push(a) },
    world: { clampPt: (x, y) => [x, y] }, dmgScale: () => 1, fx: noop, hud: noop,
  });
  let lobbed = null;
  g.proj = { enemyLob: (_t, _sx, _sy, tx, ty, _d, onLand) => (lobbed = () => onLand(tx, ty)) };
  return { g, mgr, spawned, run, hurts, patches, fogs, inflicts, land: () => lobbed?.() };
}
const trickMob = (id, level, o = {}) => ({ ...mob(id), id: 7, dmg: 6, radius: 8, cdMul: 1, trailAdd: 0, stunUntil: 0, castUntil: 0, trickAt: 0, chanceAdd: 0, atkDps: 0, affixes: [], tricks: LEVELS.find((l) => l.id === level).tricks?.[id] ?? [], ...o });

test('震地：贴近才开招，蓄力期间站住，落下时圈里的玩家攒一层震慑；被定身打断', () => {
  const { g, mgr, run, hurts } = trickScene(4);
  const e = trickMob('shiyong', 4, { x: 100, y: 0 });
  mgr.tryTrick(e, 100);
  assert.equal(e.castUntil, 0, '离得远不开招');
  e.x = 30;
  mgr.tryTrick(e, 30);
  assert.equal(e.castUntil, g.now + TRICKS.quake.warn);
  assert.ok(e.trickAt > g.now + 5);
  run();
  assert.deepEqual(hurts, [[6, 'earth', 'stun']]);
  // 再开一次，蓄力中被定身就落空
  e.trickAt = 0;
  mgr.tryTrick(e, 30);
  e.stunUntil = g.now + 1;
  run();
  assert.equal(hurts.length, 1);
});

test('抛射：火精落地留余火，鱼妖留水洼，落点里的玩家受伤；前几关的同种怪照旧直线吐弹', () => {
  for (const [id, level, kind] of [['huojing', 4, undefined], ['yuyao', 6, 'water']]) {
    const { mgr, hurts, patches, land } = trickScene(level);
    mgr.lobShot(trickMob(id, level));
    land();
    assert.equal(hurts.length, 1);
    assert.equal(patches.length, 1);
    assert.equal(patches[0][5], kind);
  }
  assert.deepEqual(LEVELS.find((l) => l.id === 2).tricks?.zhangchan, undefined);
});

test('列阵、护词缀：周围的妖物护甲 +2（不含自己和 Boss），出圈后过期；护甲进伤害结算', () => {
  const { g, mgr } = trickScene(5);
  const leader = trickMob('tiejia', 5, { x: 0, y: 0 });
  const near = trickMob('canbing', 5, { x: 20, y: 0, guardUntil: 0, guardArmor: 0 });
  const far = trickMob('canbing', 5, { x: 300, y: 0, guardUntil: 0, guardArmor: 0 });
  const boss = trickMob('xingtian', 5, { x: 10, y: 0, guardUntil: 0, guardArmor: 0 });
  leader.aura = {};
  mgr.list.push(leader, near, far, boss);
  for (const e of mgr.list) mgr.grid.insert(e);
  mgr.updateAuras(1);
  assert.equal(near.guardArmor, 2);
  assert.ok(near.guardUntil > g.now);
  assert.equal(far.guardUntil, 0);
  assert.equal(boss.guardUntil, 0);
  assert.ok(!(leader.guardUntil > g.now), '列阵不给自己加');
  // 伤害结算
  const scene = comboScene({});
  scene.dmgMult = () => 1;
  const a = enemy('metal', { guardUntil: scene.now + 1, guardArmor: 2 });
  const b = enemy('metal', { guardUntil: scene.now - 1, guardArmor: 2 });
  scene.hitEnemy(a, 10, 'fire');
  scene.hitEnemy(b, 10, 'fire');
  assert.equal(a.hp, 92);
  assert.equal(b.hp, 90);
});

test('精英词缀：按本关数量随机挑，不重复', () => {
  const { mgr } = trickScene(6);
  for (let i = 0; i < 30; i++) {
    const a = mgr.rollAffixes(2);
    assert.equal(a.length, 2);
    assert.notEqual(a[0], a[1]);
    for (const x of a) assert.ok(AFFIXES[x]);
  }
  assert.deepEqual(mgr.rollAffixes(0), []);
});

test('小怪升阶：第 1–2 关没有，之后逐关更早更多；占比从开始那秒线性涨到 Boss 现身，三阶先掷', async () => {
  const { tierShare, rollTier } = await import('../src/config/levels.ts');
  const L = (id) => LEVELS.find((l) => l.id === id);
  for (const id of [1, 2]) assert.equal(L(id).tiers, undefined);
  const late = (id, t) => tierShare(L(id), t, L(id).duration - 60);
  assert.ok(late(3, 2) < late(4, 2) && late(4, 2) < late(5, 2) && late(5, 2) < late(6, 2), '凶的占比逐关上升');
  assert.equal(late(4, 3), 0);
  assert.ok(late(6, 3) > late(5, 3) && late(5, 3) > 0, '煞从第 5 关起');
  const l6 = L(6);
  const [from, max] = l6.tiers[2];
  assert.equal(tierShare(l6, 2, from - 1), 0);
  const mid = from + (l6.duration - 60 - from) / 2;
  assert.ok(Math.abs(tierShare(l6, 2, mid) - max / 2) < 1e-9);
  assert.equal(tierShare(l6, 2, l6.duration), max);
  // 掷骰：第一个数先比三阶
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.equal(rollTier(l6, l6.duration, seq(0.01)), 3);
  assert.equal(rollTier(l6, l6.duration, seq(0.99, 0.01)), 2);
  assert.equal(rollTier(l6, l6.duration, seq(0.99, 0.99)), 1);
  assert.equal(rollTier(L(1), 300, seq(0, 0)), 1);
});

test('小怪升阶：数值按阶加强、换同阶贴图；精英和 Boss 不升阶；复活的残兵保持原阶', () => {
  const made = [];
  const sp = () => {
    const o = { scale: 1, key: '', setTexture(k) { o.key = k; return o; }, setVisible: () => o, setActive: () => o, setScale(v) { o.scale = v; return o; }, setAlpha: () => o, clearTint: () => o, setOrigin: () => o, play: () => o, anims: { stop() {} } };
    made.push(o);
    return o;
  };
  const noop = new Proxy({}, { get: () => () => {} });
  const chain = new Proxy({}, { get: () => () => chain });
  const g = { levelDef: LEVELS.find((l) => l.id === 4), now: 0, roarStacks: 0, dmgScale: () => 1, hud: noop, add: { sprite: sp, image: () => chain, text: () => chain }, anims: { exists: () => true } };
  const mgr = new EnemyManager(g);
  const base = mgr.spawn('shiyong', 0, 0, {});
  const t3 = mgr.spawn('shiyong', 0, 0, { tier: 3 });
  assert.equal(base.sprite.key, 'en_shiyong_lava');
  assert.equal(t3.sprite.key, 'en_shiyong_lava_t3');
  assert.equal(t3.maxHp, Math.round(base.maxHp * 2.6));
  assert.equal(t3.armor, base.armor + 2);
  assert.equal(t3.xp, base.xp * 3);
  assert.ok(Math.abs(t3.dmg / base.dmg - 1.5) < 1e-9);
  assert.equal(t3.sprite.scale, 1.2);
  const elite = mgr.spawn('shiyong', 0, 0, { tier: 3, elite: true });
  assert.equal(elite.tier, 1);
  assert.equal(elite.sprite.key, 'en_shiyong_lava');
  const boss = mgr.spawn('bifang', 0, 0, { tier: 2 });
  assert.equal(boss.tier, 1);

  // 残兵复活带着原来的阶
  const { mgr: m2, spawned, run } = killScene();
  m2.kill(mob('canbing', { lastEl: 'metal', tier: 2 }));
  run();
  assert.equal(spawned[0].o.tier, 2);
});

test('地面怪步态随速度变化，停下落脚；飞行、第一关和钻地动作不受影响', () => {
  const mgr = new EnemyManager({});
  const a = {
    currentAnim: { key: 'en_zhushe_move', frames: [0, 1, 2, 3] },
    isPaused: false, timeScale: 1,
    pause(frame) { this.isPaused = true; this.frame = frame; },
    resume() { this.isPaused = false; },
  };
  const e = { walkWithSpeed: true, tex: 'en_zhushe', def: { speed: 58 }, sprite: { anims: a } };
  mgr.syncWalk(e, 29);
  assert.equal(a.timeScale, .5);
  mgr.syncWalk(e, 0);
  assert.equal(a.isPaused, true);
  assert.equal(a.frame, 0);
  mgr.syncWalk(e, 170);
  assert.equal(a.isPaused, false);
  assert.equal(a.timeScale, 2.5);
  e.walkWithSpeed = false;
  mgr.syncWalk(e, 0);
  assert.equal(a.isPaused, false, '飞行和第一关原动画保持播放');
  e.walkWithSpeed = true;
  a.currentAnim.key = 'en_zhushe_dig';
  mgr.syncWalk(e, 0);
  assert.equal(a.isPaused, false, '特殊动作不能被步态暂停');
});

test('小怪的异常：已经挂着同一种时再中几率减半，迟缓时长 ×0.6；Boss 不受影响', async () => {
  const { PlayerStatus } = await import('../src/game/Status.ts');
  const { MOB_REPEAT, MOB_SLOW_DUR, ON_PLAYER } = await import('../src/config/status.ts');
  const g = { now: 0, build: { mods: {}, benming: 'fire' }, player: { x: 0, y: 0 }, fx: { text() {} }, cameras: { main: { shake() {} } }, dbg: {} };
  const st = new PlayerStatus(g);
  const random = Math.random;
  try {
    // 水对火是克：几率 ×1.5。0.2 × 1.5 = 0.3
    Math.random = () => 0.29;
    st.inflict({ kind: 'slow', chance: 0.2, mob: true });
    assert.ok(st.slowed);
    // 小怪迟缓 2 × 0.6 秒（火本命被水克，强度不打折）
    assert.ok(Math.abs(st.slowUntil - ON_PLAYER.slow.dur * MOB_SLOW_DUR) < 1e-9);
    // 已经挂着：0.3 × 0.5 = 0.15，掷 0.2 不中
    Math.random = () => 0.2;
    const until = st.slowUntil;
    g.now = 0.5;
    st.inflict({ kind: 'slow', chance: 0.2, mob: true });
    assert.equal(st.slowUntil, until);
    assert.equal(MOB_REPEAT, 0.5);
    // Boss 的不减半、不缩时长
    st.inflict({ kind: 'slow', chance: 0.2 });
    assert.ok(Math.abs(st.slowUntil - (0.5 + ON_PLAYER.slow.dur)) < 1e-9);
  } finally {
    Math.random = random;
  }
});

test('震地、缠根全场共用最小间隔：一群藤怪同时冷却好，也只有一只能放', () => {
  const { g, mgr } = trickScene(6);
  const roots = [1, 2, 3].map((i) => trickMob('tengguai', 6, { id: i, x: 100, y: 0 }));
  for (const e of roots) mgr.tryTrick(e, 100);
  assert.equal(roots.filter((e) => e.castUntil > g.now).length, 1);
  g.now += TRICKS.roots.gap;
  for (const e of roots) mgr.tryTrick(e, 100);
  assert.equal(roots.filter((e) => e.castUntil > 0).length, 2);
});

const L7 = LEVELS.find((l) => l.id === 7);

/** 只跑 Player.update 移动部分用的玩家桩：按住 dir 方向键，ice 为脚下的冰面配置（null 是平地） */
async function slidePlayer(ice) {
  const { Player } = await import('../src/game/Player.ts');
  const chain = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => chain) });
  const keys = Object.fromEntries(['UP', 'DOWN', 'LEFT', 'RIGHT', 'W', 'A', 'S', 'D'].map((k) => [k, { isDown: false }]));
  const g = {
    now: 0, dunUntil: 0, shield: 0, char: { id: 'ruan' }, pstats: { speed: 60, maxHp: 100, regen: 0 },
    status: { stunned: false, speedMult: 1, regenMult: 1, stunMeter: 0, chillMeter: 0 },
    world: { inMud: () => null, push: () => false, hitNx: 0, hitNy: 0 },
    hazards: { onIce: () => ice, drift: () => [0, 0], sandAt: () => null },
    regenPlayer() {},
  };
  const p = Object.assign(Object.create(Player.prototype), {
    g, keys, x: 0, y: 0, vx: 0, vy: 0, facing: { x: 0, y: 1 }, alive: true, dir: 's', flip: false, animKey: '', atkUntil: 0, hurtUntil: 0,
    sprite: chain, hpBg: chain, hpFill: chain, stunBar: chain, shieldBar: chain, pips: new Proxy({}, { get: () => chain }),
  });
  const step = (sec) => {
    for (let t = 0; t < sec - 1e-9; t += 0.02) p.update(0.02);
  };
  return { p, keys, step };
}

test('冰面：点位固定、纵向压扁；在冰上玩家有惯性（起步慢、松手还滑一段），平地上照旧说走就走说停就停', async () => {
  const world = Object.assign(Object.create(World.prototype), { level: L7, half: L7.size / 2, spotCache: new Map() });
  let spot = null;
  for (let i = 1; i < 20 && !spot; i++) spot = world.spotsIn('ice', -i * 320, -i * 320, i * 320, i * 320)[0];
  assert.ok(spot);
  const [x, y] = spot;
  assert.equal(world.onIce(x, y), L7.ice);
  assert.equal(world.onIce(x, y + L7.ice.radius * 0.8), null);
  const w6 = Object.assign(Object.create(World.prototype), { level: LEVELS[5], half: 2400, spotCache: new Map() });
  assert.equal(w6.onIce(x, y), null);

  const flat = await slidePlayer(null);
  const ice = await slidePlayer(L7.ice);
  for (const s of [flat, ice]) s.keys.RIGHT.isDown = true;
  flat.step(0.5);
  ice.step(0.5);
  assert.ok(Math.abs(flat.p.x - 30) < 0.5, `平地 0.5 秒走 30，实际 ${flat.p.x}`);
  assert.ok(ice.p.x < flat.p.x * 0.6, '冰上起步慢');
  // 滑起来最快到 boost 倍
  ice.step(4);
  assert.ok(Math.abs(ice.p.vx - 60 * L7.ice.boost) < 1);
  // 松手：平地立刻停，冰上还滑一段
  for (const s of [flat, ice]) s.keys.RIGHT.isDown = false;
  const fx = flat.p.x;
  const ix = ice.p.x;
  flat.step(0.5);
  ice.step(0.5);
  assert.equal(flat.p.x, fx);
  assert.ok(ice.p.x - ix > 15, '冰上松手还往前滑');
});

test('暴风雪：到点先预警再刮，起落渐变，北风推玩家；正刮着再刮就延长；吸寒的外力指向 Boss', async () => {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const img = () => { const o = new Proxy({}, { get: (_t, k) => (k === 'destroy' ? () => {} : () => o) }); return o; };
  const g = {
    levelDef: L7, now: 0, elapsed: 0, over: false, player: { x: 0, y: 0 }, add: { image: img }, hud: { toast() {} }, later() {},
    world: { spotsIn: () => [], inMud: () => null, onIce: () => null }, status: { inflict() {} }, dmgScale: () => 1,
    enemies: { inRadius: (_x, _y, _r, out) => ((out.length = 0), out) },
  };
  const hz = new Hazards(g);
  const B = L7.storm;
  g.now = g.elapsed = B.start - 1;
  hz.update();
  assert.equal(hz.storming(), 0);
  g.now = g.elapsed = B.start;
  hz.update();
  assert.equal(hz.storming(), 0, '先预警');
  assert.equal(hz.stormFrom, B.start + B.warn);
  g.now = hz.stormFrom + 0.75;
  assert.ok(Math.abs(hz.storming() - 0.5) < 1e-6, '起风渐变');
  g.now = hz.stormFrom + 3;
  const [dx, dy] = hz.drift(0, 0);
  // 风向纵向压扁到 0.6，风力在 0.6–1 倍之间
  const w = Math.hypot(dx, dy);
  assert.ok(w > B.wind * 0.6 - 1e-6 && w <= B.wind + 1e-6, `风力 ${w}`);
  assert.ok(Math.abs(dx) > Math.abs(dy), '大致横着吹');
  const end = hz.stormUntil;
  assert.ok(end - hz.stormFrom >= B.dur[0] - 1e-6);
  hz.storm(30);
  assert.ok(hz.stormUntil > end, '正刮着就延长');
  g.now = hz.stormUntil + 0.1;
  assert.equal(hz.storming(), 0);
  assert.deepEqual(hz.drift(0, 0), [0, 0]);
  hz.pull(100, 0, 45, 1);
  assert.deepEqual(hz.drift(0, 0), [45, 0]);
  g.now += 1.1;
  assert.deepEqual(hz.drift(0, 0), [0, 0]);

  // 远吼刮一阵，狂暴再刮一场
  const scene = runScene('xiao', 7);
  const calls = [];
  scene.enemies = { onRoar() {} };
  scene.hazards = { storm: (n) => calls.push(n) };
  scene.cameras = { main: { shake() {} } };
  Object.defineProperty(scene, 'hud', { value: { toast() {} } });
  scene.roar();
  assert.deepEqual(calls, [L7.roar.event.count]);
  scene.rageMusic = true;
  scene.onBossRage({ def: ENEMIES.xuanming });
  assert.equal(calls.length, 2);
});

test('回旋刃：第 7 关的飞镰甩出的刃飞到头折回出手点；之前的关卡照旧直线', async () => {
  const { ProjectileManager } = await import('../src/game/Projectiles.ts');
  const { tricksOf } = await import('../src/config/levels.ts');
  const spr = new Proxy({ anims: { stop() {}, play() {} } }, { get: (t, k) => (k in t ? t[k] : () => spr) });
  const g = { add: { sprite: () => spr }, player: { x: 0, y: 200, alive: true }, hurtPlayer() {} };
  const pm = new ProjectileManager(g);
  const B = TRICKS.boomerang;
  const p = pm.enemyBoomerang('ep_blade', 0, 0, 1, 0, B.speed, B.back, 5, 'metal');
  let far = 0;
  const T = (2 * B.speed) / B.back;
  for (let t = 0; t < T - 0.02; t += 0.01) {
    pm.update(0.01);
    far = Math.max(far, p.x);
  }
  assert.ok(Math.abs(far - B.speed ** 2 / (2 * B.back)) < 3, `飞到头约 130，实际 ${far}`);
  assert.ok(p.active && Math.abs(p.x) < 5, '折回到出手点附近');
  assert.deepEqual(tricksOf(LEVELS[4], 'feilian'), []);
  assert.deepEqual(tricksOf(L7, 'feilian'), ['boomerang']);
});

test('冰蚕死后冰爆：预警后圈里的玩家受水伤、按几率迟缓；火鸦照旧是火爆', () => {
  for (const [id, el, kind] of [['bingcan', 'water', 'slow'], ['huoya', 'fire', 'burn']]) {
    const { g, mgr, run } = killScene();
    const hurts = [];
    Object.assign(g, { player: { x: 10, y: 20 }, hurtPlayer: (_v, e, o) => hurts.push([e, o?.inflict?.kind]), dmgScale: () => 1 });
    mgr.kill(mob(id, { blastMul: 1, atkDps: 0 }));
    assert.equal(hurts.length, 0, '先预警');
    run();
    assert.deepEqual(hurts, [[el, kind]]);
  }
});

test('寒词缀第 7 关起才抽得到，圈里的玩家按 tick 迟缓', () => {
  for (let i = 0; i < 20; i++) assert.ok(!trickScene(6).mgr.rollAffixes(3).includes('frost'));
  assert.ok(trickScene(7).mgr.rollAffixes(4).includes('frost'));
  const { g, mgr, inflicts } = trickScene(7);
  const e = trickMob('aoxie', 7, { x: 20, y: 0, affixes: ['frost'], affixTick: 0, frostTick: 0, aura: {} });
  mgr.list.push(e);
  mgr.updateAuras(1);
  mgr.updateAuras(1);
  assert.deepEqual(inflicts, ['slow'], '按 tick 结算');
  g.now += AFFIXES.frost.tick;
  g.player.x = 200;
  mgr.updateAuras(1);
  assert.equal(inflicts.length, 1, '出圈不结算');
});

test('玄冥：吸寒先预警并往身边拉，收完冰爆（必定暴击）并留一片冰；冰锥落在玩家脚下，落地结冰', () => {
  const { g, mgr, run } = trickScene(7);
  const pulls = [];
  const ices = [];
  const hurts = [];
  g.hazards = { pull: (...a) => pulls.push(a), iceAt: (...a) => ices.push(a) };
  g.hurtPlayer = (_v, el, o) => hurts.push([el, !!o?.forceCrit]);
  g.cameras = { main: { shake() {} } };
  g.tweens = { add() {} };
  g.envDamage = () => {};
  const b = { ...mob('xuanming'), x: 30, y: 0, dmg: 20, state: 0, timer: 0, timer2: 9, timer3: 9, timer4: 0, raged: false, chanceAdd: 0, atkDps: 0 };
  mgr.xuanming(b, 0.016, -1, 0, 30, 30);
  assert.equal(b.state, 1);
  assert.deepEqual(pulls[0].slice(0, 2), [30, 0]);
  mgr.xuanming(b, 3, -1, 0, 30, 30);
  assert.equal(b.state, 3);
  assert.deepEqual(hurts, [['water', true]]);
  assert.equal(ices.length, 1);
  mgr.icicles(3);
  assert.equal(hurts.length, 1, '冰锥先预警');
  run();
  assert.equal(ices.length, 4);
  assert.deepEqual(hurts[1], ['water', false], '第一根落在玩家脚下');
});

const L8 = LEVELS.find((l) => l.id === 8);

/** 跑 Hazards 的流沙、沙暴用的场景桩 */
async function sandScene(level = L8) {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const img = () => { const o = new Proxy({}, { get: (_t, k) => (k === 'destroy' ? () => {} : () => o) }); return o; };
  const hurts = [];
  const world = Object.assign(Object.create(World.prototype), { level, half: level.size / 2, spotCache: new Map() });
  const g = {
    levelDef: level, now: 0, elapsed: 0, over: false, player: { x: 0, y: 0 }, add: { image: img }, hud: { toast() {} }, later() {},
    world, status: { inflict() {} }, dmgScale: () => 1, hurtPlayer: (v, el, o) => hurts.push([v, el, o?.inflict?.kind]),
    enemies: { inRadius: (_x, _y, _r, out) => ((out.length = 0), out) },
  };
  return { g, hz: new Hazards(g), hurts, world };
}

test('流沙：陷进去往中心吸、陷到中心按 tick 掉土血攒震慑；临时流沙到时消失；别的关没有', async () => {
  const { g, hz, hurts, world } = await sandScene();
  let spot = null;
  for (let i = 1; i < 20 && !spot; i++) spot = world.spotsIn('sand', -i * 340, -i * 340, i * 340, i * 340)[0];
  assert.ok(spot);
  const [x, y] = spot;
  const Q = L8.quicksand;
  assert.deepEqual(world.sandAt(x + 10, y), spot);
  assert.equal(world.sandAt(x, y + Q.radius * 0.8), null);
  // 边上：往中心吸，不掉血
  g.player = { x: x + Q.radius * 0.8, y };
  const [dx, dy] = hz.drift(g.player.x, g.player.y);
  assert.ok(Math.abs(dx + Q.pull) < 1e-6 && Math.abs(dy) < 1e-6, '往中心吸');
  hz.update();
  assert.equal(hurts.length, 0);
  // 中心：按 tick 掉土血、攒震慑
  g.player = { x: x + 3, y };
  hz.update();
  hz.update();
  assert.deepEqual(hurts, [[Q.dmg, 'earth', 'stun']]);
  g.now += Q.tick;
  hz.update();
  assert.equal(hurts.length, 2);
  // 临时流沙
  hz.sandPit(1000, 1000, 40, 5);
  assert.ok(hz.sandAt(1010, 1000));
  g.now += 5.1;
  hz.update();
  assert.equal(hz.sandAt(1010, 1000), null);
  const w6 = Object.assign(Object.create(World.prototype), { level: LEVELS[5], half: 2400, spotCache: new Map() });
  assert.equal(w6.sandAt(x, y), null);
});

test('沙暴：刮的时候金系术伤害随强度加到 +15%，别系不变；暴风雪不加成', async () => {
  const { g, hz } = await sandScene();
  assert.equal(hz.boost('metal'), 1);
  hz.storm(10, 0);
  g.now = 3;
  assert.ok(Math.abs(hz.boost('metal') - 1.15) < 1e-9);
  assert.equal(hz.boost('wood'), 1);
  g.now = 0.75;
  assert.ok(Math.abs(hz.boost('metal') - 1.075) < 1e-9, '起风渐变');
  const snow = await sandScene(L7);
  snow.hz.storm(10, 0);
  snow.g.now = 3;
  assert.equal(snow.hz.boost('metal'), 1);
  assert.equal(L8.storm.look, 'sand');
});

test('沙蝎：贴近停下预警，尾针刺身前一条线；预警时躲开就落空', () => {
  for (const [py, hit] of [[0, true], [30, false]]) {
    const { g, mgr, hurts } = trickScene(8);
    const e = trickMob('shaxie', 8, { x: 0, y: 0, state: 0, timer: 0, windMul: 1, speed: 40 });
    g.player = { x: 40, y: 0, alive: true };
    mgr.behave(e, 0.016, 1, 0, 40, 1);
    assert.equal(e.state, 1, '开始预警');
    g.player.y = py;
    mgr.behave(e, 0.6, 1, 0, 40, 1);
    assert.equal(e.state, 2);
    assert.equal(hurts.length, hit ? 1 : 0);
    if (hit) assert.equal(hurts[0][2], 'poison');
  }
});

test('陷坑：第 8 关的穿山甲破土处陷出流沙；第 3 关的照旧', () => {
  for (const [level, n] of [[8, 1], [3, 0]]) {
    const { g, mgr } = trickScene(level);
    const pits = [];
    g.hazards = { sandPit: (...a) => pits.push(a) };
    g.player = { x: 0, y: 0, alive: true };
    const e = trickMob('chuanshan', level, { x: 0, y: 0, state: 2, timer: 0, cdMul: 1, tex: 'en_chuanshan', tier: 1, sprite: { ...sprite(), play() {}, anims: { stop() {}, timeScale: 1 } } });
    g.anims = { exists: () => true };
    mgr.behave(e, 0.1, 1, 0, 10, 1);
    assert.equal(pits.length, n);
  }
});

test('旱魃：半血焚身化火（换火系、短暂无敌），土相时不狂暴；土相被一口气打穿也只是化火；化火后才会狂暴', () => {
  const { g, mgr } = trickScene(8);
  Object.assign(g, {
    hazards: { sandPit() {}, blast() {}, patch() {} }, cameras: { main: { shake() {} } }, anims: { exists: () => true },
    proj: { clearEnemyShots() {}, enemyShot() {} }, rages: 0, onBossRage() { this.rages++; },
  });
  const boss = () => ({ ...mob('hanba'), hp: 1000, maxHp: 1000, state: 0, timer: 5, timer2: 9, timer3: 9, lift: 0, raged: false, phase: 0, invulnUntil: 0, chanceAdd: 0, atkDps: 0, tex: 'boss_hanba', tier: 1, sprite: { ...sprite(), play() {}, anims: { stop() {}, timeScale: 1 } } });
  const b = boss();
  b.hp = 200;
  mgr.maybeEnrage(b);
  assert.equal(b.raged, false, '土相不狂暴');
  mgr.behave(b, 0.016, 1, 0, 30, 200);
  assert.equal(b.phase, 1);
  assert.equal(b.def.el, 'fire');
  assert.equal(b.def.id, 'hanba', '图鉴照记同一只');
  assert.equal(b.tex, 'boss_hanba_fire');
  assert.ok(b.invulnUntil > g.now);
  assert.equal(b.state, 9);
  mgr.behave(b, 2, 1, 0, 30, 200);
  assert.equal(b.state, 0);
  mgr.maybeEnrage(b);
  assert.equal(b.raged, true);
  assert.equal(g.rages, 1);
  // 土相被打穿：化火带 40% 生命，不算击杀
  const c = boss();
  mgr.kill(c);
  assert.equal(c.phase, 1);
  assert.equal(c.hp, 400);
  assert.equal(g.bossKilled, 0);
  mgr.kill(c);
  assert.equal(g.bossKilled, 1);
  assert.equal(g.killed.hanba, 1);
});

const L9 = LEVELS.find((l) => l.id === 9);

/** 跑 Hazards 潮汐用的场景桩 */
async function phaseScene() {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const img = () => { const o = new Proxy({}, { get: (_t, k) => (k === 'destroy' ? () => {} : () => o) }); return o; };
  const phases = [];
  const toasts = [];
  const blasts = [];
  const g = {
    levelDef: L9, now: 0, elapsed: 0, over: false, player: { x: 0, y: 0 }, add: { image: img }, hud: { toast: (t) => toasts.push(t) }, later() {},
    world: { spotsIn: () => [[50, 0], [-80, 30]], inMud: () => null, onIce: () => null, sandAt: () => null },
    status: { inflict() {} }, dmgScale: () => 1, boss: null, setPhase: (el, quiet) => phases.push([el, quiet]),
    enemies: { inRadius: (_x, _y, _r, out) => ((out.length = 0), out) },
  };
  const hz = new Hazards(g);
  hz.blast = (...a) => blasts.push(a);
  return { g, hz, phases, toasts, blasts };
}

test('潮汐（相位轮转）：开局安静定为涨潮，到点前预警、到点换潮；Boss 狂暴后每潮减半；火山口只在退潮喷', async () => {
  const { g, hz, phases, toasts, blasts } = await phaseScene();
  hz.update();
  assert.deepEqual(phases, [['water', true]]);
  assert.equal(hz.phaseEl, 'water');
  const T = L9.cycle;
  // 涨潮时火山口不喷
  g.elapsed = 30;
  hz.update();
  assert.equal(blasts.length, 0);
  g.elapsed = T.every[0] - T.warn + 0.1;
  hz.update();
  assert.equal(toasts.length, 1, '换潮前预警');
  g.elapsed = T.every[0] + 0.1;
  hz.update();
  assert.deepEqual(phases[1], ['fire', false]);
  hz.update();
  assert.ok(blasts.length >= 1, '退潮后火山口喷');
  // 狂暴后这一潮只有一半长
  g.boss = { raged: true };
  hz.turnPhase('water');
  const k = Math.min(1, g.elapsed / L9.duration);
  const every = T.every[0] + (T.every[1] - T.every[0]) * k;
  g.elapsed += every * 0.5 + 0.1;
  hz.update();
  assert.equal(hz.phaseEl, 'fire');
});

test('潮汐：浅滩只在涨潮积水；换潮改地气、刷怪偏向当潮元素；远吼立刻翻潮', () => {
  const world = Object.assign(Object.create(World.prototype), { level: L9, half: L9.size / 2, spotCache: new Map(), phased: [], phase: null });
  let spot = null;
  for (let i = 1; i < 20 && !spot; i++) spot = world.spotsIn('mud', -i * 300, -i * 300, i * 300, i * 300)[0];
  assert.ok(spot);
  assert.equal(world.inMud(...spot), null, '还没涨潮');
  world.setPhase('water');
  assert.equal(world.inMud(...spot), L9.mud);
  world.setPhase('fire');
  assert.equal(world.inMud(...spot), null);

  const scene = runScene('ruan', 9);
  const calls = [];
  scene.world = { setPhase: (el) => calls.push(['world', el]) };
  scene.enemies = { rephase: (el) => calls.push(['boss', el]), onRoar() {} };
  scene.hazards = { phaseEl: 'water', nextPhase: () => 'fire', turnPhase: (el) => calls.push(['turn', el]) };
  scene.cameras = { main: { shake() {} } };
  scene.scene = { isActive: () => false };
  Object.defineProperty(scene, 'hud', { value: { toast() {} } });
  scene.setPhase('water');
  const wet = { ...scene.terrainMods };
  scene.setPhase('fire');
  assert.ok(scene.terrainMods.water < wet.water && scene.terrainMods.fire > wet.fire, '退潮后水系地气变差、火系变好');
  assert.deepEqual(calls.slice(0, 2), [['world', 'water'], ['boss', 'water']]);
  // 刷怪权重：涨潮时水系 ×2
  scene.elapsed = 100;
  scene.hazards.phaseEl = 'water';
  const random = Math.random;
  let n = 0;
  try {
    let i = 0;
    Math.random = () => ((i++ * 0.618) % 1);
    for (let j = 0; j < 400; j++) if (ENEMIES[scene.pickEnemy()].el === 'water') n++;
  } finally {
    Math.random = random;
  }
  assert.ok(n / 400 > 0.6, `涨潮时水系占比 ${n / 400}`);
  scene.roar();
  assert.deepEqual(calls.at(-1), ['turn', 'fire']);
});

test('九婴随潮换元素（换贴图、换攻击异常，图鉴照记同一只）；夜叉跳到锁定的点砸地；焰蛸一次扇形喷三道', () => {
  const { g, mgr, hurts } = trickScene(9);
  const toasts = [];
  Object.assign(g, { anims: { exists: () => true }, hud: { toast: (t) => toasts.push(t) } });
  const b = { ...mob('jiuying'), tex: 'boss_jiuying', tier: 1, glyph: null, sprite: { ...sprite(), play() {}, anims: { stop() {}, timeScale: 1 } } };
  mgr.list.push(b);
  mgr.rephase('water');
  assert.equal(toasts.length, 0, '已经是水系不换');
  mgr.rephase('fire');
  assert.equal(b.def.el, 'fire');
  assert.equal(b.def.id, 'jiuying');
  assert.equal(b.tex, 'boss_jiuying_fire');
  assert.equal(b.def.inflict.kind, 'burn');
  mgr.rephase('water');
  assert.equal(b.def, ENEMIES.jiuying);

  g.player = { x: 100, y: 0, alive: true };
  const e = trickMob('yecha', 9, { x: 0, y: 0, state: 0, timer: 0, windMul: 1, lift: 0 });
  mgr.behave(e, 0.016, 1, 0, 100, 1);
  assert.equal(e.state, 1);
  assert.deepEqual([e.tx, e.ty], [100, 0]);
  mgr.behave(e, 1, 1, 0, 100, 1);
  assert.equal(e.state, 2);
  mgr.behave(e, 0.5, 1, 0, 100, 1);
  assert.deepEqual([e.x, e.y, e.state], [100, 0, 0]);
  assert.equal(hurts.length, 1);
  assert.equal(hurts[0][1], 'water');

  const shots = [];
  g.proj = { enemyShot: (...a) => shots.push(a) };
  const o = trickMob('yanshao', 9, { x: 0, y: 0, timer: 0 });
  mgr.behave(o, 0.016, 1, 0, 100, 1);
  assert.equal(shots.length, 3);
  assert.ok(shots.every((a) => a[0] === 'ep_fire'));
});

const L10 = LEVELS.find((l) => l.id === 10);

test('昆仑：五气按相生每 3 分钟换一气，Boss 现身在水气；各气的地形只在当令时起作用', async () => {
  const c = L10.cycle;
  assert.deepEqual(c.order, ['wood', 'fire', 'earth', 'metal', 'water']);
  assert.equal(c.every[0] * c.order.length, L10.duration);
  assert.equal(c.order[Math.floor((L10.duration - 60) / c.every[0])], 'water');
  const world = Object.assign(Object.create(World.prototype), { level: L10, half: L10.size / 2, spotCache: new Map(), phased: [], phase: null });
  const find = (kind, cell) => {
    for (let i = 1; i < 20; i++) {
      const p = world.spotsIn(kind, -i * cell, -i * cell, i * cell, i * cell)[0];
      if (p) return p;
    }
  };
  const zone = find('zone', 440);
  const ice = find('ice', 340);
  const mud = find('mud', 320);
  const live = () => [!!world.zoneArmor(...zone), !!world.onIce(...ice), !!world.inMud(...mud)];
  world.setPhase('fire');
  assert.deepEqual(live(), [false, false, false]);
  world.setPhase('metal');
  assert.deepEqual(live(), [true, false, false]);
  world.setPhase('water');
  assert.deepEqual(live(), [false, true, false]);
  world.setPhase('wood');
  assert.deepEqual(live(), [false, false, true]);

  // 落石只在土气、熔岩口只在火气、瘴雾只在木气
  const { Hazards } = await import('../src/game/Hazards.ts');
  const img = () => { const o = new Proxy({}, { get: (_t, k) => (k === 'destroy' ? () => {} : () => o) }); return o; };
  const fired = [];
  const banners = [];
  const g = {
    levelDef: L10, now: 0, elapsed: 0, over: false, player: { x: 0, y: 0, facing: { x: 0, y: 1 } }, pstats: { speed: 60 }, add: { image: img },
    hud: { toast() {} }, later() {}, tweens: { add() {} }, fx: new Proxy({}, { get: () => () => {} }), boss: null,
    world: { spotsIn: () => [[50, 0]], inMud: () => null, onIce: () => null, sandAt: () => null, zoneArmor: () => 0, clampPt: (x, y) => [x, y] },
    status: { inflict() {} }, dmgScale: () => 1, setPhase: (el, quiet) => banners.push([el, quiet]),
    enemies: { inRadius: (_x, _y, _r, out) => ((out.length = 0), out) },
  };
  const hz = new Hazards(g);
  hz.drop = () => fired.push('rock');
  hz.blast = () => fired.push('lava');
  hz.miasmaAt = () => fired.push('fog');
  for (const el of c.order) {
    hz.phaseEl = el;
    g.elapsed += 30;
    hz.nextAt = hz.lavaAt = hz.fogAt = 0;
    fired.length = 0;
    hz.update();
    const want = { earth: 'rock', fire: 'lava', wood: 'fog' }[el];
    assert.deepEqual([...new Set(fired)], want ? [want] : [], `${el} 气`);
  }
});

test('帝江：每掉 20% 生命按相生换一系并震出一圈新元素的弹；歌舞转着喷五色弹；各系的招各不相同', () => {
  const { g, mgr } = trickScene(10);
  const shots = [];
  const calls = [];
  Object.assign(g, {
    anims: { exists: () => true }, cameras: { main: { shake() {} } }, tweens: { add() {} },
    proj: { enemyShot: (...a) => shots.push(a) }, hazards: { rain: (n) => calls.push(['rain', n]), iceAt() {} },
  });
  const b = { ...mob('dijiang'), hp: 1000, maxHp: 1000, x: 50, y: 0, state: 0, timer: 0, timer2: 99, timer3: 99, timer4: 0, phase: 0, combo: 0, trailAcc: 0, raged: false, chanceAdd: 0, atkDps: 0, tex: 'boss_dijiang', tier: 1, glyph: null, sprite: { ...sprite(), play() {}, anims: { stop() {}, timeScale: 1 } } };
  mgr.dijiang(b, 30, -1, 0, 30, 50);
  assert.equal(b.def.el, 'earth', '满血不换，和时间无关');
  b.hp = 790;
  mgr.dijiang(b, 0.016, -1, 0, 30, 50);
  assert.equal(b.def.el, 'metal');
  assert.equal(b.def.id, 'dijiang');
  assert.equal(b.tex, 'boss_dijiang_metal');
  assert.equal(shots.length, 10);
  assert.ok(shots.every((a) => a[0] === 'ep_blade' && a[6] === 'metal'));
  // 一口气打掉大半：每帧只换一相，依次补上，不跳过
  b.hp = 100;
  const seen = [];
  for (let i = 0; i < 5; i++) {
    mgr.dijiang(b, 0.016, -1, 0, 30, 50);
    seen.push(b.def.el);
  }
  assert.deepEqual(seen, ['water', 'wood', 'fire', 'fire', 'fire']);
  shots.length = 0;
  b.hp = 1000;
  b.phase = 0;
  // 土相的招是落石
  b.def = ENEMIES.dijiang;
  b.timer2 = 0;
  mgr.dijiang(b, 0.016, -1, 0, 30, 50);
  assert.deepEqual(calls, [['rain', 4]]);
  // 歌舞
  shots.length = 0;
  b.timer3 = 0;
  mgr.dijiang(b, 0.016, -1, 0, 30, 50);
  assert.equal(b.state, 1);
  mgr.dijiang(b, 0.41, -1, 0, 30, 50);
  assert.equal(new Set(shots.map((a) => a[6])).size, 5, '五系都有');
});

test('评审回归：冰爆按预警的压扁椭圆判定，圈外不受伤；火鸦同理', () => {
  for (const id of ['bingcan', 'huoya']) {
    for (const [py, hit] of [[28, false], [14, true]]) {
      const { g, mgr, run } = killScene();
      const hurts = [];
      Object.assign(g, { player: { x: 10, y: 20 + py }, hurtPlayer: () => hurts.push(1), dmgScale: () => 1 });
      mgr.kill(mob(id, { blastMul: 1, atkDps: 0 }));
      run();
      assert.equal(hurts.length, hit ? 1 : 0, `${id} 纵向 ${py}`);
    }
  }
});

test('评审回归：瘴、寒同时带时各自计时，重叠范围里两种都按 tick 结算', () => {
  const { g, mgr, inflicts } = trickScene(7);
  const e = trickMob('aoxie', 7, { x: 10, y: 0, affixes: ['miasma', 'frost'], affixTick: 0, frostTick: 0, aura: {} });
  mgr.list.push(e);
  const random = Math.random;
  Math.random = () => 0;
  try {
    for (let i = 0; i < 10; i++) {
      g.now += 1;
      mgr.updateAuras(1);
    }
  } finally {
    Math.random = random;
  }
  assert.equal(inflicts.filter((k) => k === 'poison').length, 10);
  assert.equal(inflicts.filter((k) => k === 'slow').length, 10);
});

test('评审回归：玄冥冰锥、旱魃陷沙留下的临时冰面、流沙和固定的一样拖慢非水 / 非土系普通敌人', async () => {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const chain = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => chain) });
  const noop = new Proxy({}, { get: () => () => {} });
  for (const [kind, level, k] of [['ice', 7, L7.ice.enemy], ['sand', 8, L8.quicksand.enemy]]) {
    const dx = (temp) => {
      const g = {
        now: 10, elapsed: 10, over: false, levelDef: LEVELS.find((l) => l.id === level), kills: 0, killed: {}, build: { mods: {} },
        player: { x: 100, y: 0, alive: true }, puppets: { list: [] }, fx: noop, pickups: noop, hud: noop, proj: noop, add: { image: () => chain },
        tweens: { add() {} }, later() {}, dmgScale: () => 1, spawnCap: () => 999, hurtPlayer() {}, anims: { exists: () => true }, cameras: { main: noop },
        world: { inMud: () => null, onIce: () => (temp ? null : g.levelDef.ice), sandAt: () => (temp ? null : [0, 0]), push: () => false, clamp: () => false, nav: null },
      };
      const hz = new Hazards(g);
      g.hazards = hz;
      if (temp && kind === 'ice') hz.iceAt(0, 0, 30, 5);
      if (temp && kind === 'sand') hz.sandPit(0, 0, 30, 5);
      const mgr = new EnemyManager(g);
      g.enemies = mgr;
      const e = Object.assign(new Enemy(chain), { id: 1, def: ENEMIES.canbing, x: 0, y: 0, alive: true, hp: 100, maxHp: 100, speed: 50, radius: 7, tricks: [], affixes: [] });
      mgr.list.push(e);
      mgr.update(0.1);
      return e.x;
    };
    assert.ok(Math.abs(dx(false) - 50 * 0.1 * k) < 1e-6, `${kind} 固定`);
    assert.ok(Math.abs(dx(true) - 50 * 0.1 * k) < 1e-6, `${kind} 临时`);
  }
});

test('评审回归：换相后升级三选一按当前地气加权；帝江同一帧换相和出招时用新元素的招', async () => {
  const { SKILLS, PASSIVES } = await import('../src/config/skills.ts');
  const scene = runScene('xuanyi', 10);
  scene.world = { setPhase() {} };
  scene.enemies = { rephase() {} };
  scene.scene = { isActive: () => false };
  const count = (el) => {
    scene.setPhase(el, true);
    let seed = 123;
    const random = Math.random;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const n = {};
    try {
      for (let i = 0; i < 4000; i++) {
        const o = scene.build.options(1)[0];
        const e = o.kind === 'skill' ? SKILLS[o.id].el : PASSIVES[o.id].el;
        n[e] = (n[e] ?? 0) + 1;
      }
    } finally {
      Math.random = random;
    }
    return n;
  };
  const wood = count('wood');
  const fire = count('fire');
  assert.ok(wood.wood > fire.wood && fire.fire > wood.fire, '当令元素的卡更多');

  const { g, mgr } = trickScene(10);
  const calls = [];
  Object.assign(g, { anims: { exists: () => true }, proj: { enemyShot() {} }, hazards: { rain: () => calls.push('earth'), iceAt() {} } });
  const b = { ...mob('dijiang'), hp: 790, maxHp: 1000, x: 50, y: 0, state: 0, timer: 9, timer2: 0, timer3: 99, timer4: 0, phase: 0, combo: 0, trailAcc: 0, raged: false, chanceAdd: 0, atkDps: 0, tex: 'boss_dijiang', tier: 1, glyph: null, sprite: { ...sprite(), play() {}, anims: { stop() {}, timeScale: 1 } } };
  mgr.bladeRing = () => calls.push('metal');
  mgr.dijiang(b, 0.016, -1, 0, 30, 50);
  assert.equal(b.def.el, 'metal');
  assert.deepEqual(calls, ['metal']);
});

test('第3关回复对照：三角色只改变回复，不改变本命、生命、护甲和移速', async () => {
  const { level3Profile } = await import('../tools/playtest/profiles.mjs');
  for (const id of ['xiao', 'qingdai', 'moheng']) {
    const builds = [0, 5].map(regen => {
      const p = level3Profile(id, regen);
      const b = new Build(character(id), LEVELS[2], p.meta);
      b.level = p.buildLevel;
      b.skills = new Map(Object.entries(p.skills));
      b.passives = new Map(Object.entries(p.passives).filter(([, lv]) => lv > 0));
      b.recompute();
      return b;
    });
    const [low, high] = builds.map(b => b.stats());
    assert.equal(builds[0].benming, builds[1].benming);
    assert.deepEqual({ ...low, regen: high.regen }, high);
    assert.ok(high.regen - low.regen >= 2.5);
  }
});

test('玩家护甲：递减收益且最多减伤60%，按暴击、五行和抗性后的数值计算', () => {
  const cases = [
    { base: 6.25, el: 'earth', armor: 99, expected: 2 }, // incoming=5
    { base: 22.5, el: 'earth', armor: 99, expected: 7 }, // incoming=18
    { base: 25, el: 'earth', armor: 3, expected: 16 },
    { base: 7.5, el: 'earth', armor: 5, expected: 4 }, // 小怪 incoming=6，不再被5甲压到2伤
    { base: 7.5, el: 'earth', armor: 10, expected: 3 },
    { base: 0.1, el: 'earth', armor: 99, expected: 1 },
    { base: 10, el: 'fire', armor: 99, resist: 0.5, forceCrit: true, critDmg: 2, expected: 6 }, // incoming=15
  ];
  for (const row of cases) {
    const g = runScene('xiao', 3);
    g.now = 1;
    g.pstats = { ...g.build.stats(), armor: row.armor };
    if (row.resist) g.pstats.resist[row.el] = row.resist;
    g.player = { alive: true, moving: true, hp: 100, x: 0, y: 0, hurt() {} };
    g.fx = { number() {} };
    g.cameras = { main: { shake() {} } };
    let damage = 0;
    g.loseHp = value => { damage += value; };
    g.hurtPlayer(row.base, row.el, { crit: 0, forceCrit: row.forceCrit, critDmg: row.critDmg });
    assert.equal(damage, row.expected);
    g.hurtPlayer(row.base, row.el, { crit: 0 });
    assert.equal(damage, row.expected, '0.35秒无敌帧仍然挡住第二次命中');
  }
});

test('傀儡护甲：递减收益在石身减伤与外壳五行之后计算', async () => {
  const { PuppetManager } = await import('../src/game/Puppets.ts');
  for (const [base, armor, expected] of [[12.5, 99, 2], [45, 99, 7], [50, 3, 16], [15, 5, 4], [0.1, 99, 1]]) {
    const manager = new PuppetManager({ now: 2, pstats: { armor } });
    const puppet = { alive: true, hp: 100, el: 'metal' };
    // 土→金×0.8，石身×0.5，所以incoming=base×0.4。
    manager.hurt(puppet, base, 'earth');
    assert.equal(puppet.hp, 100 - expected);
    assert.equal(puppet.flashUntil, 2.08);
  }
});

test('正常成长加点只花现有灵石和合法点数，不补造通关或局内技能', async () => {
  const { spendProgression } = await import('../tools/playtest/progression.js');
  const { canLight, litSet } = await import('../src/config/startree.ts');
  const { treeStart } = await import('../src/game/talents.ts');
  for (const id of ['xiao','qingdai','moheng']) {
    reset();
    const save = loadSave();
    const initial = structuredClone(save);
    spendProgression(save,id);
    assert.equal(save.lingshi,0);
    assert.deepEqual(save.meta,{});
    assert.deepEqual(save.clears,initial.clears);
    assert.equal(save.tree[id].length,2);
    save.clears[id]=[1,2]; save.unlocked=3; save.lingshi=600;
    const priorSpent=save.spent;
    const ledger=spendProgression(save,id);
    assert.equal(save.lingshi + ledger.filter(e=>e.kind==='purchase').reduce((n,e)=>n+e.cost,0),600);
    assert.equal(save.spent-priorSpent,600-save.lingshi);
    assert.ok(save.lingshi>=0);
    assert.equal(save.tree[id].length,8);
    assert.equal(save.legacy[id].length,1);
    const start=treeStart(character(id)), lit=litSet(start,[]);
    for(const node of save.tree[id]) {assert.ok(canLight(node,start,lit));lit.add(node);}
    assert.deepEqual(save.clears[id],[1,2]);
    assert.equal(save.unlocked,3);
  }
});

test('评审修复：相柳破水按预警椭圆判定上下及左右边界', () => {
  for (const [x, y, hit] of [[0, 40, false], [0, -40, false], [0, 30, true], [0, -30, true], [50, 0, true], [52, 0, false]]) {
    const { g, mgr, hurts } = trickScene(6);
    Object.assign(g, { player: { x, y }, cameras: { main: { shake() {} } }, proj: { enemyShot() {} } });
    const b = trickMob('xiangliu', 6, { x: 0, y: 0, state: 3, timer: 0, raged: false,
      sprite: { setAlpha() {} } });
    mgr.xiangliu(b, 1 / 60, 0, 1, 0, 40);
    assert.equal(hurts.length, hit ? 1 : 0, `(${x}, ${y})`);
  }
});

test('评审修复：帝江歌舞中致死仍逐帧补齐五相，最后一相显示后才结算一次', async () => {
  const { DIJIANG_FORMS } = await import('../src/config/enemies.ts');
  const forms = ['earth', 'metal', 'water', 'wood', 'fire'];
  for (const start of [0, 3, 4]) {
    const { g, mgr } = trickScene(10);
    const shots = [], drops = [];
    Object.assign(g, { anims: { exists: () => true }, proj: { enemyShot: (...args) => shots.push(args) },
      pickups: { gem: (...args) => drops.push(args) } });
    const b = Object.assign(new Enemy({ ...sprite(), play() {}, clearTint() {}, anims: { stop() {} } }), {
      def: DIJIANG_FORMS[forms[start]], tex: DIJIANG_FORMS[forms[start]].tex,
      alive: true, boss: true, hp: -1000, maxHp: 1000, phase: start, state: 1, timer: 2, xp: 5,
    });
    mgr.list.push(b);
    mgr.kill(b);
    if (start < 4) {
      assert.equal(b.alive, true);
      assert.equal(g.bossKilled, 0);
      assert.equal(b.hp, 0, '不回血，也不需要玩家额外补刀');
      for (let phase = start + 1; phase <= 4; phase++) {
        mgr.update(1 / 60);
        assert.equal(b.phase, phase);
        assert.equal(b.def.el, forms[phase]);
        assert.equal(b.alive, true, '留一帧显示这一相');
        mgr.kill(b); // 同帧多个伤害入口不能提前结束补相。
        assert.equal(g.bossKilled, 0);
      }
      assert.equal(shots.length, (4 - start) * 10);
      mgr.update(1 / 60);
    }
    assert.equal(b.alive, false);
    mgr.kill(b);
    assert.equal(g.bossKilled, 1);
    assert.equal(g.kills, 1);
    assert.equal(g.killed.dijiang, 1);
    assert.equal(drops.length, 1);
  }
});

test('土系三次积累保底打昏，星图时长加成仍生效', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const scene = comboScene({});
  scene.pstats.stunMult = 1.2;
  const e = enemy('water');
  for (let i = 0; i < 2; i++) {
    scene.now = 1 + i * 2;
    scene.hitEnemy(e, 1, 'earth', { proc: 1 });
    assert.equal(e.daze, i + 1);
    assert.equal(e.stunUntil, 0);
  }
  scene.now = 5;
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  assert.equal(e.daze, 0);
  assert.ok(Math.abs(e.stunUntil - (5 + 0.8 * 1.2)) < 1e-9);
  assert.ok(Math.abs(e.stunImmuneUntil - e.stunUntil - 1) < 1e-9);
});

test('特殊直接定身清空旧眩晕积累，眩晕与免疫期不攒层、不续晕', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const scene = comboScene({});
  const e = enemy('water');
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  assert.equal(e.daze, 2);
  scene.hitEnemy(e, 1, 'earth', { stun: 0.6 });
  assert.equal(e.daze, 0);
  assert.equal(e.stunUntil, 1.6);
  const immuneUntil = e.stunImmuneUntil;
  for (const time of [1.2, 1.8, 2.5]) {
    scene.now = time;
    scene.hitEnemy(e, 1, 'earth', { proc: 1 });
    scene.hitEnemy(e, 1, 'earth', { stun: 1 });
    assert.equal(e.daze, 0);
    assert.equal(e.stunUntil, 1.6);
    assert.equal(e.stunImmuneUntil, immuneUntil);
  }
  scene.now = immuneUntil;
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  assert.equal(e.daze, 1);
});

test('震慑间隔超过四秒重新从一层起，Boss 二阶短打昏，致死或无敌命中不攒层', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const scene = comboScene({});
  const e = enemy('water');
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  scene.now += 4.01;
  scene.hitEnemy(e, 1, 'earth', { proc: 1 });
  assert.equal(e.daze, 1);
  const boss = enemy('water', { boss: true });
  for (let i = 0; i < 3; i++) scene.hitEnemy(boss, 1, 'earth', { proc: 1 });
  assert.ok(Math.abs(boss.stunUntil - scene.now - 0.4) < 1e-9);
  assert.equal(boss.daze, 0);
  assert.equal(boss.slowUntil, scene.now + 1.5);
  const dead = enemy('water', { hp: 1 });
  scene.hitEnemy(dead, 10, 'earth', { proc: 1 });
  assert.equal(dead.daze, 0);
  const immune = enemy('water', { invulnUntil: scene.now + 2 });
  scene.hitEnemy(immune, 1, 'earth', { proc: 1 });
  assert.equal(immune.daze, 0);
});

test('持续伤害从已结算的命中伤害派生，不再次乘元素强度；传播不逐跳衰减', async () => {
  const { ON_ENEMY } = await import('../src/config/status.ts');
  for (const [el, kind, field] of [['metal', 'bleed', 'bleedDps'], ['wood', 'poison', 'poisonDps'], ['fire', 'burn', 'burnDps']]) {
    const g = comboScene({});
    for (const targetEl of ['metal', 'wood', 'water', 'fire', 'earth']) {
      const e = enemy(targetEl, { hp: 10000, maxHp: 10000, burnStacks: 0, burnDps: 0 });
      const damage = g.hitEnemy(e, 20, el, { noCrit: true });
      g.afflict(e, kind, damage);
      assert.ok(Math.abs(e[field] - damage * ON_ENEMY[kind].k) < 1e-9);
    }
    if (kind === 'bleed') continue;
    const a = enemy(el, { burnStacks: 0 }), b = enemy(el, { burnStacks: 0 });
    if (kind === 'burn') { g.burnEnemy(a, 10); g.burnEnemy(b, a.burnDps); }
    else { g.poisonEnemy(a, 10, 4); g.poisonEnemy(b, a.poisonDps, 3); }
    assert.equal(b[field], 10);
  }
});

test('镇岳只提高二阶几率，直接定身与击退不再加成', (t) => {
  t.mock.method(Math, 'random', () => 0.6);
  const g = comboScene({});
  g.build.passives.set('zhenyue', 5);
  g.pstats = { ...g.build.stats(), crit: 0 };
  g.player = { x: -10, y: 0, moving: true };
  const rock = enemy('water', { kbx: 0, kby: 0 });
  g.hitEnemy(rock, 1, 'earth', { stun: 1, kb: 100 });
  assert.equal(rock.stunUntil - g.now, 1);
  assert.equal(rock.kbx, 300);
  const vine = enemy('water', { kbx: 0, kby: 0 });
  g.hitEnemy(vine, 1, 'wood', { stun: 1, kb: 100 });
  assert.equal(vine.stunUntil - g.now, 1);
  assert.equal(vine.kbx, 300);
  const stacked = enemy('water');
  for (let i = 0; i < 3; i++) g.afflict(stacked, 'stun', 1);
  assert.ok(Math.abs(stacked.stunUntil - g.now - 0.8) < 1e-9);
});

test('快怪仍脆、慢速前排更耐打，血量成长不反转快慢分工', () => {
  const fast = ['shuigui', 'huoya', 'zhushe', 'chihu'].map(id => ENEMIES[id]);
  const heavy = ['shiyong', 'tiejia', 'chuanshan', 'bingcan', 'aoxie'].map(id => ENEMIES[id]);
  for (const f of fast) for (const h of heavy) {
    assert.ok(f.speed >= 50 && h.speed <= 34);
    for (const scale of [1, 1.6 * 1.798, 5.2 * 5.2]) {
      assert.ok(Math.round(h.hp * scale) >= Math.round(f.hp * scale) * 2);
    }
  }
  assert.ok(ENEMIES.yecha.hp < ENEMIES.shiyong.hp, '跳跃突进怪不同时占据重装血量');
});

test('护甲收益递减且负护甲不放大伤害，基础护甲和超高护甲都有限度', async () => {
  const { armoredDamage } = await import('../src/game/damage.ts');
  assert.equal(armoredDamage(100, -5), 100);
  assert.equal(armoredDamage(100, 0), 100);
  assert.equal(armoredDamage(100, 5), 71);
  assert.equal(armoredDamage(100, 10), 56);
  assert.equal(armoredDamage(100, 20), 40);
  assert.equal(armoredDamage(100, 100), 40);
  for (let a = 0; a < 30; a++) assert.ok(armoredDamage(100, a + 1) <= armoredDamage(100, a));
});


test('二阶概率边界：首次不能跳阶，20% 基础率，加成按百分点，积累保底', async (t) => {
  const { advances } = await import('../src/config/status.ts');
  const random = t.mock.method(Math, 'random', () => 0);
  assert.equal(advances(1, 3, 1), false);
  assert.equal(advances(2, 3, 0), true);
  random.mock.mockImplementation(() => 0.2);
  assert.equal(advances(2, 3, 0), false);
  assert.equal(advances(2, 3, 0.1), true);
  random.mock.mockImplementation(() => 0.7);
  assert.equal(advances(2, 3, 0.5), false);
  assert.equal(advances(2, 3, 0.6), true);
  random.mock.mockImplementation(() => 0.999);
  assert.equal(advances(3, 3, 0), true);
  assert.equal(advances(5, 5, 0), true);
  assert.equal(advances(2, 3, 10), true);
});

test('五系心法各提高对应二阶概率，本系亲和仍为 1.2 倍；镇岳排除纯地脉刺构筑', async () => {
  const { PASSIVES } = await import('../src/config/skills.ts');
  for (const [el, id, hero] of [['metal', 'pojun', 'xiao'], ['wood', 'fanmao', 'qingdai'], ['water', 'xuanming', 'ruan'], ['fire', 'liaoyuan', 'zhu'], ['earth', 'zhenyue', 'moheng']]) {
    for (const [char, expected] of [['xuanyi', 0.5], [hero, 0.6]]) {
      const b = new Build(character(char), LEVELS[0]);
      b.passives.set(id, 5);
      for (const [key, value] of Object.entries(b.stats().advanceBonus)) {
        assert.ok(Math.abs(value - (key === el ? expected : 0)) < 1e-9);
      }
    }
  }
  const b = new Build(character('xuanyi'), LEVELS[0]);
  b.skills = new Map([['stonespike', 1]]);
  assert.equal(b.unlocked(PASSIVES.zhenyue), false);
  b.skills.set('luoshi', 1);
  assert.equal(b.unlocked(PASSIVES.zhenyue), true);
});

test('五系首次只挂一阶，强化后第二次即可进阶，毒火到期后重新积累', (t) => {
  t.mock.method(Math, 'random', () => 0.6);
  for (const [kind, passive, el] of [['slow', 'xuanming', 'fire'], ['stun', 'zhenyue', 'water'], ['poison', 'fanmao', 'earth'], ['burn', 'liaoyuan', 'metal'], ['bleed', 'pojun', 'wood']]) {
    for (const enhanced of [false, true]) {
      const g = comboScene({});
      if (enhanced) g.build.passives.set(passive, 5);
      g.pstats = { ...g.build.stats(), dotMult: 1 };
      const e = enemy(el, { hp: 1000 });
      const deep = () => kind === 'slow' || kind === 'stun' ? e.stunUntil > g.now : kind === 'poison' ? e.poisonDeep : kind === 'burn' ? e.burningDeep : e.hp < 1000;
      g.afflict(e, kind, 10);
      assert.equal(deep(), false, kind + ' first');
      g.afflict(e, kind, 10);
      assert.equal(deep(), enhanced, kind + ' second');
      if (enhanced && (kind === 'poison' || kind === 'burn')) {
        g.now += 5;
        g.afflict(e, kind, 10);
        assert.equal(deep(), false, kind + ' expired');
      }
    }
  }
});

test('剧毒第三次保底双倍毒伤，刷新不重复翻倍，到期恢复一阶且不放大火伤', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const g = comboScene({});
  g.pstats.dotMult = 1;
  const e = enemy('earth', { hp: 1000 });
  for (let i = 0; i < 3; i++) g.poisonEnemy(e, 10, 4);
  assert.equal(e.poisonDeep, true);
  assert.equal(e.poisonDps, 10);
  g.dotEnemy(e, 5, 5);
  assert.equal(e.hp, 985);
  g.poisonEnemy(e, 8, 2);
  g.dotEnemy(e, 5, 0);
  assert.equal(e.hp, 975);
  assert.equal(e.poisonUntil, 5);
  g.now = 5;
  g.poisonEnemy(e, 8, 2);
  assert.equal(e.poisonDeep, false);
  assert.equal(e.poisonBuild, 1);
  g.dotEnemy(e, 4, 0);
  assert.equal(e.hp, 971);
});

test('燃烧随携带者灼伤附近敌人，不伤自身、不挂异常，尊重无敌与到期', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  const g = comboScene({});
  g.pstats.dotMult = 1;
  const source = enemy('metal'), near = enemy('wood', { x: 20 }), far = enemy('wood', { x: 100 }), immune = enemy('wood', { x: 20, invulnUntil: 10 });
  const all = [source, near, far, immune];
  g.enemies.inRadius = (x, y, r) => all.filter(e => e.alive && Math.hypot(e.x - x, e.y - y) <= r);
  for (let i = 0; i < 3; i++) g.burnEnemy(source, 8);
  assert.equal(source.burningDeep, true);
  g.burnAura(source);
  assert.deepEqual(all.map(e => e.hp), [100, 94, 100, 100]);
  assert.equal(near.burnUntil, 0);
  assert.equal(near.burningDeep, false);
  source.x = 90;
  g.burnAura(source);
  assert.deepEqual(all.map(e => e.hp), [100, 94, 94, 100]);
  source.invulnUntil = 10;
  g.burnAura(source);
  assert.equal(far.hp, 94);
  source.invulnUntil = 0;
  g.now = source.burnUntil;
  g.burnAura(source);
  assert.equal(far.hp, 94);
});

test('落石命中先眩晕乱走，镇岳提高二次打昏率，免疫期间不再积累', (t) => {
  t.mock.method(Math, 'random', () => 0.6);
  const g = comboScene({});
  g.build.passives.set('zhenyue', 5);
  g.pstats = { ...g.build.stats(), crit: 0 };
  const e = enemy('water');
  g.hitEnemy(e, 1, 'earth', { daze: 1.5 });
  assert.equal(e.confusedUntil, 2.5);
  assert.equal(g.hasStatus(e, 'stun'), true);
  assert.equal(e.stunUntil, 0);
  g.hitEnemy(e, 1, 'earth', { daze: 1.5 });
  assert.equal(e.confusedUntil, 0);
  assert.equal(e.daze, 0);
  assert.equal(e.stunUntil, 1.8);
  g.now = 2;
  g.hitEnemy(e, 1, 'earth', { daze: 1.5 });
  assert.equal(e.daze, 0);
  assert.equal(e.confusedUntil, 0);
});

test('Boss 保留二阶冰冻/打昏，持续减半，结束后水土共享三秒免控', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  for (const [kind, el, duration] of [['slow', 'fire', 0.5], ['stun', 'water', 0.4]]) {
    const g = comboScene({});
    const e = enemy(el, { boss: true });
    g.afflict(e, kind, 1);
    assert.equal(e.slowF, 0.75);
    assert.equal(e.stunUntil, 0);
    g.afflict(e, kind, 1);
    g.afflict(e, kind, 1);
    assert.ok(Math.abs(e.stunUntil - g.now - duration) < 1e-9);
    assert.ok(Math.abs(e.stunImmuneUntil - e.stunUntil - 3) < 1e-9);
    assert.equal(e.frozenUntil > g.now, kind === 'slow');
    const until = e.stunUntil;
    g.now = until + 0.1;
    for (let i = 0; i < 10; i++) { g.afflict(e, 'slow', 1); g.afflict(e, 'stun', 1); }
    assert.equal(e.stunUntil, until, '不能交替水土绕过免疫');
    assert.equal(e.chill, 0);
    assert.equal(e.daze, 0);
  }
});

test('Boss 二阶毒火窗口减半，刷新不延长二阶，到期保留一阶并重新积累', (t) => {
  t.mock.method(Math, 'random', () => 0.99);
  for (const kind of ['poison', 'burn']) {
    const g = comboScene({});
    g.pstats.dotMult = 1;
    const e = enemy('earth', { hp: 1000, boss: true });
    const apply = () => g.afflict(e, kind, 10);
    for (let i = 0; i < 3; i++) apply();
    const endField = kind === 'poison' ? 'poisonDeepUntil' : 'burnDeepUntil';
    const flag = kind === 'poison' ? 'poisonDeep' : 'burningDeep';
    const baseField = kind === 'poison' ? 'poisonUntil' : 'burnUntil';
    const buildField = kind === 'poison' ? 'poisonBuild' : 'burnBuild';
    const end = e[endField];
    assert.equal(end - g.now, kind === 'poison' ? 2 : 1);
    g.now += 0.5;
    apply();
    assert.equal(e[endField], end);
    g.now = end;
    assert.ok(e[baseField] > g.now);
    if (kind === 'poison') { g.dotEnemy(e, 10, 0); assert.equal(e.hp, 990); }
    apply();
    assert.equal(e[flag], false);
    assert.equal(e[buildField], 1);
    apply();
    assert.equal(e[flag], false);
    apply();
    assert.equal(e[flag], true);
  }
});
