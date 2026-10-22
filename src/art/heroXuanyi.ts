import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';
import { EL_INFO } from '../config/elements';

// 五行散人·玄一：云游老道。白发白须、发髻插木簪，灰白宽袍黑镶边，背后太极图；
// 手持拂尘，身边五颗五行色光点绕身旋转。剪影靠拂尘的斜线、垂到胸口的长须和五色光点和其他人拉开。

// 色阶采用冷暖色相偏移：道袍高光偏暖银白、暗部偏蓝紫灰，白须白发暗部偏冷青灰。
// 道袍比须发暗一档，胸前露黑色中衣，白须压在黑底上才不和袍子连成一片
const SK = 0xf4cfb0, SKS = 0xd49678, BL = 0xe89a8c;
const HR = 0xf5f1ea, HRS = 0xbfc4ce;
const RB = 0x8e91a6, RBS = 0x686a80, RBD = 0x4a4c60, RBH = 0xc2c6d6;
const TRIM = 0x221d2c;
const WD = 0x925e36, WDH = 0xbe864e, GD = 0xe3ac3e;
const HD = 0x7e502e;
const TL = 0xfaf7f0, TLS = 0xc8ccd6;
const BT = 0x2b2435, BTH = 0x4f4460;
const WHITE = 0xffffff;
const EYE = 0x1c1424;

const LIGHTS = (['wood', 'fire', 'earth', 'metal', 'water'] as const).map((e) => EL_INFO[e].color);

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 拂尘尾、长须与袍摆的波浪相位 */
  wavePhase: number;
  /** 五颗光点的相位（度），等分 72° 循环 */
  orbit: number;
  atk: number;
}

const HEAD_Y = 11;
const BODY_Y = 17;

function drawFeet(p: PC, d: HeroDir, pose: Pose) {
  const s = pose.run ? Math.sin((pose.f / 8) * Math.PI * 2) : 0;
  if (pose.run && (pose.f === 1 || pose.f === 5)) {
    const dx = d === 'e' ? 11 : pose.f === 1 ? 11 : 20;
    p.set(dx, 29, 0xc8bfa8, 165);
    p.set(dx - 1, 28, 0xe0d8c3, 120);
  }
  if (d === 'e') {
    const fx = 14 + Math.round(2.4 * s);
    p.span(29, fx, fx + 2, BT);
    p.set(fx + 2, 29, BTH);
  } else {
    const lLift = Math.max(0, Math.round(s * 1.5));
    const rLift = Math.max(0, Math.round(-s * 1.5));
    p.span(29 - lLift, 12, 14, BT);
    p.set(13, 29 - lLift, BTH);
    p.span(29 - rLift, 18, 20, BT);
    p.set(19, 29 - rLift, BTH);
  }
}

/** 宽袍：肩宽、下摆带正弦微澜摆动，黑色镶边；背面一个太极图 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8];
  const cx = d === 'e' ? 15 : 16;
  const wave1 = Math.sin(pose.wavePhase) * 1.2;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 6 ? Math.round(Math.sin(pose.wavePhase - i * 0.3) * (pose.run ? 1.4 : 0.5)) : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    p.set(x1, y, RBD);
    if (hw > 4) p.set(x1 - 1, y, RBS);
    if (i === half.length - 1) p.span(y, x0, x1, TRIM);
  }
  const bw = d === 'e' ? 4 : 5;
  p.span(22, cx - bw, cx + bw - 1, TRIM);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    for (let i = 0; i < 4; i++) p.span(BODY_Y + i, 14 + o + i, 18 + o - i, TRIM);
    p.line(13 + o, BODY_Y, 16 + o, BODY_Y + 3, TRIM);
    p.line(19 + o, BODY_Y, 16 + o, BODY_Y + 3, TRIM);
    p.line(16 + o, 23, 16 + o + Math.round(wave1 * 0.6), 27, RBS);
    p.line(17 + o, 23, 17 + o + Math.round(wave1 * 0.5), 25, TRIM);
  } else if (d === 'e') {
    p.rect(17, BODY_Y, 2, 3, TRIM);
    p.line(17, BODY_Y, 18, BODY_Y + 3, TRIM);
    p.line(18, 23, 18 + Math.round(wave1 * 0.6), 27, RBS);
  } else {
    taiji(p, d === 'n' ? 16 : 15, 24.5, d === 'n' ? 3.6 : 3);
  }
}

/** 太极图：左白右黑，上下各一点反色 */
function taiji(p: PC, cx: number, cy: number, r: number) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const up = dx * dx + (dy + r / 2) ** 2 <= (r / 2) ** 2;
      const dn = dx * dx + (dy - r / 2) ** 2 <= (r / 2) ** 2;
      const white = up ? true : dn ? false : dx < 0;
      p.set(x, y, white ? WHITE : TRIM);
    }
  }
  p.set(cx - 0.5, cy - r / 2 - 0.5, TRIM);
  p.set(cx - 0.5, cy + r / 2 - 0.5, WHITE);
}

/** 大袖：上窄下宽，袖口黑边与波浪微摆 */
function sleeve(p: PC, x: number, dy: number, mirror: boolean, wave1: number) {
  const rows = [2, 3, 4, 4, 5, 5, 5];
  rows.forEach((w, i) => {
    const y = BODY_Y + 1 + i + dy;
    const swx = i >= 4 ? Math.round(wave1 * 0.4) : 0;
    const a = (mirror ? x : x - w + 1) + swx;
    const b = (mirror ? x + w - 1 : x) + swx;
    const cuff = i === rows.length - 1;
    p.span(y, a, b, cuff ? TRIM : RB);
    if (!cuff) {
      p.set(mirror ? a : b, y, RBH);
      p.set(mirror ? b : a, y, RBS);
    }
  });
}

function drawSleeves(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing * 0.7);
  const wave1 = Math.sin(pose.wavePhase) * 1.1;
  if (d === 's' || d === 'n') {
    sleeve(p, 10, sw, false, wave1);
    if (!skipFront) sleeve(p, 21, -sw, true, wave1);
  } else if (d === 'se' || d === 'ne') {
    sleeve(p, 11, sw, false, wave1);
    if (!skipFront) sleeve(p, 20, -sw, true, wave1);
  } else if (!skipFront) {
    const ax = 14 + Math.round(-1.2 * pose.swing);
    sleeve(p, ax, 0, true, wave1);
  }
}

/** 披到肩后的白发 */
function drawHairBack(p: PC, d: HeroDir, wavePhase: number) {
  const w1 = Math.sin(wavePhase) * 0.8;
  if (d === 's') {
    p.rect(10, 12, 2, 6, HRS);
    p.rect(20, 12, 2, 6, HRS);
  } else if (d === 'se') {
    p.rect(10, 12, 3, 6, HRS);
  } else if (d === 'e') {
    p.strand([[12, 9], [11 + w1 * 0.4, 14], [11 + w1, 18]], HRS, 3);
  }
}

function drawHead(p: PC, d: HeroDir, pose: Pose) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 6, 6, HR);
  p.span(Y - 5, 14, 17, WHITE);
  if (d === 's') {
    p.ellipse(16, Y + 1.6, 5, 4.4, SK);
    p.span(Y - 2, 11, 20, HR);
    p.span(Y - 1, 11, 14, HR);
    p.span(Y - 1, 17, 20, HR);
    p.set(15, Y - 1, SKS);
    p.span(Y, 12, 14, WHITE);
    p.span(Y, 17, 19, WHITE);
    p.span(Y + 1, 13, 14, EYE);
    p.span(Y + 1, 17, 18, EYE);
    p.set(12, Y + 2, BL);
    p.set(19, Y + 2, BL);
  } else if (d === 'se') {
    p.ellipse(17.6, Y + 1.6, 4.4, 4.4, SK);
    p.span(Y - 2, 13, 21, HR);
    p.span(Y - 1, 13, 15, HR);
    p.span(Y - 1, 19, 21, HR);
    p.rect(10, Y - 2, 3, 6, HR);
    p.span(Y, 15, 17, WHITE);
    p.span(Y, 19, 21, WHITE);
    p.span(Y + 1, 16, 17, EYE);
    p.set(20, Y + 1, EYE);
    p.set(21, Y + 1, EYE);
    p.set(21, Y + 2, BL);
  } else if (d === 'e') {
    p.ellipse(19.2, Y + 1.6, 3.6, 4.4, SK);
    p.span(Y - 2, 16, 22, HR);
    p.span(Y - 1, 18, 22, HR);
    p.span(Y, 19, 22, WHITE);
    p.span(Y + 1, 20, 21, EYE);
    p.set(23, Y + 2, SKS);
    p.set(21, Y + 2, BL);
  } else if (d === 'ne') {
    p.span(BODY_Y, 11, 20, TRIM);
    p.rect(20, Y, 2, 3, SK);
    p.set(21, Y, HR);
    for (const x of [12, 15, 17]) p.line(x, Y - 3, x, Y + 5, HRS);
    p.span(Y + 5, 11, 18, HRS);
  } else {
    p.span(BODY_Y, 10, 21, TRIM);
    p.rect(11, Y + 2, 10, 5, HR);
    p.span(Y + 7, 12, 19, HRS);
    for (const x of [13, 16, 18]) p.line(x, Y - 3, x, Y + 6, HRS);
    p.set(12, Y + 7, TRIM);
    p.set(15, Y + 7, TRIM);
    p.set(19, Y + 7, TRIM);
  }
  drawBeard(p, d, pose.wavePhase);
  drawTopknot(p, d);
}

/** 长须垂到胸口，须尖随风微摆 */
function drawBeard(p: PC, d: HeroDir, wavePhase: number) {
  const Y = HEAD_Y;
  const bsw = Math.sin(wavePhase - 0.6) * 0.8;
  if (d === 's' || d === 'se') {
    const cx = d === 's' ? 16 : 18;
    p.span(Y + 3, cx - 3, cx + 2, WHITE);
    const w = [3, 3, 3, 2, 2, 2, 1, 1, 0.5];
    w.forEach((hw, i) => {
      const y = Y + 4 + i;
      const sh = i >= 5 ? Math.round(bsw) : 0;
      p.span(y, Math.round(cx - hw) + sh, Math.round(cx + hw) - 1 + sh, i === w.length - 1 ? HRS : HR);
      if (hw >= 2) p.set(Math.round(cx + hw) - 1 + sh, y, HRS);
    });
  } else if (d === 'e') {
    p.span(Y + 3, 19, 22, WHITE);
    p.strand([[21, Y + 4], [21, Y + 8], [20 + bsw, Y + 11]], HR, 2);
    p.set(20 + Math.round(bsw), Y + 12, HRS);
  } else if (d === 'ne') {
    p.rect(21, Y + 3, 1, 4, HR);
  }
}

function drawTopknot(p: PC, d: HeroDir) {
  const cx = d === 'e' ? 15 : d === 'se' || d === 'ne' ? 15.5 : 16;
  p.circle(cx, 4, 2.6, HR);
  p.set(cx - 1, 3, WHITE);
  p.set(cx + 1, 5, HRS);
  if (d === 'e' || d === 'se' || d === 'ne') {
    p.line(cx - 5, 5, cx + 3, 3, WD);
    p.set(cx - 5, 5, WDH);
  } else {
    p.span(4, cx - 5, cx + 4, WD);
    p.set(cx - 5, 4, WDH);
    p.set(cx + 4, 4, WDH);
  }
}

/** 拂尘：柄头垂下一束多段波浪摆动的白色长尾 */
function whisk(p: PC, hx: number, hy: number, dir: number, wavePhase: number) {
  const tx = hx + 4 * dir;
  const ty = hy - 5;
  p.line(hx, hy, tx, ty, HD, 2);
  p.line(hx, hy, tx, ty, WD);
  p.set(tx, ty, GD);
  const s1 = Math.sin(wavePhase) * 1.1;
  const s2 = Math.sin(wavePhase - 1.0) * 1.8;
  const tail: [number, number][] = [[tx + dir, ty], [tx + 2 * dir + s1 * 0.4, ty + 3], [tx + 3 * dir + s1, ty + 6], [tx + 3 * dir + s2, ty + 9]];
  p.strand(tail.map(([x, y]) => [x + dir, y] as [number, number]), TLS, 2);
  p.strand(tail, TL, 2);
  p.set(tx + 3 * dir + Math.round(s2), ty + 10, TLS);
  p.set(tx + 2 * dir, ty + 4, WHITE);
}

function drawWhiskIdle(p: PC, d: HeroDir, pose: Pose, behind: boolean) {
  const sw = Math.round(pose.swing * 0.7);
  if (d === 'n' || d === 'ne') {
    if (behind) whisk(p, d === 'n' ? 10 : 11, BODY_Y + 7 + sw, -1, pose.wavePhase);
  } else if (!behind) {
    if (d === 'e') whisk(p, 18 + Math.round(-1.2 * pose.swing), BODY_Y + 8, 1, pose.wavePhase);
    else whisk(p, d === 's' ? 23 : 22, BODY_Y + 7 - sw, 1, pose.wavePhase);
  }
}

/** 出招 6 帧：拂尘挥洒，带弧光残影与仙气星芒 */
function drawSwing(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [2, 5, 8, 8, 6, 4][k];
  const lift = [-6, -4, -1, 0, 0, 0][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, RB, 3);
  p.line(sx, sy + 2, hx, hy + 1, TRIM);
  p.set(hx, hy, SK);

  const angs = [-120, -50, 0, 30, 20, 10];
  const lags = [20, 75, 45, 20, 12, 8];
  const ang = theta + (angs[k] * Math.PI) / 180;
  const lag = (lags[k] * Math.PI) / 180;
  const tx = hx + 4 * Math.cos(ang);
  const ty = hy + 4 * Math.sin(ang);
  p.line(hx, hy, tx, ty, HD);
  const pts: [number, number][] = [[tx, ty]];
  for (let i = 1; i <= 3; i++) {
    const a = ang - (lag * i) / 3;
    const [px, py] = pts[i - 1];
    pts.push([px + 3.2 * Math.cos(a), py + 3.2 * Math.sin(a)]);
  }
  if (k === 1 || k === 2) {
    // 挥洒残影
    p.strand(pts.map(([x, y]) => [x - Math.sin(ang) * 2, y + Math.cos(ang) * 2] as [number, number]), WHITE, 2);
  }
  p.strand(pts, TL, 2);
  const [ex, ey] = pts[pts.length - 1];
  p.set(ex, ey, TLS);
  if (k === 2 || k === 3) {
    p.set(ex + 2 * Math.cos(ang), ey + 2 * Math.sin(ang), WHITE);
    p.set(ex + Math.cos(ang) - 1, ey - 2, WHITE);
    p.set(ex + Math.cos(ang) + 1, ey + 2, WHITE);
  }
}

/** 五颗五行光点绕身：附带微光拖尾 */
function orbit(p: PC, phase: number, front: boolean) {
  for (let i = 0; i < 5; i++) {
    const a = ((phase + i * 72) * Math.PI) / 180;
    if (Math.sin(a) > 0 !== front) continue;
    const x = Math.round(16 + 11 * Math.cos(a) - 1);
    const y = Math.round(19 + 3 * Math.sin(a) - Math.cos(a * 2));
    const pa = a - 0.22;
    p.set(Math.round(16 + 11 * Math.cos(pa)), Math.round(19 + 3 * Math.sin(pa) - Math.cos(pa * 2)), LIGHTS[i], 145);
    p.rect(x, y, 2, 2, LIGHTS[i]);
    p.set(x, y, WHITE);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  drawFeet(p, d, pose);
  p.oy = pose.bob;
  orbit(p, pose.orbit, false);
  drawHairBack(p, d, pose.wavePhase);
  if (atk) drawSwing(p, d, pose.atk, true);
  else drawWhiskIdle(p, d, pose, true);
  drawRobe(p, d, pose);
  drawSleeves(p, d, pose, atk);
  drawHead(p, d, pose);
  if (atk) drawSwing(p, d, pose.atk, false);
  else drawWhiskIdle(p, d, pose, false);
  orbit(p, pose.orbit, true);
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 9, 2.7, 0x12222b, 85);
  return p;
}

export function buildHeroXuanyi(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 8 帧、跑动 8 帧各转 72°，五颗光点等分，正好接上下一圈
    for (let f = 0; f < 8; f++) {
      const wavePhase = (f / 8) * Math.PI * 2;
      frames.push(
        drawHero(d, {
          run: false,
          f,
          bob: f >= 3 && f <= 6 ? 1 : 0,
          swing: Math.sin(wavePhase) * 0.4,
          wavePhase,
          orbit: f * 9,
          atk: -1,
        }),
      );
    }
    for (let f = 0; f < 8; f++) {
      const phi = (f / 8) * Math.PI * 2;
      frames.push(
        drawHero(d, {
          run: true,
          f,
          bob: f % 4 === 1 || f % 4 === 2 ? 1 : 0,
          swing: Math.sin(phi) * 1.4,
          wavePhase: phi,
          orbit: f * 9,
          atk: -1,
        }),
      );
    }
    for (let k = 0; k < 6; k++) {
      frames.push(
        drawHero(d, {
          run: false,
          f: 0,
          bob: 0,
          swing: 0,
          wavePhase: (k / 6) * Math.PI * 2,
          orbit: k * 12,
          atk: k,
        }),
      );
    }
    for (let k = 0; k < 6; k++) {
      frames.push(
        drawHero(d, {
          run: true,
          f: (k + 1) % 8,
          bob: k % 2,
          swing: 0,
          wavePhase: (k / 6) * Math.PI * 2,
          orbit: k * 12,
          atk: k,
        }),
      );
    }
  }
  addSheet(scene, 'hero_xuanyi', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `xuanyi_${d}_idle`, 'hero_xuanyi', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 8);
    addAnim(scene, `xuanyi_${d}_run`, 'hero_xuanyi', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `xuanyi_${d}_atk`, 'hero_xuanyi', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `xuanyi_${d}_atkrun`, 'hero_xuanyi', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}
