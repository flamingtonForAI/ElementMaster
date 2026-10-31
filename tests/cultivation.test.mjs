import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'phaser') return { url: 'data:text/javascript,export default { Scene: class {} }', shortCircuit: true };
    if (specifier === 'tweakpane') return { url: 'data:text/javascript,export class Pane {}', shortCircuit: true };
    if (specifier.endsWith('/audio/Audio')) return { url: 'data:text/javascript,export const audio = { sfx() {}, hit() {} }', shortCircuit: true };
    return next(specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) ? `${specifier}.ts` : specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true };
    return next(url, context);
  },
});

const { Build } = await import('../src/game/Build.ts');
const { GameScene } = await import('../src/scenes/GameScene.ts');
const { DongfuScene } = await import('../src/scenes/DongfuScene.ts');
const { SkillSystem } = await import('../src/game/Skills.ts');
const { CHARACTERS } = await import('../src/config/characters.ts');
const { LEVELS } = await import('../src/config/levels.ts');
const { SKILLS, ULTIMATES } = await import('../src/config/skills.ts');
const { UPGRADES } = await import('../src/config/meta.ts');
const { talismanEffects } = await import('../src/config/map.ts');
const { loadSave, readSlot, importSlot, exportSlot, writeSave } = await import('../src/game/save.ts');
const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
const build = (id = 'xiao', meta = {}) => new Build(CHARACTERS.find(c => c.id === id), LEVELS[0], meta);

function learnEleven(b, finalLevel = 8) {
  const pool = Object.values(SKILLS).filter(s => !s.ultimate && (!s.exclusive || s.exclusive === b.char.id));
  const ids = [b.char.startSkill, ...pool.map(s => s.id).filter(id => id !== b.char.startSkill)].slice(0, 11);
  for (const [i, id] of ids.entries()) b.apply({ kind: 'skill', id, lv: i === 10 ? finalLevel : 8 });
  return ids;
}

test('六个角色自带术独立，默认七格；修炼五级十二格，中间普通术最多十格', () => {
  for (const c of CHARACTERS) for (let lv = 0; lv <= 5; lv++) {
    const b = build(c.id, { shuhai: lv });
    assert.equal(b.skillSlots, 7 + lv);
    assert.equal(b.skills.size, 1);
    while (true) {
      const option = b.options(100).find(o => o.kind === 'skill' && o.lv === 1);
      if (!option) break;
      assert.equal(SKILLS[option.id].ultimate, undefined);
      b.apply(option);
    }
    assert.equal(b.skills.size, 1 + Math.min(10, 6 + lv));
    assert.equal(b.slots[0].def.id, c.startSkill);
    assert.ok(b.slots.slice(1).every(s => s.def.id !== c.startSkill));
    assert.equal(b.ultimate, undefined);
    b.apply({ kind: 'skill', id: ULTIMATES[c.el], lv: 1 });
    assert.equal(b.ultimate, undefined, '不能通过普通升级提前领取大招');
  }
});

test('自带术不占六个普通格，满槽后已有自带术、普通术与心法仍可升级', () => {
  const b = build();
  for (const id of ['ruijin', 'yanyang', 'changsheng', 'ningshen', 'qingshen']) b.apply({ kind: 'passive', id, lv: 1 });
  b.apply({ kind: 'skill', id: 'fireball', lv: 1 });
  assert.equal(b.skills.size + b.passives.size, 7);
  assert.ok(b.options(100).every(o => !('lv' in o) || o.lv > 1), '满六格不再提供新术或新心法');
  b.apply({ kind: 'skill', id: 'leaf', lv: 1 });
  b.apply({ kind: 'passive', id: 'juling', lv: 1 });
  assert.equal(b.skills.size + b.passives.size, 7);
  b.apply({ kind: 'skill', id: 'slash', lv: 2 });
  b.apply({ kind: 'passive', id: 'ningshen', lv: 2 });
  assert.equal(b.skills.get('slash'), 2);
  assert.equal(b.passives.get('ningshen'), 2);
});

test('自带术之外一术九心法占十个普通格，第十二格只在全部满级后放大招', () => {
  const b = build('xiao', { shuhai: 5 });
  b.apply({ kind: 'skill', id: 'slash', lv: 8 });
  b.apply({ kind: 'skill', id: 'fireball', lv: 8 });
  const ids = ['ruijin', 'yanyang', 'changsheng', 'roushui', 'houtu', 'pojun', 'ningshen', 'qingshen', 'juling'];
  for (const id of ids) {
    assert.ok(b.options(100).some(o => o.kind === 'passive' && o.id === id));
    b.apply({ kind: 'passive', id, lv: id === 'juling' ? 4 : 5 });
  }
  assert.equal(b.skills.size + b.passives.size, 11);
  assert.equal(b.ultimate, undefined);
  assert.ok(b.options(100).every(o => !('lv' in o) || o.lv > 1));
  b.apply({ kind: 'passive', id: 'juling', lv: 5 });
  assert.equal(b.ultimate, 'wanjian');
  assert.equal(b.skills.size + b.passives.size, 12);
  assert.equal(b.slots[0].def.id, 'slash');
  assert.equal(b.slots[11].def.id, 'wanjian');
  assert.equal(b.slots.slice(1, 11).length, 10);
  assert.equal(b.skills.get('wanjian'), 1);
  assert.equal(b.options(100).filter(o => 'lv' in o).length, 0);
});

test('必须五级修炼且自带术与十个普通术全满级；预览不提前解锁，大招不重复或进入抽签池', () => {
  for (const c of CHARACTERS) {
    const b = build(c.id, { shuhai: 5 });
    const ids = learnEleven(b, 7);
    assert.equal(b.masteredSkills, 10);
    assert.equal(b.ultimate, undefined);
    const option = { kind: 'skill', id: ids[10], lv: 8 };
    b.preview(option);
    assert.equal(b.skills.size, 11);
    assert.equal(b.skills.get(ids[10]), 7);
    b.apply(option);
    assert.equal(b.skills.size, 12);
    assert.equal(b.ultimate, ULTIMATES[c.balanced ? b.benming : c.el]);
    const awakened = b.ultimate;
    b.apply({ kind: 'skill', id: awakened, lv: 2 });
    assert.equal(b.skills.get(awakened), 1, '大招固定一级，拒绝升级');
    b.recompute();
    assert.equal(b.ultimate, awakened);
    assert.equal(b.skills.size, 12);
    assert.ok(b.options(100).every(o => o.kind !== 'skill'));
    assert.equal(b.chestUpgrade(), null);
  }
  const four = build('xiao', { shuhai: 4 });
  learnEleven(four);
  assert.equal(four.masteredSkills, 11);
  assert.equal(four.ultimate, undefined);
});

test('宝箱升满最后普通术时解锁大招；散人大招锁定解锁时的本命', () => {
  const g = new GameScene();
  g.build = build('xuanyi', { shuhai: 5 });
  learnEleven(g.build, 7);
  g.pstats = g.build.stats();
  g.player = { x: 0, y: 0, hp: 20 };
  g.pickups = { magnetAll() {} };
  g.fx = { ring() {} }; g.later = () => {};
  const messages = [];
  Object.defineProperty(g, 'hud', { value: { toast: text => messages.push(text) } });
  g.openChest();
  const id = g.build.ultimate;
  assert.ok(id);
  assert.equal(g.build.skills.size, 12);
  assert.ok(messages.every(s => !s.includes('觉醒')), '不再显示觉醒说明');
  const other = SKILLS[id].el === 'fire' ? 'metal' : 'fire';
  g.build.mods[`lingen.${other}`] = 5;
  g.build.recompute();
  assert.equal(g.build.benming, other);
  assert.equal(g.build.ultimate, id);
});

test('十个普通格满级后仍需升满自带术；升级预览不改变左右独立格', () => {
  const b = build('xuanyi', { shuhai: 5 });
  for (const s of Object.values(SKILLS).filter(s => !s.ultimate && !s.exclusive)) b.apply({ kind: 'skill', id: s.id, lv: 8 });
  assert.equal(b.skills.size, 11);
  assert.equal(b.masteredSkills, 10);
  assert.equal(b.ultimate, undefined);
  b.preview({ kind: 'skill', id: 'fuchen', lv: 8 });
  assert.equal(b.slots[0].lv, 1);
  assert.equal(b.slots[11], undefined);
  b.apply({ kind: 'skill', id: 'fuchen', lv: 8 });
  assert.equal(b.slots[0].def.id, 'fuchen');
  assert.ok(b.slots[11].def.ultimate);
  assert.equal(b.slots.length, 12);
});

test('无属性拂尘不偏置灵根、不凑第六元素、不解锁五行异常心法，仅散人可选', () => {
  const b = build('xuanyi');
  b.mods['xuan.variety'] = 0.1;
  assert.deepEqual([...b.skills], [['fuchen', 1]]);
  b.apply({ kind: 'skill', id: 'fuchen', lv: 8 });
  assert.equal(SKILLS.fuchen.el, null);
  assert.deepEqual(Object.values(b.lingen), [0, 0, 0, 0, 0]);
  assert.equal(b.stats().dmgMult, 1);
  assert.ok(!b.options(100).some(o => o.kind === 'passive' && ['pojun', 'liaoyuan', 'fanmao', 'xuanming', 'zhenyue'].includes(o.id)));
  b.apply({ kind: 'skill', id: 'fireball', lv: 1 });
  assert.equal(b.stats().dmgMult, 1.1);
  assert.ok(b.options(100).some(o => o.kind === 'passive' && o.id === 'liaoyuan'));
  for (const c of CHARACTERS.filter(c => c.id !== 'xuanyi')) assert.ok(!build(c.id).options(100).some(o => o.id === 'fuchen'));
});

test('无属性实伤对五行相同：跳过地气、本命、周天、克弦与异常，保留通用增伤和护甲', () => {
  const g = new GameScene();
  g.build = build('xuanyi'); g.char = g.build.char; g.levelDef = LEVELS[0];
  Object.assign(g.build.mods, { 'kx.metal': 1, 'kx.fire': 1, 'kx.wood': 1, 'kx.earth': 1, 'xuan.bonus': 1 });
  g.pstats = g.build.stats(); g.pstats.dmgMult = 1.5; g.pstats.crit = 0;
  const elements = ['metal', 'wood', 'water', 'fire', 'earth'];
  g.terrainMods = Object.fromEntries(elements.map((el, i) => [el, 0.7 + i * 0.2]));
  g.pstats.vsEl = Object.fromEntries(elements.map((el, i) => [el, 1 + i]));
  g.pstats.elDmg = Object.fromEntries(elements.map(el => [el, 4]));
  g.hazards = { boost: () => 2 }; g.now = 10; g.shield = 0; g.hehua = [];
  g.player = { x: 0, y: 0, moving: false }; g.zhoutian = 'earth';
  const labels = []; g.fx = { number: (...args) => labels.push(args), text() { assert.fail('无属性不能触发伐木'); } };
  g.afflict = g.comboHit = () => assert.fail('无属性不能触发五行异常或合化命中');
  g.enemies = { kill() { assert.fail('无属性不能按元素斩杀残血敌人'); } };
  const damages = elements.map(el => {
    const e = { alive: true, hp: 140, maxHp: 1000, armor: 7, def: { el }, x: 40, y: 0, sprite: { displayHeight: 32 },
      invulnUntil: 0, flashUntil: 0, guardUntil: 0, burnUntil: 20, stunUntil: 0, slowUntil: 0, kbx: 0, kby: 0 };
    const dmg = g.hitEnemy(e, 40, null, { noCrit: true, proc: 1, kb: 30 });
    assert.equal(e.lastEl, null); assert.equal(e.hp, 87); assert.ok(e.kbx > 0);
    return dmg;
  });
  assert.deepEqual(damages, [53, 53, 53, 53, 53]);
  assert.ok(labels.every(args => args[3] === 'neutral' && args[5] === ''));
});

test('拂尘自动朝近敌扇扫：只命中范围内目标，升级扩大扇面，无目标不空放', () => {
  const angle = 70 * Math.PI / 180;
  const front = { id: 1, x: 40, y: -2 }, side = { id: 2, x: Math.cos(angle) * 40, y: -2 + Math.sin(angle) * 40 };
  const back = { id: 3, x: -60, y: -2 }, far = { id: 4, x: 200, y: -2 };
  const hits = [], visuals = [];
  const g = { player: { x: 0, y: 0, attack() {} }, pstats: { area: 1 },
    enemies: { nearest: () => front, inRadius: () => [front, side, back, far] },
    fx: { whisk: (...args) => visuals.push(args) }, hitEnemy: (e, dmg, el, options) => hits.push({ e, dmg, el, options }) };
  const system = new SkillSystem(g);
  assert.equal(system.fire('fuchen', SKILLS.fuchen.stats(1)), true);
  assert.deepEqual(hits.map(h => h.e.id), [1]);
  hits.length = 0;
  assert.equal(system.fire('fuchen', SKILLS.fuchen.stats(8)), true);
  assert.deepEqual(hits.map(h => h.e.id), [1, 2]);
  assert.ok(hits.every(h => h.el === null && h.options.kb === 50));
  assert.equal(visuals[1][3], 68);
  g.enemies.nearest = () => null;
  assert.equal(system.fire('fuchen', SKILLS.fuchen.stats(8)), false);
  assert.equal(visuals.length, 2);
});

test('新修炼可购买至五级、读档保留、导出导入保留并全额退还；旧存档默认零级', () => {
  memory.clear();
  const scene = new DongfuScene();
  scene.save = loadSave();
  scene.save.lingshi = 100000;
  scene.render = () => {};
  scene.commit = () => writeSave(scene.save);
  let denied = 0;
  scene.deny = () => denied++;
  for (const id of ['shuhai', 'xingyun']) {
    scene.sel = UPGRADES.findIndex(u => u.id === id);
    for (let i = 0; i < 6; i++) scene.buy();
    assert.equal(loadSave().meta[id], 5);
  }
  assert.equal(denied, 2);
  assert.ok(importSlot(2, exportSlot(1)));
  assert.deepEqual(readSlot(2).meta, { shuhai: 5, xingyun: 5 });
  const cost = scene.save.spent;
  assert.equal(scene.save.lingshi, 100000 - cost);
  scene.refund(); scene.refund();
  assert.equal(loadSave().lingshi, 100000);
  assert.deepEqual(loadSave().meta, {});
  const old = 'EM6:' + Buffer.from(JSON.stringify({ ver: 6, unlocked: 1, meta: { qixue: 2 } })).toString('base64');
  assert.ok(importSlot(3, old));
  assert.equal(build('xiao', readSlot(3).meta).skillSlots, 7);
  assert.equal(build('xiao', readSlot(3).meta).stats().luck, 0);
});

function runeScene(lv) {
  const g = new GameScene();
  g.build = build('xiao', { xingyun: lv });
  g.build.level = 20;
  g.pstats = g.build.stats();
  g.player = { x: 0, y: 0 };
  g.now = 10;
  g.fx = { ring() {} };
  g.cameras = { main: { flash() {}, shake() {}, worldView: { contains: (x, y) => Math.abs(x) <= 400 && Math.abs(y) <= 180 } } };
  const enemy = (x, boss = false) => ({ alive: true, x, y: 0, boss, stunUntil: 0, slowUntil: 0, stunImmuneUntil: 0, daze: 2, chill: 2, confusedUntil: 15 });
  g.enemies = { list: [enemy(380), enemy(20, true), enemy(600), { ...enemy(0), alive: false }, { ...enemy(40), elite: true }] };
  const hits = [];
  g.hitEnemy = (e, damage) => hits.push({ e, damage });
  Object.defineProperty(g, 'hud', { value: { toast() {} } });
  return { g, hits };
}

test('符箓基础六秒、幸运五级十二秒；屏幕边缘生效、屏外不生效，Boss定身转迟缓', () => {
  for (const [lv, duration, damage, speed] of [[0, 6, 300, 1.5], [5, 12, 600, 2]]) {
    const { g, hits } = runeScene(lv);
    g.useTalisman('ding');
    const [normal, boss, offscreen, dead] = g.enemies.list;
    assert.equal(normal.stunUntil, 10 + duration);
    assert.equal(normal.daze, 0);
    assert.equal(normal.chill, 0);
    assert.equal(normal.confusedUntil, 0);
    assert.equal(boss.slowUntil, 10 + duration);
    assert.equal(boss.stunUntil, 0);
    assert.equal(offscreen.stunUntil, 0);
    assert.equal(dead.stunUntil, 0);
    g.useTalisman('bao');
    assert.deepEqual(hits.map(h => h.damage), [damage, damage / 2]);
    assert.ok(hits.every(h => !h.e.boss), 'Boss 不进入命中流程，避免最低一点伤害或触发异常');
    g.useTalisman('dun');
    assert.equal(g.dunUntil, 10 + duration);
    assert.equal(g.iframeUntil, g.dunUntil);
    assert.equal(g.dunSpeed, speed);
    g.now++;
    g.useTalisman('dun');
    assert.equal(g.dunUntil, 11 + duration, '连续拾取刷新持续时间');
  }
});

test('幸运实际改变符箓刷新分支，允许更多符箓同场且保留三种等权随机', t => {
  t.mock.method(Math, 'random', () => 0.45);
  for (const [lv, expected] of [[0, 'crate'], [5, 'talisman']]) {
    const { g } = runeScene(lv);
    const drops = [];
    g.world = { half: 2000, blocked: () => false };
    g.pickups = { items: [], crate: () => drops.push('crate'), talisman: (_x, _y, id) => drops.push(id) };
    g.spawnItem();
    assert.deepEqual(drops, [expected === 'crate' ? 'crate' : 'ding']);
    g.pickups.items = [{ kind: 'talisman' }];
    g.spawnItem();
    assert.equal(drops[1], expected === 'crate' ? 'crate' : 'ding');
  }
  const { g } = runeScene(5);
  g.world = { half: 2000, blocked: () => false };
  const ids = [];
  g.pickups = { items: [{kind: 'crate'}, {kind: 'crate'}], talisman: (_x, _y, id) => ids.push(id) };
  for (const r of [0.1, 0.5, 0.9]) {
    Math.random.mock.mockImplementation(() => r);
    g.spawnItem();
  }
  assert.deepEqual(ids, ['bao', 'ding', 'dun']);
  assert.equal(talismanEffects(0).chance, 0.3);
  assert.equal(talismanEffects(1).chance, 0.6);
  assert.equal(talismanEffects(1).maxOnMap, 3);
});

test('五种大招走正常战斗命中、按轮次查找当前敌人，无目标不空放，结束后停止后续伤害', () => {
  for (const [el, id] of Object.entries(ULTIMATES)) {
    const tasks = [], hits = [], heals = [];
    const first = { alive: true }, replacement = { alive: true };
    let enemies = [];
    const g = {
      player: { x: 0, y: 0, alive: true, attack() {} }, pstats: { area: 1.5, maxHp: 100 }, shield: 0,
      enemies: { inRadius: () => [...enemies] }, hud: { toast() {} },
      fx: { ring() {}, anim() {}, burst() {}, impact() {} },
      healPlayer: amount => heals.push(amount), later: (delay, fn) => tasks.push({ delay, fn }),
      hitEnemy: (e, damage, element, options) => hits.push({ e, damage, element, options }),
    };
    const sys = new SkillSystem(g), st = SKILLS[id].stats(1);
    assert.equal(sys.fire(id, st), false);
    enemies = [first];
    assert.equal(sys.fire(id, st), true);
    tasks[0].fn();
    first.alive = false; enemies = [replacement];
    for (const task of tasks.slice(1)) task.fn();
    assert.equal(hits.length, st.count);
    assert.equal(hits[0].e, first);
    assert.ok(hits.slice(1).every(h => h.e === replacement));
    assert.ok(hits.every(h => h.element === el && h.damage > 0));
    assert.deepEqual(heals, [], '大招不直接回血');
    assert.equal(g.shield, 0, '大招不生成护盾');
    if (el === 'earth') assert.ok(hits.every(h => h.options.puppet && h.options.stun === 2.5));
    if (el === 'wood') assert.ok(hits.every(h => h.options.stun === 2));
    if (el === 'water') assert.ok(hits.every(h => h.options.slow === 3));
    g.over = true;
    tasks[0].fn();
    assert.equal(hits.length, st.count);
  }
});

function cooldownClock(id, cdMult, kite = 0) {
  const casts = [];
  const target = { alive: true, x: -50, y: 0 };
  const g = {
    now: 0, shield: 0,
    build: { skills: new Map([[id, 1]]), mods: { 'ruan.kite': kite } },
    player: { x: 0, y: 0, alive: true, moving: !!kite, facing: { x: 1, y: 0 }, attack() {} },
    pstats: { cdMult, area: 1, maxHp: 100, pierce: 0 },
    enemies: { inRadius: () => [target], nearest: () => target, nearestN: () => [target] },
    hud: { toast: () => casts.push(g.now) },
    proj: { fire: () => casts.push(g.now) },
    healPlayer() {}, later() {},
  };
  const system = new SkillSystem(g);
  let frame = 0;
  const advance = seconds => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      g.now = ++frame / 60;
      system.update(1 / 60);
    }
  };
  return { g, system, casts, advance };
}

test('所有大招基础15秒，凝神/角色成长/星图叠加后10–15秒，退射不能突破10秒', () => {
  const xiao = build();
  xiao.passives.set('ningshen', 5);
  const zhu = build('zhu');
  zhu.passives.set('ningshen', 5);
  const ruan = new Build(CHARACTERS.find(c => c.id === 'ruan'), LEVELS[0], {}, { cd: 0.22 });
  ruan.level = 80; ruan.passives.set('ningshen', 5);
  for (const id of Object.values(ULTIMATES)) {
    for (const [cdMult, kite, expected] of [
      [1, 0, 15], [xiao.stats().cdMult, 0, 12], [zhu.stats().cdMult, 0, 10.5],
      [ruan.stats().cdMult, 0.3, 10], [1, 0.3, 15 / 1.3], [-0.1, 0.3, 10],
    ]) {
      const clock = cooldownClock(id, cdMult, kite);
      clock.advance(46);
      assert.ok(clock.casts.length >= 4);
      for (let i = 1; i < clock.casts.length; i++) {
        const gap = clock.casts[i] - clock.casts[i - 1];
        assert.ok(Math.abs(gap - expected) <= 1 / 60 + 1e-8, `${id}：${gap}，预期${expected}`);
        assert.ok(gap >= 10 - 1e-8);
      }
    }
  }
});

test('冷却期间才开始退射也不能提前连放，无目标不消耗冷却；普通术仍正常吃减冷却', () => {
  const clock = cooldownClock('canghai', 0.7, 0.3);
  clock.g.player.moving = false;
  clock.advance(5);
  clock.g.player.moving = true;
  clock.advance(6);
  assert.equal(clock.casts.length, 2);
  assert.ok(clock.casts[1] - clock.casts[0] >= 10 - 1e-8);
  clock.g.enemies.inRadius = () => [];
  clock.advance(20);
  assert.equal(clock.casts.length, 2);
  clock.g.enemies.inRadius = () => [{ alive: true }];
  clock.advance(0.3);
  assert.equal(clock.casts.length, 3, '目标重新进入后直接施放，不额外等待十秒');
  const normal = cooldownClock('flysword', 0.5, 0.3);
  normal.advance(3);
  assert.ok(normal.casts.length >= 5);
  for (let i = 1; i < normal.casts.length; i++) {
    assert.ok(Math.abs(normal.casts[i] - normal.casts[i - 1] - 0.75 / 1.3) <= 1 / 60 + 1e-8);
  }
});
