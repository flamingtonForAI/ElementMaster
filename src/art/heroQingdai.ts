import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 药师·青黛。剪影和另三人拉开：宽檐斗笠压住头顶，帽檐一圈薄纱垂到下巴，整体是个钟形的头；
// 青绿交领长衫过膝，米白腰带，腰间挂葫芦；背上竹编药篓，篓口斜出几枝草药，高过帽檐。
// 帧布局与剑客相同。

const SK = 0xf3cba5, SKS = 0xd99f7f, BL = 0xec9a8e;
const HR = 0x1f2a24;
const GR = 0x3f9f72, GRS = 0x2e7a4a, GRH = 0x6fd39a, GRD = 0x24603c;
const BELT = 0xefe6cc, BELTS = 0xcfc4a6;
const IN = 0xf1ede2;
const PT = 0xd8cfb4, BT = 0x3b3448;
const HAT = 0xd8b866, HATS = 0xa8863e, HATH = 0xf0d68a, BAND = 0x2e7a4a;
const VEIL = 0xe6eee2, VEILS = 0xc4d0c0;
const BAM = 0xc9a24e, BAMS = 0x9a7a34, STRAP = 0x7a5a2a;
const LEAF = 0x5fcf7f, LEAFS = 0x2e8a4a, FLOWER = 0xf2e27a;
const GOU = 0xe0b04a, GOUS = 0xa87a2a, CORD = 0xc8372d;
const POUCH = 0x4fbf7a, POUCHS = 0x2e7a4a;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 薄纱摆动 */
  sway: number;
  atk: number;
}

const HEAD_Y = 12;
const BODY_Y = 17;

/** 长衫下露一截米色裤腿和布鞋 */
function drawLegs(p: PC, d: HeroDir, pose: Pose) {
  const phi = (pose.f / 6) * Math.PI * 2;
  const s = pose.run ? Math.sin(phi) : 0;
  const c = pose.run ? Math.cos(phi) : 0;
  const leg = (x: number, lift: number, shade: boolean) => {
    const bottom = 29 - lift;
    for (let y = 25; y <= bottom; y++) p.span(y, x, x + 2, y >= bottom ? BT : shade ? BELTS : PT);
  };
  if (d === 's' || d === 'n') {
    leg(13, Math.max(0, Math.round(2 * s)), false);
    leg(17, Math.max(0, Math.round(-2 * s)), false);
  } else if (d === 'e') {
    leg(15 - Math.round(2.5 * s), Math.max(0, Math.round(-1.5 * c)), true);
    leg(15 + Math.round(2.5 * s), Math.max(0, Math.round(1.5 * c)), false);
  } else {
    leg(13 + Math.round(1.2 * s), Math.max(0, Math.round(2 * s)), d === 'ne');
    leg(17 - Math.round(1.2 * s), Math.max(0, Math.round(-2 * s)), false);
  }
}

/** 交领长衫：比符师窄，下摆略收到膝下，深绿镶边 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 5, 5, 5, 5, 5, 5, 6, 6, 6];
  const cx = d === 'e' ? 15 : 16;
  const hem = pose.run ? Math.round(pose.swing * 0.5) : 0;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 7 ? hem : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, i === half.length - 1 ? GRD : GR);
    if (i < half.length - 1) {
      p.set(x0, y, GRH);
      p.set(x1, y, GRS);
    }
  }
  // 米白腰带，结垂在一侧
  const bw = d === 'e' ? 4 : 5;
  p.span(21, cx - bw, cx + bw - 1, BELT);
  p.span(22, cx - bw, cx + bw - 1, BELTS);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    // 白色交领，右衽，一道深绿门襟通到下摆
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.set(16 + o, BODY_Y, SK);
    p.line(16 + o, 23, 16 + o + hem, 25, GRD);
    p.set(14 + o, 23, BELT);
    p.set(14 + o, 24, BELTS);
  } else if (d === 'e') {
    p.line(16, BODY_Y, 17, BODY_Y + 2, IN);
    p.set(13, 23, BELT);
  }
}

/** 窄袖手臂，袖口米白 */
function drawArms(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    for (let i = 0; i < 6; i++) p.span(BODY_Y + 1 + i + dy, x, x + 1, i === 5 ? IN : i === 0 ? GRS : GR);
    p.span(BODY_Y + 7 + dy, x, x + 1, SK);
  };
  if (d === 's' || d === 'n') {
    arm(9, sw);
    if (!skipFront) arm(21, -sw);
  } else if (d === 'se' || d === 'ne') {
    arm(10, sw);
    if (!skipFront) arm(20, -sw);
  } else if (!skipFront) {
    const ax = 14 + Math.round(-1.2 * pose.swing);
    for (let i = 0; i < 6; i++) p.span(BODY_Y + 1 + i, ax, ax + 1, i === 5 ? IN : GR);
    p.set(ax + 1, BODY_Y + 1, GRS);
    p.span(BODY_Y + 7, ax, ax + 1, SK);
  }
}

/** 腰间葫芦，红绳系在腰带上 */
function drawGourd(p: PC, d: HeroDir) {
  const x = d === 's' ? 20 : d === 'se' ? 21 : d === 'e' ? 18 : -1;
  if (x < 0) return;
  p.set(x, 22, CORD);
  p.circle(x + 0.5, 23.5, 1, GOU);
  p.circle(x + 0.5, 25.8, 1.6, GOU);
  p.set(x + 1, 26, GOUS);
  p.set(x + 1, 25, GOUS);
  p.set(x, 25, 0xf4d27a);
}

/** 几枝草药：茎 + 叶，顶上一朵小黄花 */
function herbs(p: PC, x: number, y: number, lean: number) {
  p.line(x, y + 5, x + lean, y, LEAFS);
  p.set(x + lean, y - 1, FLOWER);
  p.set(x + lean - 1, y + 1, LEAF);
  p.set(x + lean + 1, y + 2, LEAF);
  p.line(x + 2, y + 6, x + 2 + lean, y + 2, LEAFS);
  p.set(x + 3 + lean, y + 2, LEAF);
  p.set(x + 1 + lean, y + 3, LEAF);
}

/** 竹篓：横向编纹，深浅交替 */
function basket(p: PC, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    p.span(y, x0, x1, (y - y0) % 2 ? BAMS : BAM);
    for (let x = x0 + ((y - y0) % 2); x <= x1; x += 3) p.set(x, y, (y - y0) % 2 ? BAM : BAMS);
  }
  p.span(y0, x0 - 1, x1 + 1, BAMS);
}

/** 背在身后的竹篓（正面、侧面时压在身体后面），篓口草药高过帽檐 */
function drawBasketBehind(p: PC, d: HeroDir) {
  if (d === 's') {
    herbs(p, 21, 2, 1);
    basket(p, 10, 14, 21, 23);
  } else if (d === 'se') {
    herbs(p, 6, 2, -1);
    basket(p, 8, 14, 12, 23);
  } else if (d === 'e') {
    herbs(p, 6, 2, -1);
    basket(p, 7, 14, 11, 24);
  }
}

/** 背面：竹篓压在背上，草药从帽檐和篓口之间露出来 */
function drawBasketOver(p: PC, d: HeroDir) {
  if (d === 'n') {
    basket(p, 12, 14, 19, 25);
    herbs(p, 13, 9, -1);
    herbs(p, 16, 8, 1);
  } else if (d === 'ne') {
    basket(p, 11, 14, 18, 25);
    herbs(p, 12, 9, -1);
    herbs(p, 15, 8, 1);
  }
}

/** 正面两条背带 */
function drawStraps(p: PC, d: HeroDir) {
  if (d === 's') {
    p.line(13, BODY_Y, 13, 20, STRAP);
    p.line(19, BODY_Y, 19, 20, STRAP);
  } else if (d === 'se') {
    p.line(14, BODY_Y, 14, 20, STRAP);
  } else if (d === 'e') {
    p.line(13, BODY_Y, 14, 20, STRAP);
  }
}

function drawHead(p: PC, d: HeroDir) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 5.5, 5.5, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.4, 4.6, 4.2, SK);
    p.span(Y - 2, 12, 19, HR);
    p.rect(14, Y + 1, 1, 2, EYE);
    p.rect(18, Y + 1, 1, 2, EYE);
    p.set(13, Y + 3, BL);
    p.set(19, Y + 3, BL);
    p.set(16, Y + 4, SKS);
  } else if (d === 'se') {
    p.ellipse(17.4, Y + 1.4, 4.2, 4.2, SK);
    p.span(Y - 2, 14, 21, HR);
    p.rect(16, Y + 1, 1, 2, EYE);
    p.rect(20, Y + 1, 1, 2, EYE);
    p.set(20, Y + 3, BL);
    p.set(18, Y + 4, SKS);
  } else if (d === 'e') {
    p.ellipse(19, Y + 1.4, 3.6, 4.2, SK);
    p.span(Y - 2, 17, 22, HR);
    p.rect(20, Y + 1, 1, 2, EYE);
    p.set(22, Y + 2, SK);
    p.set(20, Y + 3, BL);
  } else if (d === 'ne') {
    p.rect(20, Y, 2, 3, SK);
    p.set(20, Y + 2, SKS);
  }
}

/** 帽檐垂下的一圈薄纱：正面只挡两侧，背面整片；下沿是一排深浅相间的流苏 */
function drawVeil(p: PC, d: HeroDir, sway: number) {
  const bottom = 15 + (sway > 0 ? 1 : 0);
  const strip = (x0: number, x1: number) => {
    for (let y = 8; y <= bottom; y++) p.span(y, x0, x1, (y + x0) % 3 === 0 ? VEILS : VEIL);
    for (let x = x0; x <= x1; x += 2) p.set(x, bottom + 1, VEILS);
  };
  if (d === 's') {
    strip(7, 10);
    strip(21, 24);
  } else if (d === 'se') {
    strip(8, 12);
    strip(23, 24);
  } else if (d === 'e') {
    strip(8, 14);
    p.span(8, 23, 24, VEIL);
    p.set(24, 9, VEILS);
  } else {
    strip(7, 24);
  }
}

/** 宽檐斗笠：竹黄，帽顶尖，青绿帽带 */
function drawHat(p: PC, d: HeroDir) {
  const side = d === 'e';
  const x0 = side ? 7 : 6;
  const x1 = side ? 25 : 25;
  p.span(7, x0, x1, HAT);
  p.span(8, x0 + 1, x1 - 1, HATS);
  p.set(x0, 7, HATH);
  const cone: [number, number][] = [[1, 1], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9]];
  for (const [y, hw] of cone) {
    p.span(y, 16 - hw, 15 + hw, HAT);
    p.set(16 - hw, y, HATH);
    p.set(15 + hw, y, HATS);
  }
  p.span(6, 7, 24, BAND);
  // 编纹
  p.set(13, 4, HATS);
  p.set(18, 4, HATS);
  p.set(11, 5, HATS);
  p.set(20, 5, HATS);
}

function pouch(p: PC, x: number, y: number) {
  x = Math.round(x);
  y = Math.round(y);
  p.rect(x, y, 3, 3, POUCH);
  p.set(x + 2, y + 2, POUCHS);
  p.set(x + 1, y - 1, BELT);
  p.set(x, y - 1, POUCHS);
  p.set(x + 2, y - 1, POUCHS);
}

/** 出招：扬手朝目标抛药囊，k = 0 蓄势、1 前推、2 离手、3 收手 */
function drawThrow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [3, 7, 9, 6][k];
  const lift = [-7, -3, -1, 1][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, GR, 2);
  p.line(sx, sy + 1, hx, hy + 1, GRS);
  p.set(hx, hy, SK);
  if (k <= 1) pouch(p, hx - 1, hy - 4);
  else if (k === 2) {
    const tx = hx + 4 * Math.cos(theta);
    const ty = hy - 3 + 2 * Math.sin(theta);
    pouch(p, tx - 1, ty - 1);
    p.set(tx - 2, ty - 3, LEAF);
    p.set(tx + 2, ty - 2, LEAF);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const back = d === 'n' || d === 'ne';
  drawLegs(p, d, pose);
  p.oy = pose.bob;
  if (!back) drawBasketBehind(p, d);
  if (atk) drawThrow(p, d, pose.atk, true);
  drawRobe(p, d, pose);
  drawStraps(p, d);
  drawArms(p, d, pose, atk);
  drawGourd(p, d);
  drawHead(p, d);
  drawVeil(p, d, pose.sway);
  drawHat(p, d);
  if (back) drawBasketOver(p, d);
  if (atk) drawThrow(p, d, pose.atk, false);
  p.oy = 0;
  p.outline(OUTLINE);
  p.under(16, 29.5, 8, 2.6, 0x000000, 70);
  return p;
}

export function buildHeroQingdai(scene: Phaser.Scene) {
  const frames: PC[] = [];
  for (const d of HERO_DIRS) {
    for (let f = 0; f < 4; f++) frames.push(drawHero(d, { run: false, f: 0, bob: f >= 2 ? 1 : 0, swing: 0, sway: f >= 2 ? 1 : 0, atk: -1 }));
    for (let f = 0; f < 6; f++) {
      const phi = (f / 6) * Math.PI * 2;
      frames.push(drawHero(d, { run: true, f, bob: f % 3 === 1 ? 1 : 0, swing: Math.sin(phi) * 1.4, sway: f < 3 ? 1 : 0, atk: -1 }));
    }
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: false, f: 0, bob: 0, swing: 0, sway: 1, atk: k }));
    for (let k = 0; k < 4; k++) frames.push(drawHero(d, { run: true, f: k + 1, bob: k % 2, swing: 0, sway: 1, atk: k }));
  }
  addSheet(scene, 'hero_qingdai', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `qingdai_${d}_idle`, 'hero_qingdai', [b, b + 1, b + 2, b + 3], 4);
    addAnim(scene, `qingdai_${d}_run`, 'hero_qingdai', [4, 5, 6, 7, 8, 9].map((i) => b + i), 11);
    addAnim(scene, `qingdai_${d}_atk`, 'hero_qingdai', [10, 11, 12, 13].map((i) => b + i), 18, 0);
    addAnim(scene, `qingdai_${d}_atkrun`, 'hero_qingdai', [14, 15, 16, 17].map((i) => b + i), 18, 0);
  });
}
