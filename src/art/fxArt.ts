import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, rng } from './painter';
import { EL_INFO, GEN_ORDER } from '../config/elements';
import { TALISMANS } from '../config/map';

function single(scene: Phaser.Scene, key: string, p: PC) {
  addSheet(scene, key, [p]);
}

// 剑气：月牙形，3 帧（起、满、散）
function slashFrame(f: number): PC {
  const p = new PC(64, 64);
  const span = [40, 65, 70][f];
  const thick = [5, 10, 4][f];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x + 0.5 - 32;
      const dy = y + 0.5 - 32;
      const r = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (Math.abs(a) > span) continue;
      const taper = Math.cos(((a / span) * Math.PI) / 2);
      const t = thick * taper + 1;
      const d = 30 - r;
      if (d < 0 || d > t) continue;
      const col = d < 1.5 ? 0xffffff : d < t * 0.55 ? 0xd6e8ff : 0x8fb0e0;
      p.set(x, y, col, f === 2 ? 150 : 255);
    }
  }
  return p;
}

function flySword(): PC {
  const p = new PC(18, 7);
  p.line(1, 3, 3, 3, 0xe0b04a);
  p.rect(4, 2, 3, 3, 0x6b4630);
  p.line(7, 1, 7, 5, 0xe0b04a);
  p.line(8, 3, 16, 3, 0xe8f0f6);
  p.line(8, 2, 14, 2, 0xffffff);
  p.line(8, 4, 15, 4, 0x9fb0bf);
  p.set(17, 3, 0xe8f0f6);
  p.outline(0x3b5070);
  return p;
}

function wave(): PC {
  const p = new PC(14, 24);
  for (let y = 0; y < 24; y++) {
    const t = Math.abs(y - 11.5) / 11.5;
    const xr = Math.round(10 - t * t * 8);
    const w = Math.max(1, Math.round(4 * (1 - t)));
    for (let i = 0; i < w; i++) p.set(xr - i, y, i === 0 ? 0xffffff : 0xb8d4ff);
  }
  return p;
}

function fireball(f: number): PC {
  const p = new PC(14, 14);
  p.circle(8, 7, 4.5, 0xe8503f);
  p.circle(8.5, 6.5, 3, 0xff9a3a);
  p.circle(9, 6, 1.6, 0xfff0a0);
  p.strand([[4, 7], [1, 6 + f], [0, 8]], 0xff9a3a, 2);
  p.outline(0x6a1a12);
  return p;
}

/** 符箓：黄纸，墨色按元素；f=1 翻到侧面，飞行时交替成翻飞效果 */
function fu(ink: number, f: number): PC {
  const p = new PC(9, 11);
  if (f === 0) {
    p.rect(2, 1, 5, 9, 0xf2d36b);
    p.span(9, 2, 6, 0xc9a640);
    p.span(1, 2, 6, ink);
    p.line(4, 3, 4, 7, ink);
    p.set(3, 4, ink);
    p.set(5, 6, ink);
  } else {
    p.rect(3, 1, 3, 9, 0xf2d36b);
    p.set(5, 9, 0xc9a640);
    p.line(4, 3, 4, 7, ink);
  }
  p.outline(0x5a3a12);
  return p;
}

/** 弩箭：水色箭簇、白羽，朝右 */
function bolt(): PC {
  const p = new PC(12, 5);
  p.line(1, 2, 8, 2, 0x8a5a32);
  p.set(9, 2, 0xb8e4ff);
  p.set(10, 2, 0xe8f6ff);
  p.set(9, 1, 0x5a8cf0);
  p.set(9, 3, 0x5a8cf0);
  p.set(1, 1, 0xf1ede2);
  p.set(2, 1, 0xf1ede2);
  p.set(1, 3, 0xf1ede2);
  p.set(2, 3, 0xf1ede2);
  p.outline(0x1c2a48);
  return p;
}

function explosion(f: number): PC {
  const p = new PC(48, 48);
  const R = rng(91 + f);
  const r = [9, 16, 20, 22][f];
  const ring = (inner: number, outer: number, cols: number[], jitter: number) => {
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24) + (R() - 0.5) * jitter;
        if (d < inner || d > outer) continue;
        const k = (d - inner) / Math.max(1, outer - inner);
        p.set(x, y, cols[Math.min(cols.length - 1, Math.floor(k * cols.length))]);
      }
  };
  if (f === 0) {
    ring(0, r, [0xffffff, 0xfff0a0, 0xffc34a], 1.5);
  } else if (f === 1) {
    ring(0, r, [0xfff0a0, 0xffc34a, 0xff8a3a, 0xe8503f], 3);
  } else if (f === 2) {
    ring(r * 0.45, r, [0xffc34a, 0xff8a3a, 0xe8503f, 0x8e2a20], 4);
    for (let i = 0; i < 8; i++) {
      const a = R() * Math.PI * 2;
      p.circle(24 + Math.cos(a) * r * 0.9, 24 + Math.sin(a) * r * 0.9, 2, 0xffc34a);
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const a = R() * Math.PI * 2;
      const d = r * (0.5 + R() * 0.5);
      p.circle(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, 1.5 + R() * 1.5, R() < 0.3 ? 0xe8503f : 0x5a4a4a);
    }
  }
  return p;
}

function leaf(): PC {
  const p = new PC(9, 7);
  p.ellipse(4.5, 3.5, 4, 2.5, 0x5fc46a);
  p.line(1, 3, 7, 3, 0x2e7a4a);
  p.set(2, 2, 0xb6f09a);
  p.set(3, 2, 0xb6f09a);
  p.outline(0x163a24);
  return p;
}

function waterDragon(f: number): PC {
  const p = new PC(28, 14);
  const B = 0x4a7fe8, H = 0xa8d0ff, D = 0x2a4a90;
  // 身体波浪
  for (let x = 0; x < 18; x++) {
    const y = 7 + Math.round(Math.sin((x + f * 3) * 0.6) * 2);
    const w = 1 + Math.floor(x / 6);
    for (let k = -w; k <= w; k++) p.set(x, y + k, k === -w ? H : B);
  }
  // 头
  p.ellipse(21, 7, 4.5, 3.5, B);
  p.span(5, 19, 23, H);
  p.span(9, 20, 26, D);
  p.set(25, 7, B);
  p.set(26, 8, B);
  p.set(21, 6, 0xffffff);
  // 龙须和角
  p.strand([[23, 9], [26, 11], [27, 13]], H, 1);
  p.strand([[19, 4], [17, 1]], 0xe0f0ff, 1);
  p.outline(0x162a5a);
  return p;
}

function spike(f: number): PC {
  const p = new PC(20, 26);
  const B = 0xc79a55, S = 0x8f6a3a, H = 0xe6c07f;
  const h = [7, 18, 22][f];
  for (let i = 0; i < h; i++) {
    const y = 23 - i;
    const hw = Math.max(0, Math.round((1 - i / h) * 5));
    p.span(y, 10 - hw, 9 + hw, B);
    p.set(9 + hw, y, S);
    p.set(10 - hw, y, H);
  }
  // 旁边的小石刺
  if (f > 0) {
    for (let i = 0; i < h * 0.45; i++) {
      const hw = Math.max(0, Math.round((1 - i / (h * 0.45)) * 2));
      p.span(23 - i, 4 - hw, 3 + hw, S);
      p.span(23 - i, 16 - hw, 15 + hw, B);
    }
  }
  p.outline(OUTLINE);
  // 地面碎石
  p.under(10, 24, 9, 1.8, 0x000000, 70);
  return p;
}

function crack(): PC {
  const p = new PC(20, 8);
  p.strand([[2, 4], [6, 3], [9, 5], [13, 3], [17, 4]], 0x3a2a1a, 1);
  p.strand([[9, 5], [10, 7]], 0x3a2a1a, 1);
  p.strand([[6, 3], [5, 1]], 0x3a2a1a, 1);
  return p;
}

function gem(col: number, hi: number, dark: number): PC {
  const p = new PC(7, 9);
  for (let y = 0; y < 9; y++) {
    const hw = y <= 4 ? y * 0.75 : (8 - y) * 0.75;
    p.span(y, Math.round(3 - hw), Math.round(3 + hw), col);
  }
  p.set(2, 3, hi);
  p.set(3, 2, hi);
  p.set(4, 5, dark);
  p.set(4, 6, dark);
  p.outline(OUTLINE);
  return p;
}

function chest(): PC {
  const p = new PC(18, 15);
  const R = 0xa8322a, RS = 0x6e1e1a, G = 0xe0b04a, GS = 0xa77a2a;
  p.rect(2, 6, 14, 8, R);
  p.rect(2, 3, 14, 4, R);
  p.span(3, 3, 14, 0xc84a3a);
  p.span(13, 2, 15, RS);
  p.span(6, 2, 15, G);
  p.rect(2, 3, 1, 11, G);
  p.rect(15, 3, 1, 11, GS);
  p.rect(8, 7, 2, 3, G);
  p.set(8, 9, GS);
  p.outline(OUTLINE);
  p.under(9, 14, 8, 1.5, 0x000000, 70);
  return p;
}

/** 铜匣：和宝箱同形，青铜身、铜绿箍 */
function copperChest(): PC {
  const p = new PC(16, 13);
  const B = 0x9a6a3a, BS = 0x5e3e22, BH = 0xc08a50, V = 0x5ab89a, VS = 0x3a7a66;
  p.rect(2, 5, 12, 7, B);
  p.rect(2, 2, 12, 4, B);
  p.span(2, 3, 12, BH);
  p.span(11, 2, 13, BS);
  p.span(5, 2, 13, V);
  p.rect(2, 2, 1, 10, V);
  p.rect(13, 2, 1, 10, VS);
  p.rect(7, 6, 2, 2, V);
  p.outline(OUTLINE);
  p.under(8, 12, 7, 1.5, 0x000000, 70);
  return p;
}

/** 木匣：浅木板条加深色铁箍 */
function crate(): PC {
  const p = new PC(14, 13);
  const W = 0xc0904a, WS = 0x8a6030, WH = 0xe0b46a, I = 0x3a3040;
  p.rect(1, 2, 12, 10, W);
  p.span(2, 1, 12, WH);
  p.span(6, 1, 12, WS);
  p.span(9, 1, 12, WS);
  p.rect(1, 2, 1, 10, I);
  p.rect(12, 2, 1, 10, I);
  p.span(11, 1, 12, I);
  p.line(3, 3, 10, 10, WS);
  p.outline(OUTLINE);
  p.under(7, 12, 6, 1.5, 0x000000, 70);
  return p;
}

/** 符箓道具：黄纸、彩色边和墨迹，外圈一层同色光 */
function charm(col: number): PC {
  const p = new PC(13, 16);
  const P = 0xf4e2a8, PS = 0xd0b878;
  p.rect(3, 1, 7, 13, P);
  p.rect(9, 1, 1, 13, PS);
  p.rect(3, 1, 7, 1, col);
  p.rect(3, 13, 7, 1, col);
  p.rect(6, 3, 1, 8, col);
  p.span(5, 4, 8, col);
  p.span(8, 4, 8, col);
  p.set(5, 10, col);
  p.set(7, 10, col);
  p.outline(OUTLINE);
  p.selectiveOutline(col, col);
  p.under(6.5, 15, 4, 1, 0x000000, 60);
  return p;
}

function pill(): PC {
  const p = new PC(9, 9);
  p.circle(4.5, 4.5, 3.6, 0xc0392b);
  p.circle(4, 4, 2, 0xe8604a);
  p.set(3, 3, 0xffd0c0);
  p.span(4, 1, 7, 0xe0b04a);
  p.outline(OUTLINE);
  p.under(4.5, 8, 3.5, 1, 0x000000, 70);
  return p;
}

function antidote(): PC {
  const p = new PC(9, 11);
  // 青瓷小瓶，红布塞
  p.rect(3, 1, 3, 2, 0xc0392b);
  p.rect(3, 3, 3, 2, 0x5fa88a);
  p.ellipse(4.5, 7, 3.6, 3, 0x6fc8a0);
  p.ellipse(5.2, 7.6, 2, 1.8, 0x4a9a7a);
  p.set(3, 6, 0xd8fff0);
  p.outline(OUTLINE);
  p.under(4.5, 10, 3.5, 1, 0x000000, 70);
  return p;
}

function ring(): PC {
  const p = new PC(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
      if (r <= 31 && r >= 29) p.set(x, y, 0xffffff);
    }
  return p;
}

function disc(): PC {
  const p = new PC(64, 64);
  p.circle(32, 32, 31, 0xffffff);
  return p;
}

function eLeaf(): PC {
  const p = new PC(9, 9);
  p.ellipse(4.5, 4.5, 3.5, 3.5, 0x8fd04a);
  p.circle(4.5, 4.5, 1.8, 0xe8ff9a);
  p.outline(0x2a4a12);
  return p;
}

function ePoison(): PC {
  const p = new PC(9, 9);
  p.circle(4.5, 4.5, 3.4, 0x7ac83a);
  p.circle(3.8, 3.8, 1.5, 0xd8ff8a);
  p.outline(0x2a3a12);
  return p;
}

function eWind(): PC {
  const p = new PC(11, 11);
  p.circle(5.5, 5.5, 3.6, 0xdfe8ff);
  p.circle(5.5, 5.5, 2, 0xffffff);
  p.outline(0x4a3a6a);
  return p;
}

function eRock(): PC {
  const p = new PC(9, 9);
  p.circle(4.5, 4.8, 3.4, 0x9a8a72);
  p.ellipse(3.8, 3.8, 1.8, 1.2, 0xd4c4a0);
  p.set(6, 6, 0x5e4e3c);
  p.outline(0x2c2238);
  return p;
}

function eBoulder(): PC {
  const p = new PC(13, 13);
  p.circle(6.5, 6.8, 5.2, 0x9a8a72);
  p.ellipse(8, 8.5, 3, 2.4, 0x6e5e4a);
  p.ellipse(5, 4.8, 2.6, 1.8, 0xd4c4a0);
  p.set(4, 4, 0xf0e4c4);
  p.outline(0x2c2238);
  return p;
}

/** 从天而降的落石（落地前的那一块） */
function fallingBoulder(): PC {
  const p = new PC(18, 16);
  const D = 0x3a3446, S = 0x5a5462, M = 0x7e7884, H = 0xa8a2a8, RIM = 0xd8d0c0;
  p.ellipse(9, 8.5, 7.5, 6.5, S);
  p.ellipse(10.5, 11, 5.5, 3.5, D);
  p.ellipse(8, 7, 5.5, 4.2, M);
  p.ellipse(6.5, 5.5, 3, 2, H);
  p.span(2, 5, 9, RIM);
  p.selectiveOutline(0x2c2238, 0x1c1424);
  return p;
}

// ---------- 地面与装饰 ----------

function valueNoise(size: number, cells: number, R: () => number) {
  const g: number[] = [];
  for (let i = 0; i < cells * cells; i++) g.push(R());
  const at = (x: number, y: number) => g[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  const out = new Float32Array(size * size);
  const step = size / cells;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = gx - x0, ty = gy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const b = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      out[y * size + x] = a * (1 - sy) + b * sy;
    }
  return out;
}

function ground(
  seed: number,
  tones: number[],
  pebbles: number[],
  blades: number[],
): PC {
  // 256×256 大尺寸贴图 + 三层噪声混合，消除 128px 周期性斑块重复感；
  // 严格控制底色明度跨度，将高饱和/高明度色彩留给经验宝石、敌人与技能特效。
  const N = 256;
  const R = rng(seed);
  const p = new PC(N, N);
  const n1 = valueNoise(N, 4, R);
  const n2 = valueNoise(N, 12, R);
  const n3 = valueNoise(N, 28, R);

  // 1. 低对比度跨色相底色（柔和过渡，不抢前景拾取物）
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = n1[y * N + x] * 0.45 + n2[y * N + x] * 0.35 + n3[y * N + x] * 0.2;
      const idx = Math.min(tones.length - 1, Math.max(0, Math.floor(v * tones.length)));
      p.set(x, y, tones[idx]);
    }
  }

  // 2. 低对比碎石纹理与细微地表肌理
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(R() * (N - 3)) + 1;
    const y = Math.floor(R() * (N - 3)) + 1;
    const c = pebbles[i % pebbles.length];
    p.set(x, y, c);
    if (i % 3 === 0) p.set(x + 1, y, c);
  }

  // 3. 稀疏低对比小草束（密度适中、明度克制，绝不与绿宝石 gem_m 或掉落物混淆）
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(R() * (N - 4)) + 2;
    const y = Math.floor(R() * (N - 4)) + 2;
    const c = blades[i % blades.length];
    p.set(x, y + 1, tones[0]);
    p.set(x, y, c);
    p.set(x, y - 1, c);
    if (i % 2 === 0) p.set(x - 1, y, c);
    else p.set(x + 1, y, c);
  }

  return p;
}

function drawRockBase(p: PC, ox = 0, oy = 0) {
  // 5 阶跨色相岩石：冷蓝灰暗部 -> 暖米灰受光顶沿
  const D = 0x363d4f, S = 0x525c70, M = 0x788291, H = 0xa6adba, RIM = 0xdcd6c4;
  p.ellipse(8 + ox, 7 + oy, 6.5, 4.5, S);
  p.span(10 + oy, 3 + ox, 12 + ox, D);
  p.ellipse(7.2 + ox, 6.2 + oy, 5.2, 3.4, M);
  p.ellipse(6.2 + ox, 5.2 + oy, 3.4, 2.1, H);
  p.span(3 + oy, 5 + ox, 8 + ox, RIM);
  p.set(4 + ox, 4 + oy, RIM);
  p.span(10 + oy, 4 + ox, 7 + ox, 0x385e3c);
  p.set(5 + ox, 9 + oy, 0x5a8642);
}

/** dc_rock（3 种变体）：0 乱石堆、1 断桥石墩、2 马车残轮与碎石 */
function rock(variant = 0): PC {
  const p = new PC(20, 16);
  const D = 0x363d4f, S = 0x525c70, M = 0x788291, H = 0xa6adba, RIM = 0xdcd6c4;
  if (variant === 0) {
    drawRockBase(p, 1, 3);
    // 右侧伴生小石块
    p.ellipse(14, 11, 3.2, 2.4, S);
    p.ellipse(13.5, 10.5, 2.2, 1.5, M);
    p.set(13, 9, H);
  } else if (variant === 1) {
    // 断桥残石墩（阶梯方石 + 凹槽雕纹）
    p.rect(4, 9, 12, 4, S);
    p.span(12, 4, 15, D);
    p.rect(5, 4, 10, 6, M);
    p.rect(5, 4, 3, 6, H);
    p.span(4, 5, 12, RIM);
    p.rect(12, 5, 3, 5, S);
    p.span(7, 6, 13, D);
    p.span(12, 5, 8, 0x4a5838);
  } else {
    // 半掩泥土的破损木车轮残骸 + 拦路石
    const WD = 0x634838, WDS = 0x45302e, WDH = 0x997454;
    p.ellipse(10, 9, 6, 5, WDS);
    p.ellipse(10, 9, 4, 3.2, 0x564b38);
    // 轮辐与断裂上半圈
    p.line(5, 9, 15, 9, WD);
    p.line(10, 4, 10, 12, WD);
    p.line(6, 6, 14, 12, WDS);
    p.span(4, 8, 12, WDH);
    p.rect(9, 8, 3, 3, D);
    // 前方压轮碎石
    p.ellipse(6, 11, 3.2, 2.2, M);
    p.span(10, 5, 7, H);
    p.span(12, 8, 14, 0x4a5838);
  }
  p.selectiveOutline(0x363d4f, 0x1e2230);
  p.under(10.5, 13.5, 8, 1.8, 0x12222b, 85);
  return p;
}

/** dc_tuft（3 种变体）：0 荒原枯草束、1 矮荆棘丛、2 碎石荒草 */
function tuft(variant = 0): PC {
  const p = new PC(14, 12);
  if (variant === 0) {
    const ao = 0x1b3432, dark = 0x2a503e, mid = 0x48783e, hi = 0x749c48;
    p.span(10, 4, 9, ao);
    p.strand([[5, 10], [3, 6], [2, 5]], dark, 1);
    p.strand([[9, 10], [11, 6], [11, 5]], dark, 1);
    p.strand([[6, 10], [4, 5], [3, 4]], mid, 1);
    p.strand([[8, 10], [10, 5], [10, 4]], mid, 1);
    p.strand([[7, 10], [7, 3]], hi, 2);
  } else if (variant === 1) {
    // 矮荆棘丛（交错枯刺枝）
    const B0 = 0x2c1e26, B1 = 0x4a342e, B2 = 0x6e523e, L = 0x586e3e;
    p.span(10, 3, 10, B0);
    p.strand([[4, 10], [2, 6], [5, 4]], B1, 1);
    p.strand([[9, 10], [11, 6], [8, 4]], B1, 1);
    p.strand([[6, 10], [9, 5], [11, 4]], B2, 1);
    p.strand([[8, 10], [5, 5], [3, 4]], B2, 1);
    p.set(4, 6, L);
    p.set(8, 6, L);
    p.set(6, 4, L);
  } else {
    // 碎石伴荒草
    const ao = 0x222a30, mid = 0x587240, hi = 0x7c924c;
    p.span(10, 3, 10, ao);
    p.ellipse(5, 9, 2.5, 1.8, 0x68707e);
    p.set(4, 8, 0x9ca4b0);
    p.strand([[8, 10], [7, 5]], mid, 1);
    p.strand([[9, 10], [11, 6]], mid, 1);
    p.strand([[8, 9], [9, 4]], hi, 1);
  }
  return p;
}

/** dc_tablet（3 种变体）：0 风化古石碑、1 古道木路标、2 斜插古战场残旗 */
function tablet(variant = 0): PC {
  const p = new PC(22, 28);
  const D = 0x363d4f, S = 0x565e70, M = 0x7e8694, H = 0xb0b8c2, RIM = 0xded9c8;
  if (variant === 0) {
    p.rect(7, 6, 8, 17, M);
    p.rect(7, 6, 2, 17, H);
    p.span(5, 8, 12, RIM);
    p.rect(13, 6, 2, 17, S);
    p.ellipse(11, 6, 4, 2.2, M);
    p.span(4, 9, 12, RIM);
    p.rect(5, 22, 12, 3, S);
    p.span(24, 5, 16, D);
    for (const y of [10, 13, 16]) p.span(y, 10, 12, D);
    p.set(11, 18, D);
    p.strand([[7, 13], [9, 16], [8, 21]], 0x3a683c, 2);
    p.set(8, 14, 0x689448);
    p.set(9, 17, 0x689448);
  } else if (variant === 1) {
    // 古道木路标（立柱 + 指路横木牌 + 压脚石）
    const WD0 = 0x362420, WD1 = 0x5c3e30, WD2 = 0x846046, WDH = 0xb08a62;
    p.rect(9, 5, 3, 20, WD1);
    p.line(9, 5, 9, 24, WD2);
    p.line(11, 5, 11, 24, WD0);
    p.set(10, 4, WDH);
    // 横向指路木牌（左窄右尖）
    p.rect(4, 8, 13, 5, WD2);
    p.span(8, 4, 16, WDH);
    p.span(12, 4, 16, WD0);
    p.line(17, 9, 19, 10, WD2, 2);
    p.span(10, 6, 13, WD0);
    // 柱脚护石
    p.ellipse(8, 23, 3, 2, S);
    p.set(7, 22, H);
  } else {
    // 古战场残旗（斜插断枪杆 + 破损暗绛战旗，避开红宝石亮色）
    const WD0 = 0x362420, WD1 = 0x684836;
    const FL0 = 0x421c24, FL1 = 0x68282c, FL2 = 0x8c3c38, GD = 0xb88a44;
    p.line(7, 24, 12, 3, WD0, 2);
    p.line(7, 24, 12, 3, WD1, 1);
    p.set(12, 2, GD);
    // 破损三角残旗面
    for (let dy = 0; dy < 11; dy++) {
      const y = 5 + dy;
      const x0 = 11 - Math.floor(dy * 0.2);
      const w = Math.max(2, 8 - Math.floor(dy * 0.55) - (dy % 3 === 2 ? 2 : 0));
      p.span(y, x0, x0 + w, dy < 3 ? FL2 : dy < 8 ? FL1 : FL0);
    }
    p.span(5, 11, 18, GD);
    p.ellipse(7, 24, 3.5, 1.8, S);
  }
  p.selectiveOutline(0x363d4f, 0x1c202e);
  p.under(11, 25, 8, 1.8, 0x12222b, 85);
  return p;
}

/** dc_deadtree（2 种变体）：0 虬曲苍凉枯木、1 古道断干枯柳 */
function deadTree(variant = 0): PC {
  const p = new PC(32, 40);
  const D = 0x2c1e26, S = 0x45302e, T = 0x634838, H = 0x87654d, RIM = 0xa88464;
  if (variant === 0) {
    p.strand([[16, 38], [16, 20], [15, 12]], T, 4);
    p.strand([[14, 38], [11, 39]], S, 2);
    p.strand([[18, 38], [21, 39]], D, 2);
    p.strand([[16, 24], [10, 16], [6, 12], [4, 8]], T, 2);
    p.strand([[16, 20], [22, 13], [26, 10], [28, 6]], T, 2);
    p.strand([[15, 14], [13, 6], [14, 2]], T, 2);
    p.strand([[10, 16], [9, 10]], S, 1);
    p.strand([[22, 13], [24, 16]], D, 1);
    p.line(18, 20, 18, 37, D);
    p.line(17, 20, 17, 37, S);
    p.line(14, 20, 14, 37, H);
    p.line(14, 21, 14, 29, RIM);
    p.span(37, 13, 16, 0x4a5838);
  } else {
    // 歪斜断干枯柳（粗壮树洞老干 + 垂挂枯枝）
    p.strand([[15, 38], [13, 25], [16, 14]], T, 5);
    p.strand([[12, 38], [9, 39]], S, 2);
    p.strand([[18, 38], [22, 39]], D, 2);
    p.line(11, 20, 12, 36, H);
    p.line(11, 22, 11, 30, RIM);
    p.line(17, 16, 17, 37, D);
    // 树干空洞
    p.ellipse(15, 27, 1.8, 3, D);
    // 两侧拱起又垂下的枯柳枝
    p.strand([[15, 15], [9, 10], [5, 14], [4, 22]], S, 2);
    p.strand([[16, 14], [22, 9], [26, 13], [27, 21]], S, 2);
    p.strand([[16, 12], [18, 5], [22, 7]], T, 2);
    p.line(8, 12, 7, 20, D);
    p.line(23, 11, 24, 19, D);
    p.span(37, 12, 17, 0x4a5838);
  }
  p.selectiveOutline(0x38262e, 0x1c1424);
  p.under(17, 38, 10, 2.2, 0x12222b, 85);
  return p;
}

function bamboo(seed: number): PC {
  const p = new PC(24, 60);
  const R = rng(seed);
  // 跨色相苍翠苦竹：深冷黛青 -> 墨竹青 -> 苍青灰绿（避开经验宝石 gem_m 的高饱和翠绿色域）
  const AO = 0x142a2a, GS = 0x1e3f38, G = 0x2e5946, GH = 0x457554, RIM = 0x6c9668;
  const stalks = [6, 12, 17];
  for (const [i, x] of stalks.entries()) {
    const top = 5 + Math.floor(R() * 9) + i * 2;
    for (let y = top; y < 58; y++) {
      p.set(x, y, GH);
      p.set(x + 1, y, G);
      p.set(x + 2, y, GS);
      if (y < top + 14) p.set(x, y, RIM);
    }
    for (let y = top + 6; y < 56; y += 9 + Math.floor(R() * 3)) {
      p.span(y, x - 1, x + 3, AO);
      p.span(y - 1, x, x + 2, RIM);
    }
    // 团块层叠竹叶冠
    for (let k = 0; k < 3; k++) {
      const ly = top + 2 + k * 8;
      const dir = (k + i) % 2 === 0 ? 1 : -1;
      p.strand([[x + 1, ly + 1], [x + 1 + dir * 3, ly], [x + 1 + dir * 6, ly + 2]], GS, 2);
      p.strand([[x + 1, ly], [x + 1 + dir * 3, ly - 1], [x + 1 + dir * 5, ly + 1]], k % 2 ? G : GH, 2);
      p.set(x + 1 + dir * 2, ly - 2, RIM);
    }
  }
  p.selectiveOutline(0x1b3830, 0x10201c);
  p.under(13, 58, 10.5, 2.2, 0x12222b, 85);
  return p;
}

function shoot(): PC {
  const p = new PC(10, 12);
  for (let i = 0; i < 9; i++) {
    const y = 10 - i;
    const hw = Math.round((1 - i / 9) * 3);
    p.span(y, 5 - hw, 5 + hw, i % 3 === 0 ? 0x6e4e32 : 0xa67e46);
    p.set(5 - hw, y, 0xd4b462);
    p.set(5 + hw, y, 0x4a3222);
  }
  p.set(5, 1, 0x5c8248);
  p.selectiveOutline(0x3d2e24, 0x1c1424);
  p.under(5.5, 10.5, 4.2, 1.3, 0x12222b, 80);
  return p;
}

function mossRock(): PC {
  const p = new PC(16, 12);
  drawRockBase(p);
  // 先在岩石受光顶部叠深苍苔，再统一执行 selectiveOutline 描边，避免青苔溢出无描边或与绿宝石撞色
  p.ellipse(7, 4.8, 4.5, 2, 0x22463a);
  p.ellipse(6.5, 4.3, 3.6, 1.5, 0x356248);
  p.ellipse(6, 4, 2.2, 1, 0x4c7c54);
  p.span(3, 5, 7, 0x6e9866);
  p.selectiveOutline(0x284238, 0x1e2230);
  p.under(9, 10.5, 7.2, 1.8, 0x12222b, 85);
  return p;
}

function fern(): PC {
  const p = new PC(14, 11);
  const ao = 0x17302e, dark = 0x244c38, mid = 0x3e703e, hi = 0x689846;
  p.ellipse(7, 9, 4, 1.5, ao);
  p.strand([[7, 9], [2, 4]], dark, 2);
  p.strand([[7, 9], [12, 4]], dark, 2);
  p.strand([[7, 9], [7, 2]], mid, 2);
  p.strand([[7, 8], [3, 3]], hi, 1);
  p.strand([[7, 8], [11, 3]], mid, 1);
  p.strand([[7, 8], [7, 2]], hi, 1);
  return p;
}

/** 岩壁调色：暗部、阴影、中间、受光、顶沿，再加顶上一层苔（或焦壳） */
const CLIFF_PAL = [0x2e2a3a, 0x4a4656, 0x686474, 0x8c8894, 0xb8b2ae, 0x2e4a3a, 0x426048];
/** 第 4 关玄武岩：赭黑岩体，顶上是烧焦的暗红壳 */
const BASALT_PAL = [0x241a1c, 0x3a2a2a, 0x523a36, 0x6e5048, 0x9a7262, 0x3a2420, 0x5a2e24];

/** dc_cliff（3 种变体，第 3 关岩壁，有碰撞）：0 圆顶巨石、1 尖棱崖石、2 叠石；冷紫灰岩体 + 顶上一层暗苔。换调色即第 4 关的 dc_basalt */
function cliff(variant = 0, pal = CLIFF_PAL): PC {
  const p = new PC(30, 28);
  const [D, S, M, H, RIM, MO, MOH] = pal;
  if (variant === 0) {
    p.ellipse(15, 17, 13, 9.5, S);
    p.ellipse(17, 21, 10, 5.5, D);
    p.ellipse(13, 14, 10, 7, M);
    p.ellipse(11, 11, 6, 4, H);
    p.span(7, 8, 15, RIM);
    p.line(18, 12, 21, 20, D);
    p.ellipse(13, 9, 6, 2, MO);
    p.span(8, 10, 14, MOH);
  } else if (variant === 1) {
    for (let y = 3; y <= 26; y++) {
      const hw = Math.round(3 + (y - 3) * 0.5);
      p.span(y, 15 - hw, 14 + hw, M);
      p.span(y, 14 + Math.round(hw * 0.3), 14 + hw, S);
      p.set(15 - hw, y, H);
    }
    p.line(15, 3, 11, 26, RIM);
    p.line(16, 8, 20, 25, D);
    p.span(25, 5, 25, D);
    p.span(26, 6, 24, D);
    p.ellipse(9, 22, 3, 1.5, MO);
  } else {
    p.ellipse(15, 21, 13, 6, S);
    p.ellipse(17, 23, 10, 3.5, D);
    p.ellipse(13, 19, 10, 4.5, M);
    p.ellipse(15, 11, 8, 6, S);
    p.ellipse(14, 10, 7, 5, M);
    p.ellipse(12, 8, 4, 2.5, H);
    p.span(5, 10, 15, RIM);
    p.span(16, 7, 22, D);
    p.ellipse(15, 6, 4, 1.5, MO);
    p.set(13, 5, MOH);
  }
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(15, 26, 13, 2.2, 0x12222b, 90);
  return p;
}

/** 火精、毕方吐的火球 */
function eFire(): PC {
  const p = new PC(9, 9);
  p.circle(4.5, 4.5, 3.6, 0xff7a2a);
  p.circle(4, 4, 2.2, 0xffd05a);
  p.set(3, 3, 0xfff6c8);
  p.outline(0x5a1a12);
  return p;
}

/** 飞镰、刑天甩出的月牙飞刃 */
function eBlade(): PC {
  const p = new PC(11, 11);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      const r = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 5.5);
      const r2 = Math.hypot(x + 0.5 - 7.2, y + 0.5 - 4);
      if (r <= 4.4 && r2 > 3.4) p.set(x, y, r < 3.2 ? 0x9aa6b8 : 0xe4ecf4);
    }
  p.outline(0x2c2238);
  return p;
}

/** 余火、熔岩喷发前冒的火苗（3 帧循环） */
function flame(f: number): PC {
  const p = new PC(10, 14);
  const w = [0, 1, -1][f];
  p.ellipse(5, 10, 3.6, 3.2, 0xd83c28);
  p.strand([[5, 9], [5 + w, 5], [5 - w, 1]], 0xd83c28, 3);
  p.ellipse(5, 10.5, 2.4, 2.2, 0xff8a30);
  p.strand([[5, 10], [5 + w, 6]], 0xff8a30, 2);
  p.ellipse(5, 11, 1.2, 1.2, 0xffe45c);
  return p;
}

/** dc_lava（2 种变体，第 4 关熔岩口，贴地）：焦黑岩壳围着一汪熔岩，裂缝透出火光 */
function lavaVent(v: number): PC {
  const p = new PC(40, 26);
  const K0 = 0x221614, K1 = 0x3a2420, K2 = 0x4e3028, M0 = 0x8a2a1a, M1 = 0xd0542a, M2 = 0xf09040, M3 = 0xffd070;
  p.ellipse(20, 13, 19, 12, K1);
  p.ellipse(21, 15, 16, 9, K0);
  p.ellipse(19, 11, 15, 8, K2);
  p.ellipse(20, 13, 9, 5.5, M0);
  p.ellipse(20, 13, 7, 4, M1);
  p.ellipse(19, 12.5, 4, 2.2, M2);
  p.span(12, 18, 20, M3);
  const cracks: [number, number][][] = v === 0
    ? [[[11, 13], [5, 10], [2, 12]], [[29, 13], [35, 9]], [[20, 18], [22, 23]]]
    : [[[12, 10], [6, 6]], [[28, 15], [34, 18], [38, 16]], [[17, 17], [13, 22]]];
  for (const c of cracks) p.strand(c, M1, 1);
  return p;
}

/** fx_zone（第 5 关煞气剑阵的地面）：半径 60 的暗红阵纹，边缘一圈深色，中间一圈断续符纹 */
function zone(): PC {
  const p = new PC(120, 120);
  for (let y = 0; y < 120; y++)
    for (let x = 0; x < 120; x++) {
      const d = Math.hypot(x + 0.5 - 60, y + 0.5 - 60) / 60;
      if (d > 1) continue;
      if (d > 0.93) p.set(x, y, 0x8a2a26, 150);
      else p.set(x, y, 0x5a1418, Math.round(36 + 50 * d * d));
    }
  for (let a = 0; a < 60; a++) {
    if (a % 4 === 3) continue;
    const t = (a / 60) * Math.PI * 2;
    p.set(60 + Math.cos(t) * 44, 60 + Math.sin(t) * 44, 0xa83a30, 150);
    p.set(60 + Math.cos(t) * 45, 60 + Math.sin(t) * 45, 0xa83a30, 110);
  }
  return p;
}

/** dc_sword（3 种变体）：插在地上的残剑、长戟、断枪挂破布 */
function swordStuck(v: number): PC {
  const p = new PC(12, 24);
  const BL = 0xb8c2ce, BS = 0x6c7484, BH = 0xe4eaf0, RU = 0x8a5a3a, WD = 0x5a3e2c, GD = 0xb08a3a, RB = 0x8a2a26;
  if (v === 0) {
    p.line(5, 8, 5, 21, BL, 2);
    p.line(6, 9, 6, 21, BS);
    p.span(7, 2, 9, GD);
    p.line(5, 2, 5, 6, WD, 2);
    p.set(5, 1, GD);
    p.set(4, 14, RU);
    p.set(5, 17, RU);
  } else if (v === 1) {
    p.line(5, 2, 5, 21, WD, 2);
    p.strand([[5, 4], [9, 3], [10, 6]], BL, 2);
    p.line(5, 0, 5, 3, BH, 2);
    p.strand([[5, 7], [1, 8]], BS, 2);
  } else {
    p.line(4, 9, 6, 21, WD, 2);
    p.strand([[4, 9], [3, 5]], BL, 2);
    p.strand([[5, 11], [9, 13], [10, 17]], RB, 2);
  }
  p.ellipse(6, 21.5, 3.5, 1.4, 0x3a3228);
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(6, 22, 4, 1, 0x12222b, 80);
  return p;
}

/** dc_bones（2 种变体）：骷髅和散骨 */
function bones(v: number): PC {
  const p = new PC(16, 12);
  const BO = 0xd6cfbc, BS = 0x9a9282, D = 0x3a3430;
  if (v === 0) {
    p.ellipse(6, 6, 3.2, 2.8, BO);
    p.ellipse(7, 7.5, 2.5, 1.5, BS);
    p.set(5, 6, D);
    p.set(7, 6, D);
    p.strand([[9, 9], [14, 7]], BO, 1);
    p.set(14, 6, BO);
    p.set(15, 8, BO);
  } else {
    p.strand([[2, 8], [8, 6]], BO, 2);
    p.strand([[6, 9], [13, 8]], BS, 2);
    p.set(2, 7, BO);
    p.set(13, 7, BO);
    p.ellipse(11, 5, 2, 1.5, BO);
  }
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(8, 10, 6, 1, 0x12222b, 70);
  return p;
}

/** dc_scorch（2 种变体）：烧焦的枯树，根部还有余烬 */
function scorch(v: number): PC {
  const p = new PC(26, 40);
  const T = 0x2e2220, TS = 0x1e1618, TH = 0x4a3a34, E = 0xd0542a, E2 = 0xf0a040;
  p.strand([[13, 38], [13, 22], [v ? 16 : 11, 12], [v ? 18 : 9, 4]], T, 4);
  p.strand([[13, 26], [7, 18], [4, 14]], T, 2);
  p.strand([[13, 22], [19, 16], [22, 10]], TS, 2);
  if (v) p.strand([[16, 12], [12, 6]], TS, 2);
  else p.strand([[11, 12], [15, 7]], TS, 2);
  p.line(12, 24, 12, 37, TH);
  p.set(14, 33, E);
  p.set(14, 34, E2);
  p.set(12, 30, E);
  p.span(38, 9, 17, TS);
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(13, 38, 7, 1.6, 0x12222b, 85);
  return p;
}

/** dc_cinder（2 种变体）：一小堆火山渣，夹着几点余烬 */
function cinder(v: number): PC {
  const p = new PC(14, 10);
  const K = 0x2e2422, K2 = 0x4a3a34, E = 0xe07a2a;
  p.ellipse(7, 6, 5.5, 3, K);
  p.ellipse(6, 5, 3.5, 2, K2);
  if (v) p.ellipse(11, 7, 2.5, 1.8, K);
  p.set(5, 7, E);
  p.set(9, 6, E);
  p.set(6, 4, 0x6a564c);
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(7, 8.5, 5, 1, 0x12222b, 70);
  return p;
}

/** dc_barricade（3 种变体，第 5 关残垒，有碰撞）：0 交叉拒马、1 一排削尖木桩、2 叠起的破盾 */
function barricade(v: number): PC {
  const p = new PC(30, 28);
  const W = 0x6a4a30, WS = 0x4a3222, WH = 0x8e6a48, TIP = 0xb8b0a0, RO = 0x8a7a5a;
  if (v === 0) {
    p.strand([[5, 24], [25, 6]], W, 3);
    p.strand([[5, 6], [25, 24]], WS, 3);
    p.line(3, 17, 27, 17, WH, 2);
    p.set(25, 5, TIP);
    p.set(26, 4, TIP);
    p.set(5, 5, TIP);
    p.set(4, 4, TIP);
  } else if (v === 1) {
    for (const [x, h] of [[6, 14], [11, 18], [16, 16], [21, 19], [25, 13]]) {
      p.line(x, 26 - h, x, 26, W, 3);
      p.line(x + 1, 26 - h, x + 1, 26, WS);
      p.set(x, 25 - h, TIP);
    }
    p.line(3, 20, 27, 18, RO);
  } else {
    p.ellipse(10, 19, 7, 6, 0x6a5a3a);
    p.ellipse(10, 19, 5, 4.4, 0x8a6a34);
    p.circle(10, 19, 1.5, 0xb08a3a);
    p.ellipse(20, 17, 7, 7, 0x5a4a32);
    p.ellipse(20, 17, 5, 5, 0x7a5e30);
    p.circle(20, 17, 1.5, 0xb08a3a);
    p.strand([[3, 25], [27, 25]], WS, 2);
  }
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(15, 26, 13, 2.2, 0x12222b, 90);
  return p;
}

/** dc_pine（2 种变体）：山松，层叠针叶用深松青，避开宝石绿 */
function pine(variant = 0): PC {
  const p = new PC(28, 50);
  const T = 0x5a3e2c, TS = 0x3c2820, TH = 0x86644a;
  const N0 = 0x16302c, N1 = 0x22443a, N2 = 0x325a46, N3 = 0x4a7050;
  const lean = variant === 1 ? 1 : 0;
  p.rect(13, 30, 3, 18, T);
  p.line(13, 30, 13, 47, TH);
  p.line(15, 30, 15, 47, TS);
  p.span(47, 10, 18, TS);
  const tiers: [number, number][] = variant === 0 ? [[34, 12], [26, 10], [18, 8], [10, 5]] : [[33, 11], [24, 10], [15, 7], [8, 4]];
  for (const [i, [y, hw]] of tiers.entries()) {
    const cx = 14 + lean * (3 - i);
    for (let dy = 0; dy < 8; dy++) {
      const w = Math.round(hw * (0.35 + dy / 10));
      p.span(y + dy - 4, cx - w, cx + w, dy < 5 ? N2 : N1);
      p.span(y + dy - 4, cx + Math.round(w * 0.4), cx + w, dy < 5 ? N1 : N0);
    }
    p.span(y - 3, cx - Math.round(hw * 0.4), cx, N3);
  }
  p.set(14 + lean * 3, 3, N3);
  p.selectiveOutline(0x1b3830, 0x10201c);
  p.under(14, 47, 9, 2, 0x12222b, 85);
  return p;
}

export function buildFx(scene: Phaser.Scene) {
  const px = new PC(2, 2);
  px.rect(0, 0, 2, 2, 0xffffff);
  single(scene, 'px', px);

  addSheet(scene, 'fx_slash', [0, 1, 2].map(slashFrame));
  addAnim(scene, 'fx_slash', 'fx_slash', [0, 1, 1, 2], 20, 0);
  single(scene, 'pj_sword', flySword());
  single(scene, 'pj_wave', wave());
  addSheet(scene, 'pj_fireball', [0, 1].map(fireball));
  addAnim(scene, 'pj_fireball', 'pj_fireball', [0, 1], 10);
  for (const el of GEN_ORDER) {
    const ink = el === 'fire' ? 0xc8372d : EL_INFO[el].dark;
    addSheet(scene, `pj_fu_${el}`, [0, 1].map((f) => fu(ink, f)));
    addAnim(scene, `pj_fu_${el}`, `pj_fu_${el}`, [0, 1], 12);
  }
  addSheet(scene, 'fx_explosion', [0, 1, 2, 3].map(explosion));
  addAnim(scene, 'fx_explosion', 'fx_explosion', [0, 1, 2, 3], 16, 0);
  single(scene, 'pj_leaf', leaf());
  single(scene, 'pj_bolt', bolt());
  addSheet(scene, 'pj_water', [0, 1].map(waterDragon));
  addAnim(scene, 'pj_water', 'pj_water', [0, 1], 8);
  addSheet(scene, 'fx_spike', [0, 1, 2].map(spike));
  addAnim(scene, 'fx_spike', 'fx_spike', [0, 1, 2, 2, 2, 2, 1, 0], 20, 0);
  single(scene, 'fx_crack', crack());
  single(scene, 'gem_s', gem(0x5aa8ff, 0xd8f0ff, 0x2a5aa8));
  single(scene, 'gem_m', gem(0x5fd06a, 0xd8ffd8, 0x2a7a3a));
  single(scene, 'gem_l', gem(0xff5a6a, 0xffe0e0, 0xa82a3a));
  single(scene, 'chest', chest());
  single(scene, 'pill', pill());
  single(scene, 'chest_copper', copperChest());
  single(scene, 'crate', crate());
  for (const [id, t] of Object.entries(TALISMANS)) single(scene, `item_${id}`, charm(t.color));
  single(scene, 'fx_ring', ring());
  single(scene, 'fx_disc', disc());
  single(scene, 'ep_leaf', eLeaf());
  single(scene, 'ep_wind', eWind());
  single(scene, 'ep_poison', ePoison());
  single(scene, 'ep_rock', eRock());
  single(scene, 'ep_boulder', eBoulder());
  single(scene, 'fx_boulder', fallingBoulder());
  single(scene, 'ep_fire', eFire());
  single(scene, 'ep_blade', eBlade());
  addSheet(scene, 'fx_flame', [0, 1, 2].map(flame));
  addAnim(scene, 'fx_flame', 'fx_flame', [0, 1, 2], 10);
  single(scene, 'fx_zone', zone());
  single(scene, 'antidote', antidote());

  // 第 1 关·荒郊古道：保持苍凉低对比度的黄褐荒原基调（微冷褐暗部 -> 暖黄褐，无鲜花干扰拾取物）
  single(
    scene,
    'ground_1',
    ground(
      11,
      [0x564b38, 0x5e533b, 0x665b3f, 0x6e6343, 0x756946],
      [0x4c4230, 0x7e7350, 0x867c5a],
      [0x7d7a46, 0x8c864e],
    ),
  );
  // 第 2 关·幽篁竹林：深邃低明度林间冷苔地（冷黛绿 -> 深苔绿，留出高亮绿给宝石 gem_m 与藤怪/竹蛇）
  single(
    scene,
    'ground_2',
    ground(
      23,
      [0x263d2e, 0x2b4532, 0x314d35, 0x375538, 0x3d5c3b],
      [0x1f3326, 0x45643c, 0x4f6e42],
      [0x436e3e, 0x527d44, 0x628c4a],
    ),
  );
  // 第 3 关·山林：冷灰褐的山地碎石土，略带苔色；岩壁和松树比地面高一档明度
  single(
    scene,
    'ground_3',
    ground(
      37,
      [0x3b3a32, 0x403f35, 0x454438, 0x4a493b, 0x4f4e3e],
      [0x33322c, 0x5a584a, 0x625f50],
      [0x4a573a, 0x566442],
    ),
  );
  // 第 4 关·赤焰谷：赭黑的火山灰土，偏暖但压低明度，熔岩口和火系敌人才是亮色
  single(
    scene,
    'ground_4',
    ground(
      41,
      [0x3d2b26, 0x422f29, 0x47322b, 0x4c362d, 0x513930],
      [0x33231f, 0x5a4034, 0x63473a],
      [0x5a3428, 0x64402e],
    ),
  );
  // 第 5 关·兵冢古战场：灰黄的尘土地，金系敌人的银灰比地面亮一档
  single(
    scene,
    'ground_5',
    ground(
      53,
      [0x45423a, 0x4a463d, 0x4f4a40, 0x544e43, 0x595246],
      [0x3c3932, 0x655f54, 0x6d665a],
      [0x5c5840, 0x666046],
    ),
  );
  addSheet(scene, 'dc_rock', [0, 1, 2].map(rock));
  addSheet(scene, 'dc_tuft', [0, 1, 2].map(tuft));
  addSheet(scene, 'dc_tablet', [0, 1, 2].map(tablet));
  addSheet(scene, 'dc_deadtree', [0, 1].map(deadTree));
  addSheet(scene, 'dc_bamboo', [1, 2, 3].map(bamboo));
  single(scene, 'dc_shoot', shoot());
  single(scene, 'dc_mossrock', mossRock());
  single(scene, 'dc_fern', fern());
  addSheet(scene, 'dc_cliff', [0, 1, 2].map((v) => cliff(v)));
  addSheet(scene, 'dc_basalt', [0, 1, 2].map((v) => cliff(v, BASALT_PAL)));
  addSheet(scene, 'dc_pine', [0, 1].map(pine));
  addSheet(scene, 'dc_lava', [0, 1].map(lavaVent));
  addSheet(scene, 'dc_sword', [0, 1, 2].map(swordStuck));
  addSheet(scene, 'dc_bones', [0, 1].map(bones));
  addSheet(scene, 'dc_scorch', [0, 1].map(scorch));
  addSheet(scene, 'dc_cinder', [0, 1].map(cinder));
  addSheet(scene, 'dc_barricade', [0, 1, 2].map(barricade));
}
