import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 傀儡师·墨衡：墨家匠人，取“衣褐带索”与偃师造倡者。比剑客矮 1 像素，清瘦。
// 头发挽髻，墨色布巾贴着头顶包住、髻上打结垂两条短巾脚；及膝褐色交领短褐，腰束麻绳；
// 裤腿打绑腿、草鞋；腰挂墨斗，背上一把木矩尺；右手提一副十字木操纵架，灵丝吊着一具小木偶——这是剪影标志。

// 土系褐色：比旧版更暗、更朴素；高光偏暖麦黄，暗部偏深茶褐
const SK = 0xf4cfb0, SKS = 0xd29278, BL = 0xe89a8c;
const HR = 0x261f30;
const CAP = 0x2a2432, CAPH = 0x50485e;
const RB = 0xa8763c, RBS = 0x7a5228, RBH = 0xcc9a56, RBD = 0x56381c;
const IN = 0xe6dcc2;
const ROPE = 0xdcc68e, ROPES = 0x9e8854;
const PT = 0x4a3a30, WRAP = 0xcbb98e, WRAPS = 0x948458, SANDAL = 0xc8a85e;
const WD = 0xb27a40, WDS = 0x784c26, WDH = 0xdca862;
const INKBOX = 0x5a3a24, REEL = 0x9a6a3c;
const DOLL = 0xeed2a0, DOLLH = 0xfff0cc;
const STR = 0xf0e4c8, GLOW = 0xffeca4;
const EYE = 0x1c1424;
const MUS = 0x8a6658;
const BROW = 0x2a2232;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 灵丝与巾脚摆动相位 */
  wavePhase: number;
  blink: boolean;
  atk: number;
}

const HEAD_Y = 10;
const BODY_Y = 16;

/** 短褐下露出打绑腿的小腿和草鞋 */
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
    p.line(baseX, 23, footX, footY - 1, shade ? 0x3a2e26 : PT, 2);
    // 绑腿：小腿上三道浅麻色缠布
    for (const t of [0.4, 0.62, 0.84]) {
      const y = Math.round(23 + (footY - 1 - 23) * t);
      const x = Math.round(baseX + strideX * t);
      p.span(y, x, x + 1, shade ? WRAPS : WRAP);
    }
    p.span(footY, footX, footX + 1, SANDAL);
    if (!shade) p.set(footX + 1, footY, 0x8a6e36);
  };

  if (d === 'e') {
    leg(14, -s, -c, true);
    leg(15, s, c, false);
  } else {
    leg(13, s, c, d === 'ne' || (d === 'se' && s < 0));
    leg(17, -s, -c, false);
  }
}

/** 及膝交领短褐，腰束麻绳，绳结垂下两截 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.75 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [6, 6, 6, 5, 5, 6, 6, 7, 7];
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
    if (i >= 5 && i < half.length - 2 && hw > 4) p.set(x0 + 2, y, RBS);
    if (i === half.length - 2) p.span(y, x0 + 1, x1 - 1, RBS);
    if (i === half.length - 1) p.span(y, x0, x1, RBD);
  }
  // 交领：右衽，领口露米白中衣
  if (d === 's' || d === 'se') {
    const o = d === 'se' ? 1 : 0;
    p.set(15 + o, BODY_Y, IN);
    p.set(16 + o, BODY_Y, IN);
    p.set(16 + o, BODY_Y + 1, IN);
    p.line(14 + o, BODY_Y, 17 + o, BODY_Y + 3, RBD);
  } else if (d === 'e') {
    p.set(18, BODY_Y, IN);
    p.line(18, BODY_Y + 1, 17, BODY_Y + 3, RBD);
  } else {
    p.line(cx, BODY_Y + 4, cx, BODY_Y + 6, RBS);
  }
  // 麻绳腰带
  const bw = Math.round(4 * k);
  p.span(BODY_Y + 3, cx - bw, cx + bw - 1, ROPE);
  for (let x = cx - bw + 1; x <= cx + bw - 1; x += 2) p.set(x, BODY_Y + 3, ROPES);
  const sway = pose.run ? Math.round(Math.sin(pose.wavePhase - 1) * 1) : 0;
  if (d === 's' || d === 'se') {
    const kx = cx + (d === 'se' ? 2 : 1);
    p.set(kx, BODY_Y + 3, ROPES);
    p.line(kx, BODY_Y + 4, kx + sway, BODY_Y + 6, ROPE);
    p.line(kx + 1, BODY_Y + 4, kx + 1 + sway, BODY_Y + 5, ROPES);
  }
  // 腰挂墨斗：木匣带一个圆线轮，墨线垂下一截
  if (d === 's' || d === 'se' || d === 'e') {
    const mx = d === 's' ? 10 : d === 'se' ? 11 : 11;
    p.rect(mx, BODY_Y + 4, 3, 2, INKBOX);
    p.set(mx + 1, BODY_Y + 4, REEL);
    p.set(mx, BODY_Y + 4, 0x7a5232);
    p.line(mx + 2, BODY_Y + 6, mx + 2 + sway, BODY_Y + 7, 0x1c1424);
  }
}

/** 背上的木矩尺：背面看到完整 L 形，正面、侧面只从肩后探出一角 */
function drawSquare(p: PC, d: HeroDir, over: boolean) {
  if (over && (d === 'n' || d === 'ne')) {
    const x = d === 'n' ? 12 : 13;
    p.line(x, BODY_Y - 2, x, BODY_Y + 6, WD, 2);
    p.line(x, BODY_Y + 6, x + 6, BODY_Y + 6, WD, 2);
    p.line(x, BODY_Y - 2, x, BODY_Y + 6, WDH);
    p.line(x + 1, BODY_Y + 7, x + 6, BODY_Y + 7, WDS);
    for (const y of [BODY_Y, BODY_Y + 2, BODY_Y + 4]) p.set(x + 1, y, 0x3a2418);
    return;
  }
  if (over) return;
  if (d === 's' || d === 'se') {
    p.line(10, BODY_Y - 5, 10, BODY_Y + 1, WD, 2);
    p.line(10, BODY_Y - 5, 13, BODY_Y - 5, WD, 2);
    p.set(10, BODY_Y - 5, WDH);
    p.set(11, BODY_Y - 3, 0x3a2418);
  } else if (d === 'e') {
    p.line(10, BODY_Y - 4, 11, BODY_Y + 3, WD, 2);
    p.line(10, BODY_Y - 4, 13, BODY_Y - 5, WD, 2);
    p.set(10, BODY_Y - 4, WDH);
  }
}

function drawArms(p: PC, d: HeroDir, pose: Pose) {
  const sw = Math.round(pose.swing);
  if (d === 'e') {
    p.rect(14 - sw, BODY_Y + 1, 3, 4, RBS);
    p.rect(13 - sw, BODY_Y + 4, 4, 2, RBS);
    p.set(14 - sw, BODY_Y + 6, SK);
    return;
  }
  // 匠人袖：上臂 3 像素，袖口下张到 4 像素，露一点手
  const lx = d === 's' || d === 'n' ? 9 : 10;
  const y0 = BODY_Y + 1 + sw;
  p.rect(lx, y0, 3, 3, RB);
  p.set(lx + 2, y0, RBS);
  p.rect(lx - 1, y0 + 3, 4, 2, RB);
  p.span(y0 + 4, lx - 1, lx + 2, RBS);
  p.set(lx - 1, y0 + 3, RBH);
  p.set(lx + 1, y0 + 5, SK);
}

function drawHead(p: PC, d: HeroDir, pose: Pose) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y + 0.5, 5.8, 5.6, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.4, 4.6, 4.2, SK);
    p.span(Y + 4, 14, 17, SKS);
    p.set(12, Y + 3, BL);
    p.set(19, Y + 3, BL);
    if (pose.blink) {
      p.span(Y + 2, 12, 14, SKS);
      p.span(Y + 2, 17, 19, SKS);
    } else {
      // 黑瞳 + 外侧一点高光，和其他人同一种画法
      p.rect(13, Y + 1, 1, 2, EYE);
      p.set(12, Y + 1, 0xffffff);
      p.rect(18, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, 0xffffff);
    }
    // 细眉，眉尾外挑：专注、精明
    p.set(14, Y, BROW);
    p.set(13, Y, BROW);
    p.set(12, Y - 1, BROW);
    p.set(17, Y, BROW);
    p.set(18, Y, BROW);
    p.set(19, Y - 1, BROW);
    // 淡淡的短须，下巴一点山羊胡
    p.set(15, Y + 3, MUS);
    p.set(16, Y + 3, MUS);
    p.set(16, Y + 5, HR);
  } else if (d === 'se') {
    p.ellipse(17.4, Y + 1.4, 4.2, 4.2, SK);
    p.span(Y + 4, 16, 19, SKS);
    p.set(21, Y + 3, BL);
    if (pose.blink) {
      p.span(Y + 2, 15, 17, SKS);
      p.span(Y + 2, 19, 20, SKS);
    } else {
      p.rect(16, Y + 1, 1, 2, EYE);
      p.set(15, Y + 1, 0xffffff);
      p.rect(19, Y + 1, 1, 2, EYE);
    }
    p.set(16, Y, BROW);
    p.set(15, Y - 1, BROW);
    p.set(19, Y, BROW);
    p.set(20, Y - 1, BROW);
    p.set(17, Y + 3, MUS);
    p.set(18, Y + 3, MUS);
    p.set(18, Y + 5, HR);
  } else if (d === 'e') {
    p.ellipse(18.6, Y + 1.4, 3.4, 4.2, SK);
    p.set(18, Y + 3, BL);
    if (pose.blink) p.span(Y + 2, 18, 20, SKS);
    else {
      p.rect(19, Y + 1, 1, 2, EYE);
      p.set(18, Y + 1, 0xffffff);
    }
    p.set(19, Y, BROW);
    p.set(20, Y - 1, BROW);
    p.set(21, Y + 2, SK);
    p.set(20, Y + 3, MUS);
    p.set(20, Y + 5, HR);
  } else if (d === 'ne') {
    p.rect(19, Y, 2, 4, SK);
    p.set(19, Y + 3, SKS);
  }
  drawWrap(p, d, pose.wavePhase);
}

/** 墨色布巾贴着头顶包住发髻，髻上打结，垂两条短巾脚 */
function drawWrap(p: PC, d: HeroDir, wavePhase: number) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  const w1 = Math.sin(wavePhase) * 1.1;
  // 包头：顶部半个椭圆
  for (let y = Y - 4; y <= Y - 2; y++) {
    const t = (y - (Y - 4)) / 2;
    const hw = Math.round(3.6 + t * 1.4);
    p.span(y, Math.round(hx - hw), Math.round(hx + hw - 1), CAP);
  }
  p.span(Y - 4, Math.round(hx - 2), Math.round(hx), CAPH);
  // 前额一道巾边
  if (d !== 'n' && d !== 'ne') p.span(Y - 2, Math.round(hx - 4), Math.round(hx + 3), 0x3e3648);
  // 发髻与巾结，横插一根木簪
  const kx = d === 'e' || d === 'se' ? 15 : 16;
  p.rect(kx - 1, Y - 8, 3, 4, CAP);
  p.set(kx - 1, Y - 8, CAPH);
  p.set(kx - 1, Y - 7, CAPH);
  p.set(kx + 1, Y - 5, 0x14101c);
  p.line(kx - 3, Y - 6, kx + 3, Y - 7, WD);
  p.set(kx + 3, Y - 7, WDH);
  // 巾脚：飘向身后
  if (d === 'e' || d === 'se') {
    p.strand([[kx - 1, Y - 5], [kx - 4 + w1 * 0.5, Y - 4], [kx - 6 + w1, Y - 2]], CAP, 1);
    p.strand([[kx - 1, Y - 4], [kx - 4 + w1 * 0.7, Y - 2], [kx - 5 + w1, Y]], CAP, 1);
  } else if (d === 'n' || d === 'ne') {
    p.strand([[kx - 1, Y - 4], [kx - 2 + w1 * 0.6, Y + 1]], CAP, 1);
    p.strand([[kx + 1, Y - 4], [kx + 2 + w1 * 0.6, Y + 1]], CAP, 1);
  } else {
    p.strand([[kx + 2, Y - 5], [kx + 4 + w1 * 0.5, Y - 4]], CAP, 1);
  }
}

/** 十字木操纵架：一根横杆压一根短竖杆，深木色和浅色身体拉开 */
function cross(p: PC, x: number, y: number, tilt: number) {
  x = Math.round(x);
  y = Math.round(y);
  p.line(x - 3, y - tilt, x + 3, y + tilt, WD);
  p.line(x - 3, y + 1 - tilt, x + 3, y + 1 + tilt, WDS);
  p.set(x - 3, y - tilt, WDH);
  p.line(x, y - 2, x, y + 2, WD);
  p.set(x, y - 2, WDH);
  p.set(x, y + 2, WDS);
}

/** 吊在灵丝下的小木偶：圆头、方身、两点手脚；(cx, cy) 是头顶 */
function doll(p: PC, cx: number, cy: number) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  // 偶身用比褐衣浅一档的白木，头顶受光
  p.rect(cx - 1, cy, 2, 2, DOLL);
  p.set(cx - 1, cy, DOLLH);
  p.rect(cx - 1, cy + 2, 2, 2, WDH);
  p.set(cx, cy + 3, WD);
  p.set(cx - 2, cy + 2, DOLL);
  p.set(cx + 1, cy + 2, DOLL);
  p.set(cx - 1, cy + 4, WD);
  p.set(cx, cy + 4, WD);
}

/** 灵丝从横杆两端和中间连到木偶的手和头，木偶吊在 len 深处 */
function strings(p: PC, x: number, y: number, tilt: number, sway: number, col: number, len: number, glow = false) {
  x = Math.round(x);
  y = Math.round(y);
  const cx = x + 1 + sway;
  const cy = Math.min(25, y + len - 3);
  const lines: [number, number, number, number][] = [[x - 3, y - tilt, cx - 2, cy + 2], [x, y + 2, cx, cy], [x + 3, y + tilt, cx + 1, cy + 2]];
  // 灵丝用半透明画，外描边只套不透明像素，细线不会被描成一排黑白梳齿
  for (const [sx, sy, ex, ey] of lines) {
    if (glow) p.line(sx, sy + 1, ex, ey, GLOW, 2, 95);
    p.line(sx, sy + 1, ex, ey, col, 1, 200);
  }
  doll(p, cx, cy);
}

/** 平时：右手提着操纵架，木偶随正弦波轻轻晃；出招 6 帧：操纵架扬起，灵丝绷直泛起金光、木偶被扯向前方 */
function drawRig(p: PC, d: HeroDir, pose: Pose) {
  const theta = (FACING[d] * Math.PI) / 180;
  if (pose.atk < 0) {
    const hx = d === 'e' ? 21 : d === 'n' ? 21 : 22;
    const hy = BODY_Y + 2 + Math.round(pose.swing * 0.5);
    p.line(hx - 3, BODY_Y + 1, hx - 1, hy, RB, 2);
    p.set(hx, hy, SK);
    // 操纵架提在身侧外面，木偶吊到腰下，和褐衣分开
    const tx = hx + 2;
    const ty = hy - 3;
    const sway = Math.round(Math.sin(pose.wavePhase - 0.6) * 1.2);
    p.line(hx, hy, tx - 1, ty + 1, SK);
    strings(p, tx, ty, 0, sway + 1, STR, 11);
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
  const len = [9, 11, 13, 12, 10, 9][k];
  const sway = taut ? Math.round(5 * Math.cos(theta)) : 0;
  strings(p, hx + 1, hy - 2, tilt, sway, taut ? GLOW : STR, len, taut);
  cross(p, hx + 1, hy - 2, tilt);
  if (k === 2 || k === 3) {
    // 木偶两侧迸出金光
    const ex = Math.round(hx + 2 + sway);
    const ey = Math.min(25, Math.round(hy - 2 + len - 3)) + 2;
    p.set(ex - 3, ey, GLOW);
    p.set(ex + 3, ey, GLOW);
    p.set(ex, ey + 4, 0xfff6d0);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  drawLegs(p, d, pose);
  p.oy = pose.bob;
  const back = d === 'n' || d === 'ne';
  if (!back) drawSquare(p, d, false);
  if (back) drawRig(p, d, pose);
  drawRobe(p, d, pose);
  if (back) drawSquare(p, d, true);
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
