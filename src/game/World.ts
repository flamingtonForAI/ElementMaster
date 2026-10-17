import Phaser from 'phaser';
import { rng } from '../art/painter';
import { getTodPreset } from '../art/vistaArt';
import type { LevelDef } from '../config/levels';
import { POI_CLEAR_R } from '../config/map';
import { VIEW_W, VIEW_H } from '../config/view';
import { woodland, isRidge, spotAt, type SpotDef } from './terrain';
import { NavGrid } from './nav';

const CHUNK = 256;

interface Solid {
  x: number;
  y: number;
  r: number;
}

/** 岩壁的最大半径，查询时据此扩大范围 */
const SOLID_MAX = 16;

function isLargeDecor(tex: string): boolean {
  return tex === 'dc_deadtree' || tex === 'dc_bamboo' || tex === 'dc_tablet' || tex === 'dc_pine' || tex === 'dc_scorch';
}

function isSmallDecor(tex: string): boolean {
  return tex === 'dc_tuft' || tex === 'dc_shoot' || tex === 'dc_fern' || tex === 'dc_cinder' || tex === 'dc_bones' || tex === 'dc_sword';
}

/** 地图上的固定点位种类：熔岩口、煞气剑阵 */
export type SpotKind = 'lava' | 'zone';
const SPOT_SALT: Record<SpotKind, number> = { lava: 1, zone: 2 };

/** 剑阵是贴地的椭圆，纵向压扁到这个比例 */
export const ZONE_SQUASH = 0.72;

/** 地图缩略贴图每个像素对应的世界像素 */
export const MAP_TEXEL = 12;

/** 贴图的平均颜色（取不到时给个暗土色） */
function averageColor(src: HTMLCanvasElement): [number, number, number] {
  const d = src.getContext?.('2d')?.getImageData(0, 0, src.width, src.height).data;
  if (!d) return [90, 80, 60];
  let r = 0;
  let g = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
    c++;
  }
  return c ? [r / c, g / c, b / c] : [90, 80, 60];
}

/** 边缘墙的厚度（地图外侧） */
const EDGE_BAND = 44;

/** 方形有界地图：滚动地面 + 按林地遮罩成簇生成的装饰物 + 有碰撞的岩壁 + 边缘墙 */
export class World {
  private ground: Phaser.GameObjects.TileSprite;
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private solids = new Map<string, Solid[]>();
  /** 最近一次 push 碰到的岩石指向对象的法线 */
  hitNx = 0;
  hitNy = 0;
  private acc = 1;
  private tint: number;
  /** 地图半边长，可走范围是 [-half, half] */
  readonly half: number;
  /** 绕岩壁的距离场，没有山脊的关卡为 null */
  readonly nav: NavGrid | null;
  private navAcc = Infinity;
  /** 点位按格子缓存，键为 kind:ix,iy */
  private spotCache = new Map<string, [number, number] | null>();

  /** reserved：兴趣点位置，周围不放装饰和岩壁 */
  constructor(private scene: Phaser.Scene, private level: LevelDef, private reserved: { x: number; y: number }[] = []) {
    this.tint = getTodPreset().worldTint;
    this.half = level.size / 2;
    this.nav = level.ridges ? new NavGrid(level.size) : null;
    this.ground = scene.add.tileSprite(0, 0, VIEW_W, VIEW_H, level.ground).setOrigin(0).setScrollFactor(0).setDepth(-1e7);
    if (this.tint !== 0xffffff) this.ground.setTint?.(this.tint);
    // 地图外压暗
    const h = this.half;
    const far = h + 2000;
    scene.add.graphics().setDepth(-1e6).fillStyle(0x0a0810, 0.62)
      .fillRect(-far, -far, far * 2, far - h)
      .fillRect(-far, h, far * 2, far - h)
      .fillRect(-far, -h, far - h, h * 2)
      .fillRect(h, -h, far - h, h * 2);
  }

  /** 点是否在地图内（留 m 的边距） */
  inside(x: number, y: number, m = 0): boolean {
    return Math.abs(x) <= this.half - m && Math.abs(y) <= this.half - m;
  }

  private spotDef(kind: SpotKind): SpotDef | undefined {
    return kind === 'lava' ? this.level.lava : this.level.swordZones;
  }

  private spot(kind: SpotKind, ix: number, iy: number): [number, number] | null {
    const k = `${kind}:${ix},${iy}`;
    let v = this.spotCache.get(k);
    if (v === undefined) {
      v = spotAt(ix, iy, this.level.id, SPOT_SALT[kind], this.spotDef(kind)!, this.half, this.level.ridges);
      this.spotCache.set(k, v);
    }
    return v;
  }

  /** 矩形范围内的点位 */
  spotsIn(kind: SpotKind, x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const def = this.spotDef(kind);
    if (!def) return [];
    const out: [number, number][] = [];
    for (let iy = Math.floor(y0 / def.cell); iy <= Math.floor(y1 / def.cell); iy++)
      for (let ix = Math.floor(x0 / def.cell); ix <= Math.floor(x1 / def.cell); ix++) {
        const p = this.spot(kind, ix, iy);
        if (p && p[0] >= x0 && p[0] < x1 && p[1] >= y0 && p[1] < y1) out.push(p);
      }
    return out;
  }

  /** 这里在不在煞气剑阵里：在就返回阵给敌人加的护甲 */
  zoneArmor(x: number, y: number): number {
    const def = this.level.swordZones;
    if (!def) return 0;
    const ix = Math.floor(x / def.cell);
    const iy = Math.floor(y / def.cell);
    for (let j = iy - 1; j <= iy + 1; j++)
      for (let i = ix - 1; i <= ix + 1; i++) {
        const p = this.spot('zone', i, j);
        if (p && Math.hypot(x - p[0], (y - p[1]) / ZONE_SQUASH) < def.radius) return def.armor;
      }
    return 0;
  }

  /** 离熔岩口、剑阵太近，不放装饰 */
  private nearSpot(x: number, y: number): boolean {
    for (const kind of ['lava', 'zone'] as const) {
      const def = this.spotDef(kind);
      if (!def) continue;
      const r = def.radius + 10;
      if (this.spotsIn(kind, x - r, y - r, x + r, y + r).some(([px, py]) => Math.hypot(px - x, py - y) < r)) return true;
    }
    return false;
  }

  /** 把点夹回地图内 */
  clampPt(x: number, y: number, m = 0): [number, number] {
    const h = this.half - m;
    return [Math.max(-h, Math.min(h, x)), Math.max(-h, Math.min(h, y))];
  }

  /** 把半径 r 的对象夹回地图内，碰到边返回 true，法线记在 hitNx/hitNy */
  clamp(o: { x: number; y: number }, r: number): boolean {
    const h = this.half - r;
    let hit = false;
    if (o.x < -h) (o.x = -h), (this.hitNx = 1), (this.hitNy = 0), (hit = true);
    else if (o.x > h) (o.x = h), (this.hitNx = -1), (this.hitNy = 0), (hit = true);
    if (o.y < -h) (o.y = -h), (this.hitNx = 0), (this.hitNy = 1), (hit = true);
    else if (o.y > h) (o.y = h), (this.hitNx = 0), (this.hitNy = -1), (hit = true);
    return hit;
  }

  /**
   * 生成整张地图的缩略贴图（每像素 MAP_TEXEL 世界像素）：底色取地砖平均色压暗，
   * 林地更深、空地偏亮，岩壁画成浅色山脊线、缺口留空，边缘一圈墙色。返回贴图 key
   */
  buildMapTexture(): string {
    const key = `minimap_${this.level.id}`;
    const tm = this.scene.textures;
    // 只取决于关卡，生成过就复用
    if (tm.exists(key)) return key;
    const n = Math.ceil(this.level.size / MAP_TEXEL);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(n, n);
    const [r0, g0, b0] = averageColor(tm.get(this.level.ground).getSourceImage() as HTMLCanvasElement);
    const def = this.level.ridges;
    const seed = this.level.id;
    for (let ty = 0; ty < n; ty++)
      for (let tx = 0; tx < n; tx++) {
        const wx = -this.half + (tx + 0.5) * MAP_TEXEL;
        const wy = -this.half + (ty + 0.5) * MAP_TEXEL;
        // 林地越密越暗，空地留亮
        const wood = Math.max(0, Math.min(1, (woodland(wx, wy, seed) - 0.48) / 0.2));
        let k = 0.62 - 0.3 * wood;
        let [r, g, b] = [r0 * k, g0 * k, b0 * k];
        const edge = tx === 0 || ty === 0 || tx === n - 1 || ty === n - 1;
        const ridge = def && Math.hypot(wx, wy) >= 170 && isRidge(wx, wy, seed, def, MAP_TEXEL * 0.25);
        if (edge || ridge) {
          k = 1;
          [r, g, b] = [150, 142, 158];
        }
        const i = (ty * n + tx) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    // 熔岩口画成橘红点，剑阵画成暗红圈
    const dot = (wx: number, wy: number, col: [number, number, number]) => {
      const tx = Math.floor((wx + this.half) / MAP_TEXEL);
      const ty = Math.floor((wy + this.half) / MAP_TEXEL);
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) return;
      const i = (ty * n + tx) * 4;
      [img.data[i], img.data[i + 1], img.data[i + 2]] = col;
    };
    const h = this.half;
    for (const [x, y] of this.spotsIn('lava', -h, -h, h, h))
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) dot(x + dx * MAP_TEXEL, y + dy * MAP_TEXEL, [226, 104, 48]);
    const zr = this.level.swordZones?.radius ?? 0;
    for (const [x, y] of this.spotsIn('zone', -h, -h, h, h))
      for (let a = 0; a < 24; a++) dot(x + Math.cos((a / 24) * Math.PI * 2) * zr, y + Math.sin((a / 24) * Math.PI * 2) * zr * ZONE_SQUASH, [170, 60, 56]);
    ctx.putImageData(img, 0, 0);
    tm.addCanvas(key, canvas);
    return key;
  }

  /** 这里是否在岩壁上或贴着岩壁（按山脊噪声直接算，不依赖区块是否已生成），刷道具时用来避开 */
  blocked(x: number, y: number): boolean {
    const def = this.level.ridges;
    if (!def) return false;
    // 放宽到能容下道具和石头半径
    return isRidge(x, y, this.level.id, def, 22);
  }

  private nearReserved(x: number, y: number, r: number): boolean {
    const rr = (POI_CLEAR_R + r) ** 2;
    return this.reserved.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < rr);
  }

  /** 每 0.2 秒以 (x, y) 为源点重算距离场 */
  updateNav(x: number, y: number, dt: number) {
    if (!this.nav) return;
    this.navAcc += dt;
    if (this.navAcc < 0.2) return;
    this.navAcc = 0;
    this.nav.update(x, y);
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

  /** 把半径 r 的圆形对象推出岩壁和地图边缘，碰到返回 true，法线记在 hitNx/hitNy */
  push(o: { x: number; y: number }, r: number): boolean {
    const edge = this.clamp(o, r);
    if (!this.level.ridges) return edge;
    const reach = r + SOLID_MAX;
    const x0 = Math.floor((o.x - reach) / CHUNK);
    const x1 = Math.floor((o.x + reach) / CHUNK);
    const y0 = Math.floor((o.y - reach) / CHUNK);
    const y1 = Math.floor((o.y + reach) / CHUNK);
    let hit = edge;
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
    if (!this.inside(px, py, 8) || this.nearReserved(px, py, 6) || this.nearSpot(px, py)) return;
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
      const mask = woodland(cx, cy, this.level.id);

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
    this.buildSpots(x, y, R, list);
    this.buildEdge(x, y, R, list);
    this.chunks.set(k, list);
  }

  /** 区块里的熔岩口（贴地的熔岩壳）和煞气剑阵（暗红阵纹 + 一圈插地的残剑） */
  private buildSpots(x: number, y: number, R: () => number, list: Phaser.GameObjects.Image[]) {
    const x0 = x * CHUNK;
    const y0 = y * CHUNK;
    const add = (img: Phaser.GameObjects.Image) => {
      if (this.tint !== 0xffffff) img.setTint?.(this.tint);
      list.push(img);
    };
    for (const [px, py] of this.spotsIn('lava', x0, y0, x0 + CHUNK, y0 + CHUNK)) {
      const r = this.level.lava!.radius;
      add(this.scene.add.image(Math.round(px), Math.round(py), 'dc_lava', Math.floor(R() * 2)).setScale(r / 20).setDepth(-1e5).setFlipX(R() < 0.5));
    }
    const def = this.level.swordZones;
    for (const [px, py] of this.spotsIn('zone', x0, y0, x0 + CHUNK, y0 + CHUNK)) {
      const r = def!.radius;
      add(this.scene.add.image(Math.round(px), Math.round(py), 'fx_zone').setScale(r / 60, (r / 60) * ZONE_SQUASH).setDepth(-1e5));
      const n = 9;
      const off = R() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        const sx = px + Math.cos(a) * (r - 4);
        const sy = py + Math.sin(a) * (r - 4) * ZONE_SQUASH;
        add(this.scene.add.image(Math.round(sx), Math.round(sy), 'dc_sword', Math.floor(R() * 3)).setOrigin(0.5, 0.92).setDepth(sy).setFlipX(R() < 0.5));
      }
    }
  }

  /** 地图外侧一圈密排的边缘墙（只是贴图，碰撞靠 clamp） */
  private buildEdge(x: number, y: number, R: () => number, list: Phaser.GameObjects.Image[]) {
    const h = this.half;
    const x0 = x * CHUNK;
    const y0 = y * CHUNK;
    // 区块远在墙外，或完全在地图内侧时跳过
    const out = h + EDGE_BAND;
    if (x0 > out || x0 + CHUNK < -out || y0 > out || y0 + CHUNK < -out) return;
    const inner = h - 2;
    if (x0 >= -inner && x0 + CHUNK <= inner && y0 >= -inner && y0 + CHUNK <= inner) return;
    const tex = this.scene.textures.get(this.level.edge);
    const frames = Math.max(1, tex.frameTotal - 1);
    const STEP = 15;
    for (let gy = 0; gy < CHUNK; gy += STEP)
      for (let gx = 0; gx < CHUNK; gx += STEP) {
        const wx = x0 + gx + (R() - 0.5) * 7;
        const wy = y0 + gy + (R() - 0.5) * 7;
        const d = Math.max(Math.abs(wx), Math.abs(wy)) - h;
        if (d < -2 || d > EDGE_BAND) continue;
        const img = this.scene.add.image(Math.round(wx), Math.round(wy), this.level.edge, Math.floor(R() * frames)).setOrigin(0.5, 0.92).setDepth(wy);
        if (R() < 0.5) img.setFlipX(true);
        if (this.tint !== 0xffffff) img.setTint?.(this.tint);
        list.push(img);
      }
  }

  /** 在区块内按略小于石头直径的网格采样，落在山脊上且不是缺口的位置放一块岩壁 */
  private buildRidges(x: number, y: number, R: () => number, list: Phaser.GameObjects.Image[]) {
    const def = this.level.ridges!;
    const seed = this.level.id;
    const solids: Solid[] = [];
    const tex = this.scene.textures.get(def.tex);
    const frames = Math.max(1, tex.frameTotal - 1);
    const STEP = Math.max(14, Math.round(def.radius * 1.6));
    for (let gy = 0; gy < CHUNK; gy += STEP)
      for (let gx = 0; gx < CHUNK; gx += STEP) {
        const wx = x * CHUNK + gx + (R() - 0.5) * 8;
        const wy = y * CHUNK + gy + (R() - 0.5) * 8;
        // 出生点附近留一片空地；地图外和兴趣点旁不放
        if (Math.hypot(wx, wy) < 170) continue;
        if (!this.inside(wx, wy, 10) || this.nearReserved(wx, wy, def.radius)) continue;
        if (!isRidge(wx, wy, seed, def)) continue;
        const r = def.radius * (0.85 + R() * 0.3);
        // 碰撞圆心在石头底部偏上，和贴图的落脚点对齐
        solids.push({ x: wx, y: wy - 3, r });
        this.nav?.addSolid(wx, wy - 3, r);
        const img = this.scene.add.image(Math.round(wx), Math.round(wy + r * 0.45), def.tex, Math.floor(R() * frames)).setOrigin(0.5, 0.92).setDepth(wy + r * 0.45);
        if (R() < 0.5) img.setFlipX(true);
        if (this.tint !== 0xffffff) img.setTint?.(this.tint);
        list.push(img);
      }
    this.solids.set(`${x},${y}`, solids);
  }
}
