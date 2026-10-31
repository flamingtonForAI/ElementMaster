import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(s, c, next) {
    if (s === 'phaser') return { url: 'data:text/javascript,export default {}', shortCircuit: true };
    if (s === '../audio/Audio') return { url: 'data:text/javascript,export const audio = { sfx() {} }', shortCircuit: true };
    return next(s.startsWith('.') && !/\.[a-z]+$/.test(s) ? `${s}.ts` : s, c);
  },
  load(u, c, next) {
    return u.endsWith('.ts') ? { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(u), 'utf8'), { mode: 'transform' }), shortCircuit: true } : next(u, c);
  },
});
const { SkillSystem } = await import('../src/game/Skills.ts');
const { SKILLS } = await import('../src/config/skills.ts');
const sprite = () => {
  const s = { x: 0, y: 0, play() { return s; }, setPosition(x, y) { Object.assign(s, { x, y }); return s; },
    setDepth() { return s; }, setVisible() { return s; }, setRotation() { return s; }, setScale() { return s; } };
  return s;
};
function orbitScene({ lv = 8, area = 1, cd = 1, radius = 6 } = {}) {
  const st = SKILLS.lihuo.stats(lv), flat = st.flat ?? 0.6;
  const targets = Array.from({ length: 72 }, (_, i) => {
    const a = i * Math.PI / 36;
    return { id: i + 1, alive: true, radius, x: Math.cos(a) * st.orbit * area, y: Math.sin(a) * st.orbit * area * flat };
  });
  const hits = new Map(targets.map(e => [e.id, []]));
  const g = { now: 0, player: { x: 0, y: 0, alive: true }, pstats: { area, cdMult: cd },
    build: { skills: new Map([['lihuo', lv]]) }, add: { sprite },
    enemies: { inRadius: (x, y, r) => targets.filter(e => Math.hypot(e.x - x, e.y - y) <= r + e.radius) },
    hitEnemy: e => hits.get(e.id).push(g.now) };
  return { g, system: new SkillSystem(g), targets, hits, st };
}

test('离火环在20fps与高减冷却下仍扫到整条轨道，不因固定步长永久跳过某些角度', () => {
  const s = orbitScene({ cd: 0.5 / SKILLS.lihuo.stats(8).period });
  for (let frame = 1; frame <= 80; frame++) { s.g.now = frame / 20; s.system.updateOrbs(1 / 20); }
  assert.deepEqual([...s.hits].filter(([, times]) => !times.length).map(([id]) => id), []);
});

test('拂尘逐级扇面与射程边界准确，范围加成同时作用于特效与判定，不扫到身后', () => {
  for (let lv = 1; lv <= 8; lv++) for (const area of [1, 1.5]) for (const facing of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const st = SKILLS.fuchen.stats(lv), r = st.range * area, half = st.arc * Math.PI / 360;
    const point = (id, distance, offset) => ({ id, alive: true, x: Math.cos(facing + offset) * distance, y: -2 + Math.sin(facing + offset) * distance });
    const aim = point(0, 20, 0);
    const targets = [aim, point(1, r - 1, 0), point(2, r + 1, 0), point(3, r - 2, half - 0.02),
      point(4, r - 2, half + 0.02), point(5, r - 2, -half + 0.02), point(6, r - 2, -half - 0.02), point(7, 30, Math.PI)];
    const hits = [], visuals = [];
    const g = { player: { x: 0, y: 0, attack() {} }, pstats: { area },
      enemies: { nearest: () => aim, inRadius: () => targets }, fx: { whisk: (...args) => visuals.push(args) },
      hitEnemy: (e, dmg, el) => { assert.equal(el, null); hits.push(e.id); } };
    new SkillSystem(g).fire('fuchen', st);
    assert.deepEqual(hits, [0, 1, 3, 5], `Lv${lv}, area ${area}, angle ${facing}`);
    assert.equal(visuals[0][3], r); assert.equal(visuals[0][4], st.arc);
  }
});

test('近身技能保持分工：扇形挥砍（拂尘、剑气）前探距离长于全周环（冰环、离火环），拂尘窄扇长距、剑气宽扇高频，冰环保留全周总面积优势', () => {
  for (let lv = 1; lv <= 8; lv++) {
    const f = SKILLS.fuchen.stats(lv), sword = SKILLS.slash.stats(lv), ice = SKILLS.hanbing.stats(lv), fire = SKILLS.lihuo.stats(lv);
    assert.ok(f.range > sword.range && sword.range > ice.radius);
    assert.ok(f.arc < sword.arc && sword.arc < 180);
    assert.ok(f.cd > sword.cd && f.cd < ice.cd);
    assert.ok(fire.orbit + fire.hitRadius <= ice.radius + 3);
    const sector = Math.PI * f.range ** 2 * f.arc / 360;
    const disk = Math.PI * ice.radius ** 2;
    assert.ok(sector < disk * 0.65, '窄扇形拂尘的单次覆盖面积仍低于360°全周冰环');
  }
});

test('离火环范围加成、减冷却与20–60fps组合无角度死区，并保持0.35秒全火团共享命中间隔', () => {
  for (const lv of [1, 4, 8]) for (const area of [1, 1.5]) for (const hz of [20, 30, 60]) for (const cd of [1, 0.6, 0.3, 0, -0.2]) {
    const s = orbitScene({ lv, area, cd });
    s.targets.push({ id: 1000, radius: 6, x: 0, y: 0 }, { id: 1001, radius: 6, x: (s.st.orbit + s.st.hitRadius) * area + 10, y: 0 });
    s.hits.set(1000, []); s.hits.set(1001, []);
    for (let frame = 1; frame <= hz * 4; frame++) { s.g.now = frame / hz; s.system.updateOrbs(1 / hz); }
    for (const [id, times] of s.hits) {
      if (id >= 1000) { assert.equal(times.length, 0, '环内空心处与外侧都不能凭空受伤'); continue; }
      assert.ok(times.length > 0, `轨道漏判：Lv${lv}, area=${area}, fps=${hz}, cd=${cd}, id=${id}`);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 0.35 - 1e-9, '多火团与插值不能突破共享间隔');
    }
    for (const orb of s.system.orbs) {
      const normalized = (orb.x / (s.st.orbit * area)) ** 2 + ((orb.y + 6) / (s.st.orbit * area * s.st.flat)) ** 2;
      assert.ok(Math.abs(normalized - 1) < 1e-8, '火团贴图必须落在相同的碰撞轨道上');
    }
    assert.ok(Number.isFinite(s.system.orbAng));
    const count = [...s.hits.values()].reduce((sum, hits) => sum + hits.length, 0);
    s.g.player.alive = false; s.g.now += 1; s.system.updateOrbs(0.05);
    assert.equal([...s.hits.values()].reduce((sum, hits) => sum + hits.length, 0), count);
  }
});

test('拂尘的实际释放间隔随冷却加成缩短，满级仍慢于剑气', () => {
  for (const lv of [1, 8]) for (const cd of [1, 0.6]) {
    const times = [], st = SKILLS.fuchen.stats(lv);
    const g = { now: 0, build: { skills: new Map([['fuchen', lv]]), mods: {} },
      pstats: { cdMult: cd, sigDmg: 1 } };
    const s = new SkillSystem(g);
    s.updateSticks = s.updateAura = s.updateOrbs = s.updateVines = () => {};
    s.fire = () => { times.push(g.now); return true; };
    for (let frame = 1; frame <= 600; frame++) { g.now = frame / 60; s.update(1 / 60); }
    for (let i = 1; i < times.length; i++) assert.ok(Math.abs(times[i] - times[i - 1] - st.cd * cd) <= 1 / 60 + 1e-9);
  }
});
