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

function scene(mods = {}) {
  const tasks = [], waves = [], hits = [], slashes = [];
  const front = { x: 30, y: -2 }, back = { x: -30, y: -2 };
  const g = {
    player: { x: 0, y: 0, moving: true, facing: { x: 1, y: 0 }, attack() {} },
    pstats: { area: 1 }, build: { mods },
    enemies: { inRadius: () => [front, back] },
    later: (delay, fn) => tasks.push({ delay, fn }),
    proj: { fire: (...args) => waves.push(args) },
    fx: { anim: (...args) => slashes.push(args) },
    hitEnemy: (enemy, dmg) => hits.push({ enemy, dmg }),
  };
  return { g, system: new SkillSystem(g), tasks, waves, hits, slashes, front, back };
}

for (let lv = 1; lv <= 8; lv++) {
  test(`剑气斩 Lv${lv}：3 级起前后斩击与双向剑波`, () => {
    const s = scene(), st = SKILLS.slash.stats(lv);
    s.system.fire('slash', st);
    assert.deepEqual(s.hits.map(h => h.enemy), [s.front]);
    assert.equal(s.waves.length, lv >= 3 ? 1 : 0);
    assert.equal(s.tasks.length, lv >= 3 ? 1 : 0);
    if (lv < 3) return;
    assert.equal(s.tasks[0].delay, 0.12);
    // 后斩仍沿本轮的相反方向，起点跟随角色，与近战后斩一致。
    s.g.player.facing = { x: 0, y: 1 };
    s.g.player.x = 2;
    s.tasks[0].fn();
    assert.deepEqual(s.hits.map(h => h.enemy), [s.front, s.back]);
    assert.equal(s.slashes.length, 2);
    assert.equal(s.waves.length, 2);
    assert.equal(s.waves[0][4], 210);
    assert.equal(s.waves[1][4], -210);
    assert.equal(s.waves[1][2], s.g.player.x);
    for (const wave of s.waves) {
      assert.ok(Math.abs(wave[5]) < 1e-9);
      assert.equal(wave[6].dmg, st.dmg * 0.8);
      assert.equal(wave[6].el, 'metal');
      assert.equal(wave[6].proc, SKILLS.slash.proc);
    }
  });
}

test('连斩传承每三斩生效：3 级前追加波，3 级后强化双向波且不增加弹数', () => {
  for (const lv of [2, 3, 8]) {
    const s = scene({ 'xiao.chain': 1 });
    for (let n = 0; n < 3; n++) s.system.fire('slash', SKILLS.slash.stats(lv));
    for (const task of s.tasks) task.fn();
    assert.equal(s.waves.length, lv === 2 ? 1 : 6);
    assert.equal(s.waves[0][6].dmg, SKILLS.slash.stats(lv).dmg * (lv === 2 ? 0.6 : 0.8));
    if (lv >= 3) {
      // 前三条是即时前波，后三条是延迟后波；只有第三轮得到强化。
      for (const i of [2, 5]) assert.ok(Math.abs(s.waves[i][6].dmg / SKILLS.slash.stats(lv).dmg - 1.4) < 1e-9);
      for (const i of [0, 1, 3, 4]) assert.equal(s.waves[i][6].dmg, SKILLS.slash.stats(lv).dmg * 0.8);
    }
  }
});

test('3 级专注形态解锁，4—8 级继续强化，满级数值保持', () => {
  const levels = Array.from({ length: 8 }, (_, i) => SKILLS.slash.stats(i + 1));
  assert.equal(levels[2].range, levels[1].range);
  assert.ok(levels[3].range > levels[2].range);
  for (let i = 1; i < levels.length; i++) {
    assert.ok(levels[i].dmg >= levels[i - 1].dmg);
    assert.ok(levels[i].range >= levels[i - 1].range);
    assert.ok(levels[i].cd <= levels[i - 1].cd);
  }
  assert.deepEqual(levels[7], { dmg: 44, range: 84, cd: 0.72, arc: 160, back: 1 });
});
