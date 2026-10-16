import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';

// 傀儡师的召唤物：只画朝右，朝左翻转。
// 和敌人石俑（矮方块身体、方头、发光黄眼）拉开剪影：细腰人偶，金色球形关节，脸上一张白色傩面，
// 头顶发髻插金簪，红腰带垂下一截；头和两手各连一根半透明提线往上走，脚下一圈金色的我方标记环。
// 主体用浅灰白石色，运行时 setTint 染成五行外壳色（金刀傀、木藤傀、水傀、火傀）。
//
// 原点：pp_golem 20×26，脚底在 y=23，setOrigin(0.5, 0.9)；
//       pp_giant 38×46，脚底在 y=42，setOrigin(0.5, 0.92)；
//       pp_wall 24×14，底边在 y=12，setOrigin(0.5, 0.86)。

const B = 0xd8d4cc, S = 0xa8a49c, H = 0xf2eee6, D = 0x7a766e;
const J = 0xe0b04a, JS = 0xa87a2a;
const MASK = 0xf8f4ec, BROW = 0x1c1424, CHEEK = 0xe0605a;
const HAIR = 0x2a2633, CL = 0x9a3028, CLS = 0x6e1f1a;
const PAPER = 0xf2d36b, INK = 0xc8372d;
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
  p.outline(OUTLINE);
  p.under(10, 23.5, 5.5, 1.6, 0x000000, 80);
  p.underRing(10, 23.5, 7, 2.2, J, 170);
  return p;
}

function giantFrame(pose: GPose): PC {
  const p = new PC(38, 46);
  puppet(p, 1.8, 1, 1, pose);
  p.outline(OUTLINE);
  p.under(19, 42.5, 10, 2.4, 0x000000, 90);
  p.underRing(19, 42.5, 13, 3.4, J, 170);
  return p;
}

/** 一段夯土墙：三层错缝土砖，顶上一层草泥 */
function wallFrame(): PC {
  const p = new PC(24, 14);
  const W = 0xc49656, WS = 0x93683a, WH = 0xdcb070, WD = 0x6e4c28;
  p.rect(1, 3, 22, 9, W);
  p.span(3, 1, 22, WH);
  p.span(2, 2, 21, 0x8a7a3a);
  p.set(5, 1, 0x6a8a3a);
  p.set(16, 1, 0x6a8a3a);
  for (const y of [6, 9]) p.span(y, 1, 22, WS);
  for (const [y, xs] of [[4, [6, 13, 19]], [7, [3, 10, 17]], [10, [7, 14, 20]]] as [number, number[]][]) {
    for (const x of xs) p.rect(x, y, 1, 2, WS);
  }
  p.span(11, 1, 22, WD);
  p.rect(21, 3, 2, 9, WS);
  p.outline(OUTLINE);
  p.under(12, 12.5, 11, 1.6, 0x000000, 60);
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
  addSheet(scene, 'pp_wall', [wallFrame()]);
}
