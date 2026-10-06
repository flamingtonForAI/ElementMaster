import Phaser from 'phaser';

/** 像素画布：颜色用 0xRRGGBB，-1 表示透明 */
export class PC {
  readonly c: Int32Array;
  readonly a: Uint8Array;
  /** 绘制偏移，用来整体移动上半身等部件 */
  ox = 0;
  oy = 0;

  constructor(readonly w: number, readonly h: number) {
    this.c = new Int32Array(w * h).fill(-1);
    this.a = new Uint8Array(w * h);
  }

  set(x: number, y: number, col: number, alpha = 255) {
    x = Math.round(x + this.ox);
    y = Math.round(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.c[i] = col;
    this.a[i] = alpha;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.c[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, col: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }

  span(y: number, x0: number, x1: number, col: number) {
    for (let x = x0; x <= x1; x++) this.set(x, y, col);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, col: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, col);
      }
    }
  }

  circle(cx: number, cy: number, r: number, col: number) {
    this.ellipse(cx, cy, r, r, col);
  }

  line(x0: number, y0: number, x1: number, y1: number, col: number, width = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (width <= 1) this.set(x, y, col);
      else this.rect(Math.round(x - (width - 1) / 2), Math.round(y - (width - 1) / 2), width, width, col);
    }
  }

  /** 沿折线画一条带宽度的线（头发、尾巴等） */
  strand(pts: [number, number][], col: number, width = 2) {
    for (let i = 0; i < pts.length - 1; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, width);
  }

  /** 把已有颜色 from 替换成 to（用于在某个区域做阴影） */
  recolor(x0: number, y0: number, x1: number, y1: number, from: number, to: number) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.get(x, y) === from) this.set(x - this.ox, y - this.oy, to);
  }

  /** 四邻域外描边 */
  outline(col: number) {
    const { w, h, c, a } = this;
    const add: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (c[i] !== -1) continue;
        const n =
          (x > 0 && c[i - 1] !== -1 && a[i - 1] === 255) ||
          (x < w - 1 && c[i + 1] !== -1 && a[i + 1] === 255) ||
          (y > 0 && c[i - w] !== -1 && a[i - w] === 255) ||
          (y < h - 1 && c[i + w] !== -1 && a[i + w] === 255);
        if (n) add.push(i);
      }
    }
    for (const i of add) {
      c[i] = col;
      a[i] = 255;
    }
  }

  /** 只画在透明像素上的半透明椭圆（脚底阴影、元素底座） */
  under(cx: number, cy: number, rx: number, ry: number, col: number, alpha: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const i = y * this.w + x;
        if (dx * dx + dy * dy <= 1 && this.c[i] === -1) {
          this.c[i] = col;
          this.a[i] = alpha;
        }
      }
    }
  }

  /** 只画在透明像素上的椭圆环 */
  underRing(cx: number, cy: number, rx: number, ry: number, col: number, alpha: number) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = dx * dx + dy * dy;
        const i = y * this.w + x;
        if (d <= 1 && d >= 0.55 && this.c[i] === -1) {
          this.c[i] = col;
          this.a[i] = alpha;
        }
      }
    }
  }

  blit(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const img = ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.c.length; i++) {
      const col = this.c[i];
      if (col === -1) continue;
      img.data[i * 4] = (col >> 16) & 255;
      img.data[i * 4 + 1] = (col >> 8) & 255;
      img.data[i * 4 + 2] = col & 255;
      img.data[i * 4 + 3] = this.a[i];
    }
    ctx.putImageData(img, ox, oy);
  }
}

/** 把一组帧排成图集，注册为编号帧 0..n-1 */
export function addSheet(scene: Phaser.Scene, key: string, frames: PC[]) {
  const fw = frames[0].w;
  const fh = frames[0].h;
  const cols = Math.min(frames.length, 16);
  const rows = Math.ceil(frames.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * fw;
  canvas.height = rows * fh;
  const ctx = canvas.getContext('2d')!;
  frames.forEach((f, i) => f.blit(ctx, (i % cols) * fw, Math.floor(i / cols) * fh));
  const tex = scene.textures.addCanvas(key, canvas)!;
  frames.forEach((_, i) => tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
}

export function addAnim(scene: Phaser.Scene, key: string, tex: string, frames: number[], frameRate: number, repeat = -1) {
  scene.anims.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate, repeat });
}

/** 可复现的伪随机 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const OUTLINE = 0x1c1424;
