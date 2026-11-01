/**
 * 地形噪声：林地遮罩、山脊、山道缺口。纯函数，World 生成装饰和岩壁、小地图缩略图、刷道具避让都用这一套。
 * 用哈希格点上的平滑值噪声叠两层，不会像正弦拼出来的那样成片重复。
 */

import type { El } from '../config/elements';

/** 山脊配置，见 LevelDef.ridges */
export interface RidgeDef {
  tex: string;
  radius: number;
  /** 等高线取值，一条值一道山脊 */
  bands: number[];
  /** 噪声格子大小（世界像素），越大山脊越舒展、越稀 */
  scale: number;
  /** 山道缺口占比的门槛（0..1），越大缺口越多 */
  gap: number;
}

/** 山脊的半宽（世界像素） */
export const RIDGE_HALF = 10;

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 单层值噪声，0..1 */
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 两层叠加；第二层转个角度，压掉格点的横竖纹 */
function fbm(x: number, y: number, seed: number): number {
  const rx = x * 0.8 - y * 0.6;
  const ry = x * 0.6 + y * 0.8;
  return vnoise(x, y, seed) * 0.68 + vnoise(rx * 2.1 + 31.7, ry * 2.1 - 17.3, seed + 7) * 0.32;
}

/** 林地遮罩 0..1：高处成簇长装饰物，低处是开阔的战斗空地 */
export function woodland(wx: number, wy: number, seed: number): number {
  return fbm(wx / 520, wy / 520, seed * 31 + 3);
}

function ridgeField(wx: number, wy: number, seed: number, def: RidgeDef): number {
  return fbm(wx / def.scale, wy / def.scale, seed * 17 + 11);
}

/** 到最近一条山脊中线的距离（世界像素）：数值差除以梯度，山势陡缓不影响粗细 */
export function ridgeDist(wx: number, wy: number, seed: number, def: RidgeDef): number {
  const f = ridgeField(wx, wy, seed, def);
  const e = 2;
  const gx = (ridgeField(wx + e, wy, seed, def) - f) / e;
  const gy = (ridgeField(wx, wy + e, seed, def) - f) / e;
  const g = Math.hypot(gx, gy) || 1e-6;
  let best = Infinity;
  for (const b of def.bands) best = Math.min(best, Math.abs(f - b) / g);
  return best;
}

/** 山道缺口：沿山脊断开的地方，保证不会被围死 */
export function ridgeGap(wx: number, wy: number, seed: number, def: RidgeDef): boolean {
  return vnoise(wx / 70, wy / 70, seed * 13 + 5) < def.gap;
}

/** 这里有没有岩壁（pad：向外多算的宽度） */
export function isRidge(wx: number, wy: number, seed: number, def: RidgeDef, pad = 0): boolean {
  return ridgeDist(wx, wy, seed, def) < RIDGE_HALF + pad && !ridgeGap(wx, wy, seed, def);
}

/** 稀疏的固定点位（熔岩口、煞气剑阵）：每 cell 见方一格，按哈希决定这格有没有、落在格内哪里 */
export interface SpotDef {
  cell: number;
  /** 一格里有点位的几率 */
  chance: number;
  radius: number;
  /** 只在这一相起作用（东海归墟：浅滩涨潮才积水，火山口退潮才喷；昆仑五气各管一种），不填一直有 */
  phase?: El;
}

/**
 * 第 (ix, iy) 格的点位，没有返回 null。离出生点、地图边缘太近，或者挨着山脊的格子不放。
 * salt 区分同一关里的不同点位种类
 */
export function spotAt(ix: number, iy: number, seed: number, salt: number, def: SpotDef, half: number, ridge?: RidgeDef): [number, number] | null {
  const s = seed * 97 + salt;
  if (hash(ix, iy, s) >= def.chance) return null;
  const x = (ix + 0.2 + hash(ix, iy, s + 1) * 0.6) * def.cell;
  const y = (iy + 0.2 + hash(ix, iy, s + 2) * 0.6) * def.cell;
  if (Math.hypot(x, y) < 110 + def.radius) return null;
  const m = def.radius + 40;
  if (Math.abs(x) > half - m || Math.abs(y) > half - m) return null;
  // 缺口处也不放，免得点位边缘贴着缺口两侧的石头
  if (ridge && ridgeDist(x, y, seed, ridge) < RIDGE_HALF + def.radius) return null;
  return [x, y];
}
