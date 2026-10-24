import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'phaser') return { url: 'data:text/javascript,export default {}', shortCircuit: true };
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

function scene(angle = 0, area = 1) {
  const tasks = [], cracks = [], spikes = [], hits = [], enemies = [];
  let time = 0;
  const g = {
    player: { x: 100, y: 100, facing: { x: Math.cos(angle), y: Math.sin(angle) }, attack() {} },
    pstats: { area },
    enemies: { inRadius: (x, y, r) => enemies.filter(e => e.alive && Math.hypot(e.x - x, e.y - y) <= r + e.radius) },
    later: (delay, fn) => tasks.push({ delay, fn }),
    fx: {
      crack: (...args) => cracks.push({ args, time }),
      anim: (...args) => spikes.push({ args, time }),
      burst() {},
    },
    hitEnemy(e, dmg, el, options) {
      if (e.invulnerable) return 0;
      hits.push({ id: e.id, dmg, el, options, time });
      return dmg;
    },
  };
  const run = task => { time = task.delay; task.fn(); };
  return { g, system: new SkillSystem(g), tasks, cracks, spikes, hits, enemies, run,
    flush() { for (const task of tasks.sort((a, b) => a.delay - b.delay).splice(0)) run(task); } };
}
const mob = (id, x, y) => ({ id, x, y, radius: 3, alive: true });

for (let direction = 0; direction < 8; direction++) {
  test(`地脉刺 ${direction * 45}°：锁定朝向，从近到远延伸，范围加成同步放大`, () => {
    const angle = direction * Math.PI / 4, fx = Math.cos(angle), fy = Math.sin(angle);
    const s = scene(angle, 1.5), st = SKILLS.stonespike.stats(8);
    assert.equal(s.system.fire('stonespike', st), true, '无敌人也能向面朝方向施放');
    Object.assign(s.g.player, { x: 900, y: 900, facing: { x: -fx, y: -fy } });
    s.flush();
    const rows = Map.groupBy(s.spikes, spike => spike.time);
    assert.equal(rows.size, st.count);
    let i = 0;
    for (const [time, row] of rows) {
      const reach = (12 + (st.range - 12) * i / (st.count - 1)) * 1.5;
      const halfWidth = (reach - 12 * 1.5) * Math.tan(st.arc * Math.PI / 360);
      const sides = [];
      for (const { args: [key, x, y, options] } of row) {
        const dx = x - 100, dy = y - 102;
        assert.equal(key, 'fx_earth_ridge');
        assert.ok(Math.abs(dx * fx + dy * fy - reach) < 1e-9);
        const side = -dx * fy + dy * fx;
        assert.ok(Math.abs(side) <= halfWidth + 1e-9);
        sides.push(side);
        assert.equal(options.scale, 1.5);
        const crack = s.cracks.find(c => Math.abs(c.args[0] - x) < 1e-9 && Math.abs(c.args[1] - (y - 2)) < 1e-9);
        assert.ok(crack);
        assert.ok(Math.abs(time - crack.time - 0.12) < 1e-9);
      }
      assert.ok(Math.abs(sides.reduce((a, b) => a + b, 0)) < 1e-9, '左右对称');
      if (i === st.count - 1) {
        assert.ok(Math.abs(Math.max(...sides) - halfWidth) < 1e-9);
        assert.ok(Math.abs(Math.min(...sides) + halfWidth) < 1e-9);
      }
      i++;
    }
  });
}

test('重叠岩刺每轮只命中一次，路径外不受伤，击退严格沿施放方向', () => {
  const s = scene(), st = SKILLS.stonespike.stats(1);
  s.enemies.push(mob(1, 140, 104), mob(2, 140, 135), mob(3, 60, 100));
  s.system.fire('stonespike', st);
  assert.equal(s.hits.length, 0);
  s.flush();
  assert.equal(s.hits.length, 1);
  const hit = s.hits[0];
  assert.equal(hit.id, 1);
  assert.equal(hit.dmg, st.dmg);
  assert.equal(hit.el, 'earth');
  assert.equal(hit.options.daze, undefined);
  assert.equal(hit.options.stun, undefined);
  assert.equal(hit.options.proc, undefined, '地脉刺本身不触发震慑');
  assert.equal(hit.options.fromX, 130);
  assert.equal(hit.options.fromY, 104);
  assert.equal(hit.options.kb, st.kb);
  s.system.fire('stonespike', st);
  s.flush();
  assert.equal(s.hits.length, 2, '下一轮可以再次伤害和击退');
});

test('对象池换成新敌人仍可命中；无敌时未造成伤害不消耗整轮命中机会', () => {
  const s = scene(), st = SKILLS.stonespike.stats(1);
  const e = mob(1, 122, 100);
  s.enemies.push(e);
  s.system.fire('stonespike', st);
  const tasks = s.tasks.sort((a, b) => a.delay - b.delay);
  e.invulnerable = true;
  while (tasks[0]?.delay <= 0.12) s.run(tasks.shift());
  assert.equal(s.hits.length, 0);
  e.invulnerable = false;
  while (tasks[0]?.delay <= 0.18) s.run(tasks.shift());
  assert.equal(s.hits.length, 1);
  e.id = 2; e.x = 175;
  for (const task of tasks) s.run(task);
  assert.deepEqual(s.hits.map(h => h.id), [1, 2]);
});

test('升级逐步扩展路径和推力，伤害冷却保留；岩刺落点之间没有中心线空隙', () => {
  const levels = Array.from({ length: 8 }, (_, i) => SKILLS.stonespike.stats(i + 1));
  assert.equal(SKILLS.stonespike.name, '地脉刺');
  for (let i = 0; i < levels.length; i++) {
    const st = levels[i];
    assert.ok((st.range - 12) / (st.count - 1) <= st.radius * 2);
    assert.equal(st.stun, undefined);
    if (!i) continue;
    assert.ok(st.range >= levels[i - 1].range);
    assert.ok(st.kb >= levels[i - 1].kb);
    assert.ok(st.arc > levels[i - 1].arc);
    assert.ok(st.cd <= levels[i - 1].cd);
  }
  assert.equal(levels[0].dmg, 20);
  assert.equal(levels[7].dmg, 40);
});

for (let direction = 0; direction < 8; direction++) {
  test(`锥形 ${direction * 45}°：各级两侧边界与范围加成准确，内部无空隙，同轮只推一次`, () => {
    const angle = direction * Math.PI / 4, fx = Math.cos(angle), fy = Math.sin(angle);
    for (const lv of [1, 2, 4, 6, 8]) for (const area of [1, 1.6]) {
      const s = scene(angle, area), st = SKILLS.stonespike.stats(lv);
      const reach = st.range * area;
      const halfWidth = (st.range - 12) * area * Math.tan(st.arc * Math.PI / 360);
      const boundary = halfWidth + st.radius * area + 3;
      const at = (id, along, across) => mob(id, 100 + fx * along - fy * across, 100 + fy * along + fx * across);
      s.enemies.push(at(1, reach, boundary - 0.1), at(2, reach, -boundary + 0.1),
        at(3, reach, boundary + 0.1), at(4, reach, -boundary - 0.1), at(5, -50, 0));
      // 在每一排的中心与两侧填入真实敌人尺寸的探针，检查大片锥形内部。
      for (let row = 0; row < st.count; row++) {
        const along = (12 + (st.range - 12) * row / (st.count - 1)) * area;
        const half = (along - 12 * area) * Math.tan(st.arc * Math.PI / 360);
        for (let j = -2; j <= 2; j++) s.enemies.push(at(10 + row * 5 + j + 2, along, half * j / 2));
      }
      s.system.fire('stonespike', st);
      s.flush();
      const ids = s.hits.map(h => h.id);
      assert.ok(ids.includes(1) && ids.includes(2), `Lv${lv} area${area} 丢失边缘目标`);
      assert.ok(!ids.includes(3) && !ids.includes(4) && !ids.includes(5));
      assert.equal(ids.length, st.count * 5 + 2);
      assert.equal(new Set(ids).size, ids.length);
      for (const h of s.hits) {
        const e = s.enemies.find(e => e.id === h.id);
        assert.ok(Math.abs(e.x - h.options.fromX - fx * 10) < 1e-9);
        assert.ok(Math.abs(e.y - h.options.fromY - fy * 10) < 1e-9);
      }
    }
  });
}
