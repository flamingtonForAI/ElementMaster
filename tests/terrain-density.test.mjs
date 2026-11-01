import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'phaser') return { url: 'data:text/javascript,export default { Scene: class {} }', shortCircuit: true };
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform', sourceUrl: url }), shortCircuit: true };
    return next(url, context);
  },
});

const { LEVELS } = await import('../src/config/levels.ts');
const { spotAt } = await import('../src/game/terrain.ts');
const { World } = await import('../src/game/World.ts');

// 固定点位必须在出生附近可见，开局脚下仍有安全区；地图和判定共用这些点位。
test('各关固定地形出现在视野与移动路线附近，安全出生且相位正常', () => {
  const kinds = [['lava', 'lava', 1], ['swordZones', 'zone', 2], ['mud', 'mud', 3], ['ice', 'ice', 4], ['quicksand', 'sand', 5]];
  for (const level of LEVELS) for (const [key, kind, salt] of kinds) {
    const def = level[key];
    if (!def) continue;
    const world = Object.assign(Object.create(World.prototype), { level, half: level.size / 2, spotCache: new Map(), phase: def.phase ?? null });
    const points = world.spotsIn(kind, -600, -600, 600, 600);
    const nearby = points.filter(([x, y]) => Math.hypot(x, y) < 600);
    assert.ok(nearby.length >= 5, `${level.id} ${key}: 出生附近只有 ${nearby.length} 个`);
    assert.ok(points.some(([x, y]) => Math.abs(x) < 320 && Math.abs(y) < 180), `${level.id} ${key}: 开局视野没有地形`);
    assert.ok(points.every(([x, y]) => Math.hypot(x, y) >= 110 + def.radius));
    for (const [x, y] of nearby) {
      assert.deepEqual(spotAt(Math.floor(x / def.cell), Math.floor(y / def.cell), level.id, salt, def, level.size / 2, level.ridges), [x, y]);
    }
    const [x, y] = nearby[0];
    const at = key === 'mud' ? () => world.inMud(x, y) : key === 'ice' ? () => world.onIce(x, y)
      : key === 'quicksand' ? () => world.sandAt(x, y) : key === 'swordZones' ? () => world.zoneArmor(x, y) : null;
    if (at) {
      assert.ok(at(), `${level.id} ${key}: 地形中心应生效`);
      if (def.phase) { world.phase = 'earth'; assert.ok(!at(), `${level.id} ${key}: 非当令相不应生效`); }
    }
  }
});

test('火口远离玩家时地裂预警，毒瘴从身前缓慢扩散，非当令相不触发', async () => {
  const { Hazards } = await import('../src/game/Hazards.ts');
  const lava = LEVELS[3].lava;
  const fog = LEVELS[5].miasma;
  const blasts = [], cracks = [], clouds = [];
  const g = {
    levelDef: { duration: 600, lava, miasma: fog }, elapsed: 30, now: 30, over: false,
    player: { x: 0, y: 0, moving: false, facing: { x: 1, y: 0 } }, pstats: { speed: 60 },
    world: { spotsIn: kind => kind === 'lava' ? [[250, 0]] : [], clampPt: (x, y) => [x, y] },
    fx: { crack: (...args) => cracks.push(args) }, hud: { toast() {} },
  };
  const hz = new Hazards(g);
  hz.blast = (...args) => blasts.push(args);
  hz.miasmaAt = (...args) => clouds.push(args);
  hz.updateLava();
  assert.deepEqual(blasts, [[0, 0, lava.radius, lava.warn, lava.dmg, lava.burn]]);
  assert.deepEqual(cracks, [[0, 0, lava.warn]]);
  hz.updateMiasma();
  assert.deepEqual(clouds, [[55, 0, fog.radius, fog.grow, fog.life]]);
  assert.ok(clouds[0][0] > 4 && fog.grow > 0, '初始雾团不应立刻盖住玩家');

  const phaseGame = { ...g, levelDef: { ...g.levelDef, lava: { ...lava, phase: 'fire' }, miasma: { ...fog, phase: 'wood' } } };
  const phased = new Hazards(phaseGame);
  phased.phaseEl = 'water';
  phased.blast = () => assert.fail('非火相不应喷发');
  phased.miasmaAt = () => assert.fail('非木相不应冒雾');
  phased.updateLava();
  phased.updateMiasma();
});

test('相位地形及附属物同步淡化，当令地面盖在非当令地面上', () => {
  const world = Object.assign(Object.create(World.prototype), { phased: [], phase: 'wood' });
  const image = () => ({ active: true, alpha: 0, depth: 0, setAlpha(a) { this.alpha = a; return this; }, setDepth(d) { this.depth = d; return this; } });
  const mud = image(), ice = image(), sword = image();
  world.markPhase(mud, { phase: 'wood' }, true);
  world.markPhase(ice, { phase: 'water' }, true);
  world.markPhase(sword, { phase: 'metal' });
  assert.ok(mud.alpha > ice.alpha && mud.depth > ice.depth);
  assert.equal(sword.alpha, ice.alpha);
  world.setPhase('water');
  assert.ok(ice.alpha > mud.alpha && ice.depth > mud.depth);
  world.setPhase('metal');
  assert.equal(sword.alpha, 1);
  assert.equal(ice.alpha, 0.2);
});
