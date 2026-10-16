import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { HERO_DIRS, type HeroDir } from './heroXiao';

// 傀儡师·墨衡：清瘦的匠人，比剑客矮 1 像素。黑方巾垂两条巾脚，土黄窄袖长袍外罩皮围裙，
// 腰侧挂工具袋；右手一直提着十字提线木架，几根细线垂下来——这是剪影标志。
// 动画名与剑客相同：待机 4、跑动 6、出招 4、跑动出招 4，每方向 18 帧。

const SK = 0xf0c8a2, SKS = 0xd29a7a;
const HR = 0x2a2230;
const CAP = 0x24202e, CAPH = 0x4a4258, CAPB = 0x6a4a2c;
const RB = 0xc9963e, RBS = 0x9a6e2a, RBH = 0xe2b45a, RBD = 0x7a5420;
const AP = 0x7a4a2c, APS = 0x5a341e, APH = 0x96603a;
const BELT = 0x3a2618, BUCK = 0xd8b060;
const POUCH = 0x6a4a30, POUS = 0x4a3220;
const PT = 0x5a4232, BT = 0x2e2430;
const WD = 0xa8743e, WDS = 0x7a5028, WDH = 0xd09a5a;
const STR = 0xe8dcc0, GLOW = 0xffe9a0;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 提线垂下的摆动 */
  sway: number;
  atk: number;
}

const FRAMES_PER_DIR = 18;
const HEAD_Y = 12;
const BODY_Y = 18;

function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const s = pose.run ? Math.sin((pose.f / 6) * Math.PI * 2) : 0;
  const leg = (x: number, lift: number) => {
    const bottom = 29 - lift;
    for (let y = 26; y <= bottom; y++) p.span(y, x, x + 1, y >= bottom ? BT : PT);
  };
  if (d === 'e') {
    leg(15 + Math.round(2 * s), Math.max(0, Math.round(s)));
    leg(15 - Math.round(2 * s), Math.max(0, Math.round(-s)));
  } else {
    leg(13, Math.max(0, Math.round(1.6 * s)));
    leg(17, Math.max(0, Math.round(-1.6 * s)));
  }
}

/** 窄身长袍到小腿，正面罩一件皮围裙 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.75 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [4, 4, 4, 4, 4, 5, 5, 5, 5];
  const cx = d === 'e' ? 15 : 16;
  const hem = pose.run ? Math.round(pose.swing * 0.5) : 0;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 6 ? hem : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, RB);
    p.set(x0, y, RBH);
    p.set(x1, y, RBS);
    if (i === half.length - 1) p.span(y, x0, x1, RBD);
  }
  if (d === 'n') {
    // 背面：围裙的系带打个结
    p.span(BODY_Y + 3, cx - 4, cx + 3, BELT);
    p.rect(cx - 1, BODY_Y + 4, 2, 2, APS);
    return;
  }
  // 交领
  if (d === 's' || d === 'se') {
    const o = d === 'se' ? 1 : 0;
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, RBD);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, RBD);
    p.set(16 + o, BODY_Y, SK);
  }
  // 皮围裙：从胸口垂到袍摆
  const ax = d === 'e' ? cx : cx + (d === 'se' ? 1 : 0);
  const aw = d === 'e' ? 2 : 3;
  for (let y = BODY_Y + 2; y <= BODY_Y + 8; y++) {
    const w = y < BODY_Y + 4 ? aw - 1 : aw;
    p.span(y, ax - w, ax + w - 1, AP);
    p.set(ax + w - 1, y, APS);
    if (y === BODY_Y + 8) p.span(y, ax - w, ax + w - 1, APS);
  }
  p.set(ax - aw + 1, BODY_Y + 5, APH);
  // 腰带 + 铜扣
  p.span(BODY_Y + 3, cx - Math.round(4 * k), cx + Math.round(4 * k) - 1, BELT);
  if (d !== 'e') p.set(ax, BODY_Y + 3, BUCK);
  // 工具袋挂在左腰
  if (d === 's' || d === 'se') {
    const px = d === 's' ? 11 : 12;
    p.rect(px, BODY_Y + 4, 3, 3, POUCH);
    p.span(BODY_Y + 4, px, px + 2, POUS);
    p.set(px + 1, BODY_Y + 3, 0xbfc9d2);
  } else if (d === 'e') {
    p.rect(12, BODY_Y + 4, 2, 3, POUCH);
  }
}

/** 左臂自然下垂；右臂前伸提着木架（出招时由 drawRig 负责） */
function drawArms(p: PC, d: HeroDir, pose: Pose) {
  const sw = Math.round(pose.swing);
  if (d === 'e') {
    p.rect(14 - sw, BODY_Y + 1, 2, 5, RBS);
    return;
  }
  const lx = d === 's' || d === 'n' ? 11 : 12;
  p.rect(lx, BODY_Y + 1 + sw, 1, 5, RB);
  p.set(lx, BODY_Y + 1 + sw, RBS);
  p.set(lx, BODY_Y + 6 + sw, SK);
}

function drawHead(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y + 0.5, 5, 4.5, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.2, 4.2, 4, SK);
    p.rect(13, Y + 1, 1, 2, EYE);
    p.rect(18, Y + 1, 1, 2, EYE);
    p.span(Y + 4, 15, 16, SKS);
  } else if (d === 'se') {
    p.ellipse(17.2, Y + 1.2, 3.8, 4, SK);
    p.rect(16, Y + 1, 1, 2, EYE);
    p.rect(19, Y + 1, 1, 2, EYE);
    p.set(17, Y + 4, SKS);
  } else if (d === 'e') {
    p.ellipse(18.4, Y + 1.2, 3.2, 4, SK);
    p.rect(19, Y + 1, 1, 2, EYE);
    p.set(21, Y + 2, SK);
  } else if (d === 'ne') {
    p.rect(19, Y, 2, 4, SK);
    p.set(19, Y + 3, SKS);
  }
  drawCap(p, d);
}

/** 黑方巾：比头窄的高方帽，帽口一圈褐边，后面垂两条巾脚 */
function drawCap(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  const cx = d === 'e' ? 17 : d === 'se' ? 17 : 16;
  p.rect(cx - 4, Y - 9, 8, 6, CAP);
  p.span(Y - 9, cx - 4, cx + 3, CAPH);
  p.set(cx + 3, Y - 8, CAPH);
  p.span(Y - 4, cx - 5, cx + 4, CAPB);
  if (d === 'e' || d === 'se') {
    p.strand([[cx - 5, Y - 4], [cx - 7, Y], [cx - 7, Y + 3]], CAP, 2);
  } else if (d === 'n' || d === 'ne') {
    p.strand([[cx - 2, Y - 3], [cx - 3, Y + 4]], CAP, 2);
    p.strand([[cx + 1, Y - 3], [cx + 2, Y + 4]], CAP, 2);
  }
}

/** 十字木架：一横一竖，横杆两端和竖杆底端各垂一根线 */
function cross(p: PC, x: number, y: number, tilt: number) {
  x = Math.round(x);
  y = Math.round(y);
  p.line(x - 3, y - tilt, x + 3, y + tilt, WD);
  p.set(x + 3, y + tilt, WDS);
  p.line(x, y - 2, x, y + 2, WDS);
  p.set(x, y - 2, WDH);
}

function strings(p: PC, x: number, y: number, tilt: number, sway: number, col: number, len: number) {
  x = Math.round(x);
  y = Math.round(y);
  const ends: [number, number][] = [[x - 3, y - tilt], [x + 3, y + tilt], [x, y + 2]];
  for (const [sx, sy] of ends) p.line(sx, sy + 1, sx + sway, sy + len, col);
}

/** 平时：右手提着木架，线自然垂下随步伐晃；出招：木架朝目标一扬，线绷直发光 */
function drawRig(p: PC, d: HeroDir, pose: Pose) {
  const theta = (FACING[d] * Math.PI) / 180;
  if (pose.atk < 0) {
    const hx = d === 'e' ? 21 : d === 'n' ? 21 : 22;
    const hy = BODY_Y + 2 + Math.round(pose.swing * 0.5);
    // 手臂
    p.line(hx - 3, BODY_Y + 1, hx - 1, hy, RB, 2);
    p.set(hx, hy, SK);
    const tx = hx + 1;
    const ty = hy - 2;
    strings(p, tx, ty, 0, Math.round(pose.sway), STR, 8);
    cross(p, tx, ty, 0);
    return;
  }
  const k = pose.atk;
  const reach = [3, 7, 9, 6][k];
  const lift = [-5, -7, -4, -2][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 1;
  // 木架偏到身侧，正面出招时不挡脸
  const side = d === 's' || d === 'n' ? 6 : d === 'e' ? 2 : 3;
  const hx = 16 + side + reach * Math.cos(theta);
  const hy = Math.max(d === 'n' || d === 'ne' ? 0 : HEAD_Y + 4, BODY_Y + lift + reach * 0.4 * Math.sin(theta));
  p.line(sx + 2, sy, hx, hy, RB, 2);
  p.set(hx, hy, SK);
  const tilt = k === 1 || k === 2 ? (Math.cos(theta) >= 0 ? -1 : 1) : 0;
  const len = [7, 9, 11, 8][k];
  // 出招中间两帧线绷直、朝目标方向发光
  const taut = k === 1 || k === 2;
  const sway = taut ? Math.round(5 * Math.cos(theta)) : 0;
  strings(p, hx + 1, hy - 2, tilt, sway, taut ? GLOW : STR, len);
  cross(p, hx + 1, hy - 2, tilt);
  if (k === 2) {
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
  // 背对时木架在身前、被身体挡住一部分
  if (back) drawRig(p, d, pose);
  drawRobe(p, d, pose);
  drawArms(p, d, pose);
  drawHead(p, d);
  if (!back) drawRig(p, d, pose);
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 8, 2.4, 0x000000, 70);
  return p;
}

export function buildHeroMoheng(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    for (let f = 0; f < 4; f++) frames.push(drawHero(d, { run: false, f: 0, bob: f >= 2 ? 1 : 0, swing: 0, sway: [0, 1, 0, -1][f], atk: -1 }));
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { run: true, f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.2, sway: Math.round(-Math.sin(phi) * 1.5), atk: -1 }));
    }
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: false, f: 0, bob: 0, swing: 0, sway: 0, atk: k }));
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: true, f: k + 1, bob: k % 2, swing: 0, sway: 0, atk: k }));
  }
  addSheet(scene, 'hero_moheng', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * FRAMES_PER_DIR;
    addAnim(scene, `moheng_${d}_idle`, 'hero_moheng', [0, 1, 2, 3].map((i) => b + i), 4);
    addAnim(scene, `moheng_${d}_run`, 'hero_moheng', [4, 5, 6, 7, 8, 9].map((i) => b + i), 11);
    addAnim(scene, `moheng_${d}_atk`, 'hero_moheng', [10, 11, 12, 13].map((i) => b + i), 18, 0);
    addAnim(scene, `moheng_${d}_atkrun`, 'hero_moheng', [14, 15, 16, 17].map((i) => b + i), 18, 0);
  });
}
