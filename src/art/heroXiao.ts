import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';

// 剑客·萧寒锋：白衣银甲、束发马尾、背剑。32×32，画 5 个方向，左侧 3 个方向用翻转。

const SK = 0xf5cba4, SKS = 0xd4957a, SKH = 0xffe4c4, BL = 0xf08c84;
const HR = 0x262133, HRH = 0x62587d, HRD = 0x161221;
const RB = 0xede6d8, RBH = 0xfff9eb, RBS = 0xb8b2c8, RBD = 0x8f88a6;
const AR = 0xb8c8d8, ARS = 0x6e7f99, ARH = 0xf2f8ff;
const SA = 0x2b4570, SAH = 0x5682c4, SAD = 0x1b294a;
const PT = 0x433d56, BT = 0x2f2840, BTH = 0x5c5075;
const GD = 0xe3ac3e, GDH = 0xffe680;
const BLD = 0xe6f2fa, BLS = 0x8ea4ba, BLH = 0xffffff;
const GR = 0x70442e;
const EYE = 0x1c1424;

export const HERO_DIRS = ['s', 'se', 'e', 'ne', 'n'] as const;
export type HeroDir = (typeof HERO_DIRS)[number];
export const HERO_FRAMES_PER_DIR = 28;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  legs: 'idle' | 'run';
  f: number; // 腿部帧号 0..7
  bob: number;
  swing: number; // 手臂摆动
  wavePhase: number; // 头发/衣摆二级波动相位
  blink: boolean;
  atk: number; // -1 不出招，0..5 出招帧
}

function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 8) * Math.PI * 2;
  const run = pose.legs === 'run';
  const s = run ? Math.sin(phi) : 0;
  const c = run ? Math.cos(phi) : 0;

  // 踏步落地的扬尘微粒（半透明不触发外描边）
  if (run && (pose.f === 1 || pose.f === 5)) {
    const dx = d === 'e' ? 11 : pose.f === 1 ? 11 : 20;
    p.set(dx, 29, 0xc8bfa8, 175);
    p.set(dx - 1, 28, 0xe0d8c3, 130);
  }

  const leg = (baseX: number, ps: number, pc: number, isBackLeg: boolean) => {
    const strideX = d === 'e' ? Math.round(3.2 * ps) : d === 'se' || d === 'ne' ? Math.round(1.8 * ps) : 0;
    const liftY = Math.max(0, Math.round(2.4 * pc));
    const kneeX = baseX + Math.round(strideX * 0.5) + (d === 'e' && liftY > 0 ? 1 : 0);
    const kneeY = 26 - Math.floor(liftY * 0.4);
    const footX = baseX + strideX;
    const footY = 29 - liftY;
    const pantCol = isBackLeg ? 0x353042 : PT;
    const bootCol = isBackLeg ? 0x282334 : BT;
    p.line(baseX + 1, 24, kneeX + 1, kneeY, pantCol, 2);
    p.line(kneeX + 1, kneeY, footX + 1, footY, bootCol, 2);
    if (!isBackLeg) {
      p.set(footX + (d === 'e' || d === 'se' ? 2 : 1), footY, BTH);
      p.set(kneeX, kneeY, BTH);
    }
  };

  if (d === 'e') {
    leg(14, -s, -c, true);
    leg(15, s, c, false);
  } else {
    leg(12, s, c, d === 'ne' || (d === 'se' && s < 0));
    leg(17, -s, -c, false);
  }
}

function drawTorso(p: PC, d: HeroDir, pose: Pose) {
  const run = pose.legs === 'run';
  const s = run ? Math.sin((pose.f / 8) * Math.PI * 2) : 0;
  const twist = run ? Math.round(s * 1.2) : 0;
  const hemFlare = run ? Math.round(s * 1.3) : pose.atk === 1 || pose.atk === 2 ? -1 : 0;
  const wave1 = Math.sin(pose.wavePhase) * 1.2;

  const k = d === 'e' ? 0.74 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 6, 6, 5, 5, 5, 5, 6, 6, 7, 7];
  for (let i = 0; i < half.length; i++) {
    const y = 15 + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const cx = (d === 'e' ? 15 : 16) + (i >= 7 ? Math.round(hemFlare * 0.5) : 0);
    const x0 = cx - hw - (i >= 8 && run ? 1 : 0);
    const x1 = cx + hw - 1 + (i >= 8 && run ? 1 : 0);
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    p.set(x1, y, RBD);
    if (hw > 3) p.set(x1 - 1, y, RBS);
    if (i === half.length - 1) {
      p.span(y, x0, x1, SA);
      p.set(cx, y, RBD);
    }
  }
  // 腰带与金扣
  const bw = d === 'e' ? 4 : 5;
  const bcx = d === 'e' ? 15 : 16;
  p.span(20, bcx - bw, bcx + bw - 1, SA);
  p.span(21, bcx - bw, bcx + bw - 1, SAD);
  p.span(20, bcx - bw, bcx - bw + 2, SAH);
  if (d === 's' || d === 'se') {
    p.line(13, 15, 17, 19, RBS);
    p.line(14, 15, 17, 18, SA);
    const kx = d === 's' ? 15 : 17;
    p.rect(kx, 20, 2, 2, GD);
    p.set(kx, 20, GDH);
    p.line(kx, 22, kx + Math.round(wave1 * 0.7), 25, SAH);
    p.line(16, 22, 16 + Math.round(hemFlare * 0.4), 25, RBD);
  } else if (d === 'e') {
    p.line(18, 15, 19, 19, RBS);
    p.set(19, 15, SA);
    p.rect(18, 20, 2, 2, GD);
    p.line(18, 22, 18 + Math.round(wave1 * 0.6), 24, SAH);
  } else {
    p.line(16, 22, 16 + Math.round(hemFlare * 0.3), 25, RBS);
  }
  // 肩甲（随步伐微幅扭转起伏）
  const pad = (x: number, w: number, dy = 0) => {
    p.span(14 + dy, x, x + w - 1, ARH);
    p.span(15 + dy, x, x + w - 1, AR);
    p.span(16 + dy, x, x + w - 1, ARS);
    p.set(x + 1, 14 + dy, BLH);
  };
  if (d === 's' || d === 'n') {
    pad(9, 4, twist > 0 ? 1 : 0);
    pad(19, 4, twist < 0 ? 1 : 0);
  } else if (d === 'se' || d === 'ne') {
    pad(9, 4, twist > 0 ? 1 : 0);
    pad(19, 3, twist < 0 ? 1 : 0);
  } else {
    pad(13, 4, 0);
  }
}

function drawArms(p: PC, d: HeroDir, pose: Pose, skipSwordArm: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    p.rect(x, 16 + dy, 2, 4, RB);
    p.set(x + 1, 17 + dy, RBS);
    p.span(20 + dy, x, x + 1, AR);
    p.span(21 + dy, x, x + 1, ARS);
    p.set(x, 22 + dy, SK);
    p.set(x + 1, 22 + dy, SKS);
  };
  if (d === 's' || d === 'n') {
    arm(8, sw);
    if (!skipSwordArm) arm(22, -sw);
  } else if (d === 'se' || d === 'ne') {
    arm(8, sw);
    if (!skipSwordArm) arm(21, -sw);
  } else if (!skipSwordArm) {
    const ax = 14 + Math.round(-1.5 * pose.swing);
    arm(ax, 0);
  }
}

function drawBackSword(p: PC, d: HeroDir, wavePhase: number) {
  const tw = Math.round(Math.sin(wavePhase) * 0.8);
  if (d === 's' || d === 'se') {
    p.set(24, 6, GDH);
    p.line(23, 7, 21, 11, GR, 2);
    p.line(20, 11, 24, 12, GD);
    p.line(24, 6, 26 + tw, 9, 0xd9383a);
    p.line(9, 24, 7, 27, BLS);
    p.set(7, 27, GD);
  } else if (d === 'e') {
    p.set(8, 6, GDH);
    p.line(8, 7, 10, 11, GR, 2);
    p.line(8, 12, 12, 11, GD);
    p.line(8, 6, 6 + tw, 9, 0xd9383a);
  }
}

function drawBackSwordOver(p: PC, d: HeroDir, wavePhase: number) {
  if (d === 'n' || d === 'ne') {
    const tw = Math.round(Math.sin(wavePhase) * 0.8);
    p.line(11, 24, 20, 11, BLD, 2);
    p.line(12, 24, 21, 12, BLS);
    p.line(18, 10, 22, 12, GD);
    p.line(21, 9, 23, 7, GR, 2);
    p.set(24, 6, GDH);
    p.line(24, 6, 26 + tw, 9, 0xd9383a);
  }
}

function drawPonytail(p: PC, d: HeroDir, wavePhase: number, over: boolean) {
  const w1 = Math.sin(wavePhase) * 1.4;
  const w2 = Math.sin(wavePhase - 1.1) * 2.2;
  if (!over && d === 's') {
    p.strand([[18, 3], [21, 4], [23 + w1 * 0.5, 7], [24 + w1, 10], [25 + w2, 13]], HR, 2);
    p.set(22, 5, HRH);
  }
  if (!over && d === 'se') {
    p.strand([[14, 3], [11, 4], [9 + w1 * 0.5, 7], [8 + w1, 10], [7 + w2, 13]], HR, 2);
    p.set(11, 5, HRH);
  }
  if (!over && d === 'e') {
    p.strand([[13, 3], [10, 4], [8 + w1 * 0.5, 7], [6 + w1, 10], [5 + w2, 13]], HR, 2);
    p.set(10, 5, HRH);
  }
  if (over && d === 'n') {
    p.strand([[16, 4], [16, 8], [16 + w1, 12], [16 + w2, 16]], HR, 3);
    p.line(15, 5, 15 + w1 * 0.5, 11, HRH);
  }
  if (over && d === 'ne') {
    p.strand([[14, 4], [12, 7], [11 + w1 * 0.7, 10], [10 + w1, 13], [11 + w2, 16]], HR, 2);
    p.line(13, 5, 11 + w1 * 0.4, 9, HRH);
  }
}

function drawHead(p: PC, d: HeroDir, blink: boolean) {
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, 9, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, 10.6, 5, 4.4, SK);
    p.span(14, 13, 18, SKS);
    p.span(7, 11, 20, HR);
    for (const x of [11, 12, 14, 17, 19, 20]) p.set(x, 8, HR);
    p.line(10, 9, 10, 14, HR);
    p.line(21, 9, 21, 14, HR);
    p.span(9, 12, 14, HRD);
    p.span(9, 17, 19, HRD);
    if (blink) {
      p.span(11, 12, 14, SKS);
      p.span(11, 17, 19, SKS);
    } else {
      p.rect(13, 10, 1, 2, EYE);
      p.set(12, 10, BLH);
      p.rect(18, 10, 1, 2, EYE);
      p.set(19, 10, BLH);
    }
    p.set(12, 12, BL);
    p.set(19, 12, BL);
    p.set(16, 12, SKH);
  } else if (d === 'se') {
    p.ellipse(17.6, 10.6, 4.4, 4.4, SK);
    p.span(14, 15, 20, SKS);
    p.span(7, 13, 21, HR);
    for (const x of [14, 15, 17, 20, 21]) p.set(x, 8, HR);
    p.rect(10, 7, 3, 7, HR);
    p.span(9, 15, 17, HRD);
    p.span(9, 19, 21, HRD);
    if (blink) {
      p.span(11, 15, 17, SKS);
      p.span(11, 19, 20, SKS);
    } else {
      p.rect(16, 10, 1, 2, EYE);
      p.set(15, 10, BLH);
      p.rect(20, 10, 1, 2, EYE);
    }
    p.set(21, 12, BL);
    p.set(18, 11, SKH);
  } else if (d === 'e') {
    p.ellipse(19.2, 10.6, 3.6, 4.4, SK);
    p.span(7, 16, 22, HR);
    p.set(21, 8, HR);
    p.set(22, 8, HR);
    p.span(9, 19, 21, HRD);
    if (blink) p.span(11, 19, 21, SKS);
    else {
      p.rect(20, 10, 1, 2, EYE);
      p.set(19, 10, BLH);
    }
    p.set(23, 11, SKH);
    p.set(17, 10, SKS);
    p.set(17, 11, SKS);
    p.span(14, 17, 21, SKS);
    p.set(21, 12, BL);
  } else if (d === 'ne') {
    p.rect(20, 9, 2, 4, SK);
    p.set(20, 12, SKS);
    p.set(21, 12, SKS);
  }
  // 头发天使环高光
  if (d === 'n') {
    p.span(4, 12, 16, HRH);
    p.span(5, 11, 13, HRH);
  } else {
    p.span(4, 12, 16, HRH);
    p.set(14, 5, HRH);
  }
  // 银冠、蓝宝石与金簪
  p.rect(14, 1, 4, 3, AR);
  p.span(1, 14, 17, ARH);
  p.span(3, 14, 17, ARS);
  p.set(15, 2, SAH);
  p.set(16, 2, 0x8be9fd);
  if (d === 'e' || d === 'se' || d === 'ne') p.line(11, 3, 19, 1, GDH);
  else p.span(2, 12, 19, GDH);
}

function drawHandSword(p: PC, d: HeroDir, k: number, behind: boolean) {
  const angles = [-135, -25, 45, 85, 75, 40];
  const theta = ((FACING[d] + angles[k]) * Math.PI) / 180;
  const cx = 16 + 6 * Math.cos(theta);
  const cy = 17 + 4 * Math.sin(theta);
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const ex = cx + 12 * Math.cos(theta);
  const ey = cy + 10 * Math.sin(theta);

  // 爆发斩击帧（k=1, 2）沿挥剑轨迹绘制同心剑气弧光（外弧亮白、中弧冰青、内弧半透明残影）
  if (k === 1 || k === 2) {
    const prevTheta = ((FACING[d] + angles[k - 1]) * Math.PI) / 180;
    const rings: [number, number, number][] = [
      [12.5, 0x8be9fd, 105],
      [14.5, 0x8be9fd, 175],
      [16.5, BLH, 225],
    ];
    for (const [r, col, alpha] of rings) {
      let px = 0;
      let py = 0;
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const a = prevTheta + (theta - prevTheta) * t;
        const x = 16 + r * Math.cos(a);
        const y = 17 + r * 0.78 * Math.sin(a);
        if (s > 0) p.line(px, py, x, y, col, 1, t < 0.35 ? Math.round(alpha * 0.6) : alpha);
        px = x;
        py = y;
      }
    }
  }

  // 手臂与剑身
  p.line(16 + 3 * Math.cos(theta), 17 + 2 * Math.sin(theta), cx, cy, RB, 2);
  p.line(cx, cy, ex, ey, BLH, 2);
  p.line(cx + Math.cos(theta) * 2, cy + Math.sin(theta) * 2 + 1, ex, ey + 1, BLS);
  const nx = -Math.sin(theta);
  const ny = Math.cos(theta);
  p.line(cx - nx * 2, cy - ny * 2, cx + nx * 2, cy + ny * 2, GDH);
  p.set(cx - Math.cos(theta) * 2, cy - Math.sin(theta) * 2, GR);
  p.set(cx, cy, SK);
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const atkShift = atk ? [-1, 2, 2, 1, 0, 0][pose.atk] : 0;
  const rad = (FACING[d] * Math.PI) / 180;

  drawLegs(p, d, pose);

  p.ox = Math.round(Math.cos(rad) * atkShift);
  p.oy = pose.bob + (atk && (pose.atk === 1 || pose.atk === 2) && Math.sin(rad) > 0.3 ? 1 : 0);

  const back = d === 'n' || d === 'ne';
  if (!back) {
    drawPonytail(p, d, pose.wavePhase, false);
    if (!atk) drawBackSword(p, d, pose.wavePhase);
  }
  if (atk) drawHandSword(p, d, pose.atk, true);
  drawTorso(p, d, pose);
  drawArms(p, d, pose, atk);
  if (back && !atk) drawBackSwordOver(p, d, pose.wavePhase);
  drawHead(p, d, pose.blink);
  if (back) drawPonytail(p, d, pose.wavePhase, true);
  if (atk) drawHandSword(p, d, pose.atk, false);

  p.ox = 0;
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 8.5, 2.7, 0x12222b, 85);
  return p;
}

export function buildHeroXiao(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 8 帧（含呼吸起伏、二级发梢摆动、自然眨眼）
    for (let f = 0; f < 8; f++) {
      const wavePhase = (f / 8) * Math.PI * 2;
      frames.push(
        drawHero(d, {
          legs: 'idle',
          f,
          bob: f >= 3 && f <= 6 ? 1 : 0,
          swing: Math.sin(wavePhase) * 0.4,
          wavePhase,
          blink: f === 7,
          atk: -1,
        }),
      );
    }
    // 跑动 8 帧（屈膝迈步 + 扬尘 + 衣摆波浪）
    for (let f = 0; f < 8; f++) {
      const phi = (f / 8) * Math.PI * 2;
      frames.push(
        drawHero(d, {
          legs: 'run',
          f,
          bob: f % 4 === 1 || f % 4 === 2 ? 1 : 0,
          swing: Math.sin(phi) * 1.6,
          wavePhase: phi,
          blink: false,
          atk: -1,
        }),
      );
    }
    // 出招（站立）6 帧
    for (let k = 0; k < 6; k++) {
      frames.push(
        drawHero(d, {
          legs: 'idle',
          f: 0,
          bob: 0,
          swing: 0,
          wavePhase: (k / 6) * Math.PI * 2,
          blink: false,
          atk: k,
        }),
      );
    }
    // 出招（跑动）6 帧
    for (let k = 0; k < 6; k++) {
      frames.push(
        drawHero(d, {
          legs: 'run',
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
  addSheet(scene, 'hero_xiao', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `xiao_${d}_idle`, 'hero_xiao', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 6);
    addAnim(scene, `xiao_${d}_run`, 'hero_xiao', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `xiao_${d}_atk`, 'hero_xiao', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `xiao_${d}_atkrun`, 'hero_xiao', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}

/** 8 方向：由朝向向量得到 (基础方向, 是否翻转) */
export function dirFromVector(x: number, y: number): { dir: HeroDir; flip: boolean } {
  const a = Math.atan2(y, x);
  const sector = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  switch (sector) {
    case 0: return { dir: 'e', flip: false };
    case 1: return { dir: 'se', flip: false };
    case 2: return { dir: 's', flip: false };
    case 3: return { dir: 'se', flip: true };
    case 4: return { dir: 'e', flip: true };
    case 5: return { dir: 'ne', flip: true };
    case 6: return { dir: 'n', flip: false };
    default: return { dir: 'ne', flip: false };
  }
}
