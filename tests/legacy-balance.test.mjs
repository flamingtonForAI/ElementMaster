import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(s, c, next) {
    if (s === 'phaser') return { url: 'data:text/javascript,export default { Scene: class {}, Animations: { Events: { ANIMATION_COMPLETE: "complete" } } }', shortCircuit: true };
    if (s === 'tweakpane') return { url: 'data:text/javascript,export class Pane {}', shortCircuit: true };
    if (s === '../audio/Audio') return { url: 'data:text/javascript,export const audio = { sfx() {} }', shortCircuit: true };
    return next(s.startsWith('.') && !/\.[a-z]+$/.test(s) ? `${s}.ts` : s, c);
  },
  load(u, c, next) {
    return u.endsWith('.ts') ? { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(u), 'utf8'), { mode: 'transform' }), shortCircuit: true } : next(u, c);
  },
});
const { CHARACTERS } = await import('../src/config/characters.ts');
const { LEVELS } = await import('../src/config/levels.ts');
const { GEN_ORDER } = await import('../src/config/elements.ts');
const { LEGACIES } = await import('../src/config/legacy.ts');
const { SKILLS } = await import('../src/config/skills.ts');
const { addMods } = await import('../src/config/startree.ts');
const { Build } = await import('../src/game/Build.ts');
const { SkillSystem } = await import('../src/game/Skills.ts');
const { Puppet, PuppetManager } = await import('../src/game/Puppets.ts');
const { GameScene } = await import('../src/scenes/GameScene.ts');
const character = id => CHARACTERS.find(c => c.id === id);
const modsOf = (id, branch) => LEGACIES[id][branch].nodes.reduce((m, n) => addMods(m, n.mods), {});

test('散人每四级获得全伤成长，最低灵根与其他角色专属成长仍独立', () => {
  const b = new Build(character('xuanyi'), LEVELS[0]);
  for (const [level, expected] of [[3, 1], [4, 1.02], [20, 1.1]]) {
    b.level = level; b.recompute();
    assert.equal(b.stats().dmgMult, expected);
    assert.equal(b.stats().sigDmg, 1);
  }
  assert.equal(Object.values(b.lingen).reduce((a, v) => a + v, 0), 3);
  const zhu = new Build(character('zhu'), LEVELS[0]);
  zhu.level = 20;
  assert.equal(zhu.stats().dmgMult, 1);
  assert.equal(zhu.stats().sigDmg, 1.2);
});

test('小周天只在已学术元素间轮转，保留相生顺序，新学元素自动加入', () => {
  const g = new GameScene();
  g.build = new Build(character('xuanyi'), LEVELS[0]);
  assert.deepEqual(g.zhoutianElements(), GEN_ORDER);
  addMods(g.build.mods, LEGACIES.xuanyi[0].nodes[0].mods);
  assert.deepEqual(g.zhoutianElements(), ['fire']);
  g.build.skills.set('waterdragon', 1);
  g.build.skills.set('lihuo', 1);
  g.build.passives.set('houtu', 1);
  assert.deepEqual(g.zhoutianElements(), ['fire', 'water']);
  g.player = { x: 0, y: 0 }; g.fx = { ring() {} }; g.now = 10;
  Object.defineProperty(g, 'hud', { value: { toast() {} } });
  g.zhoutian = 'fire'; g.rotateZhoutian();
  assert.equal(g.zhoutian, 'water');
  assert.equal(g.zhoutianAt, 30);
  g.build.skills.set('leaf', 1);
  g.rotateZhoutian();
  assert.equal(g.zhoutian, 'wood');
  g.rotateZhoutian(); assert.equal(g.zhoutian, 'fire');
});

test('大周天仅加强轮到的元素；归元每次只爆发一次', () => {
  const g = new GameScene();
  g.build = new Build(character('xuanyi'), LEVELS[0], {}, modsOf('xuanyi', 0));
  g.pstats = g.build.stats(); g.now = 0; g.shield = 0; g.hehua = [];
  g.terrainMods = Object.fromEntries(GEN_ORDER.map(e => [e, 1]));
  const e = { def: { el: 'earth' }, hp: 100, maxHp: 100 };
  const base = g.dmgMult(e, 'fire');
  g.zhoutian = 'fire';
  assert.ok(Math.abs(g.dmgMult(e, 'fire') / base - 1.65) < 1e-9);
  g.zhoutian = 'water'; assert.equal(g.dmgMult(e, 'fire'), base);
  let hits = 0;
  g.player = { x: 0, y: 0 }; g.fx = { ring() {} };
  g.enemies = { inRadius: () => [e] }; g.hitEnemy = () => { hits++; };
  Object.defineProperty(g, 'hud', { value: { toast() {} } });
  g.rotateZhoutian(); assert.equal(hits, 1);
});

function puppetHit(lv, mods, giant) {
  const shape = new Proxy({}, { get: (o, key) => key === 'tintFill' ? false : () => shape });
  const target = { id: 1, alive: true, x: 20, y: 0, radius: 8 };
  let damage = 0;
  const g = { now: 1, player: { x: 0, y: 0, facing: { x: 1, y: 0 } },
    build: { skills: new Map([['puppet', lv]]), mods, version: 0 }, pstats: { area: 1, puppetDmg: 1 },
    world: { push() {} }, enemies: { nearest: () => target, inRadius: () => [target] },
    later: (_s, fn) => fn(), tweens: { add() {} }, cameras: { main: { shake() {} } },
    fx: shape, pickups: { magnetNear() {} }, hitEnemy: (_e, dmg) => { damage += dmg; },
  };
  const manager = new PuppetManager(g), p = new Puppet(shape, shape, shape);
  p.giant = giant; p.radius = giant ? 14 : 7; p.hp = p.maxHp = 100;
  manager.list = [p]; manager.update(1 / 60);
  return damage;
}

test('早成平滑 Lv5–8 巨傀成长，满级保留收益且不加成小傀儡', () => {
  const mods = LEGACIES.moheng[1].nodes[1].mods;
  const early = [5, 6, 7, 8].map(lv => puppetHit(lv, mods, true) / SKILLS.puppet.stats(lv).dmg);
  assert.ok(early.every((v, i) => i === 0 || v > early[i - 1]));
  assert.ok((early[0] + 2) / 3 < 1.4);
  assert.ok(puppetHit(8, mods, true) > puppetHit(8, {}, true));
  assert.equal(puppetHit(8, mods, false), puppetHit(8, {}, false));
  assert.equal(puppetHit(8, {}, true), SKILLS.puppet.stats(8).dmg * 2.5);
});

test('连符只降低追加符的基础伤害，原生符与符海二爆分别结算一次', () => {
  for (const lv of [1, 8]) {
    const landed = [], bursts = [];
    const shape = new Proxy({}, { get: () => () => shape });
    const target = { id: 1, alive: true, x: 35, y: 0 };
    const g = { player: { x: 0, y: 0, attack() {} }, pstats: { area: 1 },
      build: { skills: new Map([['talisman', lv]]), mods: modsOf('zhu', 1) },
      enemies: { nearestN: () => [target] }, proj: { fire: (...args) => landed.push(args[6]) },
      add: { sprite: () => shape }, tweens: { add() {} }, later: (_t, fn) => fn(),
      explode: (_x, _y, _r, dmg) => bursts.push(dmg),
    };
    const skills = new SkillSystem(g), st = SKILLS.talisman.stats(lv);
    skills.fire('talisman', st);
    assert.equal(landed.length, st.count + 1);
    landed.forEach(p => p.onHit(target));
    skills.updateSticks(1);
    const expected = st.dmg * (st.count + 0.5) * 1.5;
    assert.equal(bursts.reduce((a, b) => a + b, 0), expected);
  }
});
