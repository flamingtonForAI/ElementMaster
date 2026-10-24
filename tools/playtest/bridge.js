import { SKILLS, PASSIVES } from '/src/config/skills.ts';
import { REL_MULT, relation } from '/src/config/elements.ts';
import { spendProgression } from './progression.js';
import { loadSave, writeSave } from '/src/game/save.ts';
import { audio } from '/src/audio/Audio.ts';

export const DIRECTIONS = {
  UP: [0, -1], UP_RIGHT: [1, -1], RIGHT: [1, 0], DOWN_RIGHT: [1, 1],
  DOWN: [0, 1], DOWN_LEFT: [-1, 1], LEFT: [-1, 0], UP_LEFT: [-1, -1], STAY: [0, 0],
};

export function install(seed = 20261022, profile = null) {
  if (!import.meta.env.DEV || !new URLSearchParams(location.search).has('playtest')) throw Error('Dev playtest only');
  const game = window.game;
  game.loop.stop();
  // A fresh browser context owns localStorage. Never clear or borrow a real player profile.
  if (localStorage.length) throw Error('Expected an isolated empty browser profile');
  const events = [];
  let randomState = seed >>> 0;
  const random = () => {
    randomState += 0x6D2B79F5;
    let n = randomState;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const nativeRandom = Math.random;
  Math.random = random;
  // Restart after assets load, with the seed in place and no game time advanced.
  game.scene.stop('hud');
  game.scene.stop('game');
  let growthLedger = [];
  if (profile?.save) {
    if (profile.level > profile.save.unlocked) throw Error('Progression has not unlocked this level');
    const save = structuredClone(profile.save);
    if (profile.spend) growthLedger = spendProgression(save, profile.character);
    writeSave(save);
  } else if (profile?.skills) {
    const save = loadSave();
    save.meta = profile.meta;
    save.unlocked = profile.level;
    writeSave(save);
  } else if (profile?.spend) {
    const save = loadSave();
    growthLedger = spendProgression(save, profile.character);
    writeSave(save);
  }
  game.scene.start('game', { level: profile?.level ?? 1, char: profile?.character ?? 'xiao' });
  const g = game.scene.getScene('game');
  const hud = game.scene.getScene('hud');
  // Phaser 3.90 的 TweenManager 默认读 Date.now，不使用 game.step 的 delta。
  // 仅在隔离试玩里接入同一帧时钟，避免 API 等待改变落石、剑雨的伤害时机。
  let frameDelta = 0;
  for (const scene of [g, hud]) scene.tweens.getDelta = () => frameDelta;
  if (profile?.skills) {
    g.build.level = profile.buildLevel;
    g.build.skills = new Map(Object.entries(profile.skills));
    g.build.passives = new Map(Object.entries(profile.passives).filter(([, lv]) => lv > 0));
    g.build.recompute();
    g.pstats = g.build.stats();
    g.player.hp = g.pstats.maxHp;
    if (profile.lockXp) g.gainXp = () => {};
  }
  const metrics = { hpDamage: 0, damageHits: 0, regenRequested: 0, regenEffective: 0,
    consumableHealing: 0, chestHealing: 0, minimumHp: g.player.hp, minimumHpFraction: 1, secondsBelowHalf: 0, secondsFull: 0,
    blockedAttackAttempts: 0, puppetDamage: 0, puppetHits: 0, puppetBreaks: 0,
    secondsWithoutPuppets: 0, maxHpGains: 0 };
  let clock = game.loop.now;
  let source = null;
  let result = null;
  let lastMinute = -1;
  const born = new Map();
  const emit = (type, data = {}) => events.push({ type, time: +g.elapsed.toFixed(3), ...data });
  const wrap = (object, key, fn) => {
    const original = object[key].bind(object);
    object[key] = (...args) => fn(original, ...args);
  };
  // Cosmetic effects use an independent stream; combat still uses the original game code.
  for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(g.fx))) {
    if (key === 'constructor' || typeof g.fx[key] !== 'function') continue;
    wrap(g.fx, key, (original, ...args) => {
      const saved = Math.random;
      Math.random = nativeRandom;
      try { return original(...args); } finally { Math.random = saved; }
    });
  }
  audio.stopMusic(0);
  audio.music = () => {};
  audio.sfx = () => false;
  wrap(g.puppets, 'hurt', (original, puppet, ...args) => {
    const before = puppet.hp;
    const value = original(puppet, ...args);
    metrics.puppetDamage += Math.min(before, Math.max(0, before-puppet.hp));
    metrics.puppetHits++;
    return value;
  });
  wrap(g.puppets, 'remove', (original, puppet, broken) => {
    if (broken) { metrics.puppetBreaks++; emit('puppet_break', { giant: puppet.giant, x: puppet.x, y: puppet.y }); }
    return original(puppet, broken);
  });
  wrap(g.hazards, 'drop', (original, ...args) => {
    const previous = source;
    source = { enemy: 'environment', attack: 'falling_rock' };
    try { return original(...args); } finally { source = previous; }
  });
  wrap(g.enemies, 'hurtOf', (original, enemy, ...args) => ({
    ...original(enemy, ...args), playtestSource: { enemy: enemy.def.id, id: enemy.id,
      attack: g.enemies.dashing(enemy) ? 'dash' : enemy.def.behavior === 'explode' ? 'explosion' : 'contact_or_attack' },
  }));
  wrap(g, 'later', (original, seconds, fn) => {
    const scheduledSource = source;
    return original(seconds, () => {
      const previous = source;
      source = scheduledSource;
      try { return fn(); } finally { source = previous; }
    });
  });
  wrap(g, 'hurtPlayer', (original, base, element, options = {}) => {
    const blocked = g.now < g.iframeUntil;
    if (blocked && !g.over) metrics.blockedAttackAttempts++;
    const previous = source;
    source = { ...(options.playtestSource ?? source ?? { enemy: 'unknown', attack: 'unattributed' }), element, base };
    try { return original(base, element, options); } finally { source = previous; }
  });
  wrap(g, 'loseHp', (original, damage) => {
    const hp = g.player.hp;
    const shield = g.shield;
    const attribution = source ?? { enemy: 'unknown', attack: 'status_or_environment',
      statuses: { poison: g.status.poisoned, burn: g.status.burning, bleed: g.status.bleeding } };
    const actual = Math.min(hp, Math.max(0, damage - shield));
    metrics.hpDamage += actual;
    metrics.damageHits++;
    metrics.minimumHp = Math.min(metrics.minimumHp, Math.max(0, hp - actual));
    metrics.minimumHpFraction = Math.min(metrics.minimumHpFraction, Math.max(0,hp-actual)/g.pstats.maxHp);
    emit('damage', { ...attribution, requested: damage, hpDamage: actual,
      shieldDamage: Math.min(shield, damage), hpBefore: hp, hpAfter: Math.max(0, hp - actual) });
    return original(damage);
  });
  wrap(g.enemies, 'spawn', (original, ...args) => {
    const enemy = original(...args);
    born.set(enemy.id, { time: g.elapsed, firstHit: null });
    emit('spawn', { id: enemy.id, enemy: enemy.def.id, elite: enemy.elite, boss: enemy.boss, hp: enemy.hp });
    return enemy;
  });
  wrap(g, 'hitEnemy', (original, enemy, ...args) => {
    const entry = born.get(enemy.id);
    if (entry && entry.firstHit === null) entry.firstHit = g.elapsed;
    return original(enemy, ...args);
  });
  wrap(g.enemies, 'kill', (original, enemy) => {
    const entry = born.get(enemy.id);
    if (enemy.alive) emit('kill', { id: enemy.id, enemy: enemy.def.id, elite: enemy.elite, boss: enemy.boss,
      lifetime: entry ? g.elapsed - entry.time : null,
      combatTime: entry?.firstHit !== null && entry ? g.elapsed - entry.firstHit : null });
    const previous = source;
    source = { enemy: enemy.def.id, id: enemy.id, attack: 'death_effect' };
    try { return original(enemy); } finally { source = previous; }
  });
  wrap(g, 'applyOption', (original, option) => {
    const max = g.pstats.maxHp;
    emit('upgrade', { option: describe(option) });
    const value = original(option);
    metrics.maxHpGains += Math.max(0,g.pstats.maxHp-max);
    return value;
  });
  wrap(g, 'regenPlayer', (original, ...args) => {
    const before = g.player.hp;
    const value = original(...args);
    metrics.regenRequested += args[0];
    metrics.regenEffective += g.player.hp - before;
    if (g.player.hp - before >= 1) emit('heal', { amount: g.player.hp - before, hp: g.player.hp });
    return value;
  });
  wrap(g, 'healPlayer', (original, ...args) => {
    const before = g.player.hp;
    const value = original(...args);
    metrics.consumableHealing += g.player.hp - before;
    emit('consumable_heal', { amount: g.player.hp - before });
    return value;
  });
  wrap(g, 'openChest', (original, ...args) => {
    const before = g.player.hp;
    const value = original(...args);
    metrics.chestHealing += Math.max(0, g.player.hp - before);
    emit('chest_heal', { amount: Math.max(0, g.player.hp - before) });
    return value;
  });
  wrap(g, 'endRun', (original, win) => {
    if (!g.over) {
      result = { win, time: g.elapsed, kills: g.kills, level: g.build.level, hp: g.player.hp,
        skills: Object.fromEntries(g.build.skills), passives: Object.fromEntries(g.build.passives),
        boss: g.boss ? { hp: g.boss.hp, maxHp: g.boss.maxHp } : null, metrics: { ...metrics } };
      emit('result', result);
    }
    return original(win);
  });
  // First-level threat warnings: explosions and aimed charge lines are also visible to the bot.
  let warnings = [];
  for (const kind of ['disc', 'line']) wrap(g.fx, kind, (original, x, y, ...args) => {
    if (kind === 'disc') warnings.push({ kind, x, y, radius: args[0], until: g.now + args[3] });
    else warnings.push({ kind, x, y, angle: args[0], length: args[1], width: args[4] ?? 6, until: g.now + args[3] });
    return original(x, y, ...args);
  });
  function previewStats(o) {
    const copy = Object.assign(Object.create(Object.getPrototypeOf(g.build)), g.build, {
      skills: new Map(g.build.skills), passives: new Map(g.build.passives),
      lingen: { ...g.build.lingen },
    });
    copy.apply(o);
    return copy.stats();
  }
  function describe(o) {
    if (o.kind === 'skill') return { ...o, element: SKILLS[o.id].el,
      description: SKILLS[o.id].desc.slice(0, o.lv), stats: SKILLS[o.id].stats(o.lv),
      previousStats: o.lv > 1 ? SKILLS[o.id].stats(o.lv - 1) : null,
      previewStats: previewStats(o), preview: g.build.preview(o) };
    if (o.kind === 'passive') return { ...o, element: PASSIVES[o.id].el, description: PASSIVES[o.id].desc,
      preview: g.build.preview(o), previewStats: previewStats(o) };
    return { ...o, description: o.kind === 'heal' ? 'Restore 30% max HP' : 'Currency for future runs; no benefit to this run' };
  }
  const r = n => +n.toFixed(2);
  const dist = o => Math.hypot(o.x - g.player.x, o.y - g.player.y);
  function snapshot() {
    const p = g.player;
    const enemies = g.enemies.list.filter(e => e.alive);
    const nearby = enemies.filter(e => dist(e) < 370).sort((a, b) => dist(a) - dist(b));
    const pickups = [
      ...g.pickups.gems.map(o => ({ x: o.x, y: o.y, kind: 'xp', value: o.value })),
      ...g.pickups.pills.map(o => ({ x: o.x, y: o.y, kind: 'heal' })),
      ...g.pickups.chests.map(o => ({ x: o.img.x, y: o.img.getData('y') ?? o.img.y, kind: o.kind + '_chest' })),
      ...g.pickups.items.map(o => ({ x: o.img.x, y: o.img.y, kind: o.kind, talisman: o.talisman })),
    ].filter(o => dist(o) < 370).sort((a, b) => dist(a) - dist(b));
    const projectiles = g.proj.list.filter(o => o.active && o.kind === 'enemy');
    warnings = warnings.filter(o => o.until >= g.now);
    const speed = g.pstats.speed * Math.max(0.6, g.status.speedMult);
    const movement = Object.entries(DIRECTIONS).map(([id, [dx, dy]]) => {
      const length = Math.hypot(dx, dy) || 1;
      dx /= length; dy /= length;
      let minClearance = 999, blocked = false, projectileClearance = 999, warning = false;
      // Compute geometric facts in code, rather than asking Jev to do vector arithmetic.
      for (let i = 0; i <= 5; i++) {
        const t = i / 10;
        const x = p.x + dx * speed * t, y = p.y + dy * speed * t;
        const probe = { x, y };
        if (g.world.push(probe, 7)) blocked = true;
        for (const e of nearby) {
          const d = Math.hypot(x - e.x, y - e.y) - e.radius - 7;
          minClearance = Math.min(minClearance, d);
        }
        for (const b of projectiles) projectileClearance = Math.min(projectileClearance,
          Math.hypot(x - (b.x + b.vx * t), y - 6 - (b.y + b.vy * t)) - b.radius - 7);
        for (const w of warnings) {
          if (w.kind === 'disc' && Math.hypot(x - w.x, (y - w.y) / 0.6) < w.radius + 7) warning = true;
          if (w.kind === 'line') {
            const ux = Math.cos(w.angle), uy = Math.sin(w.angle);
            const along = Math.max(0, Math.min(w.length, (x - w.x) * ux + (y - w.y) * uy));
            if (Math.hypot(x - w.x - along * ux, y - w.y - along * uy) < w.width + 7) warning = true;
          }
        }
      }
      const x = p.x + dx * speed * 0.5, y = p.y + dy * speed * 0.5;
      const nearestXp = pickups.filter(o => o.kind === 'xp').reduce((best, o) => Math.min(best, Math.hypot(x - o.x, y - o.y)), 999);
      const facingTargets = !g.build.skills.has('slash') ? 0 : nearby.filter(e => {
        const ex = e.x - x, ey = e.y - y;
        return Math.hypot(ex, ey) < SKILLS.slash.stats(g.build.skills.get('slash')).range * g.pstats.area &&
          (id === 'STAY' || (ex * dx + ey * dy) / (Math.hypot(ex, ey) || 1) > Math.cos(80 * Math.PI / 180));
      }).length;
      return { id, blocked, minEnemyClearance: r(minClearance), minProjectileClearance: r(projectileClearance),
        warning, nearestXpDistanceAfter: r(nearestXp), slashTargetsAfter: facingTargets };
    });
    return { character: g.char.id, characterTrait: g.char.trait, levelId: g.levelDef.id, metrics: { ...metrics }, time: r(g.elapsed), over: g.over, result, level: g.build.level, xp: g.build.xp, xpNeeded: g.build.xpNeeded(),
      hp: r(p.hp), maxHp: g.pstats.maxHp, x: r(p.x), y: r(p.y), facing: p.facing,
      shield: g.shield, armor: g.pstats.armor, pickupRadius: g.pstats.pickup, kills: g.kills,
      benming: g.build.benming, stats: g.pstats, enemyCount: enemies.length,
      statuses: { poison: g.status.poisoned, burn: g.status.burning, slow: g.status.slowed, stun: g.status.stunned },
      skills: [...g.build.skills].map(([id, lv]) => ({ id, lv, stats: SKILLS[id].stats(lv) })),
      puppets: g.puppets.list.map(p => ({hp:r(p.hp),maxHp:p.maxHp,giant:p.giant,dx:r(p.x-g.player.x),dy:r(p.y-g.player.y)})),
      passives: Object.fromEntries(g.build.passives), slashCooldown: r(g.skills.timers.get('slash') ?? 0.4),
      enemies: nearby.slice(0, 12).map(e => ({ id: e.id, type: e.def.id, behavior: e.def.behavior, element: e.def.el,
        dx: r(e.x - p.x), dy: r(e.y - p.y), hp: r(e.hp), speed: r(e.speed), radius: e.radius,
        damageMultiplierVsPlayer: REL_MULT[relation(e.def.el, g.build.benming)],
        elite: e.elite, boss: e.boss, state: e.state, timer: r(e.timer), dashX: r(e.dashX), dashY: r(e.dashY) })),
      boss: g.boss ? { hp: r(g.boss.hp), maxHp: g.boss.maxHp, raged: g.boss.raged, distance: r(dist(g.boss)) } : null,
      pickups: pickups.slice(0, 12).map(o => ({ ...o, x: undefined, y: undefined, dx: r(o.x - p.x), dy: r(o.y - p.y) })),
      projectiles: projectiles.slice(0, 12).map(o => ({ dx: r(o.x - p.x), dy: r(o.y - p.y), vx: r(o.vx), vy: r(o.vy) })),
      movement, options: hud.mode === 'levelup' ? hud.options.map(describe) : [],
      terrain: g.levelDef.id === 3 ? 'Level 3 mountain forest: dense rock ridges block movement; falling rocks and ground attack warnings cause damage. Up is negative y.' : 'Level 1: bounded map with sparse solid rocks; no damaging ground hazards. Up is negative y.',
    };
  }
  function step(delta) {
    const previous = Math.random;
    Math.random = random;
    frameDelta = delta;
    try { game.step(clock, delta); } finally { frameDelta = 0; Math.random = previous; }
  }
  function tick() {
    clock += 1000 / 60;
    const active = !g.over;
    step(1000 / 60);
    if (active) {
      if (g.char.id === 'moheng' && !g.puppets.list.length) metrics.secondsWithoutPuppets += 1 / 60;
      if (g.player.hp < g.pstats.maxHp / 2) metrics.secondsBelowHalf += 1 / 60;
      if (g.player.hp >= g.pstats.maxHp - 0.01) metrics.secondsFull += 1 / 60;
    }
    if (game.loop.running) game.loop.stop();
  }
  function advance(action, frames = 30) {
    if (!(action in DIRECTIONS) || !Number.isInteger(frames) || frames < 1 || frames > 60) throw Error('Invalid movement');
    if (hud.mode === 'levelup') throw Error('Choose upgrade before moving');
    const [x, y] = DIRECTIONS[action];
    for (const [key, value] of Object.entries({ LEFT: x < 0, RIGHT: x > 0, UP: y < 0, DOWN: y > 0 })) g.player.keys[key].isDown = value;
    const before = { x: g.player.x, y: g.player.y, time: g.elapsed };
    for (let i = 0; i < frames && !g.over; i++) {
      tick();
      if (hud.mode === 'levelup') break;
    }
    const minute = Math.floor(g.elapsed / 60);
    if (minute !== lastMinute) { lastMinute = minute; emit('checkpoint', { snapshot: snapshot() }); }
    return { moved: Math.hypot(g.player.x - before.x, g.player.y - before.y), advanced: g.elapsed - before.time, snapshot: snapshot() };
  }
  function choose(index) {
    if (hud.mode !== 'levelup' || !Number.isInteger(index) || !hud.options[index]) throw Error('Invalid upgrade');
    hud.sel = index;
    hud.inputLockUntil = 0;
    const beforeConfirm = Math.random;
    Math.random = random;
    try { hud.confirm(); } finally { Math.random = beforeConfirm; }
    // Scene resume is queued until the next SceneManager step; update without consuming game time.
    step(0);
    return snapshot();
  }
  Math.random = nativeRandom;
  emit('start', { seed, profile, growthLedger, startingSave: loadSave(), stats: g.pstats, benming: g.build.benming, character: g.char.id, level: g.levelDef.id, save: 'isolated empty context', fixedStep: 1 / 60 });
  return window.__playtest = { snapshot, advance, choose, readSave: () => loadSave(), growthLedger, startingSave: loadSave(),
    drainEvents: () => events.splice(0), finish: () => { for (let i = 0; i < 120; i++) tick(); return snapshot(); } };
}
