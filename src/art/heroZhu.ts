import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 符师·朱砂。剪影和剑客拉开：剑客是宽肩直身 + 斜背长剑；符师是高道冠 + 长簪流苏、
// 窄肩 A 字道袍拖到脚面、两侧下垂的大袖，身边三张黄符绕身旋转。头比剑客低 2 像素，留出高冠。

const SK = 0xf5cba4, SKS = 0xd4957a, SKH = 0xffdfba, BL = 0xf08c84;
const HR = 0x20192b, HRH = 0x564873;
const RB = 0xd1382e, RBS = 0x99202c, RBD = 0x661426, RBH = 0xf76d47;
const TRIM = 0x29121e;
const IN = 0xede6d8, INH = 0xfff9eb, INS = 0xb8b2c8;
const GD = 0xe3ac3e, GDH = 0xffe680, GDS = 0xa37024;
const CR = 0x20192b, CRH = 0x564873;
const BT = 0x2b2238, BTH = 0x54456b;
const PAPER = 0xf7d969, PAPS = 0xc99c38, INK = 0xd1382e;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  wavePhase: number;
  blink: boolean;
  /** 绕身黄符的相位（度），三张符等分 120° 循环 */
  orbit: number;
  atk: number;
}

const HEAD_Y = 11;
const BODY_Y = 17;

/** 衣摆下露出交替迈步的布靴与扬尘微粒 */
function drawFeet(p: PC, d: HeroDir, pose: Pose) {
  const s = pose.run ? Math.sin((pose.f / 8) * Math.PI * 2) : 0;
  if (pose.run && (pose.f === 1 || pose.f === 5)) {
    const dx = d === 'e' ? 11 : pose.f === 1 ? 11 : 20;
    p.set(dx, 29, 0xc8bfa8, 165);
    p.set(dx - 1, 28, 0xe0d8c3, 120);
  }
  if (d === 'e') {
    const fx = 13 + Math.round(2.5 * s);
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

/** A 字道袍：窄肩，下摆一路外扩到脚面并带正弦波浪摆动，黑边金线 + 玉佩流苏 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.86;
  const half = [4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 9, 9];
  const cx = d === 'e' ? 15 : 16;
  const wave1 = Math.sin(pose.wavePhase) * 1.3;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 6 ? Math.round(Math.sin(pose.wavePhase - i * 0.3) * (pose.run ? 1.5 : 0.6)) : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    if (hw > 4) p.set(x0 + 1, y, RBH);
    p.set(x1, y, RBD);
    if (hw > 4) p.set(x1 - 1, y, RBS);
    if (i >= 6 && i < half.length - 2) {
      p.set(cx - 3 + sh, y, RBH);
      p.span(y, cx + 2 + sh, cx + 3 + sh, RBS);
      if (i >= 8) p.set(cx + 4 + sh, y, RBD);
    }
    if (i === half.length - 2) {
      p.span(y, x0, x1, GD);
      p.span(y, x0 + 1, cx - 2 + sh, GDH);
      p.span(y, cx + 2 + sh, cx + 3 + sh, GDS);
      p.span(y, x1 - 1, x1, GDS);
    }
    if (i === half.length - 1) p.span(y, x0, x1, TRIM);
  }
  // 腰封与玉佩
  const bw = d === 'e' ? 3 : 4;
  p.span(21, cx - bw, cx + bw - 1, TRIM);
  p.span(22, cx - bw, cx + bw - 1, GD);
  p.span(22, cx - bw, cx - 2, GDH);
  p.set(cx + bw - 1, 22, GDS);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, INH);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.line(17 + o, BODY_Y + 2, 18 + o, BODY_Y + 3, RBD);
    p.set(16 + o, BODY_Y, SK);
    p.rect(15 + o, 21, 2, 2, GDH);
    p.set(16 + o, 23, 0x50fa7b);
    p.line(16 + o, 24, 16 + o + Math.round(wave1 * 0.6), 27, TRIM);
  } else if (d === 'e') {
    p.line(16, BODY_Y, 17, BODY_Y + 2, INH);
    p.set(17, 23, 0x50fa7b);
  } else {
    // 背面：金色八卦圆
    p.circle(16, 24.5, 2.5, GDH);
    p.rect(16, 23.5, 2, 2, RBD);
    p.set(15, 24.5, RBD);
  }
}

/** 一只下垂的大袖：上窄下宽，金线滚边，袖口露白色里衬与随风波浪 */
function sleeve(p: PC, x: number, dy: number, mirror: boolean, wave1: number) {
  const rows = [2, 3, 4, 5, 6, 6, 5];
  rows.forEach((w, i) => {
    const y = BODY_Y + 1 + i + dy;
    const swx = i >= 4 ? Math.round(wave1 * 0.5) : 0;
    const a = (mirror ? x : x - w + 1) + swx;
    const b = (mirror ? x + w - 1 : x) + swx;
    const cuff = i === rows.length - 1;
    p.span(y, a, b, cuff ? INH : i === 5 ? GD : RB);
    p.set(b, y, cuff ? INS : i === 5 ? GDS : RBD);
    if (i > 0 && i < 5) {
      p.set(a, y, RBH);
      if (w >= 5) p.set(b - 1, y, RBS);
      if (i === 4) p.set(a + 1, y, RBS);
    }
    if (i === 5) p.set(a, y, GDH);
  });
  const hy = BODY_Y + 1 + rows.length + dy;
  p.set((mirror ? x + 1 : x - 1) + Math.round(wave1 * 0.5), hy, SK);
}

function drawSleeves(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing * 0.8);
  const wave1 = Math.sin(pose.wavePhase) * 1.2;
  if (d === 's' || d === 'n') {
    sleeve(p, 11, sw, false, wave1);
    if (!skipFront) sleeve(p, 20, -sw, true, wave1);
  } else if (d === 'se' || d === 'ne') {
    sleeve(p, 12, sw, false, wave1);
    if (!skipFront) sleeve(p, 19, -sw, true, wave1);
  } else if (!skipFront) {
    const ax = 14 + Math.round(-1.2 * pose.swing);
    sleeve(p, ax, 0, true, wave1);
  }
}

/** 披到腰的长发，压在身后随步伐摆动 */
function drawHairBack(p: PC, d: HeroDir, wavePhase: number) {
  const w1 = Math.sin(wavePhase) * 1.2;
  if (d === 's' || d === 'se') {
    const o = d === 'se' ? -1 : 0;
    p.rect(9 + o, 12, 3, 10, HR);
    if (d === 's') p.rect(20, 12, 3, 10, HR);
  } else if (d === 'e') {
    p.strand([[12, 8], [10, 13], [9 + w1 * 0.6, 18], [9 + w1, 23]], HR, 4);
  }
}

/** 正面两缕鬓发垂过肩；背面一整片长发随风摆动 */
function drawHairFront(p: PC, d: HeroDir, wavePhase: number) {
  const w1 = Math.sin(wavePhase) * 1.2;
  if (d === 's') {
    p.rect(10, 11, 2, 9, HR);
    p.rect(20, 11, 2, 9, HR);
    p.set(10, 20, HRH);
    p.set(21, 20, HRH);
  } else if (d === 'se') {
    p.rect(12, 11, 2, 8, HR);
    p.rect(22, 11, 1, 6, HR);
    p.set(12, 19, HRH);
  } else if (d === 'e') {
    // 侧鬓落在耳前，留出眼睛到鼻尖之间的完整颊面。
    p.rect(16, 11, 1, 5, HR);
  } else if (d === 'n') {
    for (let y = 11; y <= 25; y++) {
      const hw = y < 20 ? 5 : 5 - Math.floor((y - 19) / 2);
      const sh = y >= 18 ? Math.round(w1 * 0.5) : 0;
      p.span(y, 16 - hw + sh, 15 + hw + sh, HR);
    }
    p.line(14, 8, 14, 22, HRH);
    p.rect(15, 15, 2, 2, GDH);
  } else {
    for (let y = 11; y <= 24; y++) {
      const hw = y < 19 ? 4 : 4 - Math.floor((y - 18) / 2);
      const sh = y >= 18 ? Math.round(w1 * 0.5) : 0;
      p.span(y, 14 - hw + sh, 13 + hw + sh, HR);
    }
    p.line(12, 8, 12, 20, HRH);
  }
}

function drawHead(p: PC, d: HeroDir, pose: Pose) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.6, 5, 4.4, SK);
    p.span(Y - 2, 11, 20, HR);
    p.span(Y - 1, 12, 19, HR);
    if (pose.blink) {
      p.span(Y + 2, 12, 14, SKS);
      p.span(Y + 2, 17, 19, SKS);
    } else {
      p.rect(13, Y + 1, 1, 2, EYE);
      p.set(12, Y + 1, INH);
      p.rect(18, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, INH);
    }
    p.set(16, Y, INK);
    p.set(12, Y + 3, BL);
    p.set(19, Y + 3, BL);
    p.set(16, Y + 4, BL);
  } else if (d === 'se') {
    p.ellipse(17.6, Y + 1.6, 4.4, 4.4, SK);
    p.span(Y - 2, 13, 21, HR);
    p.span(Y - 1, 14, 21, HR);
    p.rect(10, Y - 2, 3, 6, HR);
    if (pose.blink) {
      p.span(Y + 2, 15, 17, SKS);
      p.span(Y + 2, 19, 21, SKS);
    } else {
      p.rect(16, Y + 1, 1, 2, EYE);
      p.set(15, Y + 1, INH);
      p.rect(20, Y + 1, 1, 2, EYE);
      p.set(21, Y + 1, EYE);
    }
    p.set(18, Y, INK);
    p.set(21, Y + 3, BL);
    p.set(18, Y + 4, BL);
  } else if (d === 'e') {
    p.ellipse(19.2, Y + 1.6, 3.6, 4.4, SK);
    p.span(Y - 2, 16, 22, HR);
    p.span(Y - 1, 18, 22, HR);
    if (pose.blink) p.span(Y + 2, 19, 21, SKS);
    else {
      p.rect(20, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, INH);
    }
    p.set(22, Y + 1, SKH);
    p.set(22, Y + 2, SKH);
    p.set(21, Y + 3, SKS);
  } else if (d === 'ne') {
    p.rect(20, Y, 2, 4, SK);
    p.set(20, Y + 3, SKS);
  }
  p.span(Y - 5, 13, 16, HRH);
  drawCrown(p, d, pose.wavePhase);
}

/** 高道冠：黑冠金箍，顶上一颗朱红珠；长簪横穿，两端红流苏随风摇曳 */
function drawCrown(p: PC, d: HeroDir, wavePhase: number) {
  const side = d === 'e' || d === 'se' || d === 'ne';
  const cx = d === 'e' ? 15 : 14;
  const tsw = Math.round(Math.sin(wavePhase) * 0.7);
  p.rect(cx, 1, 4, 4, CR);
  p.span(0, cx + 1, cx + 2, INK);
  p.set(cx, 1, CRH);
  p.span(4, cx - 1, cx + 4, GDH);
  p.span(5, cx - 1, cx + 4, CR);
  p.set(cx + 4, 4, GDS);
  if (side) {
    p.line(cx - 4, 4, cx + 7, 2, GDH);
    p.line(cx - 4, 5, cx - 4 + tsw, 7, INK);
  } else {
    p.span(3, cx - 4, cx + 7, GDH);
    p.line(cx - 4, 4, cx - 4 + tsw, 6, INK);
    p.line(cx + 7, 4, cx + 7 + tsw, 6, INK);
  }
}

function talisman(p: PC, x: number, y: number, glow = false) {
  x = Math.round(x);
  y = Math.round(y);
  if (glow) p.rect(x - 1, y - 1, 5, 8, 0xffe880, 95);
  p.rect(x, y, 3, 6, PAPER);
  p.span(y + 5, x, x + 2, PAPS);
  p.span(y, x, x + 2, INK);
  p.set(x + 1, y + 2, INK);
  p.set(x + 1, y + 3, INK);
  p.set(x + 1, y + 4, INK);
}

/** 三张符绕身旋转：附带灵火星点拖尾 */
function orbit(p: PC, phase: number, front: boolean, glow: boolean) {
  for (let i = 0; i < 3; i++) {
    const a = ((phase + i * 120) * Math.PI) / 180;
    const inFront = Math.sin(a) > 0;
    if (inFront !== front) continue;
    const x = 16 + 13 * Math.cos(a) - 1;
    const y = 15 + 3.2 * Math.sin(a) - Math.cos(a * 2);
    const pa = a - 0.25;
    p.set(16 + 13 * Math.cos(pa), 15 + 3.2 * Math.sin(pa) + 2, GDH, 150);
    talisman(p, x, y, glow);
  }
}

/** 出招 6 帧：大袖扬起抛符，带灵光爆发与弧线残影 */
function drawThrow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [2, 6, 9, 10, 7, 4][k];
  const lift = [-7, -5, -3, -2, -1, 0][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, RB, 3);
  p.line(sx, sy + 2, hx, hy + 2, RB, 3);
  p.line(sx, sy + 3, hx, hy + 3, INH);
  p.set(hx, hy, SK);
  if (k <= 1) talisman(p, hx - 1, hy - 6, k === 1);
  else if (k === 2 || k === 3) {
    const step = k === 2 ? 3 : 5;
    const tx = hx + step * Math.cos(theta);
    const ty = hy - 4 + 2 * Math.sin(theta);
    talisman(p, tx - 1, ty - 2, true);
    p.set(tx - 2, ty - 3, GDH);
    p.set(tx + 2, ty - 3, GDH);
    p.set(tx, ty - 4, 0xfff0a0);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const glow = atk && pose.atk >= 1 && pose.atk <= 3;
  drawFeet(p, d, pose);
  p.oy = pose.bob;
  orbit(p, pose.orbit, false, glow);
  drawHairBack(p, d, pose.wavePhase);
  if (atk) drawThrow(p, d, pose.atk, true);
  drawRobe(p, d, pose);
  drawSleeves(p, d, pose, atk);
  drawHead(p, d, pose);
  drawHairFront(p, d, pose.wavePhase);
  if (atk) drawThrow(p, d, pose.atk, false);
  orbit(p, pose.orbit, true, glow);
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 9, 2.7, 0x12222b, 85);
  return p;
}

export function buildHeroZhu(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 8 帧、跑动 8 帧各转 120°，三张符等分，正好接上下一圈
    for (let f = 0; f < 8; f++) {
      const wavePhase = (f / 8) * Math.PI * 2;
      frames.push(
        drawHero(d, {
          run: false,
          f,
          bob: f >= 3 && f <= 6 ? 1 : 0,
          swing: Math.sin(wavePhase) * 0.4,
          wavePhase,
          blink: f === 7,
          orbit: f * 15,
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
          swing: Math.sin(phi) * 1.5,
          wavePhase: phi,
          blink: false,
          orbit: f * 15,
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
          blink: false,
          orbit: k * 20,
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
          blink: false,
          orbit: k * 20,
          atk: k,
        }),
      );
    }
  }
  addSheet(scene, 'hero_zhu', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `zhu_${d}_idle`, 'hero_zhu', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 8);
    addAnim(scene, `zhu_${d}_run`, 'hero_zhu', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `zhu_${d}_atk`, 'hero_zhu', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `zhu_${d}_atkrun`, 'hero_zhu', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}
