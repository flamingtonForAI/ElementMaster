import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { HERO_DIRS, type HeroDir } from './heroXiao';
import { EL_INFO } from '../config/elements';

// 五行散人·玄一：云游老道。白发白须、发髻插木簪，灰白宽袍黑镶边，背后太极图；
// 手持拂尘，身边五颗五行色光点绕身旋转。剪影靠拂尘的斜线、垂到胸口的长须和五色光点和其他人拉开。
// 帧布局与符师相同：每方向待机 8、跑动 6、出招 4、跑动出招 4，共 22 帧。

const SK = 0xf0c8a4, SKS = 0xd49c7c, BL = 0xe8a090;
const HR = 0xeeeae4, HRS = 0xc4beb6;
const RB = 0x9e9ca8, RBS = 0x76747f, RBH = 0xbebcc6;
const TRIM = 0x24202a;
const WD = 0x8a5a34, WDH = 0xb07a48;
const HD = 0x7a4e2e;
const TL = 0xf6f4ee, TLS = 0xcfc9c0;
const BT = 0x2b2433;
const WHITE = 0xffffff;
const EYE = 0x1c1424;

const LIGHTS = (['wood', 'fire', 'earth', 'metal', 'water'] as const).map((e) => EL_INFO[e].color);

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 拂尘尾的摆动 */
  sway: number;
  /** 五颗光点的相位（度），等分 72° 循环 */
  orbit: number;
  atk: number;
}

const FRAMES_PER_DIR = 22;
const HEAD_Y = 11;
const BODY_Y = 17;

function drawFeet(p: PC, d: HeroDir, pose: Pose) {
  const s = pose.run ? Math.sin((pose.f / 6) * Math.PI * 2) : 0;
  if (d === 'e') {
    p.span(29, 14 + Math.round(2 * s), 16 + Math.round(2 * s), BT);
  } else {
    if (s >= 0) p.span(29, 13, 14, BT);
    if (s <= 0) p.span(29, 18, 19, BT);
  }
}

/** 宽袍：肩宽、下摆略外扩，黑色镶边；背面一个太极图 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8];
  const cx = d === 'e' ? 15 : 16;
  const hem = pose.run ? Math.round(pose.swing * 0.6) : 0;
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
    if (i === half.length - 1) p.span(y, x0, x1, TRIM);
  }
  // 腰间黑绦
  const bw = d === 'e' ? 4 : 5;
  p.span(22, cx - bw, cx + bw - 1, TRIM);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    // 黑色交领，一路通到下摆
    p.line(13 + o, BODY_Y, 16 + o, BODY_Y + 3, TRIM);
    p.line(19 + o, BODY_Y, 16 + o, BODY_Y + 3, TRIM);
    p.line(16 + o, 23, 16 + o + hem, 27, RBS);
    p.set(17 + o, 23, TRIM);
    p.set(17 + o, 24, TRIM);
  } else if (d === 'e') {
    p.line(17, BODY_Y, 18, BODY_Y + 3, TRIM);
    p.line(18, 23, 18 + hem, 27, RBS);
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
      // 阴阳鱼：上半圆归白、下半圆归黑，其余按左右分
      const up = dx * dx + (dy + r / 2) ** 2 <= (r / 2) ** 2;
      const dn = dx * dx + (dy - r / 2) ** 2 <= (r / 2) ** 2;
      const white = up ? true : dn ? false : dx < 0;
      p.set(x, y, white ? WHITE : TRIM);
    }
  }
  p.set(cx - 0.5, cy - r / 2 - 0.5, TRIM);
  p.set(cx - 0.5, cy + r / 2 - 0.5, WHITE);
}

/** 大袖：上窄下宽，袖口黑边 */
function sleeve(p: PC, x: number, dy: number, mirror: boolean) {
  const rows = [2, 3, 4, 4, 5, 5, 5];
  rows.forEach((w, i) => {
    const y = BODY_Y + 1 + i + dy;
    const a = mirror ? x : x - w + 1;
    const b = mirror ? x + w - 1 : x;
    const cuff = i === rows.length - 1;
    p.span(y, a, b, cuff ? TRIM : RB);
    if (!cuff) p.set(mirror ? b : a, y, RBS);
  });
}

function drawSleeves(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing * 0.7);
  if (d === 's' || d === 'n') {
    sleeve(p, 10, sw, false);
    if (!skipFront) sleeve(p, 21, -sw, true);
  } else if (d === 'se' || d === 'ne') {
    sleeve(p, 11, sw, false);
    if (!skipFront) sleeve(p, 20, -sw, true);
  } else if (!skipFront) {
    const ax = 14 + Math.round(-1.2 * pose.swing);
    for (let i = 0; i < 7; i++) {
      const y = BODY_Y + 1 + i;
      const w = Math.min(5, 2 + i);
      p.span(y, ax, ax + w - 1, i === 6 ? TRIM : RB);
      if (i < 6) p.set(ax + w - 1, y, RBS);
    }
  }
}

/** 披到肩后的白发 */
function drawHairBack(p: PC, d: HeroDir) {
  if (d === 's') {
    p.rect(10, 12, 2, 6, HRS);
    p.rect(20, 12, 2, 6, HRS);
  } else if (d === 'se') {
    p.rect(10, 12, 3, 6, HRS);
  } else if (d === 'e') {
    p.strand([[12, 9], [11, 14], [12, 18]], HRS, 3);
  }
}

function drawHead(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 6, 6, HR);
  p.span(Y - 5, 14, 17, WHITE);
  if (d === 's') {
    p.ellipse(16, Y + 1.6, 5, 4.4, SK);
    // 中分白发压住额头两侧
    p.span(Y - 2, 11, 20, HR);
    p.span(Y - 1, 11, 14, HR);
    p.span(Y - 1, 17, 20, HR);
    p.set(15, Y - 1, SKS);
    // 白眉、眯眼
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
    p.rect(20, Y, 2, 3, SK);
    p.set(21, Y, HR);
  } else {
    // 背面：白发垂到肩
    p.rect(11, Y + 2, 10, 5, HR);
    p.span(Y + 7, 12, 19, HRS);
    p.line(13, Y - 3, 13, Y + 6, HRS);
    p.line(18, Y - 3, 18, Y + 6, HRS);
  }
  drawBeard(p, d);
  drawTopknot(p, d);
}

/** 长须垂到胸口，上面一道八字胡 */
function drawBeard(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  if (d === 's' || d === 'se') {
    const cx = d === 's' ? 16 : 18;
    p.span(Y + 3, cx - 3, cx + 2, HR);
    const w = [3, 3, 3, 2, 2, 2, 1, 1, 0.5];
    w.forEach((hw, i) => {
      const y = Y + 4 + i;
      p.span(y, Math.round(cx - hw), Math.round(cx + hw) - 1, i === w.length - 1 ? HRS : HR);
      if (hw >= 2) p.set(Math.round(cx + hw) - 1, y, HRS);
    });
  } else if (d === 'e') {
    p.span(Y + 3, 19, 22, HR);
    p.strand([[21, Y + 4], [21, Y + 8], [20, Y + 11]], HR, 2);
    p.set(20, Y + 12, HRS);
  } else if (d === 'ne') {
    p.rect(21, Y + 3, 1, 4, HR);
  }
}

/** 头顶发髻，横插一根木簪 */
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

/** 拂尘：手里一根短柄斜指，柄头垂下一束白色长尾 */
function whisk(p: PC, hx: number, hy: number, dir: number, sway: number) {
  const tx = hx + 4 * dir;
  const ty = hy - 5;
  p.line(hx, hy, tx, ty, HD);
  p.set(tx, ty, WDH);
  const s = Math.round(sway);
  p.strand([[tx + dir, ty], [tx + 2 * dir, ty + 3], [tx + 3 * dir, ty + 6], [tx + 3 * dir + s, ty + 9]], TL, 2);
  p.set(tx + 3 * dir + s, ty + 10, TLS);
  p.set(tx + 2 * dir, ty + 4, TLS);
}

function drawWhiskIdle(p: PC, d: HeroDir, pose: Pose, behind: boolean) {
  const sw = Math.round(pose.swing * 0.7);
  if (d === 'n' || d === 'ne') {
    if (behind) whisk(p, d === 'n' ? 10 : 11, BODY_Y + 7 + sw, -1, -pose.sway);
  } else if (!behind) {
    if (d === 'e') whisk(p, 18 + Math.round(-1.2 * pose.swing), BODY_Y + 8, 1, pose.sway);
    else whisk(p, d === 's' ? 23 : 22, BODY_Y + 7 - sw, 1, pose.sway);
  }
}

/** 出招：拂尘朝目标方向一挥，k = 0 扬起、1 挥下、2 甩出、3 收回 */
function drawSwing(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [3, 6, 8, 5][k];
  const lift = [-6, -3, -1, 0][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, RB, 3);
  p.line(sx, sy + 2, hx, hy + 1, TRIM);
  p.set(hx, hy, SK);
  // 柄朝挥动方向转，尾巴落在后面拖出一道弧
  const ang = theta + ([-110, -45, 0, 25][k] * Math.PI) / 180;
  const lag = ([20, 70, 25, 10][k] * Math.PI) / 180;
  const tx = hx + 4 * Math.cos(ang);
  const ty = hy + 4 * Math.sin(ang);
  p.line(hx, hy, tx, ty, HD);
  const pts: [number, number][] = [[tx, ty]];
  for (let i = 1; i <= 3; i++) {
    const a = ang - (lag * i) / 3;
    const [px, py] = pts[i - 1];
    pts.push([px + 3 * Math.cos(a), py + 3 * Math.sin(a)]);
  }
  p.strand(pts, TL, 2);
  const [ex, ey] = pts[pts.length - 1];
  p.set(ex, ey, TLS);
  if (k === 2) {
    p.set(ex + 2 * Math.cos(ang), ey + 2 * Math.sin(ang), WHITE);
    p.set(ex + Math.cos(ang) - 1, ey - 2, WHITE);
    p.set(ex + Math.cos(ang) + 1, ey + 2, WHITE);
  }
}

/** 五颗光点绕身：椭圆轨道，下半圈在身前、上半圈在身后 */
function orbit(p: PC, phase: number, front: boolean) {
  for (let i = 0; i < 5; i++) {
    const a = ((phase + i * 72) * Math.PI) / 180;
    if (Math.sin(a) > 0 !== front) continue;
    const x = Math.round(16 + 13 * Math.cos(a) - 1);
    const y = Math.round(19 + 3 * Math.sin(a) - Math.cos(a * 2));
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
  drawHairBack(p, d);
  if (atk) drawSwing(p, d, pose.atk, true);
  else drawWhiskIdle(p, d, pose, true);
  drawRobe(p, d, pose);
  drawSleeves(p, d, pose, atk);
  drawHead(p, d);
  if (atk) drawSwing(p, d, pose.atk, false);
  else drawWhiskIdle(p, d, pose, false);
  orbit(p, pose.orbit, true);
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 9, 2.6, 0x000000, 70);
  return p;
}

export function buildHeroXuanyi(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    // 待机 8 帧、跑动 6 帧各转 72°，五颗光点等分，正好接上下一圈
    for (let f = 0; f < 8; f++) {
      const sway = Math.sin((f / 8) * Math.PI * 2) * 0.6;
      frames.push(drawHero(d, { run: false, f: 0, bob: f >= 4 ? 1 : 0, swing: 0, sway, orbit: f * 9, atk: -1 }));
    }
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { run: true, f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.4, sway: -Math.sin(phi) * 1.6, orbit: f * 12, atk: -1 }));
    }
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: false, f: 0, bob: 0, swing: 0, sway: 0, orbit: k * 18, atk: k }));
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: true, f: k + 1, bob: k % 2, swing: 0, sway: 0, orbit: k * 18, atk: k }));
  }
  addSheet(scene, 'hero_xuanyi', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * FRAMES_PER_DIR;
    addAnim(scene, `xuanyi_${d}_idle`, 'hero_xuanyi', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 8);
    addAnim(scene, `xuanyi_${d}_run`, 'hero_xuanyi', [8, 9, 10, 11, 12, 13].map((i) => b + i), 11);
    addAnim(scene, `xuanyi_${d}_atk`, 'hero_xuanyi', [14, 15, 16, 17].map((i) => b + i), 18, 0);
    addAnim(scene, `xuanyi_${d}_atkrun`, 'hero_xuanyi', [18, 19, 20, 21].map((i) => b + i), 18, 0);
  });
}
