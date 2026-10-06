import Phaser from 'phaser';
import { rng } from '../art/painter';
import type { LevelDef } from '../config/levels';
import { VIEW_W, VIEW_H } from '../config/view';

const CHUNK = 256;

/** 无限滚动地面 + 按区块生成的装饰物 */
export class World {
  private ground: Phaser.GameObjects.TileSprite;
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private acc = 1;

  constructor(private scene: Phaser.Scene, private level: LevelDef) {
    this.ground = scene.add.tileSprite(0, 0, VIEW_W, VIEW_H, level.ground).setOrigin(0).setScrollFactor(0).setDepth(-1e7);
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

  private ensure(x: number, y: number) {
    const k = `${x},${y}`;
    if (this.chunks.has(k)) return;
    const R = rng((x * 73856093) ^ (y * 19349663) ^ (this.level.id * 83492791));
    const list: Phaser.GameObjects.Image[] = [];
    const total = this.level.decor.reduce((s, d) => s + d.w, 0);
    const n = Math.floor(this.level.decorPerChunk * (0.6 + R() * 0.8));
    for (let i = 0; i < n; i++) {
      let r = R() * total;
      let d = this.level.decor[0];
      for (const c of this.level.decor) if ((r -= c.w) <= 0) { d = c; break; }
      const px = x * CHUNK + R() * CHUNK;
      const py = y * CHUNK + R() * CHUNK;
      if (Math.hypot(px, py) < 50) continue;
      const tex = this.scene.textures.get(d.tex);
      const frame = Math.floor(R() * (tex.frameTotal - 1));
      const img = this.scene.add.image(Math.round(px), Math.round(py), d.tex, frame).setOrigin(0.5, 0.92).setDepth(py);
      if (R() < 0.5) img.setFlipX(true);
      list.push(img);
    }
    this.chunks.set(k, list);
  }
}
