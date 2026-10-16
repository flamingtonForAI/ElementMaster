import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 海贼·阮沧。剪影和另两人拉开：背上连弩的弩臂横出两肩，右肩上方斜出鱼叉尖；
// 深蓝头巾，脑后两条巾尾随动作飘；青蓝短打敞着领口，挽袖露小臂，裤脚卷到小腿、草鞋。

const SK = 0xdca06e, SKS = 0xab6c4b, SKH = 0xf5c490;
const HR = 0x231b29;
const BD = 0x264899, BDS = 0x192b66, BDH = 0xf0f6ff;
const JK = 0x2e8fa1, JKS = 0x1e5c75, JKD = 0x153b54, JKH = 0x5cc4cf;
const TR = 0x2a3654, TRS = 0x1c223d, TRH = 0x445680;
const RP = 0xc79246, RPH = 0xedc06b, RPS = 0x8a5b2d;
const SD = 0xbf9d56, SDH = 0xe3c678;
const WD = 0x7d4928, WDH = 0xb0743c, STR = 0xf0e6cc;
const MT = 0xa8b6c4, MTH = 0xf0f8ff;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 巾尾与绳结二级波浪相位 */
  wavePhase: number;
  blink: boolean;
  atk: number;
}

/** 卷到小腿的阔腿裤 + 屈膝迈步光小腿 + 草鞋 + 扬尘 */
function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 8) * Math.PI * 2;
  const s = pose.run ? Math.sin(phi) : 0;
  const c = pose.run ? Math.cos(phi) : 0;

  if (pose.run && (pose.f === 1 || pose.f === 5)) {
    const dx = d === 'e' ? 11 : pose.f === 1 ? 11 : 20;
    p.set(dx, 29, 0xc8bfa8, 175);
    p.set(dx - 1, 28, 0xe0d8c3, 130);
  }

  const leg = (baseX: number, ps: number, pc: number, shade: boolean) => {
    const strideX = d === 'e' ? Math.round(3.0 * ps) : d === 'se' || d === 'ne' ? Math.round(1.6 * ps) : 0;
    const liftY = Math.max(0, Math.round(2.2 * pc));
    const kneeX = baseX + Math.round(strideX * 0.5) + (d === 'e' && liftY > 0 ? 1 : 0);
    const kneeY = 26 - Math.floor(liftY * 0.4);
    const footX = baseX + strideX;
    const footY = 29 - liftY;
    // 阔腿裤上半段
    p.line(baseX, 23, kneeX, kneeY, shade ? TRS : TR, 3);
    if (!shade) p.set(kneeX - 1, kneeY - 1, TRH);
    // 裸露小腿与草鞋
    p.line(kneeX, kneeY + 1, footX, Math.max(kneeY + 1, footY - 1), shade ? SKS : SK, 2);
    p.span(footY, footX - 1, footX + 2, SD);
    if (!shade) p.set(footX + 1, footY, SDH);
  };

  if (d === 'e') {
    leg(14, -s, -c, true);
    leg(15, s, c, false);
  } else {
    leg(12, s, c, d === 'ne' || (d === 'se' && s < 0));
    leg(18, -s, -c, false);
  }
}

/** 短打：敞领露胸，草绳腰带随步伐飘动 */
function drawTorso(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [6, 7, 7, 6, 6, 6, 6, 6, 6];
  const cx = d === 'e' ? 15 : 16;
  const wave1 = Math.sin(pose.wavePhase) * 1.2;
  for (let i = 0; i < half.length; i++) {
    const y = 15 + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const x0 = cx - hw;
    const x1 = cx + hw - 1;
    p.span(y, x0, x1, JK);
    p.set(x0, y, JKH);
    p.set(x1, y, JKD);
    if (hw > 4) p.set(x1 - 1, y, JKS);
  }
  // 草绳腰带，结在一侧随风摆动
  const bw = d === 'e' ? 4 : 6;
  p.span(21, cx - bw, cx + bw - 1, RP);
  p.span(22, cx - bw, cx + bw - 1, RPS);
  p.span(21, cx - bw, cx - bw + 2, RPH);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    for (let y = 15; y <= 19; y++) {
      const w = Math.max(0, 2 - Math.floor((y - 15) / 2));
      p.span(y, 16 + o - w, 15 + o + w, SK);
    }
    p.line(14 + o - 1, 15, 16 + o, 20, JKS);
    p.line(17 + o + 1, 15, 16 + o, 20, JKS);
    p.set(15 + o, 16, SKH);
    p.set(16 + o, 17, SKS);
    const kx = d === 's' ? 20 : 19;
    p.rect(kx, 21, 2, 2, RPH);
    p.line(kx + 1, 23, kx + 1 + Math.round(wave1 * 0.7), 25, RP);
  } else if (d === 'e') {
    p.line(19, 15, 18, 19, SK);
    p.set(18, 15, SKH);
  } else {
    p.line(16, 15, 16, 20, JKS);
  }
}

/** 挽起的袖子 + 肌肉高光小臂 */
function drawArms(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    for (let y = 16 + dy; y <= 18 + dy; y++) {
      p.set(x, y, JK);
      p.set(x + 1, y, JKS);
    }
    p.span(19 + dy, x, x + 1, JKH);
    for (let y = 20 + dy; y <= 22 + dy; y++) {
      p.set(x, y, y === 20 + dy ? SKH : SK);
      p.set(x + 1, y, SKS);
    }
  };
  if (d === 's' || d === 'n') {
    arm(8, sw);
    if (!skipFront) arm(22, -sw);
  } else if (d === 'se' || d === 'ne') {
    arm(8, sw);
    if (!skipFront) arm(21, -sw);
  } else if (!skipFront) {
    const ax = 14 + Math.round(-1.5 * pose.swing);
    for (let y = 16; y <= 18; y++) p.span(y, ax, ax + 2, JK);
    p.span(19, ax, ax + 2, JKH);
    for (let y = 20; y <= 22; y++) p.span(y, ax, ax + 2, SK);
    p.set(ax, 20, SKH);
    p.set(ax + 2, 21, SKS);
  }
}

/** 背上的连弩与斜插鱼叉 */
function drawBackGear(p: PC, d: HeroDir, harpoonOnly: boolean) {
  if (d === 's' || d === 'se') {
    p.line(23, 22, 25, 6, WD);
    p.line(24, 22, 26, 6, WDH);
    p.line(25, 5, 26, 1, MTH);
    p.set(24, 3, MTH);
    p.set(27, 3, MT);
    if (harpoonOnly) return;
    const y = d === 's' ? 13 : 12;
    p.line(3, y + 2, 9, y, WD, 2);
    p.line(22, y, 28, y + 2, WD, 2);
    p.set(3, y + 3, STR);
    p.set(28, y + 3, STR);
  } else if (d === 'e') {
    p.line(9, 22, 6, 4, WD);
    p.line(10, 22, 7, 4, WDH);
    p.line(6, 3, 5, 0, MTH);
    p.set(4, 1, MT);
    if (harpoonOnly) return;
    p.line(10, 10, 9, 20, WD, 2);
    p.set(9, 9, STR);
    p.set(8, 21, STR);
  }
}

function drawBackGearOver(p: PC, d: HeroDir, harpoonOnly: boolean) {
  if (d !== 'n' && d !== 'ne') return;
  const o = d === 'ne' ? -1 : 0;
  p.line(8 + o, 22, 6 + o, 4, WD);
  p.line(9 + o, 22, 7 + o, 4, WDH);
  p.line(6 + o, 3, 5 + o, 0, MTH);
  p.set(4 + o, 1, MT);
  if (harpoonOnly) return;
  p.rect(15 + o, 12, 2, 11, WD);
  p.line(15 + o, 12, 15 + o, 22, WDH);
  p.line(4 + o, 15, 10 + o, 12, WD, 2);
  p.line(21 + o, 12, 27 + o, 15, WD, 2);
  p.line(10 + o, 12, 21 + o, 12, MT);
  p.line(4 + o, 16, 15 + o, 19, STR);
  p.line(27 + o, 16, 16 + o, 19, STR);
}

/** 头巾的两条巾尾：带正弦波浪相位差 */
function drawTails(p: PC, d: HeroDir, wavePhase: number, over: boolean) {
  const w1 = Math.sin(wavePhase) * 1.4;
  const w2 = Math.sin(wavePhase - 1.1) * 2.0;
  if (!over && d === 's') {
    p.strand([[19, 5], [22, 6], [25 + w1, 8 + w2 * 0.4]], BD, 2);
    p.strand([[19, 6], [21, 9], [23 + w2, 11]], BDS, 2);
  }
  if (!over && d === 'se') {
    p.strand([[12, 5], [9, 6], [6 + w1, 8 + w2 * 0.4]], BD, 2);
    p.strand([[12, 6], [10, 9], [8 + w2, 11]], BDS, 2);
  }
  if (!over && d === 'e') {
    p.strand([[12, 5], [9, 5], [5 + w1, 7 + w2 * 0.4]], BD, 2);
    p.strand([[12, 6], [10, 8], [7 + w2, 11]], BDS, 2);
  }
  if (over && d === 'n') {
    p.rect(15, 6, 3, 2, BDS);
    p.strand([[16, 7], [14 - w1 * 0.6, 11], [13 - w2, 14]], BD, 2);
    p.strand([[17, 7], [19 + w1 * 0.6, 11], [20 + w2, 13]], BDS, 2);
  }
  if (over && d === 'ne') {
    p.rect(12, 6, 3, 2, BDS);
    p.strand([[13, 7], [10 + w1 * 0.6, 10], [8 + w2, 13]], BD, 2);
  }
}

function drawHead(p: PC, d: HeroDir, blink: boolean) {
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, 9, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, 10.6, 5, 4.4, SK);
    p.span(9, 12, 14, HR);
    p.span(9, 17, 19, HR);
    if (blink) {
      p.span(11, 12, 14, SKS);
      p.span(11, 17, 19, SKS);
    } else {
      p.rect(13, 10, 1, 2, EYE);
      p.set(12, 10, BDH);
      p.rect(18, 10, 1, 2, EYE);
      p.set(19, 10, BDH);
    }
    p.line(19, 11, 20, 13, SKH);
    p.span(14, 15, 17, SKS);
    p.set(16, 13, SKS);
    p.set(10, 10, HR);
    p.set(21, 10, HR);
  } else if (d === 'se') {
    p.ellipse(17.6, 10.6, 4.4, 4.4, SK);
    p.span(9, 15, 17, HR);
    p.span(9, 19, 21, HR);
    if (blink) {
      p.span(11, 15, 17, SKS);
      p.span(11, 19, 21, SKS);
    } else {
      p.rect(16, 10, 1, 2, EYE);
      p.set(15, 10, BDH);
      p.rect(20, 10, 1, 2, EYE);
    }
    p.line(20, 11, 21, 13, SKH);
    p.span(14, 17, 20, SKS);
    p.rect(11, 8, 2, 4, HR);
  } else if (d === 'e') {
    p.ellipse(19.2, 10.6, 3.6, 4.4, SK);
    p.span(9, 19, 22, HR);
    if (blink) p.span(11, 19, 21, SKS);
    else {
      p.rect(20, 10, 1, 2, EYE);
      p.set(19, 10, BDH);
    }
    p.set(23, 11, SKH);
    p.span(14, 18, 21, SKS);
    p.rect(14, 8, 2, 4, HR);
  } else if (d === 'ne') {
    p.rect(20, 9, 2, 4, SK);
    p.set(20, 12, SKS);
  }
  const top = (y0: number, y1: number, x0: number, x1: number) => {
    for (let y = y0; y <= y1; y++) p.span(y, x0, x1, BD);
  };
  if (d === 'e') {
    top(3, 7, 12, 21);
    p.span(8, 13, 22, BDS);
    p.set(15, 5, BDH);
    p.set(18, 4, BDH);
    p.set(20, 6, BDH);
  } else {
    top(3, 7, 11, 21);
    p.span(8, 10, 22, BDS);
    if (d !== 'n') {
      p.set(13, 5, BDH);
      p.set(16, 4, BDH);
      p.set(19, 5, BDH);
      p.set(14, 6, BDH);
      p.set(18, 6, BDH);
    } else {
      p.set(13, 5, BDH);
      p.set(18, 4, BDH);
    }
  }
  p.span(3, 12, 16, 0x3a5cb0);
}

/** 出招 6 帧：端弩瞄准 → 击发闪光与弦残影 → 后坐震动 → 复位 */
function drawCrossbow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const back = [0, 0, 1.5, 2.0, 1.0, 0][k];
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const bx = 16 + c * (2 - back);
  const by = 19 + s * (2 - back);
  const fx = bx + c * 9;
  const fy = by + s * 6;
  p.line(16 - 4 * s, 18, bx + c * 3, by + s * 2, SK, 2);
  p.line(bx, by, fx, fy, WD, 2);
  p.line(bx, by - 1, fx, fy - 1, WDH);
  const nx = -s;
  const ny = c * 0.6;
  p.line(fx - nx * 5, fy - ny * 5, fx + nx * 5, fy + ny * 5, WD, 2);
  const strPull = k === 0 ? 4 : k === 1 || k === 2 ? 1.5 : 3;
  p.line(fx - nx * 5, fy - ny * 5 + 1, bx + c * strPull, by + s * strPull * 0.7 + 1, STR);
  p.line(fx + nx * 5, fy + ny * 5 + 1, bx + c * strPull, by + s * strPull * 0.7 + 1, STR);
  p.set(fx + c, fy + s, MTH);
  if (k === 1 || k === 2) {
    const m = k === 1 ? 3 : 5;
    p.line(fx + c, fy + s, fx + c * (m + 2), fy + s * (m + 1), 0xffffff, 1, k === 1 ? 230 : 150);
    p.set(fx + c * 3 + nx, fy + s * 2 + ny, 0x8be9fd);
    p.set(fx + c * 3 - nx, fy + s * 2 - ny, 0x8be9fd);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const rad = (FACING[d] * Math.PI) / 180;
  const lean = atk && (pose.atk === 2 || pose.atk === 3) ? -1 : 0;
  drawLegs(p, d, pose);
  p.ox = Math.round(Math.cos(rad) * lean);
  p.oy = pose.bob;
  const back = d === 'n' || d === 'ne';
  if (!back) {
    drawTails(p, d, pose.wavePhase, false);
    drawBackGear(p, d, atk);
  }
  if (atk) drawCrossbow(p, d, pose.atk, true);
  drawTorso(p, d, pose);
  drawArms(p, d, pose, atk);
  drawHead(p, d, pose.blink);
  if (back) {
    drawTails(p, d, pose.wavePhase, true);
    drawBackGearOver(p, d, atk);
  }
  if (atk) drawCrossbow(p, d, pose.atk, false);
  p.ox = 0;
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 8.5, 2.7, 0x12222b, 85);
  return p;
}

export function buildHeroRuan(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
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
          swing: Math.sin(phi) * 1.6,
          wavePhase: phi,
          blink: false,
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
          atk: k,
        }),
      );
    }
  }
  addSheet(scene, 'hero_ruan', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `ruan_${d}_idle`, 'hero_ruan', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 6);
    addAnim(scene, `ruan_${d}_run`, 'hero_ruan', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `ruan_${d}_atk`, 'hero_ruan', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `ruan_${d}_atkrun`, 'hero_ruan', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}
