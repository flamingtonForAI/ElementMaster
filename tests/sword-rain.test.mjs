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

function scene(fx = 1, fy = 0, area = 1) {
  const tasks = [], images = [], tweens = [], hits = [], enemies = [];
  const g = {
    player: { x: 100, y: 100, facing: { x: fx, y: fy }, attack() {} },
    pstats: { area },
    // 没有任何选敌接口：剑雨必须在无敌人时也能施放。
    enemies: { inRadius: (x, y, r) => enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= r) },
    later: (delay, fn) => tasks.push({ delay, fn }),
    add: { image(x, y, texture) {
      const image = { x, y, texture, destroyed: false,
        setOrigin() { return this; }, setDepth() { return this; },
        setRotation(rotation) { this.rotation = rotation; return this; },
        destroy() { this.destroyed = true; },
      };
      images.push(image);
      return image;
    } },
    tweens: { add: tween => tweens.push(tween) },
    fx: { burst() {} },
    hitEnemy: (enemy, dmg, el, options) => hits.push({ enemy, dmg, el, options }),
  };
  return { g, system: new SkillSystem(g), tasks, images, tweens, hits, enemies };
}

for (let direction = 0; direction < 8; direction++) {
  test(`剑雨朝向 ${direction * 45}°：落点全在前方，施放后不跟随移动或转身`, () => {
    const ang = direction * Math.PI / 4, fx = Math.cos(ang), fy = Math.sin(ang);
    const s = scene(fx, fy);
    const st = SKILLS.jinzhen.stats(1);
    assert.equal(s.system.fire('jinzhen', st), true);
    assert.equal(s.tasks.length, st.count);
    Object.assign(s.g.player, { x: 1000, y: 1000, facing: { x: -fx, y: -fy } });
    for (const task of s.tasks) task.fn();
    for (const t of s.tweens) {
      const along = (t.x - 100) * fx + (t.y - 100) * fy;
      const across = -(t.x - 100) * fy + (t.y - 100) * fx;
      assert.ok(along > 0);
      assert.ok(((along - st.range) / st.spread) ** 2 + (across / (st.spread * 0.6)) ** 2 <= 1.000001);
      // 45°：水平前进 80，落高 80；纵深在屏幕上压到 0.6。
      assert.ok(Math.abs(t.x - t.targets.x - fx * 80) < 1e-9);
      assert.ok(Math.abs(t.y - t.targets.y - (80 + fy * 80 * 0.6)) < 1e-9);
      assert.equal(t.targets.texture, 'pj_sword');
      assert.ok(Math.abs(t.targets.rotation - Math.atan2(t.y - t.targets.y, t.x - t.targets.x)) < 1e-9);
    }
  });
}

test('落剑只在落地时命中当前落点的敌人，保留金系伤害与流血几率', () => {
  const s = scene();
  const st = SKILLS.jinzhen.stats(1);
  s.system.fire('jinzhen', st);
  s.tasks[0].fn();
  const t = s.tweens[0];
  const inside = { x: t.x + st.radius - 0.1, y: t.y };
  s.enemies.push(inside, { x: t.x + st.radius + 0.1, y: t.y });
  assert.equal(s.hits.length, 0);
  t.onComplete();
  assert.equal(s.hits.length, 1);
  assert.equal(s.hits[0].enemy, inside);
  assert.equal(s.hits[0].dmg, st.dmg);
  assert.equal(s.hits[0].el, 'metal');
  assert.equal(s.hits[0].options.proc, SKILLS.jinzhen.proc);
  assert.equal(t.targets.destroyed, true);
});

test('满级第二片向前延伸，范围加成同时扩大落区和命中范围', () => {
  const st = SKILLS.jinzhen.stats(8);
  const s = scene(1, 0, 1.4);
  const drops = [];
  s.system.rainSword = (...args) => drops.push(args);
  s.system.fire('jinzhen', st);
  assert.equal(drops.length, st.count * 2);
  assert.ok(st.spread > 36);
  assert.ok(st.radius > 11);
  for (let zone = 0; zone < 2; zone++) {
    const center = 100 + (st.range + zone * st.spread * 1.3) * 1.4;
    for (const [x, y, , , radius] of drops.slice(zone * st.count, (zone + 1) * st.count)) {
      assert.ok(((x - center) / (st.spread * 1.4)) ** 2 + ((y - 100) / (st.spread * 1.4 * 0.6)) ** 2 <= 1.000001);
      assert.equal(radius, st.radius * 1.4);
    }
  }
});
