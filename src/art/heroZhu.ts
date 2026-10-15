import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { HERO_DIRS, type HeroDir } from './heroXiao';

// 符师·朱砂。剪影和剑客拉开：剑客是宽肩直身 + 斜背长剑；符师是高道冠 + 长簪流苏、
// 窄肩 A 字道袍拖到脚面、两侧下垂的大袖，身边三张黄符绕身旋转。头比剑客低 2 像素，留出高冠。
// 动画名与剑客相同；待机多 4 帧，让绕身的符转得顺。

const SK = 0xf3cba5, SKS = 0xd99f7f, BL = 0xec9a8e;
const HR = 0x1f1a28, HRH = 0x3e3650;
const RB = 0xc8372d, RBS = 0x962520, RBD = 0x6e1a18, RBH = 0xe25a44;
const TRIM = 0x2a1418;
const IN = 0xf1ede2, INS = 0xc9c1b1;
const GD = 0xe0b04a, GDS = 0xa87a2a;
const CR = 0x1f1a28, CRH = 0x4a4058;
const BT = 0x2b2433;
const PAPER = 0xf2d36b, PAPS = 0xc9a640, INK = 0xc8372d;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 绕身黄符的相位（度），三张符等分 120° 循环 */
  orbit: number;
  atk: number;
}

const FRAMES_PER_DIR = 22;
const HEAD_Y = 11;
const BODY_Y = 17;

/** 衣摆下只露一点鞋尖 */
function drawFeet(p: PC, d: HeroDir, pose: Pose) {
  const s = pose.run ? Math.sin((pose.f / 6) * Math.PI * 2) : 0;
  if (d === 'e') {
    p.span(29, 13 + Math.round(2 * s), 15 + Math.round(2 * s), BT);
  } else {
    if (s >= 0) p.span(29, 13, 14, BT);
    if (s <= 0) p.span(29, 18, 19, BT);
  }
}

/** A 字道袍：窄肩，下摆一路外扩到脚面，黑边金线 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.7 : d === 's' || d === 'n' ? 1 : 0.86;
  const half = [4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 9];
  const cx = d === 'e' ? 15 : 16;
  const hem = pose.run ? Math.round(pose.swing * 0.7) : 0;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 7 ? hem : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    p.set(x1, y, RBS);
    if (hw > 4) p.set(x1 - 1, y, RBS);
    if (i === half.length - 2) {
      p.span(y, x0, x1, GD);
      p.set(x1, y, GDS);
    }
    if (i === half.length - 1) p.span(y, x0, x1, TRIM);
  }
  // 腰封
  const bw = d === 'e' ? 3 : 4;
  p.span(21, cx - bw, cx + bw - 1, TRIM);
  p.span(22, cx - bw, cx + bw - 1, GD);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    // 白交领 + 黑色对襟镶边，一路通到下摆
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.set(16 + o, BODY_Y, SK);
    p.line(16 + o, 23, 16 + o + hem, 26, TRIM);
  } else if (d === 'e') {
    p.line(16, BODY_Y, 17, BODY_Y + 2, IN);
  } else {
    // 背面：金色八卦圆
    p.circle(16, 25, 2.2, GD);
    p.rect(16, 24, 2, 2, RBD);
    p.set(15, 25, RBD);
  }
}

/** 一只下垂的大袖：上窄下宽，袖口露白色里衬，袖里只露一点手 */
function sleeve(p: PC, x: number, dy: number, mirror: boolean) {
  // x 是贴身那一侧的列，袖子朝外展开
  const rows = [2, 3, 4, 5, 5, 5, 5];
  rows.forEach((w, i) => {
    const y = BODY_Y + 1 + i + dy;
    const a = mirror ? x : x - w + 1;
    const b = mirror ? x + w - 1 : x;
    const cuff = i === rows.length - 1;
    p.span(y, a, b, cuff ? IN : RB);
    p.set(mirror ? b : a, y, cuff ? INS : RBS);
  });
  const hy = BODY_Y + 1 + rows.length + dy;
  p.set(mirror ? x + 1 : x - 1, hy, SK);
}

function drawSleeves(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing * 0.7);
  if (d === 's' || d === 'n') {
    sleeve(p, 11, sw, false);
    if (!skipFront) sleeve(p, 20, -sw, true);
  } else if (d === 'se' || d === 'ne') {
    sleeve(p, 12, sw, false);
    if (!skipFront) sleeve(p, 19, -sw, true);
  } else if (!skipFront) {
    // 侧面：一只大袖垂在身前
    const ax = 14 + Math.round(-1.2 * pose.swing);
    for (let i = 0; i < 7; i++) {
      const y = BODY_Y + 1 + i;
      const w = Math.min(5, 2 + i);
      p.span(y, ax, ax + w - 1, i === 6 ? IN : RB);
      p.set(ax + w - 1, y, i === 6 ? INS : RBS);
    }
    p.set(ax + 2, BODY_Y + 8, SK);
  }
}

/** 披到腰的长发，压在身后 */
function drawHairBack(p: PC, d: HeroDir) {
  if (d === 's' || d === 'se') {
    const o = d === 'se' ? -1 : 0;
    p.rect(9 + o, 12, 3, 9, HR);
    if (d === 's') p.rect(20, 12, 3, 9, HR);
  } else if (d === 'e') {
    p.strand([[12, 8], [10, 13], [10, 19], [11, 22]], HR, 4);
  }
}

/** 正面两缕鬓发垂过肩；背面一整片长发 */
function drawHairFront(p: PC, d: HeroDir) {
  if (d === 's') {
    p.rect(10, 11, 2, 9, HR);
    p.rect(20, 11, 2, 9, HR);
    p.set(10, 20, HRH);
    p.set(21, 20, HRH);
  } else if (d === 'se') {
    p.rect(12, 11, 2, 8, HR);
    p.rect(22, 11, 1, 6, HR);
  } else if (d === 'e') {
    p.rect(21, 11, 1, 5, HR);
  } else if (d === 'n') {
    for (let y = 11; y <= 25; y++) {
      const hw = y < 20 ? 5 : 5 - Math.floor((y - 19) / 2);
      p.span(y, 16 - hw, 15 + hw, HR);
    }
    p.line(14, 8, 14, 22, HRH);
    p.rect(15, 15, 2, 2, GD);
  } else {
    for (let y = 11; y <= 24; y++) {
      const hw = y < 19 ? 4 : 4 - Math.floor((y - 18) / 2);
      p.span(y, 14 - hw, 13 + hw, HR);
    }
    p.line(12, 8, 12, 20, HRH);
  }
}

function drawHead(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.6, 5, 4.4, SK);
    // 齐刘海
    p.span(Y - 2, 11, 20, HR);
    p.span(Y - 1, 12, 19, HR);
    p.rect(13, Y + 1, 1, 2, EYE);
    p.rect(18, Y + 1, 1, 2, EYE);
    p.set(12, Y + 1, EYE);
    p.set(19, Y + 1, EYE);
    p.set(16, Y, INK);
    p.set(12, Y + 3, BL);
    p.set(19, Y + 3, BL);
    p.set(16, Y + 4, BL);
  } else if (d === 'se') {
    p.ellipse(17.6, Y + 1.6, 4.4, 4.4, SK);
    p.span(Y - 2, 13, 21, HR);
    p.span(Y - 1, 14, 21, HR);
    p.rect(10, Y - 2, 3, 6, HR);
    p.rect(16, Y + 1, 1, 2, EYE);
    p.rect(20, Y + 1, 1, 2, EYE);
    p.set(21, Y + 1, EYE);
    p.set(18, Y, INK);
    p.set(21, Y + 3, BL);
    p.set(18, Y + 4, BL);
  } else if (d === 'e') {
    p.ellipse(19.2, Y + 1.6, 3.6, 4.4, SK);
    p.span(Y - 2, 16, 22, HR);
    p.span(Y - 1, 18, 22, HR);
    p.rect(20, Y + 1, 1, 2, EYE);
    p.set(21, Y + 1, EYE);
    p.set(23, Y + 2, SK);
    p.set(21, Y + 3, BL);
  } else if (d === 'ne') {
    p.rect(20, Y, 2, 4, SK);
    p.set(20, Y + 3, SKS);
  }
  p.span(Y - 5, 13, 16, HRH);
  drawCrown(p, d);
}

/** 高道冠：黑冠六像素高，金箍，顶上一颗朱红珠；一根长簪横穿，两端垂红流苏 */
function drawCrown(p: PC, d: HeroDir) {
  const side = d === 'e' || d === 'se' || d === 'ne';
  const cx = d === 'e' ? 15 : 14;
  p.rect(cx, 1, 4, 4, CR);
  p.span(0, cx + 1, cx + 2, INK);
  p.set(cx, 1, CRH);
  p.span(4, cx - 1, cx + 4, GD);
  p.span(5, cx - 1, cx + 4, CR);
  p.set(cx + 4, 4, GDS);
  if (side) {
    p.line(cx - 4, 4, cx + 7, 2, GD);
    p.set(cx - 4, 5, INK);
    p.set(cx - 4, 6, INK);
  } else {
    p.span(3, cx - 4, cx + 7, GD);
    p.set(cx - 4, 4, INK);
    p.set(cx - 4, 5, INK);
    p.set(cx + 7, 4, INK);
    p.set(cx + 7, 5, INK);
  }
}

function talisman(p: PC, x: number, y: number) {
  x = Math.round(x);
  y = Math.round(y);
  p.rect(x, y, 3, 6, PAPER);
  p.span(y + 5, x, x + 2, PAPS);
  p.span(y, x, x + 2, INK);
  p.set(x + 1, y + 2, INK);
  p.set(x + 1, y + 3, INK);
  p.set(x + 1, y + 4, INK);
}

/** 三张符绕身旋转：椭圆轨道，下半圈在身前、上半圈在身后 */
function orbit(p: PC, phase: number, front: boolean) {
  for (let i = 0; i < 3; i++) {
    const a = ((phase + i * 120) * Math.PI) / 180;
    const inFront = Math.sin(a) > 0;
    if (inFront !== front) continue;
    const x = 16 + 13 * Math.cos(a) - 1;
    const y = 15 + 3 * Math.sin(a) - Math.cos(a * 2);
    talisman(p, x, y);
  }
}

/** 出招：大袖扬起抛符，k = 0 蓄势、1 前推、2 符离手、3 收手 */
function drawThrow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [3, 7, 9, 6][k];
  const lift = [-8, -4, -2, 0][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, RB, 3);
  p.line(sx, sy + 2, hx, hy + 2, RB, 3);
  p.line(sx, sy + 3, hx, hy + 3, IN);
  p.set(hx, hy, SK);
  if (k <= 1) talisman(p, hx - 1, hy - 6);
  else if (k === 2) {
    const tx = hx + 3 * Math.cos(theta);
    const ty = hy - 4 + 2 * Math.sin(theta);
    talisman(p, tx - 1, ty - 2);
    p.set(tx - 2, ty - 3, GD);
    p.set(tx + 2, ty - 3, GD);
    p.set(tx, ty - 4, 0xfff0a0);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  drawFeet(p, d, pose);
  p.oy = pose.bob;
  orbit(p, pose.orbit, false);
  drawHairBack(p, d);
  if (atk) drawThrow(p, d, pose.atk, true);
  drawRobe(p, d, pose);
  drawSleeves(p, d, pose, atk);
  drawHead(p, d);
  drawHairFront(p, d);
  if (atk) drawThrow(p, d, pose.atk, false);
  orbit(p, pose.orbit, true);
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 9, 2.6, 0x000000, 70);
  return p;
}

export function buildHeroZhu(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 8 帧、跑动 6 帧各转 120°，三张符等分，正好接上下一圈
    for (let f = 0; f < 8; f++) frames.push(drawHero(d, { run: false, f: 0, bob: f >= 4 ? 1 : 0, swing: 0, orbit: f * 15, atk: -1 }));
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { run: true, f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.4, orbit: f * 20, atk: -1 }));
    }
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: false, f: 0, bob: 0, swing: 0, orbit: k * 30, atk: k }));
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: true, f: k + 1, bob: k % 2, swing: 0, orbit: k * 30, atk: k }));
  }
  addSheet(scene, 'hero_zhu', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * FRAMES_PER_DIR;
    addAnim(scene, `zhu_${d}_idle`, 'hero_zhu', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 8);
    addAnim(scene, `zhu_${d}_run`, 'hero_zhu', [8, 9, 10, 11, 12, 13].map((i) => b + i), 11);
    addAnim(scene, `zhu_${d}_atk`, 'hero_zhu', [14, 15, 16, 17].map((i) => b + i), 18, 0);
    addAnim(scene, `zhu_${d}_atkrun`, 'hero_zhu', [18, 19, 20, 21].map((i) => b + i), 18, 0);
  });
}
