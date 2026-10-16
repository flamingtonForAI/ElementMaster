import Phaser from 'phaser';
import { PC, rng } from './painter';

export type TodId = 'dawn' | 'day' | 'dusk' | 'night';

export interface TodPreset {
  id: TodId;
  name: string;
  /** 面板遮罩透明度 */
  veilAlpha: number;
  /** 局内地面与装饰的轻柔时辰染色（角色、敌人、宝石、特效、HUD 不染色，且全时辰通过 OKLab 可读性守门） */
  worldTint: number;
}

export const TOD_LIST: TodPreset[] = [
  { id: 'dawn', name: '清晨', veilAlpha: 0.16, worldTint: 0xfff6ec },
  { id: 'day', name: '白天', veilAlpha: 0.12, worldTint: 0xffffff },
  { id: 'dusk', name: '傍晚', veilAlpha: 0.18, worldTint: 0xffeadd },
  { id: 'night', name: '夜里', veilAlpha: 0.24, worldTint: 0xdce8f8 },
];

const TOD_KEY = 'wuxing_tod';
let currentTod: TodId = 'dusk';

try {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(TOD_KEY) : null;
  if (saved === 'dawn' || saved === 'day' || saved === 'dusk' || saved === 'night') {
    currentTod = saved;
  }
} catch {
  // 忽略无 localStorage 环境
}

export function getTod(): TodId {
  return currentTod;
}

export function getTodPreset(id: TodId = currentTod): TodPreset {
  return TOD_LIST.find((t) => t.id === id) ?? TOD_LIST[2];
}

export function setTod(id: TodId) {
  currentTod = id;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOD_KEY, id);
  } catch {
    // 忽略无 localStorage 环境
  }
}

export function getVistaTextureKey(id: TodId = currentTod): string {
  return `bg_vista_${id}`;
}

export function getVistaCloudKey(id: TodId = currentTod): string {
  return `bg_vista_clouds_${id}`;
}

export function getVistaFgKey(id: TodId = currentTod): string {
  return `bg_vista_fg_${id}`;
}

interface VistaPalette {
  sky: number[];
  cloudHi: number;
  cloudMid: number;
  cloudSh: number;
  farMt: number;
  farMtHi: number;
  midMt: number;
  midMtSh: number;
  midMtHi: number;
  mist: number;
  cliff: [number, number, number, number]; // [deep, shadow, mid, hi]
  leftCliff: [number, number, number]; // 左侧 40% 菜单留白暗崖色阶（保证文字对比度 >= 4.5:1）
  pine: [number, number, number, number]; // 古松与竹林色阶 [deep, shadow, mid, hi]
  water: [number, number, number]; // 瀑布与溪流 [deep, mid, foam]
  stone: [number, number, number]; // 石阶与剑碑 [shadow, mid, hi]
  roof: [number, number, number, number]; // 仙阁飞檐青瓦
  wall: [number, number, number]; // 墙体
  wood: [number, number, number]; // 朱漆廊柱与木构
  fireGlow: [number, number, number]; // 丹炉火光与窗灯 [outer, mid, core]
  bronze: [number, number, number]; // 丹炉与铜钟（金/火）
  stars: boolean;
  sunMoonCol: number;
  sunMoonY: number;
}

const PALETTES: Record<TodId, VistaPalette> = {
  // 清晨：东方既白、金霞初染、云海苍茫
  dawn: {
    sky: [0x263254, 0x3b4b74, 0x5c648e, 0x8c7898, 0xc2928e, 0xe8b88c, 0xfce0a8],
    cloudHi: 0xfff4d4,
    cloudMid: 0xebb898,
    cloudSh: 0x7e6688,
    farMt: 0x48587e,
    farMtHi: 0x868ea8,
    midMt: 0x304664,
    midMtSh: 0x20324c,
    midMtHi: 0x627c92,
    mist: 0xeed0b4,
    cliff: [0x1a2838, 0x2c4252, 0x46626a, 0x789288],
    leftCliff: [0x101624, 0x182234, 0x223044],
    pine: [0x10242c, 0x1c3c3c, 0x2e5e4e, 0x568c62],
    water: [0x3c6484, 0x78a8c4, 0xeef8ff],
    stone: [0x424a5e, 0x6c7688, 0xa8b0b8],
    roof: [0x1e2438, 0x323c56, 0x4e5c7a, 0x8492a8],
    wall: [0x8e7c74, 0xbcab98, 0xe4d6be],
    wood: [0x4a2424, 0x783630, 0xa85242],
    fireGlow: [0xe86e30, 0xffb448, 0xfff2a8],
    bronze: [0x3a3228, 0x6c5838, 0xb89652],
    stars: false,
    sunMoonCol: 0xfff0b8,
    sunMoonY: 50,
  },
  // 白天：碧空万里、青峰叠翠、飞瀑流泉
  day: {
    sky: [0x2c64b0, 0x3e7cc8, 0x5698de, 0x74b4ee, 0x96cef8, 0xb8e2fc, 0xd8f2ff],
    cloudHi: 0xffffff,
    cloudMid: 0xe2eef8,
    cloudSh: 0x8ca8cc,
    farMt: 0x5278a4,
    farMtHi: 0x84a8cc,
    midMt: 0x345878,
    midMtSh: 0x243e58,
    midMtHi: 0x5c88a4,
    mist: 0xcce8fa,
    cliff: [0x1c303e, 0x2e4c58, 0x4a7072, 0x7ca292],
    leftCliff: [0x121a28, 0x1a2638, 0x243448],
    pine: [0x122830, 0x1e4442, 0x346a52, 0x629e66],
    water: [0x3e7498, 0x82bce0, 0xf4fcff],
    stone: [0x485266, 0x768294, 0xb4bec8],
    roof: [0x20283c, 0x364460, 0x526688, 0x829ab8],
    wall: [0x98887e, 0xc8b8a4, 0xf0e4ce],
    wood: [0x522828, 0x823c34, 0xb45a48],
    fireGlow: [0xd8682c, 0xf6b048, 0xfff0a8],
    bronze: [0x3e362a, 0x74603c, 0xc4a258],
    stars: false,
    sunMoonCol: 0xfffbe0,
    sunMoonY: 26,
  },
  // 傍晚（基准时辰）：紫金暮霞、丹炉生烟、孤峰剑影
  dusk: {
    sky: [0x20183a, 0x3a2452, 0x603062, 0x8e4264, 0xbe5e58, 0xe48650, 0xfcc066],
    cloudHi: 0xffdc8c,
    cloudMid: 0xe27860,
    cloudSh: 0x5c325a,
    farMt: 0x422e5c,
    farMtHi: 0x825278,
    midMt: 0x2c2046,
    midMtSh: 0x1c1432,
    midMtHi: 0x644264,
    mist: 0xeca074,
    cliff: [0x161e30, 0x263446, 0x42545c, 0x7e866c],
    leftCliff: [0x0e1220, 0x151c2e, 0x1e283c],
    pine: [0x0e1e2a, 0x1a3438, 0x2e5444, 0x648252],
    water: [0x38486c, 0x787c9c, 0xffd8a8],
    stone: [0x3c3c52, 0x666276, 0xa89892],
    roof: [0x1a1a30, 0x2c2e48, 0x464868, 0x82748e],
    wall: [0x826862, 0xb28e7c, 0xe0b898],
    wood: [0x421e20, 0x6e322a, 0xa24e38],
    fireGlow: [0xf06424, 0xffaa38, 0xfff298],
    bronze: [0x362822, 0x684a30, 0xb88644],
    stars: true,
    sunMoonCol: 0xffb858,
    sunMoonY: 56,
  },
  // 夜里：星垂平野、月朗松间、山门灯火
  night: {
    sky: [0x0a0f22, 0x101832, 0x162242, 0x1e2e54, 0x263c66, 0x304a78, 0x3a5888],
    cloudHi: 0x829ec2,
    cloudMid: 0x425a80,
    cloudSh: 0x1c2a46,
    farMt: 0x182846,
    farMtHi: 0x344e74,
    midMt: 0x121e38,
    midMtSh: 0x0b1428,
    midMtHi: 0x263e60,
    mist: 0x325074,
    cliff: [0x0a1624, 0x142638, 0x223c4c, 0x3c606e],
    leftCliff: [0x070c18, 0x0c1424, 0x121e32],
    pine: [0x081420, 0x102432, 0x1c3c44, 0x30605c],
    water: [0x1e3858, 0x48749c, 0xb8e2ff],
    stone: [0x242c42, 0x3e4a64, 0x687894],
    roof: [0x101628, 0x1a243c, 0x283858, 0x4a6288],
    wall: [0x4c4e62, 0x6e7288, 0x989eb4],
    wood: [0x261820, 0x422832, 0x643e48],
    fireGlow: [0xe86424, 0xffaa38, 0xfff4a8],
    bronze: [0x222028, 0x423c38, 0x7c7054],
    stars: true,
    sunMoonCol: 0xf4f8ff,
    sunMoonY: 28,
  },
};

/** 绘制平展层叠的迎客古松冠（木元素标志剪影，区别于西式圆球橡树） */
function drawPineCanopy(p: PC, cx: number, cy: number, rx: number, ry: number, pal: VistaPalette) {
  const [p0, p1, p2, p3] = pal.pine;
  p.ellipse(cx, cy + 1, rx, ry, p0);
  p.ellipse(cx, cy, rx * 0.92, ry * 0.85, p1);
  // 水平松针簇阶梯
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry * 0.5); dy++) {
    const t = 1 - Math.abs(dy) / (ry + 0.5);
    const hw = Math.max(2, Math.round(rx * t));
    p.span(Math.round(cy + dy), Math.round(cx - hw), Math.round(cx + hw * 0.65), dy < 0 ? p2 : p1);
    if (dy <= -1) {
      p.span(Math.round(cy + dy), Math.round(cx - hw + 1), Math.round(cx - hw * 0.2), p3);
    }
  }
}

/** 绘制重檐飞角仙门道观与五行圣物（火：青铜丹炉与炉烟；金：檐角铜钟与古剑碑） */
function drawSanctuary(p: PC, ox: number, oy: number, pal: VistaPalette) {
  const [r0, r1, r2, r3] = pal.roof;
  const [w0, w1, w2] = pal.wall;
  const [wd0, wd1] = pal.wood;
  const [g0, g1, g2] = pal.fireGlow;
  const [b0, b1, b2] = pal.bronze;
  const [st0, st1, st2] = pal.stone;

  // 1. 宽阔青石道场平台（土）
  p.rect(ox - 14, oy + 28, 66, 7, st0);
  p.rect(ox - 12, oy + 28, 42, 4, st1);
  p.span(oy + 28, ox - 14, ox + 51, st2);
  // 石栏杆
  for (let x = ox - 12; x <= ox + 48; x += 6) {
    p.rect(x, oy + 25, 2, 3, st1);
    p.set(x, oy + 25, st2);
  }
  p.span(oy + 26, ox - 12, ox + 49, st1);

  // 2. 主殿下层墙体与朱漆廊柱
  p.rect(ox + 2, oy + 14, 34, 14, w1);
  p.rect(ox + 2, oy + 14, 7, 14, w2);
  p.rect(ox + 29, oy + 14, 7, 14, w0);
  for (const x of [ox + 2, ox + 11, ox + 26, ox + 35]) {
    p.rect(x, oy + 14, 2, 14, wd0);
    p.line(x, oy + 14, x, oy + 27, wd1);
  }

  // 主殿暖光花格窗与正门
  p.rect(ox + 15, oy + 17, 8, 11, wd0);
  p.rect(ox + 16, oy + 18, 6, 9, g0);
  p.rect(ox + 17, oy + 19, 4, 7, g1);
  p.rect(ox + 18, oy + 20, 2, 4, g2);
  for (const wx of [ox + 5, ox + 29]) {
    p.rect(wx, oy + 18, 4, 5, wd0);
    p.rect(wx + 1, oy + 19, 2, 3, g1);
    p.set(wx + 1, oy + 20, g2);
  }

  // 3. 下层飞檐反宇（大弧度翘角）
  for (let dy = 0; dy <= 7; dy++) {
    const y = oy + 8 + dy;
    const half = 14 + Math.round(dy * 1.35);
    const xL = ox + 19 - half;
    const xR = ox + 19 + half;
    p.span(y, xL, xR, dy % 2 === 0 ? r1 : r0);
    p.span(y, xL, ox + 17, dy % 2 === 0 ? r2 : r1);
    p.set(xL, y, r3);
    p.set(xR, y, r0);
  }
  // 飞檐翘角（向上挑起的仙阁翼角）
  p.line(ox - 5, oy + 15, ox - 9, oy + 12, r2, 2);
  p.set(ox - 9, oy + 12, r3);
  p.line(ox + 43, oy + 15, ox + 47, oy + 12, r1, 2);
  p.set(ox + 47, oy + 12, r2);

  // 檐角铜钟（金元素标志之一）与红灯笼
  p.line(ox - 7, oy + 14, ox - 7, oy + 16, b1);
  p.rect(ox - 8, oy + 16, 3, 3, b1);
  p.set(ox - 8, oy + 16, b2);
  p.set(ox - 6, oy + 18, b0);
  p.rect(ox + 44, oy + 16, 3, 3, 0xe84838);
  p.set(ox + 45, oy + 17, g2);

  // 4. 上层重檐阁楼
  p.rect(ox + 8, oy + 2, 22, 6, w1);
  for (const x of [ox + 8, ox + 18, ox + 29]) p.line(x, oy + 2, x, oy + 7, wd1);
  p.circle(ox + 19, oy + 5, 2.2, g1);
  p.set(ox + 19, oy + 5, g2);

  for (let dy = 0; dy <= 6; dy++) {
    const y = oy - 4 + dy;
    const half = 8 + Math.round(dy * 1.4);
    const xL = ox + 19 - half;
    const xR = ox + 19 + half;
    p.span(y, xL, xR, dy % 2 === 0 ? r1 : r0);
    p.span(y, xL, ox + 17, dy % 2 === 0 ? r2 : r1);
    p.set(xL, y, r3);
  }
  p.line(ox + 2, oy + 2, ox - 2, oy - 1, r2, 2);
  p.set(ox - 2, oy - 1, r3);
  p.line(ox + 36, oy + 2, ox + 40, oy - 1, r1, 2);
  // 屋脊宝顶（金葫芦刹）
  p.span(oy - 5, ox + 11, ox + 27, r3);
  p.rect(ox + 18, oy - 8, 3, 3, b2);
  p.set(ox + 19, oy - 9, g2);

  // 5. 庭院左侧：三足青铜丹炉（火元素标志） + 袅袅紫金丹烟
  const fx = ox - 7;
  const fy = oy + 22;
  p.line(fx - 2, fy + 4, fx - 3, fy + 6, b0);
  p.line(fx + 2, fy + 4, fx + 3, fy + 6, b0);
  p.line(fx, fy + 4, fx, fy + 6, b1);
  p.ellipse(fx, fy + 2, 4, 2.8, b1);
  p.ellipse(fx - 1, fy + 1.5, 2.5, 1.8, b2);
  p.span(fy - 1, fx - 3, fx + 3, b2);
  // 炉口跃动丹火
  p.span(fy, fx - 1, fx + 1, g1);
  p.set(fx, fy - 1, g2);
  // 升腾丹烟（S 形袅袅入云）
  const smokePts: [number, number, number][] = [
    [fx, fy - 4, 1.5],
    [fx + 1, fy - 8, 2.0],
    [fx - 1, fy - 13, 2.4],
    [fx + 1, fy - 19, 2.8],
    [fx + 3, fy - 25, 3.2],
  ];
  for (const [sx, sy, sr] of smokePts) {
    p.circle(sx, sy, sr, pal.cloudMid);
    p.circle(sx - 0.6, sy - 0.6, sr * 0.65, pal.cloudHi);
  }

  // 6. 平台右侧：古剑碑（金元素标志：巨型古剑斜插石坛）
  const sx = ox + 44;
  const sy = oy + 25;
  p.rect(sx - 4, sy, 9, 3, st0);
  p.span(sy, sx - 4, sx + 4, st2);
  // 斜插巨剑剑身与吞口护手
  p.line(sx, sy, sx + 3, sy - 14, st1, 2);
  p.line(sx - 1, sy, sx + 2, sy - 14, 0xe8f2ff, 1);
  p.line(sx - 2, sy - 9, sx + 5, sy - 8, b2, 2);
  p.line(sx + 2, sy - 14, sx + 3, sy - 18, b1, 2);
  p.set(sx + 3, sy - 18, g2);
}

/** 独立云海图层（320×180，可无缝水平慢速平移） */
function paintVistaClouds(tod: TodId): PC {
  const p = new PC(320, 180);
  const pal = PALETTES[tod];

  const drawCloud = (cx: number, cy: number, w: number, h: number) => {
    const puffs: [number, number, number][] = [
      [-w * 0.32, h * 0.1, h * 0.62],
      [-w * 0.12, -h * 0.16, h * 0.85],
      [w * 0.12, -h * 0.08, h * 0.78],
      [w * 0.34, h * 0.12, h * 0.58],
    ];
    for (const [dx, dy, r] of puffs) p.ellipse(cx + dx, cy + dy + 1.5, r * 1.25, r * 0.82, pal.cloudSh);
    for (const [dx, dy, r] of puffs) p.ellipse(cx + dx, cy + dy, r * 1.2, r * 0.8, pal.cloudMid);
    for (const [dx, dy, r] of puffs) p.ellipse(cx + dx - 0.8, cy + dy - 1.2, r * 1.02, r * 0.62, pal.cloudHi);
    p.rect(Math.round(cx - w * 0.4), Math.round(cy + h * 0.24), Math.round(w * 0.8), Math.max(2, Math.round(h * 0.3)), pal.cloudSh);
  };

  // 右侧与中景流云（左侧尽量轻薄，不遮抢菜单文字）
  drawCloud(152, 28, 56, 12);
  drawCloud(256, 38, 52, 11);
  drawCloud(96, 46, 38, 9);
  drawCloud(204, 58, 44, 9);
  return p;
}

/** 独立前景松竹垂枝层（320×180，用于轻微随风摆动） */
function paintVistaFg(tod: TodId): PC {
  const p = new PC(320, 180);
  const pal = PALETTES[tod];
  const [p0, p1, p2, p3] = pal.pine;
  const [wd0, wd1] = pal.wood;

  // 右上角伸出的苍劲迎客古松枝干与层叠松针（木）
  p.strand([[320, 26], [292, 22], [268, 28], [250, 26]], wd0, 4);
  p.strand([[320, 25], [292, 21], [268, 27]], wd1, 2);
  drawPineCanopy(p, 298, 12, 22, 7, pal);
  drawPineCanopy(p, 266, 22, 18, 6, pal);
  drawPineCanopy(p, 246, 25, 12, 4.5, pal);

  // 左下与右下近景幽竹剪影（木）
  const stalks: [number, number, number][] = [
    [14, 126, -1],
    [24, 134, 1],
    [306, 122, -1],
    [314, 132, -1],
  ];
  for (const [bx, topY, dir] of stalks) {
    p.line(bx, topY, bx, 180, p0, 2);
    p.line(bx, topY, bx, 180, p1, 1);
    for (let ly = topY + 4; ly < 176; ly += 12) {
      p.strand([[bx, ly], [bx + dir * 6, ly - 2], [bx + dir * 11, ly + 1]], p1, 2);
      p.strand([[bx, ly - 4], [bx - dir * 5, ly - 6], [bx - dir * 9, ly - 3]], p2, 1);
      if (bx > 200) p.set(bx + dir * 4, ly - 3, p3);
    }
  }
  return p;
}

/** 生成 320×180 仙侠五行山谷主画卷 */
function paintVistaBase(tod: TodId): PC {
  const p = new PC(320, 180);
  const pal = PALETTES[tod];
  const R = rng(tod === 'dawn' ? 101 : tod === 'day' ? 202 : tod === 'dusk' ? 303 : 404);

  // 1. 像素抖动渐变天空
  const skyBands = pal.sky;
  const skyH = 108;
  for (let y = 0; y < skyH; y++) {
    const t = (y / skyH) * (skyBands.length - 1);
    const idx = Math.min(skyBands.length - 2, Math.floor(t));
    const frac = t - idx;
    const cA = skyBands[idx];
    const cB = skyBands[idx + 1];
    for (let x = 0; x < 320; x++) {
      const bayer = ((x & 1) << 1) | (y & 1);
      p.set(x, y, frac * 4 > bayer ? cB : cA);
    }
  }

  // 星辰（傍晚/夜里）
  if (pal.stars) {
    const starCount = tod === 'night' ? 55 : 22;
    for (let i = 0; i < starCount; i++) {
      const sx = Math.floor(R() * 316) + 2;
      const sy = Math.floor(R() * 68) + 3;
      const bright = i % 5 === 0;
      p.set(sx, sy, bright ? 0xffffff : 0xc8dcff);
    }
  }

  // 日轮 / 弯月（置于右上方天空，烘托仙山山门）
  const sunX = 202;
  const sunY = pal.sunMoonY;
  p.circle(sunX, sunY, 12, pal.sky[Math.min(skyBands.length - 1, 5)]);
  p.circle(sunX, sunY, 8.5, pal.sunMoonCol);
  if (tod === 'night') {
    p.circle(sunX + 3, sunY - 2, 7, pal.sky[1]);
  }

  // 2. 远景层叠青峰（大气透视群山）
  for (let x = 0; x < 320; x++) {
    const peak =
      Math.sin(x * 0.025 - 0.6) * 18 +
      Math.sin(x * 0.06 + 1.2) * 10 +
      Math.cos(x * 0.014) * 8;
    const topY = Math.round(74 - peak);
    for (let y = Math.max(18, topY); y < 125; y++) {
      const ridgeLit = Math.cos(x * 0.025 - 0.6) > 0 && y < topY + 6 && x > 110;
      p.set(x, y, ridgeLit ? pal.farMtHi : pal.farMt);
    }
  }

  // 3. 中景奇峰断崖（土）
  const peaks: [number, number, number][] = [
    [146, 52, 46],
    [235, 42, 65],
    [295, 56, 48],
  ];
  for (const [cx, topY, halfW] of peaks) {
    for (let dy = 0; dy <= 76; dy++) {
      const y = topY + dy;
      if (y >= 140) break;
      const w = Math.round((dy / 76) * halfW);
      const ridge = cx + Math.round(Math.sin(dy * 0.22) * 3);
      p.span(y, cx - w, ridge, pal.midMt);
      p.span(y, cx - w, cx - Math.max(0, w - 4), pal.midMtHi);
      p.span(y, ridge + 1, cx + w, pal.midMtSh);
    }
  }

  // 4. 中景悬崖飞瀑（水元素标志：从断崖倾泻而下汇入山涧水潭）
  const wfX = 152;
  for (let y = 68; y <= 146; y++) {
    const spread = y > 130 ? Math.round((y - 130) * 0.35) : 0;
    p.span(y, wfX - 4 - spread, wfX + 4 + spread, pal.water[0]);
    p.span(y, wfX - 2 - spread, wfX + 2 + spread, pal.water[1]);
    if (y % 3 !== 0) {
      p.span(y, wfX - 1, wfX + 1, pal.water[2]);
    }
  }
  // 瀑底水雾与溪石水潭
  for (const [mx, my, mr] of [[148, 145, 5], [156, 146, 5.5], [152, 142, 4]]) {
    p.circle(mx, my, mr, pal.mist);
  }
  for (let y = 147; y < 180; y++) {
    const sx = 152 - Math.round((y - 147) * 0.7);
    const sw = 8 + Math.round((y - 147) * 0.45);
    p.span(y, sx - sw, sx + sw, pal.water[0]);
    p.span(y, sx - sw + 3, sx + sw - 3, pal.water[1]);
    if (y % 4 === 0) p.span(y, sx - 3, sx + 3, pal.water[2]);
  }

  // 5. 山谷云海雾带（像素抖动柔和衔接）
  for (let y = 96; y <= 112; y++) {
    const density = 1 - Math.abs(y - 104) / 9;
    for (let x = 110; x < 320; x++) {
      if (((x + y * 3) % 4) < density * 3) {
        p.set(x, y, pal.mist);
      }
    }
  }

  // 6. 右侧仙山主崖与盘山古石阶（土）
  const [c0, c1, c2, c3] = pal.cliff;
  for (let y = 84; y < 180; y++) {
    const dy = y - 84;
    const xStart = Math.max(126, Math.round(182 - dy * 0.65 + Math.sin(y * 0.15) * 3));
    p.span(y, xStart, 319, c1);
    p.span(y, xStart, xStart + 6, c2);
    if (dy % 6 < 2) p.span(y, xStart, xStart + 2, c3);
    p.span(y, 290, 319, c0);
  }

  // 蜿蜒登仙青石阶（从底部中右一路通向右上山门）
  for (let y = 94; y < 180; y++) {
    const t = (y - 94) / 86;
    const stX = Math.round(236 - t * 52 + Math.sin(t * Math.PI * 2.2) * 10);
    const sw = Math.round(4 + t * 8);
    const isStep = y % 3 === 0;
    p.span(y, stX - sw - 1, stX + sw + 1, c0);
    p.span(y, stX - sw, stX + sw, isStep ? pal.stone[2] : pal.stone[1]);
    p.span(y, stX + Math.round(sw * 0.4), stX + sw, pal.stone[0]);
  }

  // 7. 悬崖迎客古松群（木）
  const pines: [number, number, number, number][] = [
    [192, 86, 14, 5],
    [286, 88, 16, 5.5],
    [176, 118, 15, 5],
    [296, 120, 14, 5],
  ];
  for (const [px, py, rx, ry] of pines) {
    p.rect(px - 1, py, 3, 12, pal.wood[0]);
    p.line(px - 1, py, px - 1, py + 11, pal.wood[1]);
    drawPineCanopy(p, px, py - 2, rx, ry, pal);
    drawPineCanopy(p, px - 4, py + 2, rx * 0.75, ry * 0.75, pal);
  }

  // 8. 右上方主景：仙门道观、青铜丹炉（火）、古剑碑与铜钟（金）
  drawSanctuary(p, 224, 62, pal);

  // 9. 左侧 40%（x = 0..128）深邃绝壁与松竹暗影（刻意压暗、低细节，保证左侧标题与菜单文字高对比度 ≥ 4.5:1）
  const [lc0, lc1, lc2] = pal.leftCliff;
  for (let y = 0; y < 180; y++) {
    const edgeX = Math.round(
      118 +
        Math.sin(y * 0.045) * 8 +
        (y > 110 ? (y - 110) * 0.25 : 0) -
        (y < 45 ? (45 - y) * 0.9 : 0),
    );
    if (edgeX <= 0) continue;
    p.span(y, 0, Math.min(319, edgeX), lc0);
    if (edgeX > 12) {
      p.span(y, Math.max(0, edgeX - 10), edgeX, lc1);
      if (y % 5 < 2) p.span(y, Math.max(0, edgeX - 3), edgeX, lc2);
    }
  }
  // 左崖边探出的古松剪影（深暗色调，不抢菜单文字）
  p.strand([[68, 36], [96, 30], [116, 33]], lc0, 3);
  p.ellipse(106, 26, 16, 4.5, lc1);
  p.ellipse(104, 27, 15, 4, lc0);
  p.strand([[88, 108], [112, 102], [126, 104]], lc0, 3);
  p.ellipse(118, 99, 14, 4, lc1);
  p.ellipse(116, 100, 13, 3.5, lc0);

  return p;
}

/** 将 320×180 的 PC 画布 2× 邻近放大生成 640×360 贴图 */
function addVistaTexture(scene: Phaser.Scene, key: string, src: PC) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const scale = 2;
  const W = src.w * scale;
  const H = src.h * scale;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(W, H);
  const dst = img.data;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = y * src.w + x;
      const col = src.c[i];
      if (col === -1) continue;
      const r = (col >> 16) & 255;
      const g = (col >> 8) & 255;
      const b = col & 255;
      const a = src.a[i];
      for (let dy = 0; dy < scale; dy++) {
        const row = (y * scale + dy) * W;
        for (let dx = 0; dx < scale; dx++) {
          const di = (row + x * scale + dx) * 4;
          dst[di] = r;
          dst[di + 1] = g;
          dst[di + 2] = b;
          dst[di + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

const paintedVista = new Set<TodId>();

/** 该时辰是否用的是外部生图远景；生图自带云和前景，不再叠程序画的云层、前景层 */
export function isVistaPainted(id: TodId = currentTod): boolean {
  return paintedVista.has(id);
}

export function buildVista(scene: Phaser.Scene) {
  for (const t of TOD_LIST) {
    const baseKey = getVistaTextureKey(t.id);
    // 若预加载了外部 PNG 且有效，则保留外部贴图，否则使用程序生成的仙侠五行山谷贴图作为可靠回退
    if (scene.textures.exists(baseKey)) paintedVista.add(t.id);
    else {
      addVistaTexture(scene, baseKey, paintVistaBase(t.id));
    }
    addVistaTexture(scene, getVistaCloudKey(t.id), paintVistaClouds(t.id));
    addVistaTexture(scene, getVistaFgKey(t.id), paintVistaFg(t.id));
  }
}
