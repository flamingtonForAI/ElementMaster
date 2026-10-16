import Phaser from 'phaser';
import { PC, addSheet } from './painter';
import { EL_INFO } from '../config/elements';

// 选角详情用的半身肖像：44×56，界面里放大 2 倍。正面与四分之三侧脸交错（光从左上来），配色沿用各角色贴图。
// 每人一个一眼能认的标志：剑客背剑红穗、符师朱砂痣与黄符、海贼头巾刀疤、药师斗笠撩纱、傀儡师提线木架、散人长须拂尘。

export const PORTRAIT_W = 44;
export const PORTRAIT_H = 56;
const CX = 22;

const EYE = 0x1c1424;
const OUT_T = 0x2a2234;
const OUT_B = 0x150f1c;
const WHITE = 0xf4f0f4;

interface Skin {
  sk: number;
  sks: number;
  skh: number;
  bl: number;
  lip: number;
}

const FAIR: Skin = { sk: 0xf5cba4, sks: 0xd4957a, skh: 0xffe4c4, bl: 0xf08c84, lip: 0xb85a58 };

/** 脸型每行的半宽，从 y=12 起；下巴收尖 */
const FACE = [6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 7, 6, 6, 5, 4, 3];
const FACE_Y = 12;

function row(p: PC, y: number, hw: number, col: number) {
  p.span(y, CX - hw, CX - 1 + hw, col);
}

/** 脸、耳、脖子；slim 让脸再窄一点 */
function face(p: PC, s: Skin, slim = 0) {
  // 脖子
  p.rect(CX - 3, 30, 6, 6, s.sk);
  p.rect(CX + 1, 30, 2, 6, s.sks);
  p.span(31, CX - 3, CX + 2, s.sks);
  FACE.forEach((hw0, i) => {
    const hw = Math.max(2, hw0 - (i > 9 ? slim : 0));
    const y = FACE_Y + i;
    row(p, y, hw, s.sk);
    // 右侧背光
    p.span(y, CX + hw - 2, CX - 1 + hw, s.sks);
  });
  // 下颌阴影
  p.span(FACE_Y + 17, CX - 2, CX + 2, s.sks);
  // 左颊受光
  for (let y = 19; y <= 23; y++) p.set(CX - 7 + (y > 22 ? 1 : 0), y, s.skh);
  // 耳朵
  p.rect(CX - 9, 19, 1, 4, s.sk);
  p.set(CX - 9, 22, s.sks);
  p.rect(CX + 8, 19, 1, 4, s.sks);
  // 鼻子
  p.set(CX, 24, s.skh);
  p.set(CX, 25, s.sks);
  p.set(CX + 1, 25, s.sks);
}

/** 四分之三侧脸：远眼收窄、鼻尖越过脸缘，下颌向朝向偏移。 */
function turnedFace(p: PC, s: Skin, direction: -1 | 1, iris: number, thoughtful = false) {
  const x = (u: number) => CX + direction * u;
  const span = (y: number, a: number, b: number, col: number) =>
    p.span(y, Math.min(x(a), x(b)), Math.max(x(a), x(b)), col);
  p.rect(CX - 3, 29, 6, 7, s.sks);
  p.rect(CX - 2, 31, 3, 4, s.sk);
  for (let y = 12; y <= 30; y++) {
    const back = y < 24 ? -7 : -7 + Math.floor((y - 23) * 0.9);
    const front = y < 18 ? 5 : y < 24 ? 6 : 6 - Math.floor((y - 23) * 0.55);
    span(y, back, front, s.sk);
    span(y, back, back + 2, s.sks);
  }
  // 鼻梁与鼻尖形成侧脸轮廓，远侧眼比近侧眼短。
  span(23, 5, 8, s.sk);
  span(24, 6, 8, s.skh);
  span(25, 5, 7, s.sks);
  p.rect(x(-7), 20, 2, 4, s.sks);
  span(20, -4, 0, EYE);
  span(21, -4, 0, WHITE);
  p.set(x(-1), 21, EYE);
  p.set(x(-1), 22, iris);
  span(22, -4, -2, s.skh);
  span(20, 4, 5, EYE);
  p.set(x(5), 21, iris);
  span(18, -4, -2, EYE);
  p.set(x(-1), thoughtful ? 18 : 19, EYE);
  span(18, 4, 5, EYE);
  span(27, 3, 5, s.lip);
  if (thoughtful) p.set(x(2), 28, s.sks);
  span(29, 0, 3, s.sks);
}

type EyeStyle = 'sharp' | 'soft' | 'narrow' | 'old' | 'bold';

/** 一对眼睛：iris 虹膜色、hi 高光 */
function eyes(p: PC, style: EyeStyle, iris: number, irisD: number, y = 21) {
  for (const side of [-1, 1]) {
    // 内眼角 x0，往外延伸
    const x0 = side < 0 ? CX - 3 : CX + 2;
    const o = (k: number) => x0 + side * k;
    if (style === 'old') {
      // 眯眼：一道弯线加眼尾纹
      p.set(o(0), y + 1, EYE);
      p.set(o(1), y + 1, EYE);
      p.set(o(2), y + 1, EYE);
      p.set(o(3), y, EYE);
      p.set(o(4), y + 2, 0xc89478);
      continue;
    }
    if (style === 'narrow') {
      p.set(o(0), y + 1, EYE);
      p.set(o(1), y + 1, irisD);
      p.set(o(2), y + 1, iris);
      p.set(o(3), y + 1, EYE);
      p.set(o(4), y, EYE);
      p.set(o(1), y, EYE);
      p.set(o(2), y, EYE);
      p.set(o(3), y, EYE);
      continue;
    }
    // 上眼线：剑眼、浓眼外眼角上挑
    for (let k = 0; k <= 3; k++) p.set(o(k), y, EYE);
    p.set(o(4), style === 'soft' ? y + 1 : y - 1, EYE);
    // 两行虹膜：上行深（瞳孔），下行浅；内眼角一点眼白
    p.set(o(0), y + 1, WHITE);
    p.set(o(1), y + 1, irisD);
    p.set(o(2), y + 1, irisD);
    p.set(o(3), y + 1, style === 'soft' ? irisD : EYE);
    p.set(o(1), y + 2, iris);
    p.set(o(2), y + 2, iris);
    p.set(o(3), y + 2, WHITE);
    // 高光点在瞳孔靠光源一侧
    p.set(side < 0 ? o(2) : o(1), y + 1, 0xffffff);
    if (style === 'sharp') {
      // 下眼睑一道浅线收住眼形
      p.set(o(1), y + 3, 0xc8907a);
      p.set(o(2), y + 3, 0xc8907a);
    }
    if (style === 'soft') p.set(o(4), y + 2, EYE);
  }
}

/** 眉毛：sharp 剑眉斜飞，soft 细弯，thick 浓粗，long 长寿眉下垂 */
function brows(p: PC, style: 'sharp' | 'soft' | 'thick' | 'long', col: number, y = 18) {
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? CX - 2 : CX + 1;
    const o = (k: number) => x0 + side * k;
    if (style === 'sharp') {
      p.set(o(0), y + 1, col);
      p.set(o(1), y, col);
      p.set(o(2), y, col);
      p.set(o(3), y - 1, col);
      p.set(o(4), y - 1, col);
    } else if (style === 'soft') {
      p.set(o(1), y, col);
      p.set(o(2), y, col);
      p.set(o(3), y, col);
      p.set(o(4), y + 1, col);
    } else if (style === 'thick') {
      for (let k = 0; k <= 4; k++) p.set(o(k), y, col);
      p.set(o(1), y - 1, col);
      p.set(o(2), y - 1, col);
      p.set(o(3), y - 1, col);
    } else {
      for (let k = 0; k <= 3; k++) p.set(o(k), y, col);
      p.set(o(4), y + 1, col);
      p.set(o(5), y + 2, col);
      p.set(o(5), y + 3, col);
    }
  }
}

function mouth(p: PC, s: Skin, style: 'flat' | 'smile' | 'grin' | 'small') {
  const y = 27;
  if (style === 'flat') {
    p.span(y, CX - 1, CX + 1, s.lip);
  } else if (style === 'small') {
    p.span(y, CX - 1, CX, s.lip);
    p.set(CX - 1, y + 1, s.sks);
  } else if (style === 'smile') {
    p.set(CX - 2, y - 1, s.lip);
    p.span(y, CX - 1, CX + 1, s.lip);
    p.set(CX + 2, y - 1, s.lip);
  } else {
    // 咧嘴笑露牙，一边嘴角挑高
    p.set(CX - 3, y - 1, EYE);
    p.span(y, CX - 2, CX + 2, EYE);
    p.span(y, CX - 1, CX + 1, WHITE);
    p.set(CX + 3, y - 2, EYE);
    p.set(CX + 2, y - 1, EYE);
  }
}

function blush(p: PC, s: Skin) {
  p.set(CX - 6, 25, s.bl, 170);
  p.set(CX - 5, 25, s.bl, 170);
  p.set(CX + 4, 25, s.bl, 170);
  p.set(CX + 5, 25, s.bl, 170);
}

/** 肩膀轮廓：每行半宽（从 y=33 起），画到画布底 */
function shoulderHW(y: number): number {
  if (y < 33) return 0;
  const t = y - 33;
  return Math.min(21, Math.round(7 + t * 2.4 - t * t * 0.08));
}

/** 交领右衽袍：领口一个 V 露出里衬，左襟的镶边从 V 底斜向画面左下；c 外袍，cs 暗部，ch 高光，lin 里衬，trim 镶边 */
function robe(p: PC, c: { c: number; cs: number; ch: number; lin: number; trim: number; trimH?: number }) {
  for (let y = 33; y < PORTRAIT_H; y++) {
    const hw = shoulderHW(y);
    row(p, y, hw, c.c);
    // 右侧背光、左肩受光
    p.span(y, CX + hw - 4, CX - 1 + hw, c.cs);
    if (y < 40) p.span(y, CX - hw + 1, CX - hw + 3, c.ch);
  }
  // 领口 V：两边从脖子两侧收到胸口
  const vy = 43;
  for (let y = 33; y <= vy; y++) {
    const k = (y - 33) / (vy - 33);
    const l = Math.round(CX - 5 + k * 6);
    const r = Math.round(CX + 4 - k * 3);
    if (r - l > 1) p.span(y, l + 1, r - 1, c.lin);
    p.set(l, y, c.trim);
    p.set(l - 1, y, c.trimH ?? c.trim);
    p.set(r, y, c.trim);
  }
  // 左襟压右襟：镶边从 V 底斜到画面左下
  for (let y = vy; y < PORTRAIT_H; y++) {
    const x = Math.round(CX + 1 - (y - vy) * 0.7);
    p.set(x, y, c.trim);
    p.set(x - 1, y, c.trimH ?? c.trim);
    p.set(x + 1, y, c.cs);
  }
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/** 角色立在暗色底上：上方带一点元素色，往下分四档变深；头后一团柔光 */
function backdrop(el: number, glow: number): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const base = 0x120e18;
  const tones = [mix(base, el, 0.42), mix(base, el, 0.28), mix(base, el, 0.16), mix(base, el, 0.07)];
  const band = PORTRAIT_H / tones.length;
  for (let y = 0; y < PORTRAIT_H; y++) {
    const i = Math.min(tones.length - 1, Math.floor(y / band));
    for (let x = 0; x < PORTRAIT_W; x++) p.set(x, y, tones[i]);
  }
  for (let y = 0; y < PORTRAIT_H; y++)
    for (let x = 0; x < PORTRAIT_W; x++) {
      const d = Math.hypot(x + 0.5 - CX, (y + 0.5 - 19) * 1.1);
      if (d < 17) p.set(x, y, glow, d < 13 ? 34 : 18);
    }
  return p;
}

/** 把人物叠到底图上（人物先描边） */
function compose(bg: PC, fig: PC): PC {
  fig.selectiveOutline(OUT_T, OUT_B);
  for (let i = 0; i < fig.c.length; i++) if (fig.c[i] !== -1) bg.set(i % fig.w, Math.floor(i / fig.w), fig.c[i], fig.a[i] || 255);
  return bg;
}

// ---------- 剑客·萧寒锋 ----------

function xiao(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const HR = 0x262133, HRH = 0x62587d;
  const RB = 0xede6d8, RBH = 0xfff9eb, RBS = 0xb8b2c8;
  const AR = 0xb8c8d8, ARS = 0x6e7f99, ARH = 0xf2f8ff;
  const SA = 0x2b4570, SAH = 0x5682c4;
  const GD = 0xe3ac3e, GDH = 0xffe680;
  const TS = 0xc8372d, TSD = 0x8e2a20;
  // 背后的剑：剑柄从右肩后斜出，金色护手，红穗垂下
  p.line(33, 4, 28, 14, SA, 3);
  p.line(33, 4, 30, 9, SAH, 1);
  p.rect(26, 13, 6, 2, GD);
  p.span(13, 26, 28, GDH);
  p.set(34, 3, GD);
  p.strand([[34, 4], [37, 9], [36, 14], [38, 19]], TS, 2);
  p.strand([[35, 5], [38, 10]], TSD, 1);
  // 马尾：从头顶后面甩向左后方
  p.strand([[19, 6], [13, 7], [9, 11], [7, 17], [6, 23], [8, 29]], HR, 3);
  p.strand([[13, 7], [10, 10], [8, 15]], HRH, 1);
  p.strand([[6, 24], [5, 28]], HR, 2);
  robe(p, { c: RB, cs: RBS, ch: RBH, lin: 0x433d56, trim: SA, trimH: SAH });
  // 左肩银甲（画面左）
  for (let y = 35; y < 44; y++) {
    const w = 9 - Math.abs(y - 38);
    p.span(y, 2, 2 + w + 2, AR);
    p.set(3 + w, y, ARS);
  }
  p.span(35, 4, 9, ARH);
  p.span(38, 3, 10, ARS);
  p.span(41, 3, 8, ARS);
  // 斜挎剑带
  p.line(30, 34, 14, 55, 0x70442e, 2);
  p.line(31, 34, 15, 55, 0x9a6a46, 1);
  turnedFace(p, FAIR, -1, 0x9ab0d0);
  // 后侧鬓发更厚，露出朝左的鼻尖和下颌。
  p.strand([[29, 16], [30, 23], [28, 29]], HR, 3);
  // 头发：额前碎刘海，两鬓长发垂到下颌
  for (let y = 7; y <= 14; y++) row(p, y, Math.min(9, 4 + y - 7), HR);
  p.span(15, CX - 9, CX - 4, HR);
  p.span(15, CX + 2, CX + 8, HR);
  p.span(16, CX - 9, CX - 6, HR);
  p.span(16, CX + 5, CX + 8, HR);
  p.strand([[CX - 1, 13], [CX - 3, 18]], HR, 2);
  p.strand([[CX + 2, 14], [CX + 4, 18]], HR, 1);
  p.strand([[CX - 9, 15], [CX - 9, 27]], HR, 2);
  p.strand([[CX + 8, 15], [CX + 8, 27]], HR, 2);
  p.span(9, CX - 4, CX + 1, HRH);
  p.span(10, CX - 6, CX - 3, HRH);
  // 白色发带束在头顶，带尾飘向右
  p.rect(CX - 3, 5, 6, 3, RB);
  p.span(5, CX - 2, CX + 2, RBH);
  p.set(CX + 2, 7, RBS);
  p.strand([[CX + 3, 6], [CX + 8, 4], [CX + 12, 6]], RB, 1);
  return compose(backdrop(EL_INFO.metal.dark, EL_INFO.metal.color), p);
}

// ---------- 符师·朱砂 ----------

function zhu(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const HR = 0x20192b, HRH = 0x564873;
  const RB = 0xd1382e, RBS = 0x99202c, RBH = 0xf76d47;
  const TRIM = 0x29121e;
  const IN = 0xede6d8;
  const GD = 0xe3ac3e, GDH = 0xffe680, GDS = 0xa37024;
  const PAPER = 0xf7d969, PAPS = 0xc99c38, INK = 0xd1382e;
  // 长发披到肩后
  for (let y = 12; y < 46; y++) {
    const hw = y < 20 ? 10 : 11 - Math.floor((y - 20) / 8);
    row(p, y, hw, HR);
  }
  p.strand([[CX - 10, 16], [CX - 11, 30], [CX - 10, 42]], HRH, 1);
  robe(p, { c: RB, cs: RBS, ch: RBH, lin: IN, trim: TRIM, trimH: GD });
  // 金线沿领口
  for (let y = 34; y < 44; y++) p.set(CX + 3 - Math.floor((y - 33) * 0.9) + 1, y, GD);
  face(p, FAIR, 1);
  eyes(p, 'soft', 0xd08a3a, 0x7a3a1e);
  brows(p, 'soft', HR);
  // 单侧挑眉和轻扬嘴角：带一点自信、狡黠。
  p.span(18, 24, 28, FAIR.sk);
  p.span(17, 25, 28, HR);
  p.span(27, 21, 24, INK);
  p.set(25, 26, INK);
  blush(p, FAIR);
  // 朱砂痣
  p.set(CX - 1, 18, INK);
  p.set(CX, 18, INK);
  // 额发中分，两缕鬓发垂过肩
  for (let y = 9; y <= 14; y++) row(p, y, Math.min(9, 5 + y - 9), HR);
  p.span(15, CX - 9, CX - 5, HR);
  p.span(15, CX + 4, CX + 8, HR);
  p.set(CX - 1, 14, FAIR.sk);
  p.set(CX, 14, FAIR.sk);
  p.span(15, CX - 2, CX + 1, FAIR.sk);
  p.strand([[CX - 8, 15], [CX - 9, 24], [CX - 8, 36]], HR, 2);
  p.strand([[CX + 7, 15], [CX + 8, 24], [CX + 7, 36]], HR, 2);
  p.span(10, CX - 5, CX - 1, HRH);
  // 高道冠：上宽下窄的金边黑冠，冠前一片金叶，顶上朱红珠
  for (let y = 1; y <= 9; y++) row(p, y, 3 + Math.floor((9 - y) / 3), HR);
  p.span(9, CX - 4, CX + 3, GD);
  p.span(8, CX - 3, CX + 2, GDS);
  p.span(1, CX - 5, CX + 4, GD);
  p.span(2, CX - 4, CX - 2, HRH);
  p.rect(CX - 1, 4, 2, 3, GD);
  p.set(CX - 1, 4, GDH);
  p.circle(CX, 0, 1.2, RB);
  // 长簪横穿冠底，左端垂一串红流苏
  p.span(6, CX - 9, CX + 8, GD);
  p.span(6, CX - 9, CX - 7, GDH);
  p.strand([[CX - 9, 7], [CX - 10, 10]], RB, 1);
  p.rect(CX - 11, 10, 2, 2, RB);
  p.set(CX - 11, 10, RBH);
  // 右手两指夹一张黄符，抬到脸侧
  p.rect(32, 13, 6, 12, PAPER);
  p.rect(37, 13, 1, 12, PAPS);
  p.span(13, 32, 37, INK);
  p.span(24, 32, 37, INK);
  p.line(34, 15, 34, 22, INK);
  p.span(17, 33, 36, INK);
  p.span(20, 33, 36, INK);
  // 手：从袖口伸出
  p.rect(31, 24, 4, 4, FAIR.sk);
  p.set(34, 24, FAIR.sks);
  p.set(34, 25, FAIR.sks);
  p.rect(29, 28, 7, 6, RB);
  p.span(28, 29, 35, GD);
  p.rect(33, 29, 3, 5, RBS);
  return compose(backdrop(EL_INFO.fire.dark, EL_INFO.fire.color), p);
}

// ---------- 海贼·阮沧 ----------

function ruan(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const S: Skin = { sk: 0xdca06e, sks: 0xab6c4b, skh: 0xf5c490, bl: 0xc8705a, lip: 0x8a4a3a };
  const HR = 0x231b29;
  const BD = 0x264899, BDS = 0x192b66, BDH = 0x4a74c8;
  const JK = 0x2e8fa1, JKS = 0x1e5c75, JKH = 0x5cc4cf;
  const RP = 0xc79246, RPS = 0x8a5b2d;
  const WD = 0x7d4928, MT = 0xa8b6c4, MTH = 0xf0f8ff;
  // 背后的连弩横出两肩，鱼叉尖从右肩斜出
  p.rect(1, 31, 42, 3, WD);
  p.span(31, 1, 42, 0xb0743c);
  p.line(36, 30, 41, 2, WD, 2);
  p.line(41, 2, 42, -1, MT, 2);
  p.set(40, 3, MTH);
  p.line(39, 0, 43, 5, MT, 1);
  robe(p, { c: JK, cs: JKS, ch: JKH, lin: S.sk, trim: JKS, trimH: JKH });
  // 敞领露出的胸口加点阴影
  p.span(36, CX - 1, CX + 1, S.sks);
  p.set(CX, 37, S.sks);
  // 斜挎草绳
  p.line(8, 36, 34, 55, RP, 2);
  p.line(9, 36, 35, 55, RPS, 1);
  face(p, S);
  eyes(p, 'bold', 0x3a5a7a, 0x1c2a40);
  brows(p, 'thick', HR, 18);
  mouth(p, S, 'grin');
  // 豪爽大笑：张口露齿，眉眼不再是文静的细线。
  p.span(27, 19, 25, EYE);
  p.span(28, 20, 25, EYE);
  p.span(27, 20, 24, WHITE);
  p.span(29, 21, 24, S.lip);
  p.span(17, 16, 19, HR);
  p.set(27, 17, HR);
  // 左颊刀疤
  p.line(CX - 6, 21, CX - 4, 26, 0xf0c8a8);
  p.set(CX - 5, 23, 0x9a5a42);
  // 胡茬
  for (const [x, y] of [[CX - 3, 29], [CX - 1, 30], [CX + 1, 29], [CX + 3, 29], [CX, 28], [CX - 4, 28], [CX + 4, 28]]) p.set(x, y, S.sks);
  // 乱发从头巾下支棱出来
  for (let y = 9; y <= 15; y++) row(p, y, 9, HR);
  for (const [x, y] of [[CX - 10, 14], [CX - 10, 16], [CX + 9, 15], [CX - 5, 16], [CX + 3, 16], [CX + 9, 17]]) p.rect(x, y, 2, 2, HR);
  // 深蓝头巾，额前打结，巾尾从左后飘出
  p.rect(CX - 10, 9, 20, 6, BD);
  for (let y = 4; y < 9; y++) row(p, y, 5 + (y - 4), BD);
  p.span(13, CX - 10, CX + 9, BDS);
  p.span(14, CX - 10, CX + 9, BDS);
  p.span(5, CX - 4, CX + 1, BDH);
  p.span(10, CX - 9, CX - 2, BDH);
  // 白色波纹
  for (let x = CX - 8; x < CX + 8; x += 3) p.set(x, 11, 0xf0f6ff);
  p.strand([[CX - 9, 11], [CX - 15, 12], [CX - 19, 16], [CX - 20, 21]], BD, 3);
  p.strand([[CX - 9, 13], [CX - 14, 17], [CX - 16, 23]], BDS, 2);
  return compose(backdrop(EL_INFO.water.dark, EL_INFO.water.color), p);
}

// ---------- 药师·青黛 ----------

function qingdai(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const HR = 0x1c2b28;
  const GR = 0x3da370, GRS = 0x267350, GRH = 0x7be098;
  const HAT = 0xdebc64, HATS = 0xa68038, HATH = 0xf7df8c, BAND = 0x267350;
  const VEIL = 0xebf5e8;
  const BAM = 0xcfa44a, BAMS = 0x967030;
  const LEAF = 0x68d87b, LEAFS = 0x28824a, FLOWER = 0xffe875;
  // 背后药篓口斜出的草药，高过帽檐
  p.rect(30, 26, 11, 9, BAM);
  for (let y = 27; y < 35; y += 2) p.span(y, 30, 40, BAMS);
  p.strand([[34, 26], [36, 10], [38, 2]], LEAFS, 1);
  p.strand([[37, 26], [40, 14]], LEAFS, 1);
  for (const [x, y] of [[37, 3], [35, 7], [38, 9], [36, 13], [40, 15], [39, 19]]) {
    p.set(x, y, LEAF);
    p.set(x + 1, y, LEAF);
    p.set(x, y + 1, LEAFS);
  }
  p.set(38, 1, FLOWER);
  p.set(39, 2, FLOWER);
  // 长发垂肩后
  for (let y = 14; y < 40; y++) row(p, y, 10 - Math.floor(Math.max(0, y - 26) / 5), HR);
  robe(p, { c: GR, cs: GRS, ch: GRH, lin: 0xede6d8, trim: GRS, trimH: GRH });
  face(p, FAIR, 1);
  // 放松的闭眼弧线，和符师睁眼挑眉形成区别。
  p.strand([[15, 22], [17, 21], [19, 22]], EYE, 1);
  p.strand([[24, 22], [26, 21], [28, 22]], EYE, 1);
  brows(p, 'soft', HR);
  mouth(p, FAIR, 'smile');
  blush(p, FAIR);
  // 刘海
  for (let y = 11; y <= 14; y++) row(p, y, 9, HR);
  p.span(15, CX - 9, CX - 3, HR);
  p.span(15, CX + 1, CX + 8, HR);
  p.span(16, CX - 9, CX - 6, HR);
  p.span(16, CX + 6, CX + 8, HR);
  p.strand([[CX - 9, 15], [CX - 9, 30]], HR, 2);
  p.strand([[CX + 8, 15], [CX + 8, 30]], HR, 2);
  // 鬓边别一枝草药
  p.strand([[CX - 10, 16], [CX - 13, 11]], LEAFS, 1);
  p.set(CX - 13, 10, LEAF);
  p.set(CX - 14, 11, LEAF);
  p.set(CX - 12, 12, LEAF);
  p.set(CX - 13, 9, FLOWER);
  // 宽檐斗笠：扁圆锥，帽檐几乎占满画宽
  for (let y = 2; y <= 9; y++) {
    const hw = Math.round(3 + (y - 2) * 1.6);
    row(p, y, hw, HAT);
    p.span(y, CX + hw - 3, CX - 1 + hw, HATS);
    if (y > 3) p.set(CX - hw + 1, y, HATH);
  }
  for (let y = 10; y <= 11; y++) row(p, y, 21, HAT);
  p.span(11, CX - 21, CX + 20, HATS);
  p.span(10, CX - 20, CX - 10, HATH);
  // 竹篾纹
  for (let x = CX - 18; x <= CX + 18; x += 4) p.set(x, 10, HATS);
  p.span(9, CX - 15, CX + 14, BAND);
  // 薄纱：从帽檐两端垂下、撩到耳后，是一片半透明的纱面，外缘一道亮边
  for (let y = 12; y < 34; y++) {
    const k = (y - 12) / 22;
    const outer = Math.round(20 - k * 6);
    const inner = Math.round(15 - k * 3);
    for (const side of [-1, 1]) {
      for (let d = inner; d <= outer; d++) {
        const x = side < 0 ? CX - d : CX - 1 + d;
        p.set(x, y, VEIL, d === outer ? 150 : 55);
      }
    }
  }
  // 胸前轻拈药草，细长叶片与海贼的宽肩、符师的举符区分。
  p.line(12, 48, 17, 34, LEAFS, 1);
  p.strand([[15, 40], [10, 36], [11, 39], [15, 41]], LEAF, 1);
  p.strand([[16, 37], [20, 33], [20, 36], [16, 39]], LEAF, 1);
  p.rect(11, 45, 5, 4, FAIR.sk);
  p.span(48, 12, 15, FAIR.sks);
  p.rect(7, 49, 9, 7, GRH);
  return compose(backdrop(EL_INFO.wood.dark, EL_INFO.wood.color), p);
}

// ---------- 傀儡师·墨衡 ----------

function moheng(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const S: Skin = { sk: 0xf4cfb0, sks: 0xd29278, skh: 0xffe6d0, bl: 0xe8a090, lip: 0x9a5a50 };
  const HR = 0x261f30;
  const CAP = 0x221d2e, CAPH = 0x4f4762;
  const RB = 0xd19c3e, RBS = 0x9e6c28, RBH = 0xf0c668;
  const AP = 0x824e2e, APS = 0x563022, APH = 0xa86c42;
  const BUCK = 0xffe484;
  const WD = 0xb27a40, WDS = 0x784c26, WDH = 0xdca862;
  const STR = 0xf0e4c8, GLOW = 0xffeca4;
  // 方巾两条巾脚垂在脑后两侧
  p.strand([[CX - 8, 8], [CX - 12, 16], [CX - 13, 26]], CAP, 2);
  p.strand([[CX + 7, 8], [CX + 11, 16], [CX + 12, 24]], CAP, 2);
  robe(p, { c: RB, cs: RBS, ch: RBH, lin: 0xede6d8, trim: RBS, trimH: RBH });
  // 皮围裙：胸前一块，两条背带
  p.rect(CX - 7, 44, 14, 12, AP);
  p.rect(CX + 3, 44, 4, 12, APS);
  p.span(44, CX - 7, CX + 6, APH);
  p.line(CX - 6, 44, CX - 10, 34, AP, 2);
  p.line(CX + 5, 44, CX + 9, 34, AP, 2);
  p.rect(CX - 7, 44, 2, 2, BUCK);
  p.rect(CX + 5, 44, 2, 2, BUCK);
  // 胸前小工具：尺与刻刀
  p.line(CX - 4, 47, CX - 4, 53, 0xd8dce8);
  p.line(CX - 2, 46, CX - 2, 52, WDH);
  turnedFace(p, S, 1, 0x8a6a3a, true);
  // 视线朝向提线木架，近侧眼下留一点倦色。
  p.span(23, 18, 21, S.sks);
  p.strand([[15, 16], [15, 24], [18, 28]], HR, 2);
  // 头发收在方巾里，两鬓各露一缕
  for (let y = 12; y <= 14; y++) row(p, y, 8, HR);
  p.span(15, CX - 8, CX - 5, HR);
  p.span(15, CX + 4, CX + 7, HR);
  p.strand([[CX - 8, 15], [CX - 8, 22]], HR, 1);
  p.strand([[CX + 7, 15], [CX + 7, 22]], HR, 1);
  // 黑方巾：方顶
  p.rect(CX - 8, 4, 16, 9, CAP);
  p.rect(CX - 7, 3, 14, 1, CAP);
  p.span(4, CX - 7, CX - 2, CAPH);
  p.span(12, CX - 8, CX + 7, 0x74502e);
  p.line(CX, 4, CX, 11, 0x14101c);
  // 右手提十字木架（画面右侧），几根提线垂下，泛金光
  p.rect(30, 6, 12, 2, WD);
  p.span(6, 30, 41, WDH);
  p.rect(35, 2, 2, 12, WD);
  p.set(35, 2, WDH);
  p.span(7, 30, 41, WDS);
  for (const x of [31, 36, 41]) {
    p.line(x, 8, x, 30, STR, 1, 200);
    p.set(x, 18, GLOW);
  }
  // 握架的手
  p.rect(34, 13, 4, 3, S.sk);
  p.set(37, 14, S.sks);
  p.line(36, 16, 38, 32, RB, 3);
  p.line(38, 17, 39, 32, RBS, 1);
  return compose(backdrop(EL_INFO.earth.dark, EL_INFO.earth.color), p);
}

// ---------- 五行散人·玄一 ----------

function xuanyi(): PC {
  const p = new PC(PORTRAIT_W, PORTRAIT_H);
  const S: Skin = { sk: 0xf4cfb0, sks: 0xd49678, skh: 0xffe6d0, bl: 0xe89a8c, lip: 0xb06a60 };
  const HR = 0xf5f1ea, HRS = 0xbfc4ce;
  const RB = 0xa4a6b4, RBS = 0x76788a, RBH = 0xd8dce8;
  const TRIM = 0x221d2c;
  const WD = 0x925e36, WDH = 0xbe864e;
  const TL = 0xfaf7f0, TLS = 0xc8ccd6;
  // 拂尘：柄从左肩后斜出，白尾垂下
  p.line(4, 34, 11, 6, WD, 2);
  p.line(5, 33, 11, 8, WDH, 1);
  p.strand([[11, 5], [7, 8], [4, 14], [3, 22], [5, 30]], TL, 3);
  p.strand([[10, 6], [6, 11], [5, 19]], TLS, 1);
  // 白发披到肩后
  for (let y = 12; y < 36; y++) row(p, y, 10 - Math.floor(Math.max(0, y - 24) / 4), HR);
  robe(p, { c: RB, cs: RBS, ch: RBH, lin: 0xede6d8, trim: TRIM, trimH: 0x4a4458 });
  face(p, S);
  eyes(p, 'old', 0, 0);
  brows(p, 'long', HR, 19);
  // 皱纹
  p.span(17, CX - 3, CX + 2, S.sks);
  p.set(CX - 6, 24, S.sks);
  p.set(CX + 5, 24, S.sks);
  // 长须垂到胸口，两撇胡子
  p.span(26, CX - 3, CX + 2, HR);
  p.set(CX - 4, 27, HR);
  p.set(CX + 3, 27, HR);
  for (let y = 27; y < 47; y++) {
    const hw = y < 31 ? 4 : Math.max(1, 4 - Math.floor((y - 31) / 5));
    const sway = y > 38 ? 1 : 0;
    p.span(y, CX - hw + sway, CX - 1 + hw + sway, HR);
    p.set(CX + hw - 1 + sway, y, HRS);
  }
  p.span(27, CX - 1, CX + 1, S.lip);
  p.set(CX - 2, 26, S.lip);
  p.set(CX + 2, 26, S.lip);
  // 发顶与发髻，插木簪
  for (let y = 10; y <= 14; y++) row(p, y, Math.min(9, 6 + y - 10), HR);
  p.span(15, CX - 9, CX - 6, HR);
  p.span(15, CX + 5, CX + 8, HR);
  p.span(11, CX + 3, CX + 7, HRS);
  p.ellipse(CX, 7, 4, 3.5, HR);
  p.span(8, CX + 1, CX + 3, HRS);
  p.line(CX - 7, 5, CX + 7, 8, WD, 1);
  p.set(CX - 7, 5, WDH);
  // 五颗五行光点绕在身侧
  const orbs: [number, number][] = [[36, 10], [40, 20], [38, 31], [5, 40], [39, 42]];
  (['wood', 'fire', 'earth', 'metal', 'water'] as const).forEach((e, i) => {
    const [x, y] = orbs[i];
    p.rect(x, y, 2, 2, EL_INFO[e].color);
    p.set(x, y, 0xffffff);
    p.set(x - 1, y + 1, EL_INFO[e].color, 120);
    p.set(x + 2, y, EL_INFO[e].color, 120);
  });
  return compose(backdrop(0x3a3448, 0xd8d0e4), p);
}

export const PORTRAITS: Record<string, () => PC> = { xiao, zhu, ruan, qingdai, moheng, xuanyi };

export function buildPortraits(scene: Phaser.Scene) {
  for (const [id, draw] of Object.entries(PORTRAITS)) {
    if (!scene.textures.exists(`portrait_${id}`)) addSheet(scene, `portrait_${id}`, [draw()]);
  }
}
