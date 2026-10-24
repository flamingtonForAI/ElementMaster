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

/** 藤缚：地上盘开的一丛藤蔓，按地面压扁（宽:高 = 1:0.6） */
function vine(): PC {
  const p = new PC(40, 24);
  const D = 0x2e7a4a, L = 0x4fbf7a, H = 0xa8e890;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.4;
    const pts: [number, number][] = [];
    for (let t = 0; t <= 16; t += 2) {
      const w = Math.sin(t * 0.6 + k) * 2;
      pts.push([20 + Math.cos(a) * t * 1.1 - Math.sin(a) * w, 12 + (Math.sin(a) * t * 1.1 + Math.cos(a) * w) * 0.6]);
    }
    p.strand(pts, D, 1);
    const [lx, ly] = pts[pts.length - 2];
    p.set(Math.round(lx), Math.round(ly), L);
    p.set(Math.round(lx) + 1, Math.round(ly), H);
  }
  p.ellipse(20, 12, 3, 2, D);
  p.set(20, 11, L);
  p.outline(0x173a24);
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

/** 树妖环射的飞叶：尖头杏叶带叶脉，飞行中翻转 */
function eLeaf(): PC {
  const p = new PC(9, 9);
  const L = 0x6fb840, H = 0xb4e86a, V = 0x3f7a2a;
  for (const [y, x0, x1] of [[1, 6, 7], [2, 4, 7], [3, 3, 7], [4, 2, 6], [5, 2, 5], [6, 1, 4], [7, 1, 2]] as const) p.span(y, x0, x1, L);
  for (const [y, x0, x1] of [[2, 4, 5], [3, 3, 4], [4, 2, 3], [5, 2, 2]] as const) p.span(y, x0, x1, H);
  p.line(1, 7, 6, 2, V);
  p.outline(0x2a4a12);
  return p;
}

/** 瘴蟾吐的毒涎：朝飞行方向（右）的圆头，拖一条渐细的尾巴 */
function ePoison(): PC {
  const p = new PC(12, 9);
  p.span(4, 1, 5, 0x7ac83a);
  p.span(3, 3, 5, 0x7ac83a);
  p.span(5, 3, 5, 0x5f9a34);
  p.circle(7.5, 4.5, 3.1, 0x7ac83a);
  p.span(6, 7, 9, 0x5f9a34);
  p.set(9, 5, 0x5f9a34);
  p.span(3, 6, 7, 0xd8ff8a);
  p.set(7, 2, 0xd8ff8a);
  p.outline(0x2a3a12);
  return p;
}

/** 狼妖的风刃：凸面朝前的新月，后面拖两道风痕 */
function eWind(): PC {
  const p = new PC(12, 11);
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 12; x++) {
      const r = Math.hypot(x + 0.5 - 4.5, y + 0.5 - 5.5);
      const r2 = Math.hypot(x + 0.5 - 2.6, y + 0.5 - 5.5);
      if (r <= 5.2 && r2 > 4.6) p.set(x, y, r > 4.2 ? 0xffffff : 0xdfe8ff);
    }
  p.span(3, 2, 4, 0xb8c8f0);
  p.span(7, 2, 4, 0xb8c8f0);
  p.outline(0x4a3a6a);
  return p;
}

/** 山魈投的石块：不规则的棱角碎石，飞行中翻滚 */
function eRock(): PC {
  const p = new PC(9, 9);
  const M = 0x9a8a72, H = 0xd4c4a0, D = 0x5e4e3c;
  p.span(1, 3, 5, M);
  p.span(2, 2, 6, M);
  p.span(3, 1, 7, M);
  p.span(4, 1, 7, M);
  p.span(5, 2, 7, M);
  p.span(6, 2, 6, M);
  p.span(7, 4, 5, M);
  p.span(1, 3, 4, H);
  p.span(2, 2, 3, H);
  p.set(1, 3, H);
  p.span(6, 4, 6, D);
  p.set(7, 5, D);
  p.set(5, 3, D);
  p.outline(0x2c2238);
  return p;
}

/** 山魈王掷出的巨石：多面棱角，一道裂纹，飞行中翻滚 */
function eBoulder(): PC {
  const p = new PC(13, 13);
  const M = 0x9a8a72, S = 0x6e5e4a, H = 0xd4c4a0, HL = 0xf0e4c4;
  for (const [y, x0, x1] of [[1, 4, 8], [2, 3, 9], [3, 2, 10], [4, 1, 11], [5, 1, 11], [6, 1, 11], [7, 1, 11], [8, 2, 11], [9, 2, 10], [10, 3, 9], [11, 5, 8]] as const) p.span(y, x0, x1, M);
  p.ellipse(8.5, 8.5, 3, 2.4, S);
  p.span(2, 4, 6, H);
  p.span(3, 3, 5, H);
  p.span(4, 2, 3, H);
  p.set(4, 2, HL);
  p.line(6, 4, 8, 7, S);
  p.set(9, 7, S);
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

/** 火精、毕方的火球：亮焰心在前（右），三条火舌往后拖 */
function eFire(): PC {
  const p = new PC(13, 9);
  const R = 0xd83c28, O = 0xff7a2a, Y = 0xffd05a, W = 0xfff6c8;
  p.strand([[6, 2], [2, 1]], R, 1);
  p.strand([[6, 6], [2, 7]], R, 1);
  p.span(3, 2, 6, O);
  p.span(4, 0, 6, O);
  p.span(5, 2, 6, O);
  p.set(0, 4, R);
  p.circle(8.5, 4.5, 3.3, O);
  p.circle(9, 4.5, 2, Y);
  p.set(9, 4, W);
  p.set(10, 4, W);
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

/** 鱼妖、相柳吐的水弹：朝飞行方向（右）的水滴，后面拖两道细水痕 */
function eWater(): PC {
  const p = new PC(12, 9);
  const B = 0x5a9ae8, H = 0xd8ecff, D = 0x3a64b0;
  p.span(3, 1, 4, D);
  p.span(5, 0, 4, D);
  p.span(4, 2, 6, B);
  p.circle(7.5, 4.5, 3.2, B);
  p.span(6, 6, 9, D);
  p.set(8, 3, H);
  p.set(7, 3, H);
  p.set(9, 4, H);
  p.outline(0x1c2a52);
  return p;
}

/** fx_puddle（2 种变体，蛟冲过留下的水洼）：半径 10 的扁水洼，边上一圈亮水光 */
function puddle(v: number): PC {
  const p = new PC(20, 12);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 20; x++) {
      const wob = v ? Math.sin(x * 0.9) * 0.08 : Math.cos(x * 0.7) * 0.08;
      const d = Math.hypot((x + 0.5 - 10) / 10, (y + 0.5 - 6) / 6) + wob;
      if (d > 1) continue;
      p.set(x, y, d > 0.78 ? 0x6a9ad0 : 0x3a5e90, d > 0.78 ? 170 : 140);
    }
  p.span(4, 6, 9, 0xb8d8f8, 170);
  p.set(13, 7, 0xb8d8f8, 150);
  return p;
}

/** fx_fog（瘴雾的一团）：半径约 26 的柔边扁雾团，病恹恹的黄绿，中心厚、边缘散 */
function fog(): PC {
  const p = new PC(52, 36);
  const R = rng(66);
  for (let y = 0; y < 36; y++)
    for (let x = 0; x < 52; x++) {
      const d = Math.hypot((x + 0.5 - 26) / 26, (y + 0.5 - 18) / 18) + (R() - 0.5) * 0.12;
      if (d >= 1) continue;
      const a = Math.round(220 * (1 - d) ** 0.8);
      if (a > 6) p.set(x, y, d < 0.45 ? 0xb4d478 : 0x96bc5c, a);
    }
  return p;
}

/** dc_mud（2 种变体，第 6 关泥潭，贴地）：半径 50 的扁泥沼，湿边略亮，中间一汪浑水泛着天光，冒两个泡 */
function mudPool(v: number): PC {
  const p = new PC(100, 62);
  const R = rng(70 + v);
  for (let y = 0; y < 62; y++)
    for (let x = 0; x < 100; x++) {
      const a = Math.atan2(y + 0.5 - 31, x + 0.5 - 50);
      const wob = Math.sin(a * 3 + v * 2) * 0.05 + Math.sin(a * 7 + v) * 0.03;
      const d = Math.hypot((x + 0.5 - 50) / 50, (y + 0.5 - 31) / 31) + wob;
      if (d > 1) continue;
      const n = R() < 0.06 ? 1 : 0;
      p.set(x, y, d > 0.9 ? 0x4a4a32 : d > 0.7 ? (n ? 0x3a3a28 : 0x34342a) : d > 0.4 ? 0x2c3226 : (n ? 0x34403a : 0x2e3a34));
    }
  // 浑水上的天光
  p.span(24, 38, 50, 0x46564e);
  p.span(25, 42, 56, 0x3e4c46);
  p.span(36, 54, 60, 0x3e4c46);
  // 两个泥泡
  for (const [x, y] of v ? [[34, 34], [62, 26]] : [[60, 36], [40, 22]]) {
    p.circle(x, y, 1.6, 0x4e5a4a);
    p.set(x - 1, y - 1, 0x6a7a68);
  }
  return p;
}

/** 芦苇调色：暗部、茎、受光茎、高光，穗子暗、穗子亮 */
const REED = { D: 0x2e3422, S: 0x4e5a32, M: 0x6e7a42, H: 0x96985a, P0: 0x7a5a3a, P1: 0xb08e5e };

/** dc_reed（3 种变体，第 6 关芦苇荡，有碰撞）：一大丛密芦苇，茎秆往两边微微摊开，顶上一片褐色苇穗 */
function reed(v: number): PC {
  const p = new PC(30, 30);
  const R = rng(80 + v);
  const { D, S, M, H, P0, P1 } = REED;
  // 根部一团暗色
  p.ellipse(15, 27, 11, 2.6, D);
  const n = 11 + v;
  for (let i = 0; i < n; i++) {
    const bx = 5 + (i / (n - 1)) * 20 + (R() - 0.5) * 2;
    const lean = (bx - 15) * 0.35 + (R() - 0.5) * 3;
    const top = 4 + R() * 9;
    const col = i % 3 === 0 ? S : i % 3 === 1 ? M : H;
    p.strand([[bx, 27], [bx + lean * 0.5, 16], [bx + lean, top]], col, 1);
    // 一半的茎秆顶着苇穗
    if (R() < 0.6) {
      p.strand([[bx + lean, top], [bx + lean + 1, top - 3]], P0, 2);
      p.set(bx + lean, top - 2, P1);
    }
    // 叶子斜着耷拉下来
    if (i % 2 === 0) p.strand([[bx + lean * 0.4, 18], [bx + lean * 0.4 + (lean >= 0 ? 4 : -4), 21]], S, 1);
  }
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(15, 28, 12, 1.8, 0x12222b, 90);
  return p;
}

/** dc_cattail（2 种变体）：一小丛香蒲，几根直茎顶着深褐的蒲棒 */
function cattail(v: number): PC {
  const p = new PC(14, 26);
  const { D, S, M } = REED;
  const stems = v ? [[4, 7], [7, 3], [10, 8]] : [[5, 5], [9, 4]];
  for (const [x, top] of stems) {
    p.line(x, top, x, 24, M);
    p.line(x + 1, top + 6, x + 1, 24, S);
    p.rect(x - 1, top + 2, 2, 5, 0x5a3a26);
    p.set(x - 1, top + 2, 0x7a5236);
    p.set(x, top, M);
  }
  p.strand([[6, 24], [2, 16]], S, 1);
  p.strand([[8, 24], [12, 17]], M, 1);
  p.ellipse(7, 24, 4, 1.4, D);
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(7, 24.5, 5, 1, 0x12222b, 80);
  return p;
}

/** dc_lotus（2 种变体）：贴着水面的几片暗青荷叶，叶心一道缺口，偶尔一朵粉白花苞 */
function lotus(v: number): PC {
  const p = new PC(18, 10);
  const L0 = 0x1e3a3c, L1 = 0x2a4e4c, L2 = 0x3a6260, PK = 0xd8a0b0, PW = 0xf0dce0;
  const pads: [number, number, number][] = v ? [[5, 5, 4], [12, 6, 3.4]] : [[6, 6, 4.5], [13, 4, 3], [12, 8, 2.4]];
  for (const [x, y, r] of pads) {
    p.ellipse(x, y, r, r * 0.55, L1);
    p.ellipse(x - 0.5, y - 0.4, r * 0.7, r * 0.35, L2);
    p.line(x, y, x + r - 0.5, y, L0);
  }
  if (!v) {
    p.ellipse(13, 3, 1.5, 1.8, PK);
    p.set(13, 2, PW);
  }
  p.selectiveOutline(0x1c2a2c, 0x14181c);
  return p;
}

/** 第 7 关冰崖：冷石青灰岩体，顶上一层积雪；受光面压成灰白，不和蓝宝石撞色 */
const ICE_PAL = [0x262c38, 0x3e4656, 0x5a6474, 0x848c98, 0xc4ccd4, 0xc8d0d8, 0xe8eef2];

/** dc_ice（2 种变体，第 7 关冰面，贴地）：半径 50 的扁冰面，灰青冰色，边上一圈薄雪，几道裂纹和反光 */
function iceSheet(v: number): PC {
  const p = new PC(100, 62);
  const R = rng(90 + v);
  for (let y = 0; y < 62; y++)
    for (let x = 0; x < 100; x++) {
      const a = Math.atan2(y + 0.5 - 31, x + 0.5 - 50);
      const wob = Math.sin(a * 3 + v * 2) * 0.04 + Math.sin(a * 6 + v) * 0.03;
      const d = Math.hypot((x + 0.5 - 50) / 50, (y + 0.5 - 31) / 31) + wob;
      if (d > 1) continue;
      const n = R() < 0.05 ? 1 : 0;
      p.set(x, y, d > 0.9 ? 0x7a8490 : d > 0.75 ? 0x4e5a68 : d > 0.4 ? (n ? 0x56636e : 0x4a5664) : n ? 0x5a6874 : 0x52606c);
    }
  // 裂纹
  const cracks: [number, number][][] = v
    ? [[[30, 22], [42, 30], [40, 40]], [[42, 30], [60, 27], [70, 35]]]
    : [[[24, 30], [38, 26], [52, 34]], [[52, 34], [64, 24]], [[52, 34], [58, 44]]];
  for (const c of cracks) p.strand(c, 0x3a4450, 1);
  // 冰面反光
  p.span(18, 36, 48, 0x8a96a2);
  p.span(19, 40, 52, 0x6a7682);
  p.span(40, 58, 64, 0x6a7682);
  return p;
}

/** dc_icecliff（3 种变体，第 7 关冰崖，有碰撞）：岩形同 dc_cliff，换成积雪的冷青灰 */
function iceCliff(v: number): PC {
  return cliff(v, ICE_PAL);
}

/** dc_snowpine（2 种变体）：压着雪的山松，针叶比第 3 关更暗更冷，每层顶上一道积雪 */
function snowPine(variant = 0): PC {
  const p = new PC(28, 50);
  const T = 0x4a3a30, TS = 0x302420, TH = 0x6e5848;
  const N0 = 0x14262a, N1 = 0x1e3436, N2 = 0x2a4444, SN = 0xc8d0d8, SNH = 0xe8eef2;
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
    // 积雪压在每层的受光一侧
    const sw = Math.round(hw * 0.75);
    p.span(y - 1, cx - sw, cx + Math.round(sw * 0.3), SN);
    p.span(y - 2, cx - Math.round(sw * 0.6), cx, SNH);
  }
  p.set(14 + lean * 3, 3, SNH);
  p.selectiveOutline(0x1e2a34, 0x10181e);
  p.under(14, 47, 9, 2, 0x12222b, 85);
  return p;
}

/** dc_icerock（2 种变体）：半埋雪里的石头，顶上一层雪 */
function iceRock(v: number): PC {
  const p = new PC(20, 16);
  const D = 0x2e3440, S = 0x48505e, M = 0x66707e, SN = 0xc8d0d8, SNH = 0xe8eef2;
  if (v === 0) {
    p.ellipse(9, 10, 7, 4.5, S);
    p.span(13, 3, 14, D);
    p.ellipse(8, 9, 5.5, 3.2, M);
    p.ellipse(8, 6.5, 5.5, 2, SN);
    p.span(5, 6, 10, SNH);
    p.ellipse(15, 12, 3, 2, S);
    p.span(10, 14, 16, SN);
  } else {
    p.rect(5, 6, 9, 7, S);
    p.rect(5, 6, 3, 7, M);
    p.span(12, 5, 13, D);
    p.span(5, 5, 13, SN);
    p.span(4, 6, 11, SNH);
    p.set(14, 9, D);
  }
  // 根部的积雪
  p.ellipse(10, 13.5, 8, 1.6, 0xa8b2bc);
  p.selectiveOutline(0x2e3440, 0x1a1e26);
  p.under(10.5, 14, 8, 1.6, 0x12222b, 80);
  return p;
}

/** dc_snowtuft（2 种变体）：一小堆雪，探出几根冻僵的枯草 */
function snowTuft(v: number): PC {
  const p = new PC(14, 12);
  const G0 = 0x4a4a42, G1 = 0x6a685a;
  if (v) {
    p.strand([[5, 9], [3, 4]], G0, 1);
    p.strand([[8, 9], [10, 3]], G1, 1);
  } else {
    p.strand([[6, 9], [5, 3]], G1, 1);
    p.strand([[9, 9], [11, 5]], G0, 1);
    p.strand([[4, 9], [2, 6]], G0, 1);
  }
  p.ellipse(7, 9.5, 5.5, 2.2, 0xa8b2bc);
  p.ellipse(6.5, 9, 4, 1.4, 0xc8d0d8);
  p.span(8, 5, 7, 0xe8eef2);
  p.selectiveOutline(0x3a4250, 0x1e2430);
  return p;
}

/** 玄冥的冰羽：朝飞行方向（右）的一片冰棱，尾部拖一点霜 */
function eIce(): PC {
  const p = new PC(13, 7);
  const B = 0x9fd8ff, H = 0xf0faff, D = 0x5a8ab8;
  p.span(3, 0, 3, D, 160);
  p.tri([3, 1], [3, 5], [12, 3], B);
  p.span(3, 4, 10, H);
  p.span(4, 4, 8, D);
  p.outline(0x1c2a52);
  return p;
}

/** fx_icicle（玄冥的冰锥，从天而降）：尖朝下的长冰锥 */
function icicle(): PC {
  const p = new PC(9, 20);
  const B = 0x9fd8ff, H = 0xf0faff, D = 0x5a8ab8;
  for (let y = 0; y < 18; y++) {
    const hw = Math.max(0, Math.round(3.5 * (1 - y / 18)));
    p.span(y, 4 - hw, 4 + hw, y < 4 ? D : B);
    p.set(4 - Math.max(0, hw - 1), y, H);
  }
  p.set(4, 18, H);
  p.outline(0x1c2a52);
  return p;
}

/** fx_snowflake：暴风雪里的一道雪痕，朝右画、按风向转 */
function snowflake(): PC {
  const p = new PC(5, 1);
  p.span(0, 0, 1, 0xe8f0f8, 90);
  p.span(0, 2, 4, 0xffffff, 220);
  return p;
}

/** fx_frost（寒词缀的脚下一圈霜，半径 30）：淡蓝的霜环，环上几颗冰晶 */
function frostRing(): PC {
  const p = new PC(60, 60);
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < 60; x++) {
      const d = Math.hypot(x + 0.5 - 30, y + 0.5 - 30) / 30;
      if (d > 1 || d < 0.72) continue;
      p.set(x, y, 0xc8ecff, Math.round(170 * (1 - Math.abs(d - 0.88) / 0.16)));
    }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = 30 + Math.cos(a) * 26;
    const y = 30 + Math.sin(a) * 26;
    p.set(x, y, 0xffffff);
    p.set(x - 1, y, 0xd8f0ff, 200);
    p.set(x + 1, y, 0xd8f0ff, 200);
    p.set(x, y - 1, 0xd8f0ff, 200);
    p.set(x, y + 1, 0xd8f0ff, 200);
  }
  return p;
}

/** 第 8 关雅丹土台：风蚀的赭红土崖，顶上一层浅沙壳 */
const YARDANG_PAL = [0x3a2a22, 0x5a4232, 0x7a5a40, 0x9a7a56, 0xc8a878, 0x8a7450, 0xa89068];

/** dc_yardang（3 种变体，第 8 关雅丹，有碰撞）：岩形同 dc_cliff，换成风蚀的赭红土 */
function yardang(v: number): PC {
  return cliff(v, YARDANG_PAL);
}

/** dc_quicksand（2 种变体，第 8 关流沙，贴地）：半径 50 的扁沙涡，一圈圈往中心旋，中间发暗下陷 */
function quicksand(v: number): PC {
  const p = new PC(100, 62);
  for (let y = 0; y < 62; y++)
    for (let x = 0; x < 100; x++) {
      const dx = (x + 0.5 - 50) / 50;
      const dy = (y + 0.5 - 31) / 31;
      const a = Math.atan2(dy, dx);
      const wob = Math.sin(a * 3 + v * 2) * 0.04;
      const d = Math.hypot(dx, dy) + wob;
      if (d > 1) continue;
      // 螺旋纹：角度和半径一起转
      const band = Math.sin(d * 18 - a * 2 * (v ? -1 : 1));
      const col = d < 0.22 ? 0x4a3c28 : d < 0.4 ? (band > 0 ? 0x6a5638 : 0x5e4c32) : band > 0.3 ? 0x8a7248 : band < -0.3 ? 0x6e5a3a : 0x7c6642;
      p.set(x, y, col, d > 0.9 ? 200 : 255);
    }
  return p;
}

/** dc_poplar（2 种变体）：枯死的胡杨，扭着的粗干、几根断枝，枝头挂着几簇干黄的叶 */
function poplar(v: number): PC {
  const p = new PC(30, 42);
  const T = 0x6a4a32, TS = 0x46301f, TH = 0x9a7650, LF = 0xc8a040, LFD = 0x9a7a30;
  const lean = v ? -1 : 1;
  p.strand([[15, 40], [15 + lean, 30], [14 - lean, 20], [15, 14]], T, 4);
  p.strand([[16, 40], [16 + lean, 30], [15 - lean, 20]], TS, 2);
  p.strand([[14, 38], [14 + lean, 28]], TH, 1);
  p.span(40, 10, 20, TS);
  // 断枝
  const branches: [number, number][][] = v
    ? [[[14, 20], [6, 12], [4, 8]], [[15, 16], [22, 9], [25, 6]], [[15, 26], [23, 22]]]
    : [[[14, 18], [7, 10], [6, 6]], [[15, 14], [21, 7]], [[14, 26], [6, 22]], [[16, 22], [25, 15]]];
  for (const b of branches) p.strand(b, T, 2);
  for (const b of branches) {
    const [x, y] = b[b.length - 1];
    p.ellipse(x, y, 2.6, 1.8, LFD);
    p.ellipse(x - 0.5, y - 0.5, 1.8, 1.2, LF);
  }
  p.selectiveOutline(0x3a2a22, 0x1c1424);
  p.under(15, 40, 8, 1.8, 0x12222b, 85);
  return p;
}

/** dc_sandrock（2 种变体）：风蚀的小土石，顶上积着沙 */
function sandRock(v: number): PC {
  const p = new PC(20, 16);
  const D = 0x4a3428, S = 0x6e5038, M = 0x8e6c4a, H = 0xb8966a;
  if (v === 0) {
    p.ellipse(10, 10, 7, 4.5, S);
    p.ellipse(9, 8.5, 5.5, 3.2, M);
    p.span(6, 6, 11, H);
    p.span(12, 4, 15, D);
    p.line(12, 7, 14, 11, D);
  } else {
    // 蘑菇形的风蚀石：上大下小
    p.rect(8, 9, 4, 5, S);
    p.ellipse(10, 7, 6.5, 3, M);
    p.span(5, 6, 13, H);
    p.span(9, 5, 15, D);
  }
  p.ellipse(10, 13.5, 7, 1.4, 0x7a6444);
  p.selectiveOutline(0x4a3428, 0x1c1424);
  p.under(10.5, 14, 8, 1.6, 0x12222b, 80);
  return p;
}

/** dc_camelthorn（2 种变体）：一小丛骆驼刺，干枯的灰橄榄色细枝 */
function camelthorn(v: number): PC {
  const p = new PC(14, 12);
  const B0 = 0x4a4230, B1 = 0x6a5e3e, B2 = 0x847448;
  p.span(10, 3, 10, B0);
  const twigs: [number, number][][] = v
    ? [[[6, 10], [3, 5]], [[7, 10], [8, 3]], [[8, 10], [12, 6]]]
    : [[[5, 10], [2, 6]], [[7, 10], [6, 4]], [[8, 10], [11, 4]], [[9, 10], [12, 8]]];
  twigs.forEach((t, i) => p.strand(t, i % 2 ? B1 : B2, 1));
  p.set(4, 6, B2);
  p.set(10, 5, B2);
  p.selectiveOutline(0x3a3224, 0x1c1424);
  return p;
}

/** 金蜣滚出的金丸：沙团裹着几点金光，原地翻滚 */
function sandBall(): PC {
  const p = new PC(10, 10);
  p.circle(5, 5, 4.2, 0x9a7a48);
  p.circle(4.4, 4.4, 3, 0xb8945a);
  for (const [x, y] of [[3, 3], [6, 5], [4, 7], [7, 3]]) p.set(x, y, 0xf0d070);
  p.set(3, 2, 0xfff0b0);
  p.outline(0x3a2a18);
  return p;
}

/** fx_sandgrain：沙暴里贴地刮的一道沙痕，朝右画、按风向转 */
function sandgrain(): PC {
  const p = new PC(6, 1);
  p.span(0, 0, 1, 0xb89868, 90);
  p.span(0, 2, 5, 0xe0c890, 210);
  return p;
}

/** dc_coral（3 种变体，第 9 关珊瑚礁，有碰撞）：灰黑礁石上长着暗珊瑚红的枝状珊瑚，颜色压暗，不和红宝石撞色 */
function coral(v: number): PC {
  const p = new PC(30, 28);
  const R = rng(120 + v);
  const RK = 0x3a4448, RKS = 0x2a3236, RKH = 0x5a666a, C0 = 0x7a3e3a, C1 = 0xa65a4e, C2 = 0xc88a72;
  // 礁石底座
  p.ellipse(15, 22, 13, 5.5, RKS);
  p.ellipse(14, 20.5, 11.5, 4.5, RK);
  p.span(17, 7, 16, RKH);
  // 枝状珊瑚：几根主枝分叉向上
  const n = 3 + v;
  for (let i = 0; i < n; i++) {
    const bx = 6 + (i / (n - 1)) * 18 + (R() - 0.5) * 2;
    const top = 4 + R() * 8;
    const lean = (R() - 0.5) * 6;
    const col = i % 2 ? C0 : C1;
    p.strand([[bx, 20], [bx + lean * 0.5, 14], [bx + lean, top]], col, 2);
    p.strand([[bx + lean * 0.5, 14], [bx + lean * 0.5 + (lean >= 0 ? 4 : -4), 10]], C0, 1);
    p.set(bx + lean, top, C2);
  }
  if (v === 2) {
    // 一团扇形珊瑚
    p.ellipse(20, 12, 5, 4, C0);
    p.ellipse(19.5, 11.5, 3.5, 2.8, C1);
  }
  p.selectiveOutline(0x2c2238, 0x1c1424);
  p.under(15, 26, 13, 2.2, 0x12222b, 90);
  return p;
}

/** dc_tidepool（2 种变体，第 9 关浅滩，贴地）：半径 50 的扁浅水，边上一圈湿沙，水面几道波纹 */
function tidepool(v: number): PC {
  const p = new PC(100, 62);
  for (let y = 0; y < 62; y++)
    for (let x = 0; x < 100; x++) {
      const a = Math.atan2(y + 0.5 - 31, x + 0.5 - 50);
      const wob = Math.sin(a * 3 + v * 2) * 0.05 + Math.sin(a * 5 + v) * 0.03;
      const d = Math.hypot((x + 0.5 - 50) / 50, (y + 0.5 - 31) / 31) + wob;
      if (d > 1) continue;
      p.set(x, y, d > 0.88 ? 0x4a5a58 : d > 0.6 ? 0x2e4c58 : 0x284452);
    }
  for (const [y, x0, x1] of v ? [[20, 34, 50], [34, 52, 68], [42, 30, 40]] : [[22, 40, 58], [36, 28, 44], [30, 60, 72]]) p.span(y, x0, x1, 0x5a8090);
  return p;
}

/** dc_kelp（2 种变体）：几根暗青的海草，从沙里长出来微微弯 */
function kelp(v: number): PC {
  const p = new PC(14, 30);
  const K0 = 0x1e3a32, K1 = 0x2e5244, K2 = 0x3e6a50;
  const stems = v ? [[4, 6, -1], [8, 2, 1], [11, 9, 1]] : [[5, 4, 1], [9, 7, -1]];
  stems.forEach(([x, top, dir], i) => {
    p.strand([[x, 28], [x + dir * 2, 20], [x - dir, 12], [x + dir, top]], i % 2 ? K1 : K2, 2);
    p.strand([[x, 28], [x + dir * 2, 20]], K0, 1);
  });
  p.ellipse(7, 28, 5, 1.4, 0x24302e);
  p.selectiveOutline(0x1c2a2c, 0x10181a);
  return p;
}

/** dc_shell（2 种变体）：沙里的几枚贝壳，或一只暗橘的海星 */
function shell(v: number): PC {
  const p = new PC(12, 9);
  if (v) {
    const O = 0xb86a42, OH = 0xd89a62;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      p.strand([[6, 5], [6 + Math.cos(a) * 4.5, 5 + Math.sin(a) * 3.5]], O, 2);
    }
    p.set(6, 4, OH);
  } else {
    p.ellipse(4, 5, 3, 2.4, 0xc8b898);
    p.line(4, 3, 4, 7, 0x9a8a70);
    p.line(2, 4, 3, 7, 0x9a8a70);
    p.ellipse(9, 6, 2, 1.6, 0xb8a888);
  }
  p.selectiveOutline(0x3a3430, 0x1c1424);
  return p;
}

/** 第 10 关昆仑玉崖：青玉色的岩体，顶上积雪；玉色压灰，不和绿宝石撞色 */
const KUNLUN_PAL = [0x22302e, 0x34504a, 0x4a6a62, 0x6a8a80, 0xa8c0b4, 0xc8d0d8, 0xe8eef2];

/** dc_kunlun（3 种变体，第 10 关玉崖，有碰撞）：岩形同 dc_cliff，换成积雪的青玉 */
function kunlun(v: number): PC {
  return cliff(v, KUNLUN_PAL);
}

export function buildFx(scene: Phaser.Scene) {
  const px = new PC(2, 2);
  px.rect(0, 0, 2, 2, 0xffffff);
  single(scene, 'px', px);

  addSheet(scene, 'fx_slash', [0, 1, 2].map(slashFrame));
  addAnim(scene, 'fx_slash', 'fx_slash', [0, 1, 1, 2], 20, 0);
  single(scene, 'pj_sword', flySword());
  single(scene, 'pj_wave', wave());
  single(scene, 'fx_vine', vine());
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
  single(scene, 'ep_water', eWater());
  addSheet(scene, 'fx_puddle', [0, 1].map(puddle));
  single(scene, 'fx_fog', fog());
  single(scene, 'ep_ice', eIce());
  single(scene, 'fx_icicle', icicle());
  single(scene, 'fx_snowflake', snowflake());
  single(scene, 'fx_frost', frostRing());
  single(scene, 'ep_sandball', sandBall());
  single(scene, 'fx_sandgrain', sandgrain());
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
  // 第 6 关·云梦泽：发暗的青褐湿泥地，偏冷，水系敌人的蓝和泥潭都比它跳一点
  single(
    scene,
    'ground_6',
    ground(
      67,
      [0x2f382f, 0x333c32, 0x374035, 0x3b4438, 0x3f483b],
      [0x2a3029, 0x4a5240, 0x535a46],
      [0x46553a, 0x4e5e40],
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
  // 第 7 关·寒江：雪夜江岸，冷石板青灰的冻土夹着薄雪，压低明度，冰面、宝石和敌人都比它亮
  single(
    scene,
    'ground_7',
    ground(
      79,
      [0x343a46, 0x383e4a, 0x3c424e, 0x404652, 0x444a56],
      [0x2e323c, 0x505662, 0x5a606c],
      [0x5a5a52, 0x666458],
    ),
  );
  // 第 8 关·大漠：压暗的赭黄沙地，偏暖，土系敌人的土黄和流沙比它亮一档
  single(
    scene,
    'ground_8',
    ground(
      83,
      [0x443828, 0x493c2b, 0x4e402e, 0x534431, 0x584834],
      [0x3c3024, 0x64523a, 0x6c5840],
      [0x6a5a38, 0x76643e],
    ),
  );
  // 第 9 关·东海归墟：暗青灰的海底沙地，冷而沉，水火两系的蓝和橘都比它跳
  single(
    scene,
    'ground_9',
    ground(
      97,
      [0x283639, 0x2c3a3d, 0x303e41, 0x344245, 0x384649],
      [0x222e31, 0x46545a, 0x4e5c60],
      [0x34503f, 0x3c5844],
    ),
  );
  // 第 10 关·昆仑：冷灰紫的玉石台地，五系敌人的颜色都比它跳
  single(
    scene,
    'ground_10',
    ground(
      101,
      [0x33313c, 0x373540, 0x3b3944, 0x3f3d48, 0x43414c],
      [0x2d2b35, 0x585664, 0x605e6c],
      [0x4a5848, 0x52604e],
    ),
  );
  addSheet(scene, 'dc_mud', [0, 1].map(mudPool));
  addSheet(scene, 'dc_reed', [0, 1, 2].map(reed));
  addSheet(scene, 'dc_cattail', [0, 1].map(cattail));
  addSheet(scene, 'dc_lotus', [0, 1].map(lotus));
  addSheet(scene, 'dc_ice', [0, 1].map(iceSheet));
  addSheet(scene, 'dc_icecliff', [0, 1, 2].map(iceCliff));
  addSheet(scene, 'dc_snowpine', [0, 1].map(snowPine));
  addSheet(scene, 'dc_icerock', [0, 1].map(iceRock));
  addSheet(scene, 'dc_snowtuft', [0, 1].map(snowTuft));
  addSheet(scene, 'dc_quicksand', [0, 1].map(quicksand));
  addSheet(scene, 'dc_yardang', [0, 1, 2].map(yardang));
  addSheet(scene, 'dc_poplar', [0, 1].map(poplar));
  addSheet(scene, 'dc_sandrock', [0, 1].map(sandRock));
  addSheet(scene, 'dc_camelthorn', [0, 1].map(camelthorn));
  addSheet(scene, 'dc_coral', [0, 1, 2].map(coral));
  addSheet(scene, 'dc_tidepool', [0, 1].map(tidepool));
  addSheet(scene, 'dc_kelp', [0, 1].map(kelp));
  addSheet(scene, 'dc_shell', [0, 1].map(shell));
  addSheet(scene, 'dc_kunlun', [0, 1, 2].map(kunlun));
}
