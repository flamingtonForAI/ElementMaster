import type Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './Enemies';
import { PLAYER_RADIUS } from './Player';
import { audio } from '../audio/Audio';

/** 地上的余火：玩家站在上面每隔一会儿受一次火伤并可能灼烧 */
interface Patch {
  x: number;
  y: number;
  r: number;
  until: number;
  dmg: number;
  flames: Phaser.GameObjects.Sprite[];
}

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
 */
export class Hazards {
  private nextAt: number;
  private warned = false;
  private lavaAt: number;
  private lavaWarned = false;
  private zoneHinted = false;
  private patches: Patch[] = [];
  private patchTickAt = 0;

  constructor(private g: GameScene) {
    this.nextAt = g.levelDef.rockfall?.start ?? Infinity;
    this.lavaAt = g.levelDef.lava?.start ?? Infinity;
  }

  update() {
    this.updatePatches();
    this.updateLava();
    this.updateZoneHint();
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

  /** 在 (x, y) 留一片半径 r、持续 dur 秒的余火，每次烫玩家 dmg（再乘伤害成长） */
  patch(x: number, y: number, r: number, dur: number, dmg: number) {
    const g = this.g;
    if (this.patches.length >= PATCH_MAX) this.remove(this.patches.shift()!);
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
    this.patches.push({ x, y, r, until: g.now + dur, dmg, flames });
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
      if (!hit && Math.hypot(p.x - pt.x, (p.y - pt.y) / 0.6) < pt.r + PLAYER_RADIUS * 0.5) hit = pt;
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
}
