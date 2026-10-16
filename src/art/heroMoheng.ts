import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 傀儡师·墨衡：清瘦的匠人，比剑客矮 1 像素。黑方巾垂两条巾脚，土黄窄袖长袍外罩皮围裙，
// 腰侧挂工具袋；右手一直提着十字提线木架，几根细线垂下来——这是剪影标志。

// 色阶采用冷暖色相偏移：暖黄长袍高光偏蜜金、暗部偏橄榄褐，皮围裙暗部偏深红紫褐
const SK = 0xf4cfb0, SKS = 0xd29278;
const HR = 0x261f30;
const CAP = 0x221d2e, CAPH = 0x4f4762, CAPB = 0x74502e;
const RB = 0xd19c3e, RBS = 0x9e6c28, RBH = 0xf0c668, RBD = 0x744d1e;
const AP = 0x824e2e, APS = 0x563022, APH = 0xa86c42;
const BELT = 0x38231a, BUCK = 0xffe484;
const POUCH = 0x704c30, POUS = 0x4a2e22;
const PT = 0x5c4234, BT = 0x2c2232, BTH = 0x524258;
const WD = 0xb27a40, WDS = 0x784c26, WDH = 0xdca862;
const STR = 0xf0e4c8, GLOW = 0xffeca4;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 提线与帽巾摆动相位 */
  wavePhase: number;
  blink: boolean;
  atk: number;
}

const HEAD_Y = 12;
const BODY_Y = 18;

function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 8) * Math.PI * 2;
  const s = pose.run ? Math.sin(phi) : 0;
  const c = pose.run ? Math.cos(phi) : 0;

  if (pose.run && (pose.f === 1 || pose.f === 5)) {
    const dx = d === 'e' ? 11 : pose.f === 1 ? 11 : 20;
    p.set(dx, 29, 0xc8bfa8, 170);
    p.set(dx - 1, 28, 0xe0d8c3, 125);
  }

  const leg = (baseX: number, ps: number, pc: number, shade: boolean) => {
    const strideX = d === 'e' ? Math.round(2.6 * ps) : d === 'se' || d === 'ne' ? Math.round(1.4 * ps) : 0;
    const liftY = Math.max(0, Math.round(1.8 * pc));
    const footX = baseX + strideX;
    const footY = 29 - liftY;
    p.line(baseX, 26, footX, footY, shade ? 0x433024 : PT, 2);
    p.span(footY, footX, footX + 1, BT);
    if (!shade) p.set(footX + 1, footY, BTH);
  };

  if (d === 'e') {
    leg(14, -s, -c, true);
    leg(15, s, c, false);
  } else {
    leg(13, s, c, d === 'ne' || (d === 'se' && s < 0));
    leg(17, -s, -c, false);
  }
}

/** 窄身长袍到小腿，正面罩一件立体皮围裙 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.75 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [4, 4, 4, 4, 4, 5, 5, 5, 5];
  const cx = d === 'e' ? 15 : 16;
  const hem = pose.run ? Math.round(Math.sin(pose.wavePhase - 0.8) * 1.1) : 0;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 6 ? hem : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    p.set(x1, y, RBD);
    if (hw > 3) p.set(x1 - 1, y, RBS);
    if (i === half.length - 1) p.span(y, x0, x1, RBD);
  }
  if (d === 'n') {
    p.span(BODY_Y + 3, cx - 4, cx + 3, BELT);
    p.rect(cx - 1, BODY_Y + 4, 2, 2, APS);
    return;
  }
  if (d === 's' || d === 'se') {
    const o = d === 'se' ? 1 : 0;
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, RBD);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, RBD);
    p.set(16 + o, BODY_Y, SK);
  }
  // 皮围裙：带高光铆钉与铜扣
  const ax = d === 'e' ? cx : cx + (d === 'se' ? 1 : 0);
  const aw = d === 'e' ? 2 : 3;
  for (let y = BODY_Y + 2; y <= BODY_Y + 8; y++) {
    const w = y < BODY_Y + 4 ? aw - 1 : aw;
    p.span(y, ax - w, ax + w - 1, AP);
    p.set(ax + w - 1, y, APS);
    if (y === BODY_Y + 8) p.span(y, ax - w, ax + w - 1, APS);
  }
  p.set(ax - aw + 1, BODY_Y + 5, APH);
  p.set(ax - aw + 1, BODY_Y + 2, BUCK);
  p.span(BODY_Y + 3, cx - Math.round(4 * k), cx + Math.round(4 * k) - 1, BELT);
  if (d !== 'e') p.set(ax, BODY_Y + 3, BUCK);
  // 工具袋挂在左腰，探出金属扳手高光
  if (d === 's' || d === 'se') {
    const px = d === 's' ? 11 : 12;
    p.rect(px, BODY_Y + 4, 3, 3, POUCH);
    p.span(BODY_Y + 4, px, px + 2, POUS);
    p.set(px + 1, BODY_Y + 3, 0xeef4f8);
    p.set(px + 2, BODY_Y + 3, 0xbfc9d2);
  } else if (d === 'e') {
    p.rect(12, BODY_Y + 4, 2, 3, POUCH);
  }
}

function drawArms(p: PC, d: HeroDir, pose: Pose) {
  const sw = Math.round(pose.swing);
  if (d === 'e') {
    p.rect(14 - sw, BODY_Y + 1, 2, 5, RBS);
    return;
  }
  const lx = d === 's' || d === 'n' ? 11 : 12;
  p.rect(lx, BODY_Y + 1 + sw, 2, 5, RB);
  p.set(lx + 1, BODY_Y + 1 + sw, RBS);
  p.set(lx, BODY_Y + 6 + sw, SK);
}

function drawHead(p: PC, d: HeroDir, pose: Pose) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y + 0.5, 5, 4.5, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.2, 4.2, 4, SK);
    if (pose.blink) {
      p.span(Y + 2, 12, 14, SKS);
      p.span(Y + 2, 17, 19, SKS);
    } else {
      p.rect(13, Y + 1, 1, 2, EYE);
      p.set(12, Y + 1, 0xffffff);
      p.rect(18, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, 0xffffff);
    }
    p.span(Y + 4, 15, 16, SKS);
  } else if (d === 'se') {
    p.ellipse(17.2, Y + 1.2, 3.8, 4, SK);
    if (pose.blink) {
      p.span(Y + 2, 15, 17, SKS);
      p.span(Y + 2, 18, 20, SKS);
    } else {
      p.rect(16, Y + 1, 1, 2, EYE);
      p.set(15, Y + 1, 0xffffff);
      p.rect(19, Y + 1, 1, 2, EYE);
    }
    p.set(17, Y + 4, SKS);
  } else if (d === 'e') {
    p.ellipse(18.4, Y + 1.2, 3.2, 4, SK);
    if (pose.blink) p.span(Y + 2, 18, 20, SKS);
    else {
      p.rect(19, Y + 1, 1, 2, EYE);
      p.set(18, Y + 1, 0xffffff);
    }
    p.set(21, Y + 2, SK);
  } else if (d === 'ne') {
    p.rect(19, Y, 2, 4, SK);
    p.set(19, Y + 3, SKS);
  }
  drawCap(p, d, pose.wavePhase);
}

/** 黑方巾：后面垂两条随风摆动的巾脚 */
function drawCap(p: PC, d: HeroDir, wavePhase: number) {
  const Y = HEAD_Y;
  const cx = d === 'e' || d === 'se' ? 17 : 16;
  const w1 = Math.sin(wavePhase) * 1.1;
  p.rect(cx - 4, Y - 9, 8, 6, CAP);
  p.span(Y - 9, cx - 4, cx + 3, CAPH);
  p.set(cx + 3, Y - 8, CAPH);
  p.span(Y - 4, cx - 5, cx + 4, CAPB);
  if (d === 'e' || d === 'se') {
    p.strand([[cx - 5, Y - 4], [cx - 7 + w1 * 0.5, Y], [cx - 8 + w1, Y + 3]], CAP, 2);
  } else if (d === 'n' || d === 'ne') {
    p.strand([[cx - 2, Y - 3], [cx - 3 + w1 * 0.7, Y + 4]], CAP, 2);
    p.strand([[cx + 1, Y - 3], [cx + 2 + w1 * 0.7, Y + 4]], CAP, 2);
  }
}

function cross(p: PC, x: number, y: number, tilt: number) {
  x = Math.round(x);
  y = Math.round(y);
  p.line(x - 3, y - tilt, x + 3, y + tilt, WD);
  p.set(x + 3, y + tilt, WDS);
  p.line(x, y - 2, x, y + 2, WDS);
  p.set(x, y - 2, WDH);
}

function strings(p: PC, x: number, y: number, tilt: number, sway: number, col: number, len: number, glow = false) {
  x = Math.round(x);
  y = Math.round(y);
  const ends: [number, number][] = [[x - 3, y - tilt], [x + 3, y + tilt], [x, y + 2]];
  for (const [sx, sy] of ends) {
    if (glow) p.line(sx, sy + 1, sx + sway, sy + len, GLOW, 2, 95);
    p.line(sx, sy + 1, sx + sway, sy + len, col);
  }
}

/** 平时：右手提着木架，线随正弦波柔顺摆动；出招 6 帧：木架扬起，灵丝绷直泛起金光 */
function drawRig(p: PC, d: HeroDir, pose: Pose) {
  const theta = (FACING[d] * Math.PI) / 180;
  if (pose.atk < 0) {
    const hx = d === 'e' ? 21 : d === 'n' ? 21 : 22;
    const hy = BODY_Y + 2 + Math.round(pose.swing * 0.5);
    p.line(hx - 3, BODY_Y + 1, hx - 1, hy, RB, 2);
    p.set(hx, hy, SK);
    const tx = hx + 1;
    const ty = hy - 2;
    const sway = Math.round(Math.sin(pose.wavePhase - 0.6) * 1.4);
    strings(p, tx, ty, 0, sway, STR, 8);
    cross(p, tx, ty, 0);
    return;
  }
  const k = pose.atk;
  const reach = [2, 6, 9, 9, 6, 3][k];
  const lift = [-4, -7, -6, -4, -2, -1][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 1;
  const side = d === 's' || d === 'n' ? 6 : d === 'e' ? 2 : 3;
  const hx = 16 + side + reach * Math.cos(theta);
  const hy = Math.max(d === 'n' || d === 'ne' ? 0 : HEAD_Y + 4, BODY_Y + lift + reach * 0.4 * Math.sin(theta));
  p.line(sx + 2, sy, hx, hy, RB, 2);
  p.set(hx, hy, SK);
  const taut = k >= 1 && k <= 3;
  const tilt = taut ? (Math.cos(theta) >= 0 ? -1 : 1) : 0;
  const len = [7, 9, 11, 10, 8, 7][k];
  const sway = taut ? Math.round(5 * Math.cos(theta)) : 0;
  strings(p, hx + 1, hy - 2, tilt, sway, taut ? GLOW : STR, len, taut);
  cross(p, hx + 1, hy - 2, tilt);
  if (k === 2 || k === 3) {
    const ex = Math.round(hx + 1 + sway);
    const ey = Math.round(hy + len - 2);
    p.set(ex - 1, ey, GLOW);
    p.set(ex + 1, ey, GLOW);
    p.set(ex, ey + 1, 0xfff6d0);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  drawLegs(p, d, pose);
  p.oy = pose.bob;
  const back = d === 'n' || d === 'ne';
  if (back) drawRig(p, d, pose);
  drawRobe(p, d, pose);
  drawArms(p, d, pose);
  drawHead(p, d, pose);
  if (!back) drawRig(p, d, pose);
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 8.5, 2.5, 0x12222b, 85);
  return p;
}

export function buildHeroMoheng(scene: Phaser.Scene) {
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
          swing: Math.sin(phi) * 1.4,
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
  addSheet(scene, 'hero_moheng', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `moheng_${d}_idle`, 'hero_moheng', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 6);
    addAnim(scene, `moheng_${d}_run`, 'hero_moheng', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `moheng_${d}_atk`, 'hero_moheng', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `moheng_${d}_atkrun`, 'hero_moheng', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}
