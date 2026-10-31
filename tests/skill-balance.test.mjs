import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(s, c, next) {
    if (s === 'phaser') return { url: 'data:text/javascript,export default { Math: { Clamp: (x,a,b) => Math.max(a,Math.min(b,x)), Angle: { Wrap: a => Math.atan2(Math.sin(a),Math.cos(a)) } } }', shortCircuit: true };
    if (s === '../audio/Audio') return { url: 'data:text/javascript,export const audio = { sfx() {} }', shortCircuit: true };
    return next(s.startsWith('.') && !/\.[a-z]+$/.test(s) ? `${s}.ts` : s, c);
  },
  load(u, c, next) {
    return u.endsWith('.ts') ? { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(u), 'utf8'), { mode: 'transform' }), shortCircuit: true } : next(u, c);
  },
});
const { SkillSystem } = await import('../src/game/Skills.ts');
const { ProjectileManager } = await import('../src/game/Projectiles.ts');
const { SKILLS } = await import('../src/config/skills.ts');
const { Build } = await import('../src/game/Build.ts');
const { CHARACTERS } = await import('../src/config/characters.ts');
const { LEVELS } = await import('../src/config/levels.ts');

const sprite = () => {
  const obj = { anims: { stop() {} }, rotation: 0 };
  const s = new Proxy(obj, { get: (t, k) => k in t ? t[k] : (...args) => {
    if (k === 'setPosition') [t.x, t.y] = args;
    if (k === 'setScale') [t.scaleX, t.scaleY = args[0]] = args;
    return s;
  } });
  return s;
};
const mob = (id, x, y = -2, radius = 6) => ({ id, x, y, radius, alive: true });
function scene(enemies = [], area = 1) {
  const hits = [], tasks = [], lobbed = [];
  const near = (x, y, r, exclude) => enemies.filter(e => e.alive && !exclude?.has(e.id) && Math.hypot(e.x - x, e.y - y) <= r)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const g = { now: 0, player: { x: 0, y: 0, facing: { x: 1, y: 0 }, alive: true, attack() {} },
    pstats: { area, pierce: 0, sigDmg: 1, cdMult: 1 }, build: { skills: new Map(), mods: {} },
    enemies: {
      nearest: (x, y, r, exclude) => near(x, y, r, exclude)[0] ?? null,
      nearestN: (x, y, r, n) => near(x, y, r).slice(0, n),
      randomIn: (x, y, r, n) => near(x, y, r).slice(0, n),
      inRadius: (x, y, r, out = []) => { out.length = 0; out.push(...enemies.filter(e => e.alive && Math.hypot(e.x - x, e.y - y) <= r + e.radius)); return out; },
    },
    add: { sprite, image: sprite }, tweens: { add() {} },
    fx: { droplet() {}, burst() {}, anim() {}, ring() {}, impact() {}, crack() {} },
    hitEnemy(e, dmg, el, opts) { hits.push({ id: e.id, dmg, el, opts, time: g.now }); return dmg; },
    slowEnemy() {}, stunEnemy() {},
    later: (delay, fn) => tasks.push({ delay, fn }),
  };
  g.proj = new ProjectileManager(g);
  const system = new SkillSystem(g);
  return { g, system, enemies, hits, tasks, lobbed, advance(seconds, hz = 60) {
    for (let i = 0; i < seconds * hz; i++) { g.now += 1 / hz; g.proj.update(1 / hz); }
  } };
}

test('双水龙在远距离仍命中瞄准中心，并行加宽而非张开死角；各方向/范围加成一致', () => {
  for (const lv of [5, 6, 8]) for (const area of [1, 1.5]) for (let d = 0; d < 8; d++) {
    const a = d * Math.PI / 4, target = mob(1, Math.cos(a) * 240, -2 + Math.sin(a) * 240);
    const s = scene([target], area), st = SKILLS.waterdragon.stats(lv);
    s.system.fire('waterdragon', st); s.advance(1.7);
    assert.equal(s.hits.length, 2, `Lv${lv} area=${area} direction=${d}`);
    assert.equal(s.hits.reduce((v, h) => v + h.dmg, 0), st.dmg * 1.5, '双龙总伤害为单龙的1.5倍');
    assert.ok(s.hits.every(h => h.opts.slow === st.slow));
  }
});

test('飞叶的每一片都能命中初始目标，不因额外扇形散射打偏', () => {
  const s = scene([mob(1, 160)]);
  s.system.fire('leaf', SKILLS.leaf.stats(8)); s.advance(1);
  assert.equal(s.hits.length, 3);
});

test('飞叶有足够时间完成七个不同目标的长距离弹射，仍不能重复命中同一个敌人', () => {
  const targets = Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI + i * Math.PI * 2 / 7;
    return mob(i + 1, 150 + Math.cos(a) * 130, -2 + Math.sin(a) * 130);
  });
  const s = scene(targets), st = SKILLS.leaf.stats(8);
  s.system.fire('leaf', { ...st, count: 1 }); s.advance(5);
  assert.deepEqual(s.hits.map(h => h.id).sort(), [1, 2, 3, 4, 5, 6, 7]);
});

test('飞剑穿透后转向未命中的敌人，不绕着已经命中的活敌人打转', () => {
  const s = scene([mob(1, 40), mob(2, 100, 40)]);
  s.system.fire('flysword', SKILLS.flysword.stats(1)); s.advance(1.4);
  assert.deepEqual(s.hits.map(h => h.id), [1, 2]);
});

test('高速玩家弹道在20–60fps各个角度沿途命中，贯穿按近远排序且不打到轨迹外', () => {
  for (const hz of [20, 30, 60]) for (let d = 0; d < 8; d++) {
    const a = d * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a), step = 416 / hz;
    const point = (id, along, side = 0) => mob(id, dx * along - dy * side, -2 + dy * along + dx * side, 1);
    const s = scene([point(3, step * 0.9), point(2, step * 0.55), point(1, step * 0.2), point(4, step * 0.5, 8)]);
    s.g.proj.fire('bolt', 'pj_bolt', 0, -8, dx * 416, dy * 416, { dmg: 10, el: 'water', life: 1, radius: 2, pierce: 1 });
    s.g.proj.update(1 / hz);
    assert.deepEqual(s.hits.map(h => h.id), [1, 2], `fps=${hz} direction=${d}`);
  }
});

test('藤缚重叠或多轮覆盖共享半秒命中间隔，新增区域仍伤害新目标', () => {
  const s = scene([mob(1, 40, 0), mob(2, 42, 0), mob(3, 130, 0)]);
  const st = SKILLS.tengfu.stats(8);
  s.system.fire('tengfu', st);
  for (let frame = 1; frame <= 120; frame++) {
    s.g.now = frame / 60;
    if (frame === 20 || frame === 40) s.system.fire('tengfu', st);
    s.system.updateVines(1 / 60);
  }
  for (const target of s.enemies) {
    const hits = s.hits.filter(h => h.id === target.id);
    assert.ok(hits.length >= 3 && hits.length <= 4, `id=${target.id}: ${hits.length}`);
    for (let i = 1; i < hits.length; i++) assert.ok(hits[i].time - hits[i - 1].time >= 0.5 - 1e-9);
  }
});

test('火球和落石先覆盖不同敌群，只有一个目标时仍可集火', () => {
  for (const id of ['fireball', 'luoshi']) {
    const s = scene([mob(1, 80, 0), mob(2, 85, 0), mob(3, -140, 0)]), centers = [];
    s.g.proj.lob = (...args) => { centers.push([args[4], args[5], args[9]]); return { sprite: sprite() }; };
    s.system.boulder = (...args) => centers.push([args[0], args[1], args[3]]);
    const st = SKILLS[id].stats(8);
    s.system.fire(id, st);
    assert.equal(centers.length, st.count);
    assert.ok(centers.some(([x]) => x === -140), `${id} 没有覆盖第二群`);
    s.enemies.splice(1); centers.length = 0;
    s.system.fire(id, st);
    assert.equal(centers.length, st.count);
    assert.ok(centers.every(([x]) => x === 80));
  }
});

test('藤缚跨轮重叠按所有存续藤蔓增伤，保持半秒间隔且过期后恢复单藤伤害', () => {
  for (const hz of [20, 30, 60]) for (const [first, second, overlap] of [[9, 9, 11.25], [9, 24, 26.25], [24, 9, 26.25]]) {
    const s = scene([mob(1, 40, 0)]);
    const st = SKILLS.tengfu.stats(1);
    s.system.fire('tengfu', { ...st, dmg: first });
    for (let frame = 1; frame <= 3.6 * hz; frame++) {
      s.g.now = frame / hz;
      if (frame === Math.round(st.cd * hz)) s.system.fire('tengfu', { ...st, dmg: second });
      s.system.updateVines(1 / hz);
    }
    const overlapped = s.hits.filter(h => h.time > 2.4 && h.time < 3);
    assert.ok(overlapped.length > 0);
    assert.ok(overlapped.every(h => h.dmg === overlap), `fps=${hz}, damage=${first}/${second}`);
    assert.equal(s.hits.at(-1).dmg, second, '旧藤过期后不再贡献伤害');
    for (let i = 1; i < s.hits.length; i++) assert.ok(s.hits[i].time - s.hits[i - 1].time >= 0.5 - 1e-9);
  }
});

test('单片藤蔓在不同战斗时刻与帧率下都完整结算六跳，不被浮点误差误认为重叠命中', () => {
  for (const hz of [20, 30, 60]) for (const start of [0, 5.7, 300]) {
    const s = scene([mob(1, 40, 0)]);
    s.g.now = start;
    s.system.fire('tengfu', SKILLS.tengfu.stats(1));
    for (let i = 0; i < 3 * hz; i++) { s.g.now += 1 / hz; s.system.updateVines(1 / hz); }
    assert.equal(s.hits.length, 6, `fps=${hz} start=${start}`);
  }
});

test('完整角色成长与心法的通用冷却最多缩短75%，普通构筑保留原收益', () => {
  for (const char of CHARACTERS) {
    const b = new Build(char, LEVELS[0]);
    assert.equal(b.stats().cdMult, 1 - (char.cdr ?? 0));
    b.level = 200; b.mods.cd = 0.6; b.passives.set('ningshen', 5);
    assert.ok(b.stats().cdMult >= 0.25);
  }
});

test('火球覆盖大于火符，藤缚保留有限持续区域；所有技能等级数值有限且大招约束保留', () => {
  for (let lv = 1; lv <= 8; lv++) {
    assert.ok(SKILLS.fireball.stats(lv).radius >= SKILLS.talisman.stats(lv).radius * 1.4);
    assert.ok(SKILLS.fireball.stats(lv).cd > SKILLS.talisman.stats(lv).cd);
    assert.ok(SKILLS.tengfu.stats(lv).radius < SKILLS.hanbing.stats(lv).radius);
  }
  for (const def of Object.values(SKILLS)) {
    for (let lv = 1; lv <= def.maxLv; lv++) assert.ok(Object.values(def.stats(lv)).every(Number.isFinite), def.id);
    if (def.ultimate) { assert.equal(def.maxLv, 1); assert.equal(def.stats(1).cd, 15); }
  }
});

test('十技能构筑适配：核心数量质变在 Lv3–5 提前成型，宝箱在主动术全满后继续升心法', () => {
  assert.equal(SKILLS.slash.stats(3).back, 1);
  assert.equal(SKILLS.talisman.stats(3).count, 2);
  assert.equal(SKILLS.fireball.stats(3).count, 2);
  assert.equal(SKILLS.leaf.stats(3).count, 2);
  assert.equal(SKILLS.luoshi.stats(4).count, 2);
  assert.equal(SKILLS.luoshi.stats(8).count, 3);
  assert.equal(SKILLS.waterdragon.stats(5).count, 2);
  assert.deepEqual([1, 3, 5, 8].map(lv => SKILLS.crossbow.stats(lv).pierce), [2, 3, 4, 6]);

  const b = new Build(CHARACTERS[0], LEVELS[0], { shuhai: 5 });
  b.skills.set('slash', 8);
  b.passives.set('ruijin', 4);
  const up = b.chestUpgrade();
  assert.deepEqual(up, { id: 'ruijin', lv: 5 });
  assert.equal(b.chestUpgrade(), null);
});
