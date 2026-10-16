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

function isLargeDecor(tex: string): boolean {
  return tex === 'dc_deadtree' || tex === 'dc_bamboo' || tex === 'dc_tablet';
}

function isSmallDecor(tex: string): boolean {
  return tex === 'dc_tuft' || tex === 'dc_shoot' || tex === 'dc_fern';
}

/** 无限滚动地面 + 按林地遮罩成簇生成的装饰物 */
export class World {
  private ground: Phaser.GameObjects.TileSprite;
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
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
      }
    }
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

    this.chunks.set(k, list);
  }
}
