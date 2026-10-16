import Phaser from 'phaser';
import { rng } from '../art/painter';
import { getTodPreset } from '../art/vistaArt';
import type { LevelDef } from '../config/levels';
import { VIEW_W, VIEW_H } from '../config/view';

const CHUNK = 256;

/** 低频连续噪声（用于生成“四周密、中间素”的林地遮罩，让装饰物成簇聚集、留出开阔战斗空地） */
function woodlandMask(wx: number, wy: number, seed: number): number {
  const s1 = 0.0045;
  const s2 = 0.011;
  const v1 = Math.sin(wx * s1 + seed * 1.7) * Math.cos(wy * s1 - seed * 2.3);
  const v2 = Math.sin((wx + wy) * s2 + seed * 0.9) * 0.5 + Math.cos((wx - wy) * s2 - seed * 1.4) * 0.5;
  return (v1 * 0.65 + v2 * 0.35 + 1) * 0.5; // 归一化到 0..1
}

/** 山脊走向：比林地遮罩频率略高，等高线间距约 300px，围出窄道 */
function ridgeField(wx: number, wy: number, seed: number): number {
  const s = 0.0052;
  const v1 = Math.sin(wx * s + seed * 2.1) * Math.cos(wy * s * 1.15 - seed * 0.7);
  const v2 = Math.sin((wx * 0.6 - wy) * s * 1.7 + seed * 1.3);
  return (v1 * 0.7 + v2 * 0.3 + 1) * 0.5;
}

/** 山道缺口：沿山脊每隔一段断开，保证不会被围死 */
function ridgeGap(wx: number, wy: number, seed: number): boolean {
  const s = 0.021;
  return Math.sin(wx * s + seed) + Math.sin(wy * s * 1.3 - seed * 0.5) < -0.55;
}

interface Solid {
  x: number;
  y: number;
  r: number;
}

/** 岩壁的最大半径，查询时据此扩大范围 */
const SOLID_MAX = 16;

function isLargeDecor(tex: string): boolean {
  return tex === 'dc_deadtree' || tex === 'dc_bamboo' || tex === 'dc_tablet' || tex === 'dc_pine';
}

function isSmallDecor(tex: string): boolean {
  return tex === 'dc_tuft' || tex === 'dc_shoot' || tex === 'dc_fern';
}

/** 无限滚动地面 + 按林地遮罩成簇生成的装饰物 + 有碰撞的岩壁 */
export class World {
  private ground: Phaser.GameObjects.TileSprite;
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private solids = new Map<string, Solid[]>();
  /** 最近一次 push 碰到的岩石指向对象的法线 */
  hitNx = 0;
  hitNy = 0;
  private acc = 1;
  private tint: number;

  constructor(private scene: Phaser.Scene, private level: LevelDef) {
    this.tint = getTodPreset().worldTint;
    this.ground = scene.add.tileSprite(0, 0, VIEW_W, VIEW_H, level.ground).setOrigin(0).setScrollFactor(0).setDepth(-1e7);
    if (this.tint !== 0xffffff) this.ground.setTint?.(this.tint);
  }

  update(dt: number) {
    const cam = this.scene.cameras.main;
    this.ground.tilePositionX = cam.scrollX;
    this.ground.tilePositionY = cam.scrollY;
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const cx = Math.floor((cam.scrollX + VIEW_W / 2) / CHUNK);
    const cy = Math.floor((cam.scrollY + VIEW_H / 2) / CHUNK);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) this.ensure(x, y);
    for (const [k, list] of this.chunks) {
      const [x, y] = k.split(',').map(Number);
      if (Math.abs(x - cx) > 3 || Math.abs(y - cy) > 3) {
        for (const s of list) s.destroy();
        this.chunks.delete(k);
        this.solids.delete(k);
      }
    }
  }

  /** 把半径 r 的圆形对象推出岩壁，碰到返回 true，法线记在 hitNx/hitNy */
  push(o: { x: number; y: number }, r: number): boolean {
    if (!this.level.ridges) return false;
    const reach = r + SOLID_MAX;
    const x0 = Math.floor((o.x - reach) / CHUNK);
    const x1 = Math.floor((o.x + reach) / CHUNK);
    const y0 = Math.floor((o.y - reach) / CHUNK);
    const y1 = Math.floor((o.y + reach) / CHUNK);
    let hit = false;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.solids.get(`${cx},${cy}`);
        if (!list) continue;
        for (const s of list) {
          const dx = o.x - s.x;
          const dy = o.y - s.y;
          const rr = s.r + r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.001;
          const nx = d2 ? dx / d : 1;
          const ny = d2 ? dy / d : 0;
          o.x = s.x + nx * rr;
          o.y = s.y + ny * rr;
          this.hitNx = nx;
          this.hitNy = ny;
          hit = true;
        }
      }
    return hit;
  }

  private pickDecor(R: () => number, filter?: (tex: string) => boolean) {
    const pool = filter ? this.level.decor.filter((d) => filter(d.tex)) : this.level.decor;
    const items = pool.length ? pool : this.level.decor;
    const total = items.reduce((s, d) => s + d.w, 0);
    let r = R() * total;
    for (const c of items) if ((r -= c.w) <= 0) return c;
    return items[0];
  }

  private spawnOne(px: number, py: number, texKey: string, R: () => number, list: Phaser.GameObjects.Image[]) {
    const dist = Math.hypot(px, py);
    // 大件装饰远离玩家出生点，小件装饰保持基础安全距离
    if (dist < (isLargeDecor(texKey) ? 115 : 55)) return;
    const tex = this.scene.textures.get(texKey);
    const frameCount = Math.max(1, tex.frameTotal - 1);
    const frame = Math.floor(R() * frameCount);
    const img = this.scene.add.image(Math.round(px), Math.round(py), texKey, frame).setOrigin(0.5, 0.92).setDepth(py);
    if (R() < 0.5) img.setFlipX(true);
    if (this.tint !== 0xffffff) img.setTint?.(this.tint);
    list.push(img);
  }

  private ensure(x: number, y: number) {
    const k = `${x},${y}`;
    if (this.chunks.has(k)) return;
    const R = rng((x * 73856093) ^ (y * 19349663) ^ (this.level.id * 83492791));
    const list: Phaser.GameObjects.Image[] = [];
    const maxCap = this.level.decorPerChunk + 3;

    // 在每个区块内采样 2~3 个候选簇心：落入林地遮罩（mask > 0.52）则生成自然聚落簇，遮罩外只撒少量低矮草石
    const centers = 2 + Math.floor(R() * 2);
    for (let c = 0; c < centers && list.length < maxCap; c++) {
      const cx = (x + 0.18 + R() * 0.64) * CHUNK;
      const cy = (y + 0.18 + R() * 0.64) * CHUNK;
      const mask = woodlandMask(cx, cy, this.level.id);

      if (mask > 0.52) {
        // 林地聚落：1 个主景物件（枯木/古碑/翠竹/岩石）+ 2~4 个伴生中小物件环绕
        const main = this.pickDecor(R);
        this.spawnOne(cx, cy, main.tex, R, list);
        const companions = 2 + Math.floor(R() * 3);
        for (let m = 0; m < companions && list.length < maxCap; m++) {
          const ang = R() * Math.PI * 2;
          const rad = 16 + R() * 34;
          const sub = this.pickDecor(R, (t) => !isLargeDecor(t));
          this.spawnOne(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.8, sub.tex, R, list);
        }
      } else if (R() < 0.65 && list.length < maxCap) {
        // 开阔战斗区：仅零星点缀矮小草束或竹笋
        const small = this.pickDecor(R, isSmallDecor);
        this.spawnOne(cx, cy, small.tex, R, list);
      }
    }

    if (this.level.ridges) this.buildRidges(x, y, R, list);
    this.chunks.set(k, list);
  }

  /** 在区块内按 20px 网格采样，落在等高线带上且不是缺口的位置放一块巨石 */
  private buildRidges(x: number, y: number, R: () => number, list: Phaser.GameObjects.Image[]) {
    const def = this.level.ridges!;
    const seed = this.level.id;
    const solids: Solid[] = [];
    const tex = this.scene.textures.get(def.tex);
    const frames = Math.max(1, tex.frameTotal - 1);
    const STEP = 20;
    for (let gy = 0; gy < CHUNK; gy += STEP)
      for (let gx = 0; gx < CHUNK; gx += STEP) {
        const wx = x * CHUNK + gx + (R() - 0.5) * 8;
        const wy = y * CHUNK + gy + (R() - 0.5) * 8;
        // 出生点附近留一片空地
        if (Math.hypot(wx, wy) < 170) continue;
        const f = ridgeField(wx, wy, seed);
        if (!def.bands.some((b) => Math.abs(f - b) < 0.024)) continue;
        if (ridgeGap(wx, wy, seed)) continue;
        const r = def.radius * (0.85 + R() * 0.3);
        // 碰撞圆心在石头底部偏上，和贴图的落脚点对齐
        solids.push({ x: wx, y: wy - 3, r });
        const img = this.scene.add.image(Math.round(wx), Math.round(wy + r * 0.45), def.tex, Math.floor(R() * frames)).setOrigin(0.5, 0.92).setDepth(wy + r * 0.45);
        if (R() < 0.5) img.setFlipX(true);
        if (this.tint !== 0xffffff) img.setTint?.(this.tint);
        list.push(img);
      }
    this.solids.set(`${x},${y}`, solids);
  }
}
