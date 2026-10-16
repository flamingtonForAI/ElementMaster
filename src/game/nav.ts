/**
 * 绕墙寻路：把岩壁的碰撞圆标到格子上，从玩家所在格往外做 8 邻 BFS 得到距离场，
 * 被岩壁挡住的敌人、傀儡顺着距离下降的方向走，绕到缺口再过去。纯数据，不依赖 Phaser。
 */

/** 格子边长（世界像素），要小于山道缺口宽度 */
export const NAV_CELL = 12;
/** 标墙时按这个身体半径加厚 */
const AGENT_R = 7;
const UNSEEN = 0xffff;
/** 直奔前先看身前这么远有没有墙 */
const LOOK = 40;

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class NavGrid {
  readonly n: number;
  private wall: Uint8Array;
  private dist: Uint16Array;
  private queue: Int32Array;
  private half: number;
  /** 当前距离场的源点格 */
  private sx = -1;
  private sy = -1;

  constructor(size: number) {
    this.half = size / 2;
    this.n = Math.ceil(size / NAV_CELL);
    this.wall = new Uint8Array(this.n * this.n);
    this.dist = new Uint16Array(this.n * this.n).fill(UNSEEN);
    this.queue = new Int32Array(this.n * this.n);
  }

  private cx(x: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.floor((x + this.half) / NAV_CELL)));
  }

  private cy(y: number): number {
    return Math.max(0, Math.min(this.n - 1, Math.floor((y + this.half) / NAV_CELL)));
  }

  /** 标一块岩石：格心落在 r + AGENT_R 以内的格子算墙。区块重建时同一块石头会再标一次，结果不变 */
  addSolid(x: number, y: number, r: number) {
    const R = r + AGENT_R;
    const x0 = this.cx(x - R);
    const x1 = this.cx(x + R);
    const y0 = this.cy(y - R);
    const y1 = this.cy(y + R);
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const wx = -this.half + (i + 0.5) * NAV_CELL - x;
        const wy = -this.half + (j + 0.5) * NAV_CELL - y;
        if (wx * wx + wy * wy < R * R) this.wall[j * this.n + i] = 1;
      }
  }

  isWall(x: number, y: number): boolean {
    return this.wall[this.cy(y) * this.n + this.cx(x)] === 1;
  }

  /** 从 (x, y) 重算距离场 */
  update(x: number, y: number) {
    const n = this.n;
    const sx = this.cx(x);
    const sy = this.cy(y);
    this.sx = sx;
    this.sy = sy;
    const dist = this.dist;
    const wall = this.wall;
    const q = this.queue;
    dist.fill(UNSEEN);
    let head = 0;
    let tail = 0;
    const s = sy * n + sx;
    dist[s] = 0;
    q[tail++] = s;
    while (head < tail) {
      const c = q[head++];
      const x0 = c % n;
      const y0 = (c / n) | 0;
      const d = dist[c] + 1;
      for (const [dx, dy] of DIRS) {
        const nx = x0 + dx;
        const ny = y0 + dy;
        if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
        const k = ny * n + nx;
        if (dist[k] !== UNSEEN || wall[k]) continue;
        // 斜走不切墙角
        if (dx && dy && (wall[y0 * n + nx] || wall[ny * n + x0])) continue;
        dist[k] = d;
        q[tail++] = k;
      }
    }
  }

  /**
   * 在 (x, y) 处朝源点该走的方向。直线基本走得通时返回 null（照原样直奔）；
   * force 为 true 时只要有更近的邻格就给方向（刚撞墙的时候用）。
   * (hx, hy) 是直奔的方向，几个邻格一样近时选和它最顺的那个
   */
  steer(x: number, y: number, hx: number, hy: number, force = false): [number, number] | null {
    if (this.sx < 0) return null;
    const n = this.n;
    const i = this.cx(x);
    const j = this.cy(y);
    let d0 = this.dist[j * n + i];
    if (d0 === UNSEEN) {
      // 被挤进了墙格或孤岛：看邻格里有没有连通的
      d0 = UNSEEN - 1;
    } else if (!force && d0 <= Math.max(Math.abs(i - this.sx), Math.abs(j - this.sy)) + 1 && this.clear(x, y, x + hx * LOOK, y + hy * LOOK)) {
      // 8 邻 BFS 在空地上正好等于切比雪夫距离，没多绕、身前也没墙角就直奔
      return null;
    }
    let best = d0;
    let bx = 0;
    let by = 0;
    let bdot = -Infinity;
    for (const [dx, dy] of DIRS) {
      const ni = i + dx;
      const nj = j + dy;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const d = this.dist[nj * n + ni];
      if (d === UNSEEN || d >= d0 || d > best) continue;
      // 朝邻格中心走，比用固定 8 个方向更顺
      const tx = -this.half + (ni + 0.5) * NAV_CELL - x;
      const ty = -this.half + (nj + 0.5) * NAV_CELL - y;
      const tl = Math.hypot(tx, ty) || 1;
      const dot = (tx * hx + ty * hy) / tl;
      if (d < best || dot > bdot) {
        best = d;
        bx = tx / tl;
        by = ty / tl;
        bdot = dot;
      }
    }
    if (best >= d0) return null;
    return [bx, by];
  }

  /** 两点之间的连线有没有穿过墙格 */
  clear(ax: number, ay: number, bx: number, by: number): boolean {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(d / (NAV_CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (this.isWall(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }
}
