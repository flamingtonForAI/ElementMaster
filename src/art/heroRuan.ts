import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 海贼·阮沧。剪影和另两人拉开：背上连弩的弩臂横出两肩，右肩上方斜出鱼叉尖；
// 深蓝头巾，脑后两条巾尾随动作飘；青蓝短打敞着领口，挽袖露小臂，裤脚卷到小腿、草鞋。
// 帧布局与剑客相同。

const SK = 0xd9a070, SKS = 0xb07a50, SKH = 0xeab888;
const HR = 0x231d26;
const BD = 0x24448f, BDS = 0x182e62, BDH = 0xe8eef8;
const JK = 0x2f8a9e, JKS = 0x1f5f70, JKH = 0x52b0c4;
const TR = 0x2a3550, TRS = 0x1e2740;
const RP = 0xc0904a, RPS = 0x8a6230;
const SD = 0xb89a5a;
const WD = 0x7a4a2a, WDH = 0xa8703e, STR = 0xe8e0c8;
const MT = 0xaab4bd, MTH = 0xe6eef4;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 巾尾飘动 */
  sway: number;
  atk: number;
}

/** 卷到小腿的阔腿裤 + 光小腿 + 草鞋 */
function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 6) * Math.PI * 2;
  const s = pose.run ? Math.sin(phi) : 0;
  const c = pose.run ? Math.cos(phi) : 0;
  const leg = (x: number, lift: number, shade: boolean) => {
    const bottom = 29 - lift;
    for (let y = 23; y <= bottom; y++) {
      if (y === bottom) p.span(y, x - 1, x + 2, SD);
      else if (y >= bottom - 2) p.span(y, x, x + 1, y === bottom - 2 ? SKS : SK);
      else p.span(y, x - 1, x + 2, shade ? TRS : TR);
    }
    p.span(bottom - 3, x - 1, x + 2, TRS);
  };
  if (d === 's' || d === 'n') {
    leg(12, Math.max(0, Math.round(2 * s)), false);
    leg(18, Math.max(0, Math.round(-2 * s)), false);
  } else if (d === 'e') {
    leg(15 - Math.round(2.5 * s), Math.max(0, Math.round(-1.5 * c)), true);
    leg(15 + Math.round(2.5 * s), Math.max(0, Math.round(1.5 * c)), false);
  } else {
    leg(12 + Math.round(1.2 * s), Math.max(0, Math.round(2 * s)), d === 'ne');
    leg(18 - Math.round(1.2 * s), Math.max(0, Math.round(-2 * s)), false);
  }
}

/** 短打：比剑客更短更宽，敞领露胸，草绳腰带 */
function drawTorso(p: PC, d: HeroDir) {
  const k = d === 'e' ? 0.7 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [6, 7, 7, 6, 6, 6, 6, 6, 6];
  const cx = d === 'e' ? 15 : 16;
  for (let i = 0; i < half.length; i++) {
    const y = 15 + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const x0 = cx - hw;
    const x1 = cx + hw - 1;
    p.span(y, x0, x1, JK);
    p.set(x0, y, JKH);
    p.set(x1, y, JKS);
    if (hw > 4) p.set(x1 - 1, y, JKS);
  }
  // 草绳腰带，结在一侧
  const bw = d === 'e' ? 4 : 6;
  p.span(21, cx - bw, cx + bw - 1, RP);
  p.span(22, cx - bw, cx + bw - 1, RPS);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    // 敞开的领口
    for (let y = 15; y <= 19; y++) {
      const w = Math.max(0, 2 - Math.floor((y - 15) / 2));
      p.span(y, 16 + o - w, 15 + o + w, SK);
    }
    p.line(14 + o - 1, 15, 16 + o, 20, JKS);
    p.line(17 + o + 1, 15, 16 + o, 20, JKS);
    p.set(15 + o, 16, SKH);
    const kx = d === 's' ? 20 : 19;
    p.rect(kx, 21, 2, 2, RP);
    p.line(kx + 1, 23, kx + 1, 25, RP);
  } else if (d === 'e') {
    p.line(19, 15, 18, 19, SK);
    p.set(18, 15, SK);
  } else {
    p.line(16, 15, 16, 20, JKS);
  }
}

/** 挽起的袖子 + 光小臂 */
function drawArms(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    for (let y = 16 + dy; y <= 18 + dy; y++) {
      p.set(x, y, JK);
      p.set(x + 1, y, JKS);
    }
    p.span(19 + dy, x, x + 1, JKH);
    for (let y = 20 + dy; y <= 22 + dy; y++) {
      p.set(x, y, SK);
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
    p.set(ax + 2, 21, SKS);
  }
}

/** 背上的连弩：弩臂横出两肩；鱼叉斜插在右肩后，叉尖高出头顶一侧 */
function drawBackGear(p: PC, d: HeroDir, harpoonOnly: boolean) {
  if (d === 's' || d === 'se') {
    // 鱼叉：杆从右腰后斜到右肩上方
    p.line(23, 22, 25, 6, WD);
    p.line(24, 22, 26, 6, WDH);
    p.line(25, 5, 26, 1, MT);
    p.set(24, 3, MTH);
    p.set(27, 3, MT);
    if (harpoonOnly) return;
    // 弩臂：从左右肩后露出两截
    const y = d === 's' ? 13 : 12;
    p.line(3, y + 2, 9, y, WD, 2);
    p.line(22, y, 28, y + 2, WD, 2);
    p.set(3, y + 3, STR);
    p.set(28, y + 3, STR);
  } else if (d === 'e') {
    p.line(9, 22, 6, 4, WD);
    p.line(10, 22, 7, 4, WDH);
    p.line(6, 3, 5, 0, MT);
    p.set(4, 1, MT);
    if (harpoonOnly) return;
    p.line(10, 10, 9, 20, WD, 2);
    p.set(9, 9, STR);
    p.set(8, 21, STR);
  }
}

/** 背面看到整把弩：弩身竖在背中、弩臂横跨两肩 */
function drawBackGearOver(p: PC, d: HeroDir, harpoonOnly: boolean) {
  if (d !== 'n' && d !== 'ne') return;
  const o = d === 'ne' ? -1 : 0;
  p.line(8 + o, 22, 6 + o, 4, WD);
  p.line(9 + o, 22, 7 + o, 4, WDH);
  p.line(6 + o, 3, 5 + o, 0, MT);
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

/** 头巾的两条巾尾 */
function drawTails(p: PC, d: HeroDir, sway: number, over: boolean) {
  const sw = sway;
  if (!over && d === 's') {
    p.strand([[19, 5], [22, 6], [24 + sw, 8]], BD, 2);
    p.strand([[19, 6], [21, 9], [22 + sw, 11]], BDS, 2);
  }
  if (!over && d === 'se') {
    p.strand([[12, 5], [9, 6], [7 + sw, 8]], BD, 2);
    p.strand([[12, 6], [10, 9], [9 + sw, 11]], BDS, 2);
  }
  if (!over && d === 'e') {
    p.strand([[12, 5], [9, 5], [6 + sw, 7]], BD, 2);
    p.strand([[12, 6], [10, 8], [8 + sw, 11]], BDS, 2);
  }
  if (over && d === 'n') {
    p.rect(15, 6, 3, 2, BDS);
    p.strand([[16, 7], [14 - sw, 11], [13 - sw, 14]], BD, 2);
    p.strand([[17, 7], [19 + sw, 11], [20 + sw, 13]], BDS, 2);
  }
  if (over && d === 'ne') {
    p.rect(12, 6, 3, 2, BDS);
    p.strand([[13, 7], [10 + sw, 10], [9 + sw, 13]], BD, 2);
  }
}

function drawHead(p: PC, d: HeroDir) {
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, 9, 6, 6, HR);
  if (d === 's') {
    p.ellipse(16, 10.6, 5, 4.4, SK);
    // 粗眉、刀疤
    p.span(9, 12, 14, HR);
    p.span(9, 17, 19, HR);
    p.rect(13, 10, 1, 2, EYE);
    p.rect(18, 10, 1, 2, EYE);
    p.line(19, 11, 20, 13, SKH);
    p.span(14, 15, 17, SKS);
    p.set(16, 13, SKS);
    p.set(10, 10, HR);
    p.set(21, 10, HR);
  } else if (d === 'se') {
    p.ellipse(17.6, 10.6, 4.4, 4.4, SK);
    p.span(9, 15, 17, HR);
    p.span(9, 19, 21, HR);
    p.rect(16, 10, 1, 2, EYE);
    p.rect(20, 10, 1, 2, EYE);
    p.line(20, 11, 21, 13, SKH);
    p.span(14, 17, 20, SKS);
    p.rect(11, 8, 2, 4, HR);
  } else if (d === 'e') {
    p.ellipse(19.2, 10.6, 3.6, 4.4, SK);
    p.span(9, 19, 22, HR);
    p.rect(20, 10, 1, 2, EYE);
    p.set(23, 11, SK);
    p.span(14, 18, 21, SKS);
    p.rect(14, 8, 2, 4, HR);
  } else if (d === 'ne') {
    p.rect(20, 9, 2, 4, SK);
    p.set(20, 12, SKS);
  }
  // 头巾：包住头顶到眉上，白色浪纹
  const top = (y0: number, y1: number, x0: number, x1: number) => {
    for (let y = y0; y <= y1; y++) p.span(y, x0, x1, BD);
  };
  if (d === 'e') {
    top(3, 7, 12, 21);
    p.span(8, 13, 22, BD);
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
  p.span(3, 12, 15, 0x3a5cb0);
}

/** 出招：端弩平射。k = 0 瞄准、1 击发（弩口闪光）、2 后坐、3 回位 */
function drawCrossbow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const back = k === 2 ? 1.5 : 0;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const bx = 16 + c * (2 - back);
  const by = 19 + s * (2 - back);
  const fx = bx + c * 9;
  const fy = by + s * 6;
  // 双手托住弩身
  p.line(16 - 4 * s, 18, bx + c * 3, by + s * 2, SK, 2);
  p.line(bx, by, fx, fy, WD, 2);
  p.line(bx, by - 1, fx, fy - 1, WDH);
  // 弩臂垂直于射向
  const nx = -s;
  const ny = c * 0.6;
  p.line(fx - nx * 5, fy - ny * 5, fx + nx * 5, fy + ny * 5, WD, 2);
  p.line(fx - nx * 5, fy - ny * 5 + 1, bx + c * 4, by + s * 3 + 1, STR);
  p.line(fx + nx * 5, fy + ny * 5 + 1, bx + c * 4, by + s * 3 + 1, STR);
  p.set(fx + c, fy + s, MT);
  if (k === 1) {
    p.set(fx + c * 3, fy + s * 2, 0xffffff);
    p.set(fx + c * 3 + nx, fy + s * 2 + ny, 0xb8e4ff);
    p.set(fx + c * 3 - nx, fy + s * 2 - ny, 0xb8e4ff);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const rad = (FACING[d] * Math.PI) / 180;
  const lean = atk && pose.atk === 2 ? -1 : 0;
  drawLegs(p, d, pose);
  p.ox = Math.round(Math.cos(rad) * lean);
  p.oy = pose.bob;
  const back = d === 'n' || d === 'ne';
  if (!back) {
    drawTails(p, d, pose.sway, false);
    drawBackGear(p, d, atk);
  }
  if (atk) drawCrossbow(p, d, pose.atk, true);
  drawTorso(p, d);
  drawArms(p, d, pose, atk);
  drawHead(p, d);
  if (back) {
    drawTails(p, d, pose.sway, true);
    drawBackGearOver(p, d, atk);
  }
  if (atk) drawCrossbow(p, d, pose.atk, false);
  p.ox = 0;
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 8, 2.6, 0x000000, 70);
  return p;
}

export function buildHeroRuan(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    for (let f = 0; f < 4; f++) frames.push(drawHero(d, { run: false, f: 0, bob: f >= 2 ? 1 : 0, swing: 0, sway: f >= 2 ? 1 : 0, atk: -1 }));
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { run: true, f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.4, sway: f < 3 ? 1 : -1, atk: -1 }));
    }
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: false, f: 0, bob: 0, swing: 0, sway: 1, atk: k }));
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: true, f: k + 1, bob: k % 2, swing: 0, sway: 1, atk: k }));
  }
  addSheet(scene, 'hero_ruan', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `ruan_${d}_idle`, 'hero_ruan', [b, b + 1, b + 2, b + 3], 4);
    addAnim(scene, `ruan_${d}_run`, 'hero_ruan', [4, 5, 6, 7, 8, 9].map((i) => b + i), 11);
    addAnim(scene, `ruan_${d}_atk`, 'hero_ruan', [10, 11, 12, 13].map((i) => b + i), 18, 0);
    addAnim(scene, `ruan_${d}_atkrun`, 'hero_ruan', [14, 15, 16, 17].map((i) => b + i), 18, 0);
  });
}
