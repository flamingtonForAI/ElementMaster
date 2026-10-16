import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { HERO_DIRS, HERO_FRAMES_PER_DIR, type HeroDir } from './heroXiao';

// 药师·青黛。剪影和另三人拉开：宽檐斗笠压住头顶，帽檐一圈薄纱垂到下巴，整体是个钟形的头；
// 青绿交领长衫过膝，米白腰带，腰间挂葫芦；背上竹编药篓，篓口斜出几枝草药，高过帽檐。

const SK = 0xf5cba4, SKS = 0xd4957a, BL = 0xf08c84;
const HR = 0x1c2b28;
const GR = 0x3da370, GRS = 0x267350, GRH = 0x7be098, GRD = 0x184738;
const BELT = 0xf5ecd2, BELTS = 0xc7bba0;
const IN = 0xede6d8, INH = 0xfff9eb;
const PT = 0xdccfba, BT = 0x332b42, BTH = 0x584c6e;
const HAT = 0xdebc64, HATS = 0xa68038, HATH = 0xf7df8c, BAND = 0x267350;
const VEIL = 0xebf5e8, VEILS = 0xbccfc0;
const BAM = 0xcfa44a, BAMS = 0x967030, STRAP = 0x785426;
const LEAF = 0x68d87b, LEAFS = 0x28824a, FLOWER = 0xffe875;
const GOU = 0xe6b446, GOUS = 0xa67426, CORD = 0xd1382e;
const POUCH = 0x52c778, POUCHS = 0x267350;
const EYE = 0x1c1424;

const FACING: Record<HeroDir, number> = { s: 90, se: 45, e: 0, ne: -45, n: -90 };

interface Pose {
  run: boolean;
  f: number;
  bob: number;
  swing: number;
  /** 薄纱与草药摆动相位 */
  wavePhase: number;
  blink: boolean;
  atk: number;
}

const HEAD_Y = 12;
const BODY_Y = 17;

/** 长衫下露一截屈膝迈步的米色裤腿、布鞋与踏步微尘 */
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
    const strideX = d === 'e' ? Math.round(2.8 * ps) : d === 'se' || d === 'ne' ? Math.round(1.5 * ps) : 0;
    const liftY = Math.max(0, Math.round(2.0 * pc));
    const kneeX = baseX + Math.round(strideX * 0.5) + (d === 'e' && liftY > 0 ? 1 : 0);
    const footX = baseX + strideX;
    const footY = 29 - liftY;
    p.line(baseX + 1, 25, kneeX + 1, 27 - Math.floor(liftY * 0.4), shade ? BELTS : PT, 2);
    p.span(footY, footX, footX + 2, BT);
    if (!shade) p.set(footX + 2, footY, BTH);
  };

  if (d === 'e') {
    leg(14, -s, -c, true);
    leg(15, s, c, false);
  } else {
    leg(13, s, c, d === 'ne' || (d === 'se' && s < 0));
    leg(17, -s, -c, false);
  }
}

/** 交领长衫：下摆随步伐与呼吸呈现微澜摆动 */
function drawRobe(p: PC, d: HeroDir, pose: Pose) {
  const k = d === 'e' ? 0.72 : d === 's' || d === 'n' ? 1 : 0.88;
  const half = [5, 5, 5, 5, 5, 5, 5, 6, 6, 6];
  const cx = d === 'e' ? 15 : 16;
  const wave1 = Math.sin(pose.wavePhase) * 1.1;
  for (let i = 0; i < half.length; i++) {
    const y = BODY_Y + i;
    const hw = Math.max(3, Math.round(half[i] * k));
    const sh = i >= 6 ? Math.round(Math.sin(pose.wavePhase - i * 0.3) * (pose.run ? 1.2 : 0.5)) : 0;
    const x0 = cx - hw + sh;
    const x1 = cx + hw - 1 + sh;
    p.span(y, x0, x1, i === half.length - 1 ? GRD : GR);
    if (i < half.length - 1) {
      p.set(x0, y, GRH);
      p.set(x1, y, GRD);
      if (hw > 3) p.set(x1 - 1, y, GRS);
    }
  }
  const bw = d === 'e' ? 4 : 5;
  p.span(21, cx - bw, cx + bw - 1, BELT);
  p.span(22, cx - bw, cx + bw - 1, BELTS);
  if (d === 's' || d === 'se') {
    const o = d === 's' ? 0 : 1;
    p.line(14 + o, BODY_Y, 16 + o, BODY_Y + 2, INH);
    p.line(18 + o, BODY_Y, 16 + o, BODY_Y + 2, IN);
    p.set(16 + o, BODY_Y, SK);
    p.line(16 + o, 23, 16 + o + Math.round(wave1 * 0.5), 25, GRD);
    p.set(14 + o, 23, BELT);
    p.line(14 + o, 24, 14 + o + Math.round(wave1 * 0.5), 25, BELTS);
  } else if (d === 'e') {
    p.line(16, BODY_Y, 17, BODY_Y + 2, INH);
    p.set(13, 23, BELT);
  }
}

/** 窄袖手臂，袖口米白带高光 */
function drawArms(p: PC, d: HeroDir, pose: Pose, skipFront: boolean) {
  const sw = Math.round(pose.swing);
  const arm = (x: number, dy: number) => {
    for (let i = 0; i < 6; i++) p.span(BODY_Y + 1 + i + dy, x, x + 1, i === 5 ? INH : i === 0 ? GRS : GR);
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
    for (let i = 0; i < 6; i++) p.span(BODY_Y + 1 + i, ax, ax + 1, i === 5 ? INH : GR);
    p.set(ax + 1, BODY_Y + 1, GRS);
    p.span(BODY_Y + 7, ax, ax + 1, SK);
  }
}

/** 腰间药葫芦，随步伐微晃 */
function drawGourd(p: PC, d: HeroDir, wavePhase: number) {
  const x = d === 's' ? 20 : d === 'se' ? 21 : d === 'e' ? 18 : -1;
  if (x < 0) return;
  const gsw = Math.round(Math.sin(wavePhase) * 0.4);
  p.set(x, 22, CORD);
  p.circle(x + 0.5 + gsw, 23.5, 1, GOU);
  p.circle(x + 0.5 + gsw, 25.8, 1.6, GOU);
  p.set(x + 1 + gsw, 26, GOUS);
  p.set(x + 1 + gsw, 25, GOUS);
  p.set(x + gsw, 25, 0xffe890);
}

/** 几枝草药：随风轻轻摇曳 */
function herbs(p: PC, x: number, y: number, lean: number, wavePhase: number) {
  const sw = Math.round(Math.sin(wavePhase) * 0.6);
  const ln = lean + sw;
  p.line(x, y + 5, x + ln, y, LEAFS);
  p.set(x + ln, y - 1, FLOWER);
  p.set(x + ln - 1, y + 1, LEAF);
  p.set(x + ln + 1, y + 2, LEAF);
  p.line(x + 2, y + 6, x + 2 + ln, y + 2, LEAFS);
  p.set(x + 3 + ln, y + 2, LEAF);
  p.set(x + 1 + ln, y + 3, LEAF);
}

function basket(p: PC, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    p.span(y, x0, x1, (y - y0) % 2 ? BAMS : BAM);
    for (let x = x0 + ((y - y0) % 2); x <= x1; x += 3) p.set(x, y, (y - y0) % 2 ? BAM : BAMS);
  }
  p.span(y0, x0 - 1, x1 + 1, BAMS);
}

function drawBasketBehind(p: PC, d: HeroDir, wavePhase: number) {
  if (d === 's') {
    herbs(p, 21, 2, 1, wavePhase);
    basket(p, 10, 14, 21, 23);
  } else if (d === 'se') {
    herbs(p, 6, 2, -1, wavePhase);
    basket(p, 8, 14, 12, 23);
  } else if (d === 'e') {
    herbs(p, 6, 2, -1, wavePhase);
    basket(p, 7, 14, 11, 24);
  }
}

function drawBasketOver(p: PC, d: HeroDir, wavePhase: number) {
  if (d === 'n') {
    basket(p, 12, 14, 19, 25);
    herbs(p, 13, 9, -1, wavePhase);
    herbs(p, 16, 8, 1, wavePhase);
  } else if (d === 'ne') {
    basket(p, 11, 14, 18, 25);
    herbs(p, 12, 9, -1, wavePhase);
    herbs(p, 15, 8, 1, wavePhase);
  }
}

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

function drawHead(p: PC, d: HeroDir, blink: boolean) {
  const Y = HEAD_Y;
  const hx = d === 'e' ? 16.5 : 16;
  p.ellipse(hx, Y, 5.5, 5.5, HR);
  if (d === 's') {
    p.ellipse(16, Y + 1.4, 4.6, 4.2, SK);
    p.span(Y - 2, 12, 19, HR);
    if (blink) {
      p.span(Y + 2, 13, 15, SKS);
      p.span(Y + 2, 17, 19, SKS);
    } else {
      p.rect(14, Y + 1, 1, 2, EYE);
      p.set(13, Y + 1, INH);
      p.rect(18, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, INH);
    }
    p.set(13, Y + 3, BL);
    p.set(19, Y + 3, BL);
    p.set(16, Y + 4, SKS);
  } else if (d === 'se') {
    p.ellipse(17.4, Y + 1.4, 4.2, 4.2, SK);
    p.span(Y - 2, 14, 21, HR);
    if (blink) {
      p.span(Y + 2, 15, 17, SKS);
      p.span(Y + 2, 19, 21, SKS);
    } else {
      p.rect(16, Y + 1, 1, 2, EYE);
      p.set(15, Y + 1, INH);
      p.rect(20, Y + 1, 1, 2, EYE);
    }
    p.set(20, Y + 3, BL);
    p.set(18, Y + 4, SKS);
  } else if (d === 'e') {
    p.ellipse(19, Y + 1.4, 3.6, 4.2, SK);
    p.span(Y - 2, 17, 22, HR);
    if (blink) p.span(Y + 2, 19, 21, SKS);
    else {
      p.rect(20, Y + 1, 1, 2, EYE);
      p.set(19, Y + 1, INH);
    }
    p.set(22, Y + 2, SK);
    p.set(20, Y + 3, BL);
  } else if (d === 'ne') {
    p.rect(20, Y, 2, 3, SK);
    p.set(20, Y + 2, SKS);
  }
}

/** 帽檐垂下的薄纱：带正弦微风波浪与流苏摆动 */
function drawVeil(p: PC, d: HeroDir, wavePhase: number) {
  const w1 = Math.sin(wavePhase);
  const bottom = 15 + (w1 > 0.3 ? 1 : 0);
  const sw = Math.round(w1 * 0.6);
  const strip = (x0: number, x1: number) => {
    for (let y = 8; y <= bottom; y++) {
      const shift = y >= 13 ? sw : 0;
      p.span(y, x0 + shift, x1 + shift, (y + x0) % 3 === 0 ? VEILS : VEIL);
    }
    for (let x = x0; x <= x1; x += 2) p.set(x + sw, bottom + 1, VEILS);
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

function drawHat(p: PC, d: HeroDir) {
  const side = d === 'e';
  const x0 = side ? 7 : 6;
  const x1 = 25;
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
  p.set(13, 4, HATS);
  p.set(18, 4, HATS);
  p.set(11, 5, HATS);
  p.set(20, 5, HATS);
}

function pouch(p: PC, x: number, y: number, glow = false) {
  x = Math.round(x);
  y = Math.round(y);
  if (glow) p.rect(x - 1, y - 1, 5, 5, 0x8ef7a8, 95);
  p.rect(x, y, 3, 3, POUCH);
  p.set(x + 2, y + 2, POUCHS);
  p.set(x + 1, y - 1, BELT);
  p.set(x, y - 1, POUCHS);
  p.set(x + 2, y - 1, POUCHS);
}

/** 出招 6 帧：扬手朝目标抛药囊，带翠绿药粉粒子与弧光 */
function drawThrow(p: PC, d: HeroDir, k: number, behind: boolean) {
  const theta = (FACING[d] * Math.PI) / 180;
  const isBehind = Math.sin(theta) < -0.2;
  if (isBehind !== behind) return;
  const reach = [2, 6, 9, 10, 7, 4][k];
  const lift = [-7, -4, -2, -1, 0, 1][k];
  const sx = 16 + 3 * Math.cos(theta);
  const sy = BODY_Y + 2;
  const hx = 16 + reach * Math.cos(theta);
  const hy = BODY_Y + 2 + lift + reach * 0.5 * Math.sin(theta);
  p.line(sx, sy, hx, hy, GR, 2);
  p.line(sx, sy + 1, hx, hy + 1, GRS);
  p.set(hx, hy, SK);
  if (k <= 1) pouch(p, hx - 1, hy - 4, k === 1);
  else if (k === 2 || k === 3) {
    const step = k === 2 ? 4 : 6;
    const tx = hx + step * Math.cos(theta);
    const ty = hy - 3 + 2 * Math.sin(theta);
    pouch(p, tx - 1, ty - 1, true);
    p.set(tx - 2, ty - 3, LEAF);
    p.set(tx + 2, ty - 2, LEAF);
    p.set(tx, ty - 3, FLOWER);
  }
}

function drawHero(d: HeroDir, pose: Pose): PC {
  const p = new PC(32, 32);
  const atk = pose.atk >= 0;
  const back = d === 'n' || d === 'ne';
  drawLegs(p, d, pose);
  p.oy = pose.bob;
  if (!back) drawBasketBehind(p, d, pose.wavePhase);
  if (atk) drawThrow(p, d, pose.atk, true);
  drawRobe(p, d, pose);
  drawStraps(p, d);
  drawArms(p, d, pose, atk);
  drawGourd(p, d, pose.wavePhase);
  drawHead(p, d, pose.blink);
  drawVeil(p, d, pose.wavePhase);
  drawHat(p, d);
  if (back) drawBasketOver(p, d, pose.wavePhase);
  if (atk) drawThrow(p, d, pose.atk, false);
  p.oy = 0;
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(17, 29.5, 8.5, 2.7, 0x12222b, 85);
  return p;
}

export function buildHeroQingdai(scene: Phaser.Scene) {
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
          swing: Math.sin(phi) * 1.5,
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
  addSheet(scene, 'hero_qingdai', frames);
  HERO_DIRS.forEach((d, di) => {
    const b = di * HERO_FRAMES_PER_DIR;
    addAnim(scene, `qingdai_${d}_idle`, 'hero_qingdai', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => b + i), 6);
    addAnim(scene, `qingdai_${d}_run`, 'hero_qingdai', [8, 9, 10, 11, 12, 13, 14, 15].map((i) => b + i), 12);
    addAnim(scene, `qingdai_${d}_atk`, 'hero_qingdai', [16, 17, 18, 19, 20, 21].map((i) => b + i), 24, 0);
    addAnim(scene, `qingdai_${d}_atkrun`, 'hero_qingdai', [22, 23, 24, 25, 26, 27].map((i) => b + i), 24, 0);
  });
}
