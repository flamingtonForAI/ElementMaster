import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';

// 剑客·萧寒锋：白衣银甲、束发马尾、背剑。32×32，画 5 个方向，左侧 3 个方向用翻转。

const SK = 0xf3cba5, SKS = 0xd99f7f, BL = 0xec9a8e;
const HR = 0x2a2633, HRH = 0x4a4560;
const RB = 0xf1ede2, RBS = 0xc9c1b1, RBD = 0x9a9183;
const AR = 0xbfc9d2, ARS = 0x828d9a, ARH = 0xeef4f8;
const SA = 0x2f4470, SAH = 0x4d6aa6;
const PT = 0x4a4458, BT = 0x3b3448;
const GD = 0xe0b04a;
const BLD = 0xe8f0f6, BLS = 0x9fb0bf;
const GR = 0x6b4630;
const EYE = 0x1c1424;

export const HERO_DIRS = ['s', 'se', 'e', 'ne', 'n'] as const;
export type HeroDir = (typeof HERO_DIRS)[number];
export const HERO_FRAMES_PER_DIR = 18;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  legs: 'idle' | 'run';
  f: number; // 腿部帧号
  bob: number;
  swing: number; // 手臂摆动 -1..1
  sway: number; // 头发摆动
  atk: number; // -1 不出招，0..3 出招帧
}

function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 6) * Math.PI * 2;
  const run = pose.legs === 'run';
  const s = run ? Math.sin(phi) : 0;
  const c = run ? Math.cos(phi) : 0;
  const leg = (x: number, lift: number, shade: boolean) => {
    const bottom = 29 - lift;
    for (let y = 24; y <= bottom; y++) {
      const col = y >= bottom - 1 ? BT : shade ? 0x3a3546 : PT;
      p.span(y, x, x + 2, col);
    }
  };
  if (d === 's' || d === 'n') {
    leg(12, Math.max(0, Math.round(2 * s)), false);
    leg(17, Math.max(0, Math.round(-2 * s)), false);
  } else if (d === 'e') {
    const front = 15 + Math.round(2.5 * s);
    const back = 15 - Math.round(2.5 * s);
    leg(back, Math.max(0, Math.round(-1.5 * c)), true);
    leg(front, Math.max(0, Math.round(1.5 * c)), false);
  } else {
    leg(12 + Math.round(1.2 * s), Math.max(0, Math.round(2 * s)), d === 'ne');
    leg(17 - Math.round(1.2 * s), Math.max(0, Math.round(-2 * s)), false);
  }
}

function drawTorso(p: PC, d: HeroDir) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 6, 6, 5, 5, 5, 5, 6, 6, 6, 6];
  for (let i = 0; i < half.length; i++) {
    const y = 15 + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const cx = d === 'e' ? 15 : 16;
    const x0 = cx - hw;
    const x1 = cx + hw - 1;
    p.span(y, x0, x1, RB);
    // 右侧阴影
    p.set(x1, y, RBS);
    if (hw > 4) p.set(x1 - 1, y, RBS);
    if (i === half.length - 1) p.span(y, x0, x1, RBS);
  }
  // 腰带
  const bw = d === 'e' ? 4 : d === 's' || d === 'n' ? 5 : 5;
  const bcx = d === 'e' ? 15 : 16;
  p.span(20, bcx - bw, bcx + bw - 1, SA);
  p.span(21, bcx - bw, bcx + bw - 1, SA);
  p.span(20, bcx - bw, bcx - bw + 2, SAH);
  if (d === 's' || d === 'se') {
    // 交领：从左肩斜向右下
    p.line(13, 15, 17, 19, RBS);
    p.set(15, 15, SA);
    p.set(16, 15, SA);
    p.set(16, 16, SA);
    // 腰带结
    const kx = d === 's' ? 15 : 17;
    p.rect(kx, 22, 2, 2, SAH);
    p.set(kx, 24, SA);
    // 下摆中缝
    p.line(16, 22, 16, 25, RBD);
  } else if (d === 'e') {
    p.line(18, 15, 19, 19, RBS);
    p.set(19, 15, SA);
    p.rect(18, 22, 2, 2, SAH);
  } else {
    // 背面：后襟中缝
    p.line(16, 22, 16, 25, RBS);
  }
  // 肩甲
  const pad = (x: number, w: number) => {
    p.span(15, x, x + w - 1, ARH);
    p.span(16, x, x + w - 1, AR);
    p.span(17, x, x + w - 1, ARS);
  };
  if (d === 's' || d === 'n') {
    pad(10, 3);
    pad(19, 3);
  } else if (d === 'se' || d === 'ne') {
    pad(10, 3);
    pad(19, 2);
  } else {
    pad(13, 4);
  }
}

function drawArms(p: PC, d: HeroDir, pose: Pose, skipSwordArm: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    for (let y = 16 + dy; y <= 21 + dy; y++) {
      p.set(x, y, RB);
      p.set(x + 1, y, RBS);
    }
    p.set(x, 22 + dy, SK);
    p.set(x + 1, 22 + dy, SKS);
  };
  if (d === 's' || d === 'n') {
    arm(8, sw);
    if (!skipSwordArm) arm(22, -sw);
  } else if (d === 'se' || d === 'ne') {
    arm(8, sw);
    if (!skipSwordArm) arm(21, -sw);
  } else {
    if (!skipSwordArm) {
      const ax = 15 + Math.round(-1.5 * pose.swing);
      for (let y = 16; y <= 21; y++) {
        p.set(ax, y, RB);
        p.set(ax + 1, y, RB);
        p.set(ax + 2, y, RBS);
      }
      p.set(ax, 22, SK);
      p.set(ax + 1, 22, SK);
      p.set(ax + 2, 22, SKS);
    }
  }
}

function drawBackSword(p: PC, d: HeroDir) {
  if (d === 's' || d === 'se') {
    p.set(24, 7, GD);
    p.line(23, 8, 22, 11, GR, 2);
    p.line(20, 12, 24, 13, GD);
    p.set(9, 25, BLS);
    p.set(8, 26, BLS);
  } else if (d === 'e') {
    p.set(8, 7, GD);
    p.line(8, 8, 10, 11, GR, 2);
    p.line(8, 13, 12, 12, GD);
  }
}

function drawBackSwordOver(p: PC, d: HeroDir) {
  if (d === 'n' || d === 'ne') {
    p.line(12, 24, 20, 12, BLD, 2);
    p.line(13, 24, 21, 13, BLS);
    p.line(18, 11, 22, 13, GD);
    p.line(21, 10, 23, 8, GR, 2);
    p.set(24, 7, GD);
  }
}

function drawPonytail(p: PC, d: HeroDir, sway: number, over: boolean) {
  const sw = sway;
  if (!over && d === 's') p.strand([[18, 3], [21, 4], [23, 6], [24 + sw, 9], [23 + sw, 12]], HR, 2);
  if (!over && d === 'se') p.strand([[14, 3], [11, 4], [9, 7], [8 + sw, 10], [9 + sw, 13]], HR, 2);
  if (!over && d === 'e') p.strand([[13, 3], [10, 4], [8, 7], [7 + sw, 10], [8 + sw, 13]], HR, 2);
  if (over && d === 'n') {
    p.strand([[16, 4], [16, 9], [16 + sw, 13], [17 + sw, 16]], HR, 3);
    p.line(15, 6, 15, 10, HRH);
  }
  if (over && d === 'ne') {
    p.strand([[14, 4], [12, 7], [11 + sw, 10], [11 + sw, 13], [12 + sw, 15]], HR, 2);
  }
}

function drawHead(p: PC, d: HeroDir) {
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, 9, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, 10.6, 5, 4.4, SK);
    p.span(7, 11, 20, HR);
    for (const x of [11, 12, 14, 17, 19, 20]) p.set(x, 8, HR);
    p.span(14, 13, 18, SKS);
    p.rect(13, 10, 1, 2, EYE);
    p.rect(18, 10, 1, 2, EYE);
    p.set(12, 12, BL);
    p.set(19, 12, BL);
    p.set(16, 13, SKS);
  } else if (d === 'se') {
    p.ellipse(17.6, 10.6, 4.4, 4.4, SK);
    p.span(7, 13, 21, HR);
    for (const x of [14, 15, 17, 20, 21]) p.set(x, 8, HR);
    p.rect(10, 7, 3, 6, HR);
    p.span(14, 15, 20, SKS);
    p.rect(16, 10, 1, 2, EYE);
    p.rect(20, 10, 1, 2, EYE);
    p.set(21, 12, BL);
    p.set(15, 11, SKS);
  } else if (d === 'e') {
    p.ellipse(19.2, 10.6, 3.6, 4.4, SK);
    p.span(7, 16, 22, HR);
    p.set(21, 8, HR);
    p.set(22, 8, HR);
    p.rect(20, 10, 1, 2, EYE);
    p.set(23, 11, SK);
    p.set(17, 10, SKS);
    p.set(17, 11, SKS);
    p.span(14, 17, 21, SKS);
    p.set(21, 12, BL);
  } else if (d === 'ne') {
    p.rect(20, 9, 2, 4, SK);
    p.set(20, 12, SKS);
    p.set(21, 12, SKS);
  }
  // 头发高光
  if (d === 'n') {
    p.span(4, 12, 16, HRH);
    p.span(5, 11, 13, HRH);
  } else {
    p.span(4, 12, 15, HRH);
  }
  // 银冠和金簪
  p.rect(14, 1, 4, 3, AR);
  p.span(1, 14, 17, ARH);
  p.span(3, 14, 17, ARS);
  if (d === 'e' || d === 'se' || d === 'ne') p.line(11, 3, 19, 1, GD);
  else p.span(2, 12, 19, GD);
}

function drawHandSword(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = ((FACING[d] + [-120, -40, 30, 70][k]) * Math.PI) / 180;
  const cx = 16 + 6 * Math.cos(theta);
  const cy = 18 + 4 * Math.sin(theta);
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const ex = cx + 11 * Math.cos(theta);
  const ey = cy + 9 * Math.sin(theta);
  // 手臂
  p.line(16 + 3 * Math.cos(theta), 17 + 2 * Math.sin(theta), cx, cy, RB, 2);
  // 剑身
  p.line(cx, cy, ex, ey, BLD, 2);
  p.line(cx + Math.cos(theta) * 2, cy + Math.sin(theta) * 2 + 1, ex, ey + 1, BLS);
  // 护手
  const nx = -Math.sin(theta);
  const ny = Math.cos(theta);
  p.line(cx - nx * 2, cy - ny * 2, cx + nx * 2, cy + ny * 2, GD);
  p.set(cx - Math.cos(theta) * 2, cy - Math.sin(theta) * 2, GR);
  p.set(cx, cy, SK);
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const lean = atk && (pose.atk === 1 || pose.atk === 2) ? 1 : 0;
  const rad = (FACING[d] * Math.PI) / 180;

  // 下半身
  drawLegs(p, d, pose);

  // 上半身整体偏移：呼吸起伏 + 出招前倾
  p.ox = Math.round(Math.cos(rad) * lean);
  p.oy = pose.bob + (Math.sin(rad) > 0.5 ? lean : 0);

  const back = d === 'n' || d === 'ne';
  if (!back) {
    drawPonytail(p, d, pose.sway, false);
    if (!atk) drawBackSword(p, d);
  }
  if (atk) drawHandSword(p, d, pose.atk, true);
  drawTorso(p, d);
  drawArms(p, d, pose, atk);
  if (back && !atk) drawBackSwordOver(p, d);
  drawHead(p, d);
  if (back) drawPonytail(p, d, pose.sway, true);
  if (atk) drawHandSword(p, d, pose.atk, false);

  p.ox = 0;
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 8, 2.6, 0x000000, 70);
  return p;
}

export function buildHeroXiao(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 4
    for (let f = 0; f < 4; f++) frames.push(drawHero(d, { legs: 'idle', f: 0, bob: f >= 2 ? 1 : 0, swing: 0, sway: f >= 2 ? 1 : 0, atk: -1 }));
    // 跑动 6
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { legs: 'run', f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.4, sway: f < 3 ? 1 : 0, atk: -1 }));
    }
    // 出招（站立）4
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { legs: 'idle', f: 0, bob: 0, swing: 0, sway: 1, atk: k }));
    // 出招（跑动）4
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { legs: 'run', f: k + 1, bob: k % 2, swing: 0, sway: 1, atk: k }));
  }
  addSheet(scene, 'hero_xiao', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `xiao_${d}_idle`, 'hero_xiao', [b, b + 1, b + 2, b + 3], 4);
    addAnim(scene, `xiao_${d}_run`, 'hero_xiao', [4, 5, 6, 7, 8, 9].map((i) => b + i), 11);
    addAnim(scene, `xiao_${d}_atk`, 'hero_xiao', [10, 11, 12, 13].map((i) => b + i), 18, 0);
    addAnim(scene, `xiao_${d}_atkrun`, 'hero_xiao', [14, 15, 16, 17].map((i) => b + i), 18, 0);
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
