import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'phaser') return { url: 'data:text/javascript,export default { Math: { Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) } }', shortCircuit: true };
    if (specifier === '../audio/Audio') return { url: 'data:text/javascript,export const audio = { sfx() {} }', shortCircuit: true };
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return {
      format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }), shortCircuit: true,
    };
    return nextLoad(url, context);
  },
});

const { SkillSystem } = await import('../src/game/Skills.ts');
const { SKILLS } = await import('../src/config/skills.ts');
const mob = (id, x, y) => ({ id, x, y, radius: 3, alive: true });

function scene(area = 1, mods = {}) {
  const enemies = [], tasks = [], bolts = [], hits = [], slows = [], rings = [];
  const nearby = (x, y, r) => enemies.filter(e => e.alive && Math.hypot(e.x - x, e.y - y) <= r)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const g = {
    player: { x: 0, y: 0, facing: { x: 1, y: 0 }, attack() {} },
    pstats: { area, sigDmg: 1.4 }, build: { mods },
    enemies: {
      nearest: (x, y, r) => nearby(x, y, r)[0] ?? null,
      nearestN: (x, y, r, n) => nearby(x, y, r).slice(0, n),
      inRadius: (x, y, r) => enemies.filter(e => e.alive && Math.hypot(e.x - x, e.y - y) <= r + e.radius),
    },
    later: (delay, fn) => tasks.push({ delay, fn }),
    proj: { fire: (kind, tex, x, y, vx, vy, options) => bolts.push({ x, y, vx, vy, options }) },
    fx: { ring: (...args) => rings.push(args) },
    hitEnemy: (e, dmg, el, options) => hits.push({ id: e.id, dmg, el, options }),
    slowEnemy: (e, dur) => slows.push({ id: e.id, dur }),
  };
  return { g, enemies, tasks, bolts, hits, slows, rings, system: new SkillSystem(g),
    flush() { for (const t of tasks.splice(0)) t.fn(); } };
}

test('逐级覆盖成长；单靶直击输出、箭数及贯穿保留', () => {
  for (let lv = 1; lv <= 8; lv++) {
    const s = scene(), st = SKILLS.crossbow.stats(lv), boss = mob(1, 180, -2);
    s.enemies.push(boss);
    s.system.fire('crossbow', st); s.flush();
    assert.equal(s.bolts.length, lv < 4 ? 3 : lv < 7 ? 4 : 5);
    for (const b of s.bolts) {
      assert.ok(Math.abs(Math.atan2(b.vy, b.vx)) <= 0.03);
      assert.equal(b.options.dmg, st.dmg);
      assert.equal(b.options.pierce, st.pierce);
      assert.equal(b.options.dmgAt(boss), 1.2);
      b.options.onHit?.(boss);
    }
    assert.equal(s.hits.length, 0, '孤立 Boss 不吃自身溅射');
    assert.equal(s.slows.length, lv === 8 ? st.shots : 0);
    assert.equal(s.rings.length, lv >= 3 ? st.shots : 0);
  }
});

test('5级起轮射三个方向；仅一个敌人时仍全部集火', () => {
  for (const lv of [4, 5, 8]) {
    const s = scene();
    s.enemies.push(mob(1, 70, -2), mob(2, 0, 100), mob(3, -130, -2));
    s.system.fire('crossbow', SKILLS.crossbow.stats(lv)); s.flush();
    const directions = s.bolts.map(b => Math.abs(b.vx) > Math.abs(b.vy) ? Math.sign(b.vx) : 2);
    assert.deepEqual(directions, lv === 4 ? [1, 1, 1, 1] : lv === 5 ? [1, 2, -1, 1] : [1, 2, -1, 1, 2]);
  }
});

test('连射中目标死亡、移出射程或被对象池复用，均重新选取有效目标', () => {
  for (const lv of [1, 5]) {
    const s = scene(), old = mob(1, 60, -2), next = mob(2, 0, 100);
    s.enemies.push(old, next);
    s.system.fire('crossbow', SKILLS.crossbow.stats(lv));
    s.tasks.shift().fn();
    Object.assign(old, { id: 9, x: 999 });
    s.tasks.shift().fn();
    assert.ok(s.bolts[1].vy > Math.abs(s.bolts[1].vx));
    old.alive = next.alive = false;
    s.flush();
    assert.ok(s.bolts.every(b => Number.isFinite(b.vx) && Number.isFinite(b.vy)));
    assert.equal(s.system.fire('crossbow', SKILLS.crossbow.stats(lv)), false);
  }
});

test('水花范围和显示同乘柔水；每支箭对同一敌人仅溅射一次，各箭独立', () => {
  const s = scene(1.5), st = SKILLS.crossbow.stats(8);
  const a = mob(1, 70, -2), b = mob(2, 90, -2), wing = mob(3, 80, 45), outside = mob(4, 80, 85);
  s.enemies.push(a, b, wing, outside);
  s.system.fire('crossbow', st); s.flush();
  s.bolts[0].options.onHit(a);
  s.bolts[0].options.onHit(b);
  assert.equal(s.hits.filter(h => h.id === wing.id).length, 1);
  assert.equal(s.hits.filter(h => h.id === outside.id).length, 0);
  assert.ok(s.hits.every(h => h.dmg === st.dmg * 0.45 && h.options.noCrit && !h.options.proc));
  assert.ok(s.rings.every(r => r[2] === 36 * 1.5));
  s.bolts[1].options.onHit(a);
  assert.equal(s.hits.filter(h => h.id === wing.id).length, 2);
  wing.id = 10;
  s.bolts[0].options.onHit(a);
  assert.equal(s.hits.filter(h => h.id === 10).length, 1, '去重按敌人 id，兼容对象池');
});

test('中期水花覆盖逐渐增加，成长伤害与远扬、分水传承兼容', () => {
  for (const lv of [3, 5, 7, 8]) {
    const s = scene(1, { 'ruan.range': 0.3, 'ruan.pierce': 2 });
    const target = mob(1, 300, -2);
    s.enemies.push(target, mob(2, 300, 22), mob(3, 300, 32));
    const st = s.system.stats('crossbow', lv);
    s.system.fire('crossbow', st); s.flush();
    const b = s.bolts[0];
    assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 416) < 1e-9);
    assert.equal(b.options.pierce, st.pierce + 2);
    b.options.onHit(target);
    assert.equal(s.hits.length, lv < 7 ? 1 : 2);
    assert.equal(s.hits[0].dmg, SKILLS.crossbow.stats(lv).dmg * 1.4 * st.splash);
    assert.equal(s.slows.length, lv < 8 ? 0 : 3);
  }
});

test('近身密集敌群下连续贯敌同样递进触发贯潮满额增伤，各箭计数独立', () => {
  const s = scene(), st = SKILLS.crossbow.stats(8);
  const closePack = [mob(1, 25, -2), mob(2, 35, -2), mob(3, 45, -2), mob(4, 55, -2)];
  s.enemies.push(...closePack);
  s.system.fire('crossbow', st); s.flush();
  const b0 = s.bolts[0], b1 = s.bolts[1];
  assert.deepEqual(closePack.map(e => b0.options.dmgAt(e)), [1, 1.1, 1.2, 1.2]);
  assert.equal(b1.options.dmgAt(closePack[0]), 1, '另一支箭独立计算贯敌层数');
});
