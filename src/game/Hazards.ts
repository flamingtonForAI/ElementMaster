import type Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './Enemies';
import { PLAYER_RADIUS } from './Player';
import { audio } from '../audio/Audio';

/** 地上的余火（fire）、水洼（water）或缠根（roots） */
export type PatchKind = 'fire' | 'water' | 'roots';

/** 余火：玩家站在上面每隔一会儿受一次火伤并可能灼烧；水洼：不伤人，踩上去可能迟缓 */
interface Patch {
  kind: PatchKind;
  x: number;
  y: number;
  r: number;
  until: number;
  dmg: number;
  flames: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[];
}

/** 瘴雾：从小慢慢扩到 R，存在到 until；puffs 是一圈慢慢转的雾团 */
interface Fog {
  x: number;
  y: number;
  R: number;
  r: number;
  born: number;
  grow: number;
  until: number;
  spin: number;
  puffs: Phaser.GameObjects.Image[];
}

/** 同时存在的瘴雾上限，超了先散最早的 */
const FOG_MAX = 10;
/** 瘴雾是贴地的椭圆，纵向压扁 */
const FOG_SQUASH = 0.7;
/** 每片瘴雾的雾团数 */
const FOG_PUFFS = 7;
/** 瘴雾里的普通敌人掉血的结算间隔（秒） */
const FOG_ENEMY_TICK = 0.5;

/** 同时存在的余火上限，超了先灭最早的 */
const PATCH_MAX = 48;
/** 余火对玩家的结算间隔（秒） */
const PATCH_TICK = 0.6;

/**
 * 关卡地形机制：
 * - 落石（第 3 关山林）：地上先出现影子，石头从天而降，砸中玩家造成土伤害并累积震慑；砸中的普通敌人掉一大截血，引怪进落石区是正当打法。
 * - 熔岩口（第 4 关赤焰谷）：固定在地图上，周期挑玩家附近的几个喷发，先发光预警，喷完留一会儿余火；同样会烧掉非火系的普通敌人。
 * - 余火：熔岩、赤狐冲刺、毕方俯冲都会留下，也给 Boss 用。
 * - 煞气剑阵（第 5 关兵冢）只改护甲，由 World.zoneArmor 判定，这里只负责第一次靠近时的提示。
 * - 泥潭（第 6 关云梦泽）只改移速，由 World.inMud 判定，这里只负责第一次踩进去的提示。
 * - 瘴雾（第 6 关）：周期从玩家附近的泥潭里冒出，慢慢扩散开，雾里玩家会中毒，非木系的普通敌人持续掉血；相柳吐的毒泽也化成瘴雾。
 * - 水洼：蛟冲刺、鱼妖的抛射水弹留下，踩上去可能迟缓；缠根（后期关卡的藤怪催生）同理。
 */
export class Hazards {
  private nextAt: number;
  private warned = false;
  private lavaAt: number;
  private lavaWarned = false;
  private zoneHinted = false;
  private patches: Patch[] = [];
  private patchTickAt = 0;
  private wetTickAt = 0;
  private mudHinted = false;
  private fogs: Fog[] = [];
  private fogAt: number;
  private fogWarned = false;
  private fogTickAt = 0;
  private fogEnemyAt = 0;
  private tmp: Enemy[] = [];

  constructor(private g: GameScene) {
    this.nextAt = g.levelDef.rockfall?.start ?? Infinity;
    this.lavaAt = g.levelDef.lava?.start ?? Infinity;
    this.fogAt = g.levelDef.miasma?.start ?? Infinity;
  }

  update() {
    this.updatePatches();
    this.updateLava();
    this.updateZoneHint();
    this.updateMudHint();
    this.updateMiasma();
    this.updateFogs();
    this.updateRockfall();
  }

  private updateRockfall() {
    const g = this.g;
    const rf = g.levelDef.rockfall;
    if (!rf || g.over || g.elapsed < this.nextAt) return;
    const k = Math.min(1, g.elapsed / g.levelDef.duration);
    const every = rf.every[0] + (rf.every[1] - rf.every[0]) * k;
    const count = Math.round(rf.count[0] + (rf.count[1] - rf.count[0]) * k);
    this.nextAt = g.elapsed + every * (0.85 + Math.random() * 0.3);
    if (!this.warned) {
      this.warned = true;
      g.hud.toast('山上落石！看准地上的影子', '#e0ad48');
    }
    const p = g.player;
    // 第一块砸在玩家前进方向上，逼着变向；其余散在附近
    const lead = p.moving ? 0.7 * g.pstats.speed : 0;
    this.drop(p.x + p.facing.x * lead, p.y + p.facing.y * lead);
    for (let i = 1; i < count; i++) this.scatter(50, 150);
  }

  /** Boss 用：在玩家周围一口气砸 n 块 */
  rain(n: number) {
    const p = this.g.player;
    this.drop(p.x, p.y);
    for (let i = 1; i < n; i++) this.scatter(40, 130);
  }

  private scatter(r0: number, r1: number) {
    const p = this.g.player;
    const a = Math.random() * Math.PI * 2;
    const r = r0 + Math.random() * (r1 - r0);
    this.drop(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8);
  }

  private drop(x: number, y: number) {
    const g = this.g;
    const rf = g.levelDef.rockfall ?? { radius: 20, warn: 1.1, dmg: 12 };
    const R = rf.radius;
    // 影子越来越深，石头加速落下，落地瞬间结算
    g.fx.disc(x, y, R, 0x1a1208, 0.3, rf.warn);
    g.fx.disc(x, y, R, 0xdaa53e, 0.12, rf.warn);
    const rock = g.add.image(x, y - 150, 'fx_boulder').setOrigin(0.5, 0.9).setDepth(1e6 - 1);
    g.tweens.add({ targets: rock, y, duration: rf.warn * 1000, ease: 'Quad.in', onComplete: () => rock.destroy() });
    g.later(rf.warn, () => {
      if (g.over) return;
      audio.sfx('explode', { rate: 0.8, vol: 0.5 });
      g.fx.crack(x, y, 0.6);
      g.fx.ring(x, y - 2, R + 4, 0xdaa53e, 0.3);
      g.fx.burst(x, y - 4, 0x8a6220, 10);
      const p = g.player;
      if (Math.hypot(p.x - x, (p.y - y) / 0.6) < R + PLAYER_RADIUS) {
        g.hurtPlayer(rf.dmg * g.dmgScale(), 'earth', { inflict: { kind: 'stun', chance: 1 } });
        g.cameras.main.shake(120, 0.005);
      }
      const tmp: Enemy[] = [];
      for (const e of g.enemies.inRadius(x, y, R, tmp)) if (!e.boss) g.envDamage(e, e.maxHp * (e.elite ? 0.15 : 0.6));
    });
  }

  // ---------- 熔岩口 ----------

  private updateLava() {
    const g = this.g;
    const lv = g.levelDef.lava;
    if (!lv || g.over || g.elapsed < this.lavaAt) return;
    const k = Math.min(1, g.elapsed / g.levelDef.duration);
    const every = lv.every[0] + (lv.every[1] - lv.every[0]) * k;
    const count = Math.round(lv.count[0] + (lv.count[1] - lv.count[0]) * k);
    this.lavaAt = g.elapsed + every * (0.85 + Math.random() * 0.3);
    const p = g.player;
    // 只喷看得见的熔岩口（屏幕内外扩一点），离玩家近的优先
    const vents = g.world.spotsIn('lava', p.x - 360, p.y - 220, p.x + 360, p.y + 220)
      .map(([x, y]) => ({ x, y, d: Math.hypot(x - p.x, y - p.y) + Math.random() * 120 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count);
    if (!vents.length) return;
    if (!this.lavaWarned) {
      this.lavaWarned = true;
      g.hud.toast('熔岩口要喷发了！发亮的地方快离开', '#ff8a4a');
    }
    for (const v of vents) this.blast(v.x, v.y, lv.radius, lv.warn, lv.dmg, lv.burn);
  }

  /** Boss 远吼用：只让屏幕内离玩家最近的 n 个熔岩口提前喷一次，不波及全屏；附近没有就不喷 */
  erupt(n: number) {
    const g = this.g;
    const lv = g.levelDef.lava;
    if (!lv) return;
    const p = g.player;
    const vents = g.world.spotsIn('lava', p.x - 320, p.y - 180, p.x + 320, p.y + 180)
      .map(([x, y]) => ({ x, y, d: Math.hypot(x - p.x, y - p.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    for (const v of vents) this.blast(v.x, v.y, lv.radius, lv.warn, lv.dmg, lv.burn);
  }

  /**
   * 火柱：预警 warn 秒（地面发亮、冒火苗），然后喷发，范围内玩家受火伤并必定灼烧，
   * 非火系的普通敌人掉一大截血；之后原地留 burn 秒余火。Boss 的火雨也用这个
   */
  blast(x: number, y: number, r: number, warn: number, dmg: number, burn: number) {
    const g = this.g;
    // 暗地面上要亮：橘色圆盘渐深，开头和中途各扩一圈
    g.fx.disc(x, y, r, 0xff7a2a, 0.26, warn);
    g.fx.ring(x, y, r, 0xffa040, warn * 0.5);
    g.later(warn * 0.5, () => g.fx.ring(x, y, r, 0xffa040, warn * 0.5));
    const glow = g.add.sprite(x, y + 2, 'fx_flame', 0).setOrigin(0.5, 0.9).setDepth(y + 1).setScale(0.6).setAlpha(0.8);
    glow.play('fx_flame');
    g.tweens.add({ targets: glow, scale: 1.4, duration: warn * 1000, ease: 'Quad.in', onComplete: () => glow.destroy() });
    audio.sfx('charge', { rate: 0.6, vol: 0.35 });
    g.later(warn, () => {
      if (g.over) return;
      audio.sfx('explode', { rate: 0.7, vol: 0.55 });
      g.fx.anim('fx_explosion', x, y - 6, { scale: r / 20, tint: 0xffa040 });
      g.fx.ring(x, y - 2, r + 6, 0xff8a3a, 0.35);
      g.fx.burst(x, y - 8, 0xff7a2a, 12);
      const p = g.player;
      if (Math.hypot(p.x - x, (p.y - y) / 0.6) < r + PLAYER_RADIUS) {
        g.hurtPlayer(dmg * g.dmgScale(), 'fire', { inflict: { kind: 'burn', chance: 1, dps: 1.5 * g.dmgScale() } });
        g.cameras.main.shake(120, 0.005);
      }
      const tmp: Enemy[] = [];
      for (const e of g.enemies.inRadius(x, y, r, tmp)) if (!e.boss && e.def.el !== 'fire') g.envDamage(e, e.maxHp * (e.elite ? 0.15 : 0.6), 'fire');
      if (burn > 0) this.patch(x, y, r * 0.7, burn, dmg * 0.3);
    });
  }

  // ---------- 余火 ----------

  /** 在 (x, y) 留一片半径 r、持续 dur 秒的余火，每次烫玩家 dmg（再乘伤害成长）；kind 为 water 时是一汪水洼 */
  patch(x: number, y: number, r: number, dur: number, dmg: number, kind: PatchKind = 'fire') {
    const g = this.g;
    if (this.patches.length >= PATCH_MAX) this.remove(this.patches.shift()!);
    if (kind === 'water') {
      const img = g.add.image(x, y, 'fx_puddle', Math.floor(Math.random() * 2)).setDepth(-9e4).setScale(r / 10).setFlipX(Math.random() < 0.5).setAlpha(0.85);
      this.patches.push({ kind, x, y, r, until: g.now + dur, dmg, flames: [img] });
      return;
    }
    if (kind === 'roots') {
      // 一圈从地里钻出的藤蔓，颜色压暗一档，和玩家的藤缚区分开
      const vines: Phaser.GameObjects.Image[] = [];
      const off = Math.random() * Math.PI;
      for (let i = 0; i < 4; i++) {
        const a = off + (i / 4) * Math.PI * 2;
        const vx = x + Math.cos(a) * r * 0.55;
        const vy = y + Math.sin(a) * r * 0.55 * 0.6;
        vines.push(g.add.image(vx, vy, 'fx_vine').setOrigin(0.5, 0.9).setDepth(vy).setTint(0x8aa86a).setFlipX(i % 2 === 0));
      }
      this.patches.push({ kind, x, y, r, until: g.now + dur, dmg, flames: vines });
      return;
    }
    const n = r < 14 ? 1 : 3;
    const flames: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const d = n === 1 ? 0 : r * 0.5;
      const fx = x + Math.cos(a) * d;
      const fy = y + Math.sin(a) * d * 0.6;
      const s = g.add.sprite(fx, fy, 'fx_flame', 0).setOrigin(0.5, 0.9).setDepth(fy).setScale(n === 1 ? 0.7 : 0.9).setAlpha(0.9);
      s.anims.play({ key: 'fx_flame', startFrame: Math.floor(Math.random() * 3) });
      flames.push(s);
    }
    this.patches.push({ kind, x, y, r, until: g.now + dur, dmg, flames });
  }

  private remove(pt: Patch) {
    for (const s of pt.flames) s.destroy();
  }

  private updatePatches() {
    const g = this.g;
    if (!this.patches.length) return;
    const now = g.now;
    const p = g.player;
    let hit: Patch | null = null;
    let wet = false;
    for (let i = this.patches.length - 1; i >= 0; i--) {
      const pt = this.patches[i];
      const left = pt.until - now;
      if (left <= 0) {
        this.remove(pt);
        this.patches.splice(i, 1);
        continue;
      }
      // 最后半秒淡出
      if (left < 0.5) for (const s of pt.flames) s.setAlpha(left * 1.8);
      if (Math.hypot(p.x - pt.x, (p.y - pt.y) / 0.6) >= pt.r + PLAYER_RADIUS * 0.5) continue;
      if (pt.kind === 'water' || pt.kind === 'roots') wet = true;
      else hit ??= pt;
    }
    // 水洼、缠根（小怪留下的）：每 0.6 秒 25% 迟缓（会攒寒意）
    if (wet && now >= this.wetTickAt && !g.over) {
      this.wetTickAt = now + PATCH_TICK;
      g.status.inflict({ kind: 'slow', chance: 0.25, mob: true });
    }
    if (hit && now >= this.patchTickAt && !g.over) {
      this.patchTickAt = now + PATCH_TICK;
      g.hurtPlayer(hit.dmg * g.dmgScale(), 'fire', { inflict: { kind: 'burn', chance: 0.5, dps: 1.5 * g.dmgScale() } });
    }
  }

  // ---------- 煞气剑阵 ----------

  private updateZoneHint() {
    const g = this.g;
    if (this.zoneHinted || !g.levelDef.swordZones) return;
    const p = g.player;
    // 走近阵边就提示，不用真的踩进去
    if (g.world.zoneArmor(p.x, p.y) || g.world.zoneArmor(p.x + p.facing.x * 60, p.y + p.facing.y * 60)) {
      this.zoneHinted = true;
      g.hud.toast(`煞气剑阵：阵中的敌人护甲 +${g.levelDef.swordZones.armor}，把它们引出来打`, '#e06a5a');
    }
  }

  // ---------- 泥潭 ----------

  private updateMudHint() {
    const g = this.g;
    if (this.mudHinted || !g.levelDef.mud) return;
    const p = g.player;
    if (!g.world.inMud(p.x, p.y)) return;
    this.mudHinted = true;
    g.hud.toast('陷进泥潭了：走得慢，非水系的妖物也一样', '#b8a878');
  }

  // ---------- 瘴雾 ----------

  private updateMiasma() {
    const g = this.g;
    const m = g.levelDef.miasma;
    if (!m || g.over || g.elapsed < this.fogAt) return;
    const k = Math.min(1, g.elapsed / g.levelDef.duration);
    const every = m.every[0] + (m.every[1] - m.every[0]) * k;
    this.fogAt = g.elapsed + every * (0.85 + Math.random() * 0.3);
    const n = this.rise(Math.round(m.count[0] + (m.count[1] - m.count[0]) * k));
    if (n && !this.fogWarned) {
      this.fogWarned = true;
      g.hud.toast('泥潭里冒出了瘴雾！雾里会中毒，把怪引进去', '#8fe06a');
    }
  }

  /** 从玩家附近（屏幕内外扩一点）的 n 个泥潭里冒瘴雾，已经在冒的跳过，离得近的优先；返回冒了几处。远吼也用这个 */
  rise(n: number) {
    const g = this.g;
    const m = g.levelDef.miasma;
    if (!m || n <= 0) return 0;
    const p = g.player;
    const pools = g.world.spotsIn('mud', p.x - 360, p.y - 220, p.x + 360, p.y + 220)
      .filter(([x, y]) => !this.fogs.some((f) => Math.hypot(f.x - x, f.y - y) < 20))
      .map(([x, y]) => ({ x, y, d: Math.hypot(x - p.x, y - p.y) + Math.random() * 120 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
    for (const v of pools) this.miasmaAt(v.x, v.y, m.radius, m.grow, m.life);
    return pools.length;
  }

  /** 在 (x, y) 冒一片瘴雾：grow 秒内从小扩到半径 R，life 秒后散掉 */
  miasmaAt(x: number, y: number, R: number, grow: number, life: number) {
    const g = this.g;
    if (this.fogs.length >= FOG_MAX) this.dropFog(this.fogs.shift()!);
    const puffs: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < FOG_PUFFS; i++) {
      // 中间一团压在人物下面，外圈几团飘在人物上面，半透明不挡视线
      puffs.push(g.add.image(x, y, 'fx_fog').setDepth(i === 0 ? -9e4 : 1e5).setAlpha(0).setFlipX(Math.random() < 0.5));
    }
    audio.sfx('charge', { rate: 0.4, vol: 0.25 });
    this.fogs.push({ x, y, R, r: 4, born: g.now, grow, until: g.now + life, spin: Math.random() * Math.PI * 2, puffs });
  }

  private dropFog(f: Fog) {
    for (const s of f.puffs) s.destroy();
  }

  /** 这片雾当前在 (x, y) 处是否笼罩着 */
  private covers(f: Fog, x: number, y: number, pad = 0) {
    return Math.hypot(x - f.x, (y - f.y) / FOG_SQUASH) < f.r + pad;
  }

  private updateFogs() {
    const g = this.g;
    if (!this.fogs.length) return;
    const now = g.now;
    const p = g.player;
    const m = g.levelDef.miasma ?? { tick: 0.7, chance: 0.6, dps: 2, enemy: 0.05 };
    let onPlayer = false;
    for (let i = this.fogs.length - 1; i >= 0; i--) {
      const f = this.fogs[i];
      const left = f.until - now;
      if (left <= 0) {
        this.dropFog(f);
        this.fogs.splice(i, 1);
        continue;
      }
      // 慢慢扩开：先快后慢；最后 2 秒淡出
      const k = Math.min(1, (now - f.born) / f.grow);
      f.r = Math.max(4, f.R * (1 - (1 - k) * (1 - k)));
      const fade = Math.min(1, left / 2, (now - f.born) / 0.6);
      f.spin += 0.0035;
      f.puffs.forEach((s, j) => {
        const a = f.spin + (j / (FOG_PUFFS - 1)) * Math.PI * 2;
        const d = j === 0 ? 0 : f.r * 0.55;
        const px = f.x + Math.cos(a) * d;
        const py = f.y + Math.sin(a) * d * FOG_SQUASH;
        s.setPosition(px, py).setScale((f.r / 26) * (j === 0 ? 1.05 : 0.6)).setAlpha((j === 0 ? 0.7 : 0.42) * fade);
      });
      if (!onPlayer && this.covers(f, p.x, p.y)) onPlayer = true;
    }
    if (onPlayer && now >= this.fogTickAt && !g.over) {
      this.fogTickAt = now + m.tick;
      g.status.inflict({ kind: 'poison', chance: m.chance, dps: m.dps * g.dmgScale(), dur: 3 });
    }
    // 雾里非木系的普通敌人掉血：引怪进雾是正当打法
    if (now >= this.fogEnemyAt && !g.over) {
      this.fogEnemyAt = now + FOG_ENEMY_TICK;
      for (const f of this.fogs)
        for (const e of g.enemies.inRadius(f.x, f.y, f.r, this.tmp))
          if (!e.boss && e.def.el !== 'wood' && this.covers(f, e.x, e.y)) g.envDamage(e, e.maxHp * m.enemy * (e.elite ? 0.25 : 1), 'wood');
    }
  }
}
