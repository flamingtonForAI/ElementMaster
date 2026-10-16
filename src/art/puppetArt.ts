import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';

// 傀儡师的召唤物：只画朝右，朝左翻转。
// 和敌人石俑（矮方块身体、方头、发光黄眼）拉开剪影：细腰人偶，金色球形关节，脸上一张白色傩面，
// 头顶发髻插金簪，红腰带垂下一截；头和两手各连一根半透明提线往上走，脚下一圈金色的我方标记环。
// 主体用浅灰白石色，运行时 setTint 染成五行外壳色（金刀傀、木藤傀、水傀、火傀）。
//
// 原点：pp_golem 20×26，脚底在 y=23，setOrigin(0.5, 0.9)；
//       pp_giant 38×46，脚底在 y=42，setOrigin(0.5, 0.92)。

const B = 0xdad6ce, S = 0xa4a2ae, H = 0xf8f3ea, D = 0x727082;
const J = 0xecb84a, JS = 0xa87628;
const MASK = 0xfaf6ee, BROW = 0x1c1424, CHEEK = 0xe86258;
const HAIR = 0x282234, CL = 0xa83228, CLS = 0x6e1c22;
const PAPER = 0xf8dc70, INK = 0xc8372d;
const STR = 0xf4e8c8;

interface GPose {
  /** 走路相位：0..3 */
  step: number;
  /** 扑击：-1 不扑，0 蓄力后仰、1 前扑出拳、2 收势 */
  atk: number;
}

/** 按比例 s 画一尊傀儡；(ox, oy) 是 20×26 设计稿左上角在画布上的位置，脚底在设计稿 y=23 */
function puppet(p: PC, s: number, ox: number, oy: number, pose: GPose) {
  const X = (x: number) => Math.round(ox + x * s);
  const Y = (y: number) => Math.round(oy + y * s);
  const r = (x: number, y: number, w: number, h: number, c: number) => p.rect(X(x), Y(y), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), c);
  const ball = (x: number, y: number) => {
    r(x, y, 1, 1, J);
    if (s > 1.4) p.set(X(x) + 1, Y(y) + 1, JS);
  };
  const lean = pose.atk === 0 ? -1 : pose.atk === 1 ? 1 : 0;
  const t = pose.atk >= 0 ? 0 : [0, 1, 0, -1][pose.step];
  const bob = pose.atk < 0 && pose.step % 2 === 1 ? 1 : 0;

  // 腿：细石腿，膝盖一颗金关节
  const leg = (x: number, lift: number, shade: boolean) => {
    r(x, 17 + bob, 2, 5 - lift - bob, shade ? S : B);
    ball(x, 19 + bob - lift);
    r(x - (shade ? 0 : 0), 22 - lift, 3, 1, D);
  };
  leg(7 - t, Math.max(0, -t), true);
  leg(11 + t, Math.max(0, t), false);

  const o = lean;
  const by = bob;
  // 腰：红腰带，前面垂一截
  r(7 + o, 15 + by, 6, 2, CL);
  r(9 + o, 17 + by, 2, 2, CLS);
  // 躯干：宽肩细腰
  r(5 + o, 9 + by, 10, 1, H);
  r(6 + o, 10 + by, 8, 3, B);
  r(7 + o, 13 + by, 6, 2, B);
  r(13 + o, 10 + by, 1, 3, S);
  r(12 + o, 13 + by, 1, 2, S);
  // 胸口小黄符
  r(9 + o, 10 + by, 2, 3, PAPER);
  r(9 + o, 10 + by, 2, 1, INK);

  // 后臂
  ball(5 + o, 9 + by);
  r(4 + o, 10 + by + t, 1, 3, S);
  ball(4 + o, 12 + by + t);
  r(4 + o, 13 + by + t, 1, 2, S);
  // 前臂：扑击时伸直往前打
  ball(14 + o, 9 + by);
  let hand: [number, number];
  if (pose.atk === 1) {
    r(15 + o, 10 + by, 3, 1, B);
    ball(17 + o, 10 + by);
    r(18 + o, 9 + by, 2, 3, H);
    hand = [19 + o, 9 + by];
  } else if (pose.atk === 0) {
    r(14 + o, 6 + by, 1, 3, B);
    ball(14 + o, 5 + by);
    hand = [14 + o, 5 + by];
  } else {
    r(15 + o, 10 + by - t, 1, 2, B);
    ball(15 + o, 12 + by - t);
    r(15 + o, 13 + by - t, 1, 2, B);
    hand = [15 + o, 15 + by - t];
  }

  // 头：白色傩面，黑眉细眼、红颊；发髻插金簪
  const hx = 10 + o;
  const hy = 5 + by;
  p.ellipse(X(hx), Y(hy), 3 * s, 3.4 * s, MASK);
  p.span(Y(hy - 3), X(hx - 2), X(hx + 2), HAIR);
  p.ellipse(X(hx - 0.5), Y(hy - 3.6), 1.6 * s, 1.2 * s, HAIR);
  r(hx - 3, hy - 4, 2, 1, J);
  r(hx, hy - 1, 2, 1, BROW);
  r(hx + 1, hy, 1, 1, BROW);
  r(hx - 2, hy, 1, 1, BROW);
  r(hx + 2, hy + 1, 1, 1, CHEEK);
  r(hx - 2, hy + 1, 1, 1, CHEEK);
  r(hx, hy + 2, 1, 1, CHEEK);

  // 提线：头顶和两只手各一根，半透明，不参与描边
  const top = 0;
  const strings: [number, number][] = [[hx - 1, hy - 5], [hand[0], hand[1] - 1], [4 + o, 9 + by + t]];
  for (const [sx, sy] of strings) {
    const n = Math.max(1, Y(sy) - top);
    for (let i = 0; i < n; i++) p.set(X(sx), Y(sy) - 1 - i, STR, 120);
  }
}

function golemFrame(pose: GPose): PC {
  const p = new PC(20, 26);
  puppet(p, 1, 0, 1, pose);
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(10.6, 23.5, 5.8, 1.7, 0x12222b, 85);
  p.underRing(10, 23.5, 7, 2.2, J, 175);
  return p;
}

function giantFrame(pose: GPose): PC {
  const p = new PC(38, 46);
  puppet(p, 1.8, 1, 1, pose);
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(20, 42.5, 10.5, 2.5, 0x12222b, 92);
  p.underRing(19, 42.5, 13, 3.4, J, 175);
  return p;
}

export function buildPuppetArt(scene: Phaser.Scene) {
  const walk = [0, 1, 2, 3].map((step) => ({ step, atk: -1 }));
  const atk = [0, 1, 2].map((a) => ({ step: 0, atk: a }));
  addSheet(scene, 'pp_golem', [...walk, ...atk].map(golemFrame));
  addAnim(scene, 'pp_golem_move', 'pp_golem', [0, 1, 2, 3], 8);
  addAnim(scene, 'pp_golem_atk', 'pp_golem', [4, 5, 6], 12, 0);
  addSheet(scene, 'pp_giant', [...walk, ...atk].map(giantFrame));
  addAnim(scene, 'pp_giant_move', 'pp_giant', [0, 1, 2, 3], 6);
  addAnim(scene, 'pp_giant_atk', 'pp_giant', [4, 5, 6], 10, 0);
}
