import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { TEMP_TERRAIN, type StormLook } from '../config/levels';
import type { El } from '../config/elements';
import { VIEW_W, VIEW_H, cameraView } from '../config/view';
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

/** 流沙同样纵向压扁 */
const SAND_SQUASH = 0.62;
/** 风暴的提示 */
const STORM_TEXT: Record<StormLook, { css: string; warn: string; start: (dir: string) => string }> = {
  snow: { css: '#c8ecff', warn: '北风紧了，暴风雪要来了！看不远时贴着冰崖走', start: (d) => `暴风雪！北风往${d}吹，看不远了` },
  sand: { css: '#fff0d0', warn: '天边黄了，沙暴要来了！沙暴里金气更盛', start: (d) => `沙暴！风往${d}刮，看不远了；金系术更强` },
};
/** 临时冰面同时存在的上限 */
const ICE_MAX = 24;
/** 风暴起、落各用这么多秒渐变 */
const STORM_FADE = 1.5;
/** 风暴里的雪片 / 沙粒数 */
const FLAKES = 48;
/** 风暴的遮罩比画面大一圈，玩家贴着地图边、不在画面正中时也盖得住 */
const VEIL_W = VIEW_W * 2;
const VEIL_H = VIEW_H * 2;
const VEIL_DEPTH = 1.5e6;

interface IcePatch {
  x: number;
  y: number;
  r: number;
  until: number;
  img: Phaser.GameObjects.Image;
}

/**
 * 关卡地形机制：
 * - 落石（第 3 关山林）：地上先出现影子，石头从天而降，砸中玩家造成土伤害并累积震慑；砸中的普通敌人掉一大截血，引怪进落石区是正当打法。
 * - 熔岩口（第 4 关赤焰谷）：固定在地图上，周期挑玩家附近的几个喷发，先发光预警，喷完留一会儿余火；同样会烧掉非火系的普通敌人。
 * - 余火：熔岩、赤狐冲刺、毕方俯冲都会留下，也给 Boss 用。
 * - 煞气剑阵（第 5 关兵冢）只改护甲，由 World.zoneArmor 判定，这里只负责第一次靠近时的提示。
 * - 泥潭（第 6 关云梦泽）只改移速，由 World.inMud 判定，这里只负责第一次踩进去的提示。
 * - 瘴雾（第 6 关）：周期从玩家附近的泥潭里冒出，慢慢扩散开，雾里玩家会中毒，非木系的普通敌人持续掉血；相柳吐的毒泽也化成瘴雾。
 * - 水洼：蛟冲刺、鱼妖的抛射水弹留下，踩上去可能迟缓；缠根（后期关卡的藤怪催生）同理。
 * - 冰面（第 7 关寒江）：固定的由 World.onIce 判定，玄冥冰锥留下的临时冰面在这里；玩家在冰上有惯性（Player 里算）。
 * - 风暴（第 7 关暴风雪、第 8 关沙暴）：周期刮起，视野只剩玩家周围一圈，风一直把玩家往一个方向推；沙暴里金系术更强。
 *   玄冥的吸寒、流沙往中心的吸力也走这里的外力（drift）。
 * - 相位轮转（第 9 关涨退潮、第 10 关五气当令）：按 cycle.order 换相，换相时 GameScene.setPhase 改地气、点位、Boss 元素；
 *   带 phase 的点位（浅滩、火山口、毒沼、剑阵、冰面）和落石、瘴雾只在那一相起作用。
 * - 流沙（第 8 关）：固定的由 World.sandAt 判定，旱魃和穿山甲留下的临时流沙在这里；陷进去走得慢、往中心吸，陷到中心掉血攒震慑。
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
  /** 当前相（东海归墟的潮、昆仑的当令元素），没有相位的关卡为 null；phaseAt 是下一次换相的开局秒数 */
  phaseEl: El | null = null;
  private phaseAt = Infinity;
  private phaseWarned = false;
  private ices: IcePatch[] = [];
  private sands: IcePatch[] = [];
  private sandHinted = false;
  private sandTickAt = 0;
  private iceHinted = false;
  /** 风暴：下一场的开局秒数；当前这场从 stormFrom 刮到 stormUntil（g.now），风向单位向量 */
  private stormAt: number;
  stormFrom = 0;
  stormUntil = 0;
  private windX = 0;
  private windY = 0;
  private stormWarned = false;
  private veil: Phaser.GameObjects.Image | null = null;
  private flakes: Phaser.GameObjects.Image[] = [];
  private flakeAt = 0;
  /** 往 (pullX, pullY) 拉的外力，到 pullUntil 为止，每秒 pullF 像素（玄冥的吸寒） */
  private pullX = 0;
  private pullY = 0;
  private pullF = 0;
  private pullUntil = 0;

  constructor(private g: GameScene) {
    this.nextAt = g.levelDef.rockfall?.start ?? Infinity;
    this.lavaAt = g.levelDef.lava?.start ?? Infinity;
    this.fogAt = g.levelDef.miasma?.start ?? Infinity;
    this.stormAt = g.levelDef.storm?.start ?? Infinity;
    if (g.levelDef.storm && g.textures) stormTexture(g, g.levelDef.storm.look, g.levelDef.storm.vision);
  }

  update() {
    this.updatePhase();
    this.updateIce();
    this.updateSand();
    this.updateStorm();
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
    if (!rf || g.over || g.elapsed < this.nextAt || (rf.phase && rf.phase !== this.phaseEl)) return;
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
    // 海底火山口只在退潮时喷
    if (!lv || g.over || g.elapsed < this.lavaAt || (lv.phase && lv.phase !== this.phaseEl)) return;
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
      g.hud.toast(lv.hint ?? '熔岩口要喷发了！发亮的地方快离开', '#ff8a4a');
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
    g.hud.toast(g.levelDef.mud.tex ? '踩进涨潮的浅滩了：走得慢，非水系的妖物也一样' : '陷进泥潭了：走得慢，非水系的妖物也一样', '#b8a878');
  }

  // ---------- 瘴雾 ----------

  private updateMiasma() {
    const g = this.g;
    const m = g.levelDef.miasma;
    if (!m || g.over || g.elapsed < this.fogAt || (m.phase && m.phase !== this.phaseEl)) return;
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
    const m = g.levelDef.miasma ?? { tick: 0.7, chance: 0.6, dps: 2, enemy: 0.025 };
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
      const damaged = new Set<Enemy>();
      for (const f of this.fogs)
        for (const e of g.enemies.inRadius(f.x, f.y, f.r, this.tmp))
          if (!damaged.has(e) && !e.boss && e.def.el !== 'wood' && this.covers(f, e.x, e.y)) {
            // 同一轮只结算一次，多片毒泽重叠也不会倍增伤害。
            damaged.add(e);
            g.envDamage(e, e.maxHp * m.enemy * (e.elite ? 0.25 : 1), 'wood');
          }
    }
  }

  // ---------- 相位轮转 ----------

  /** 开局定为 order 的第一相；到点前 warn 秒预警，到点换到下一相 */
  private updatePhase() {
    const g = this.g;
    const c = g.levelDef.cycle;
    if (!c || g.over) return;
    if (!this.phaseEl) {
      this.turnPhase(c.order[0], true);
      return;
    }
    const next = this.nextPhase();
    if (!this.phaseWarned && g.elapsed >= this.phaseAt - c.warn) {
      this.phaseWarned = true;
      const t = c.warnText[next];
      if (t) g.hud.toast(t, '#b8aec8');
    }
    if (g.elapsed >= this.phaseAt) this.turnPhase(next);
  }

  /** order 里的下一相 */
  nextPhase(): El {
    const order = this.g.levelDef.cycle?.order ?? [];
    return order[(order.indexOf(this.phaseEl!) + 1) % order.length];
  }

  /** 换到这一相，排好下一次换相（cycle.rage 的关卡 Boss 狂暴后每相减半）；quiet 为开局定相，不提示。远吼也用这个 */
  turnPhase(el: El, quiet = false) {
    const g = this.g;
    const c = g.levelDef.cycle;
    if (!c) return;
    const k = Math.min(1, g.elapsed / g.levelDef.duration);
    const every = (c.every[0] + (c.every[1] - c.every[0]) * k) * (c.rage && g.boss?.raged ? 0.5 : 1);
    this.phaseEl = el;
    this.phaseAt = g.elapsed + every;
    this.phaseWarned = false;
    g.setPhase(el, quiet);
  }

  // ---------- 冰面 ----------

  /** 本关此刻有没有冰面（固定的或临时的）；敌人每帧查减速前先看这个，没有就省掉查询 */
  get anyIce() {
    return !!this.g.levelDef.ice || this.ices.length > 0;
  }

  /** 本关此刻有没有流沙（固定的或临时的） */
  get anySand() {
    return !!this.g.levelDef.quicksand || this.sands.length > 0;
  }

  /** 这里是不是冰面（固定的或冰锥留下的）：是就返回冰面配置，否则 null */
  onIce(x: number, y: number) {
    const fixed = this.g.world.onIce?.(x, y);
    if (fixed) return fixed;
    for (const c of this.ices) if (Math.hypot(x - c.x, (y - c.y) / 0.62) < c.r) return this.g.levelDef.ice ?? TEMP_TERRAIN.ice;
    return null;
  }

  /** 在 (x, y) 结一片半径 r、持续 dur 秒的临时冰面 */
  iceAt(x: number, y: number, r: number, dur: number) {
    const g = this.g;
    if (this.ices.length >= ICE_MAX) this.ices.shift()!.img.destroy();
    const img = g.add.image(x, y, 'dc_ice', Math.floor(Math.random() * 2)).setDepth(-9.5e4).setScale(r / 50).setAlpha(0.9).setFlipX(Math.random() < 0.5);
    this.ices.push({ x, y, r, until: g.now + dur, img });
  }

  private updateIce() {
    const g = this.g;
    for (let i = this.ices.length - 1; i >= 0; i--) {
      const c = this.ices[i];
      const left = c.until - g.now;
      if (left <= 0) {
        c.img.destroy();
        this.ices.splice(i, 1);
      } else if (left < 1) c.img.setAlpha(left * 0.9);
    }
    if (this.iceHinted || !g.levelDef.ice) return;
    const p = g.player;
    if (!this.onIce(p.x, p.y)) return;
    this.iceHinted = true;
    g.hud.toast('踩上冰面了：起步慢、转向会滑出去，非水系的妖物在冰上也站不稳', '#c8ecff');
  }

  // ---------- 流沙 ----------

  /** 这里在不在流沙里（固定的或临时的）：在就返回流沙中心、到中心的距离和配置 */
  sandAt(x: number, y: number) {
    const g = this.g;
    const fixed = g.levelDef.quicksand ? g.world.sandAt(x, y) : null;
    if (fixed) return { x: fixed[0], y: fixed[1], d: Math.hypot(fixed[0] - x, fixed[1] - y), r: g.levelDef.quicksand!.radius, def: g.levelDef.quicksand! };
    for (const c of this.sands)
      if (Math.hypot(x - c.x, (y - c.y) / SAND_SQUASH) < c.r) return { x: c.x, y: c.y, d: Math.hypot(c.x - x, c.y - y), r: c.r, def: g.levelDef.quicksand ?? TEMP_TERRAIN.sand };
    return null;
  }

  /** 在 (x, y) 陷出一片半径 r、持续 dur 秒的临时流沙 */
  sandPit(x: number, y: number, r: number, dur: number) {
    const g = this.g;
    if (this.sands.length >= ICE_MAX) this.sands.shift()!.img.destroy();
    const img = g.add.image(x, y, 'dc_quicksand', Math.floor(Math.random() * 2)).setDepth(-9.5e4).setScale(r / 50).setAlpha(0.95).setFlipX(Math.random() < 0.5);
    this.sands.push({ x, y, r, until: g.now + dur, img });
  }

  /** 临时流沙到时消失；玩家陷到中心时按 tick 掉血、攒震慑 */
  private updateSand() {
    const g = this.g;
    for (let i = this.sands.length - 1; i >= 0; i--) {
      const c = this.sands[i];
      const left = c.until - g.now;
      if (left <= 0) {
        c.img.destroy();
        this.sands.splice(i, 1);
      } else if (left < 1) c.img.setAlpha(left * 0.95);
    }
    if (!g.levelDef.quicksand && !this.sands.length) return;
    const p = g.player;
    const s = this.sandAt(p.x, p.y);
    if (!s) return;
    if (!this.sandHinted) {
      this.sandHinted = true;
      g.hud.toast('陷进流沙了：走得慢、往中间吸，陷到中间会被埋，赶紧往外走', '#e8c878');
    }
    if (g.over || s.d > s.r * s.def.core || g.now < this.sandTickAt) return;
    this.sandTickAt = g.now + s.def.tick;
    g.hurtPlayer(s.def.dmg * g.dmgScale(), 'earth', { inflict: { kind: 'stun', chance: 0.5, mob: true } });
  }

  // ---------- 风暴与外力 ----------

  /** 本关风暴的外观，没配就当暴风雪 */
  private get look(): StormLook {
    return this.g.levelDef.storm?.look ?? 'snow';
  }

  /** 风暴给这一系术的伤害倍率（沙暴里金 +15%，随风暴强度渐变） */
  boost(el: El) {
    const b = this.g.levelDef.storm?.boost;
    return b && b.el === el ? 1 + b.amt * this.storming() : 1;
  }

  /** 这一刻风暴的强度 0..1（起落各渐变 STORM_FADE 秒） */
  storming(now = this.g.now) {
    if (now < this.stormFrom || now >= this.stormUntil) return 0;
    return Math.min(1, (now - this.stormFrom) / STORM_FADE, (this.stormUntil - now) / STORM_FADE);
  }

  /** 推着玩家走的外力（风 + 吸寒 + 流沙），每秒像素 */
  drift(x: number, y: number): [number, number] {
    const g = this.g;
    const k = this.storming();
    let dx = 0;
    let dy = 0;
    if (k > 0) {
      const w = (g.levelDef.storm?.wind ?? 22) * k;
      dx = this.windX * w;
      dy = this.windY * w;
    }
    if (g.now < this.pullUntil) {
      const d = Math.hypot(this.pullX - x, this.pullY - y);
      if (d > 4) {
        dx += ((this.pullX - x) / d) * this.pullF;
        dy += ((this.pullY - y) / d) * this.pullF;
      }
    }
    const sand = this.sandAt(x, y);
    if (sand && sand.d > 3) {
      dx += ((sand.x - x) / sand.d) * sand.def.pull;
      dy += ((sand.y - y) / sand.d) * sand.def.pull;
    }
    return [dx, dy];
  }

  /** 往 (x, y) 拉玩家 dur 秒，每秒 force 像素 */
  pull(x: number, y: number, force: number, dur: number) {
    this.pullX = x;
    this.pullY = y;
    this.pullF = force;
    this.pullUntil = this.g.now + dur;
  }

  private updateStorm() {
    const g = this.g;
    const b = g.levelDef.storm;
    if (b && !g.over && g.elapsed >= this.stormAt) {
      const k = Math.min(1, g.elapsed / g.levelDef.duration);
      const dur = b.dur[0] + (b.dur[1] - b.dur[0]) * k;
      const every = b.every[0] + (b.every[1] - b.every[0]) * k;
      this.stormAt = g.elapsed + b.warn + dur + every * (0.85 + Math.random() * 0.3);
      if (!this.stormWarned) {
        this.stormWarned = true;
        g.hud.toast(STORM_TEXT[this.look].warn, STORM_TEXT[this.look].css);
      }
      this.storm(dur, b.warn);
    }
    this.drawStorm();
  }

  /**
   * 刮一场 dur 秒的风暴，warn 秒后起风；正在刮就接着延长（远吼、Boss 狂暴也用这个）。
   * 每场换一个风向，大致横着吹
   */
  storm(dur: number, warn = 1) {
    const g = this.g;
    const now = g.now;
    if (this.storming(now) > 0 || now < this.stormFrom) {
      this.stormUntil = Math.max(this.stormUntil, now + dur);
      return;
    }
    this.stormFrom = now + warn;
    this.stormUntil = this.stormFrom + dur;
    const a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.8;
    this.windX = Math.cos(a);
    this.windY = Math.sin(a) * 0.6;
    audio.sfx('charge', { rate: 0.35, vol: 0.4 });
    g.later(warn, () => {
      if (g.over) return;
      g.hud.toast(STORM_TEXT[this.look].start(this.windX > 0 ? '东' : '西'), STORM_TEXT[this.look].css);
    });
  }

  /** 暂停期间旋转屏幕也要补齐风暴遮罩。 */
  refreshView() { this.drawStorm(); }

  /** 视野遮罩跟着玩家，雪片（沙粒）在屏幕上顺着风斜飞；不刮的时候都藏起来 */
  private drawStorm() {
    const g = this.g;
    if (!g.levelDef.storm && !this.stormUntil) return;
    const k = this.storming();
    if (!this.veil && (k <= 0 || !g.textures?.exists(`fx_storm_${this.look}`))) return;
    const cam = g.cameras.main;
    const { width, height } = cameraView(cam);
    const ox = (cam.width - width) / 2;
    const oy = (cam.height - height) / 2;
    const storm = g.levelDef.storm;
    if (k > 0 && storm && stormTexture(g, storm.look, storm.vision, width, height)) this.veil?.setTexture(`fx_storm_${storm.look}`);
    if (!this.veil) {
      const look = this.look;
      this.veil = g.add.image(0, 0, `fx_storm_${look}`).setDepth(VEIL_DEPTH).setAlpha(0);
      for (let i = 0; i < FLAKES; i++)
        this.flakes.push(g.add.image(ox + Math.random() * width, oy + Math.random() * height, look === 'snow' ? 'fx_snowflake' : 'fx_sandgrain').setScrollFactor(0).setDepth(VEIL_DEPTH + 1).setAlpha(0));
    }
    const p = g.player;
    this.veil.setVisible(k > 0).setPosition(p.x, p.y - 6).setAlpha(k);
    const dt = Math.min(0.05, g.now - this.flakeAt);
    this.flakeAt = g.now;
    const vx = this.windX * 260 + 20;
    // 雪往下飘，沙贴着地横着刮
    const vy = this.windY * 120 + (this.look === 'snow' ? 90 : 20);
    this.flakes.forEach((f, i) => {
      f.setVisible(k > 0);
      if (k <= 0) return;
      const sp = 0.6 + (i % 5) * 0.12;
      let x = f.x + vx * sp * dt;
      let y = f.y + vy * sp * dt;
      x = ox - 8 + Phaser.Math.Wrap(x - ox + 8, 0, width + 16);
      y = oy - 8 + Phaser.Math.Wrap(y - oy + 8, 0, height + 16);
      f.setPosition(x, y).setRotation(Math.atan2(vy, vx)).setAlpha(k * (0.45 + (i % 3) * 0.2));
    });
  }
}

/** 风暴的视野遮罩颜色：暴风雪灰白，沙暴昏黄 */
const VEIL_RGB: Record<StormLook, [string, string]> = { snow: ['150,166,184', '160,174,192'], sand: ['150,120,78', '162,130,84'] };

/** 风暴的视野遮罩：中间留一圈看得清的，往外渐渐被风雪（风沙）吞掉（线性过滤，软边） */
export function stormTexture(scene: Phaser.Scene, look: StormLook, vision: number, width = VIEW_W, height = VIEW_H) {
  const tm = scene.textures;
  const key = `fx_storm_${look}`;
  const old = tm.exists(key) ? tm.get(key) as Phaser.Textures.CanvasTexture : undefined;
  const w = Math.max(VEIL_W, Math.ceil(width * 2));
  const h = Math.max(VEIL_H, Math.ceil(height * 2));
  if (old && old.width >= w && old.height >= h) return false;
  const c = old?.canvas ?? document.createElement('canvas');
  if (old) old.setSize(Math.max(w, old.width), Math.max(h, old.height));
  else { c.width = w; c.height = h; }
  const ctx = c.getContext('2d')!;
  const cx = c.width / 2;
  const cy = c.height / 2;
  const [mid, edge] = VEIL_RGB[look];
  // 纵向压扁一点，和地面透视一致
  ctx.setTransform(1, 0, 0, 0.8, 0, cy * 0.2);
  const grad = ctx.createRadialGradient(cx, cy, vision * 0.7, cx, cy, vision + 110);
  grad.addColorStop(0, `rgba(${mid},0)`);
  grad.addColorStop(0.45, `rgba(${mid},0.55)`);
  grad.addColorStop(1, `rgba(${edge},0.93)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, -c.height, c.width, c.height * 3);
  if (old) old.refresh();
  else tm.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return true;
}
