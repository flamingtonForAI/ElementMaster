import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { readEnemySheet } from './enemySheets';

// 傀儡师的召唤物：只画朝右，朝左翻转。
// 和敌人石俑（矮方块身体、方头、发光黄眼）拉开剪影：细腰人偶，金色球形关节，脸上一张白色傩面，
// 头顶发髻插金簪，红腰带垂下一截；头和两手各连一根半透明提线往上走，脚下一圈金色的我方标记环。
// 主体用浅灰白石色，运行时 setTint 染成五行外壳色（金刀傀、木藤傀、水傀、火傀）。
//
// 正式造型是原画 PNG（assets/puppets，0–3 走路、4–7 拍地），加载后在脚底叠阴影和金环；下方程序画只作缺图回退。
// 原点：PNG 脚底在 0.9 高度处（pp_golem 28×38、pp_giant 52×68），setOrigin(0.5, 0.9)；
//       回退的程序画 pp_golem 24×30 脚底 y=28.5、pp_giant 46×56 脚底 y=51，同样按 0.9 放会差一两像素，可接受。

const B = 0xdad6ce, S = 0xa4a2ae, H = 0xf8f3ea, D = 0x727082;
const J = 0xecb84a, JS = 0xa87628;
const MASK = 0xfaf6ee, BROW = 0x1c1424, CHEEK = 0xe86258;
const HAIR = 0x282234, CL = 0xa83228, CLS = 0x6e1c22;
const PAPER = 0xf8dc70, INK = 0xc8372d;
const STR = 0xf4e8c8;

interface GPose {
  /** 走路相位：0..3 */
  step: number;
  /** 拍地：-1 不出招，0 举拳蓄力、1 举过头顶、2 双拳拍地、3 收势 */
  atk: number;
}

/** 按比例 s 画一尊傀儡；(ox, oy) 是 24×30 设计稿左上角在画布上的位置，脚底（鞋底那一行）在设计稿 y=26 */
function puppet(p: PC, s: number, ox: number, oy: number, pose: GPose) {
  const X = (x: number) => Math.round(ox + x * s);
  const Y = (y: number) => Math.round(oy + y * s);
  const r = (x: number, y: number, w: number, h: number, c: number) => p.rect(X(x), Y(y), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), c);
  const ball = (x: number, y: number, n = 1) => {
    r(x, y, n, n, J);
    if (s > 1.4 || n > 1) r(x + n - 1, y + n - 1, 1, 1, JS);
  };
  /** 石拳：3×3，左上受光 */
  const fist = (x: number, y: number) => {
    r(x, y, 3, 3, B);
    r(x, y, 2, 1, H);
    r(x + 2, y + 1, 1, 2, S);
    r(x, y + 2, 2, 1, S);
  };
  const atk = pose.atk;
  // 身体前后倾、上下沉：蓄力后仰挺起，拍地时前扑下蹲
  const o = atk === 0 ? -1 : atk === 1 ? -1 : atk === 2 ? 2 : atk === 3 ? 1 : 0;
  const t = atk >= 0 ? 0 : [0, 1, 0, -1][pose.step];
  const by = atk === 1 ? -1 : atk === 2 ? 3 : atk === 3 ? 1 : pose.step % 2 === 1 ? 1 : 0;

  // 腿：粗石腿，膝盖一颗金关节；下蹲时腿变短、两脚分开
  const knee = atk === 2 ? 2 : 0;
  const leg = (x: number, lift: number, shade: boolean) => {
    const top = 20 + by;
    r(x, top, 3, 26 - top - lift, shade ? S : B);
    if (!shade) r(x, top, 1, 26 - top - lift, H);
    ball(x + 1, 22 + Math.round(by / 2) - lift);
    r(x - 1, 26 - lift, 5, 1, D);
  };
  leg(7 - t - knee, Math.max(0, -t), true);
  leg(13 + t + knee, Math.max(0, t), false);

  // 腰：红腰带，前面垂一截
  r(7 + o, 18 + by, 10, 2, CL);
  r(11 + o, 20 + by, 2, 3, CLS);
  // 躯干：桶状胸，宽肩收腰
  r(5 + o, 9 + by, 14, 1, H);
  r(5 + o, 10 + by, 14, 3, B);
  r(6 + o, 13 + by, 12, 3, B);
  r(7 + o, 16 + by, 10, 2, B);
  r(16 + o, 10 + by, 3, 3, S);
  r(15 + o, 13 + by, 3, 3, S);
  r(15 + o, 16 + by, 2, 2, D);
  r(6 + o, 10 + by, 1, 6, H);
  // 胸口黄符
  r(10 + o, 11 + by, 3, 4, PAPER);
  r(10 + o, 11 + by, 3, 1, INK);
  r(11 + o, 13 + by, 1, 1, INK);
  // 金护肩
  ball(4 + o, 8 + by, 2);
  ball(18 + o, 8 + by, 2);

  // 手臂 2 格粗，末端石拳；返回两只拳头的位置，提线连到拳头上
  const hands: [number, number][] = [];
  if (atk === 0) {
    // 举拳蓄力：两拳在头两侧
    r(4 + o, 4 + by, 2, 5, S);
    r(18 + o, 4 + by, 2, 5, B);
    fist(3 + o, 1 + by);
    fist(18 + o, 1 + by);
    hands.push([4 + o, 1 + by], [19 + o, 1 + by]);
  } else if (atk === 1) {
    // 双拳合在头顶
    r(6 + o, 2 + by, 2, 7, S);
    r(16 + o, 2 + by, 2, 7, B);
    fist(8 + o, -1 + by);
    fist(12 + o, -1 + by);
    hands.push([9 + o, -1 + by], [13 + o, -1 + by]);
  } else if (atk === 2) {
    // 拍地：双臂往前下方伸直，两拳砸在身前地面
    r(15 + o, 11 + by, 2, 23 - 11 - by, S);
    r(18 + o, 11 + by, 2, 23 - 11 - by, B);
    r(18 + o, 11 + by, 1, 23 - 11 - by, H);
    fist(14 + o, 23);
    fist(18 + o, 23);
    hands.push([15 + o, 23], [19 + o, 23]);
  } else {
    // 走路、收势：两臂垂在身侧，前后摆
    const sw = atk === 3 ? 1 : t;
    r(3 + o, 10 + by + sw, 2, 6, S);
    r(19 + o, 10 + by - sw, 2, 6, B);
    r(19 + o, 10 + by - sw, 1, 6, H);
    fist(2 + o, 16 + by + sw);
    fist(19 + o, 16 + by - sw);
    hands.push([3 + o, 16 + by + sw], [20 + o, 16 + by - sw]);
  }

  // 头：白色傩面，黑眉细眼、红颊；发髻插金簪
  const hx = 12 + o;
  const hy = 5 + by;
  p.ellipse(X(hx), Y(hy), 3.2 * s, 3.5 * s, MASK);
  p.span(Y(hy - 3), X(hx - 2), X(hx + 2), HAIR);
  p.ellipse(X(hx - 0.5), Y(hy - 3.7), 1.7 * s, 1.3 * s, HAIR);
  r(hx - 3, hy - 4, 2, 1, J);
  r(hx, hy - 1, 2, 1, BROW);
  r(hx + 1, hy, 1, 1, BROW);
  r(hx - 2, hy, 1, 1, BROW);
  r(hx + 2, hy + 1, 1, 1, CHEEK);
  r(hx - 2, hy + 1, 1, 1, CHEEK);
  r(hx, hy + 2, 1, 1, CHEEK);

  // 提线：头顶和两只拳头各一根，半透明，不参与描边
  const strings: [number, number][] = [[hx - 1, hy - 5], ...hands.map(([x, y]): [number, number] => [x + 1, y])];
  for (const [sx, sy] of strings) {
    const n = Math.max(0, Y(sy));
    for (let i = 0; i < n; i++) p.set(X(sx), Y(sy) - 1 - i, STR, 120);
  }
}

function golemFrame(pose: GPose): PC {
  const p = new PC(24, 30);
  puppet(p, 1, 0, 2, pose);
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(12.6, 28.5, 7, 1.8, 0x12222b, 85);
  p.underRing(12, 28.5, 8.5, 2.4, J, 175);
  return p;
}

function giantFrame(pose: GPose): PC {
  const p = new PC(46, 56);
  puppet(p, 1.8, 1, 3, pose);
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(23.5, 51, 12.5, 2.7, 0x12222b, 92);
  p.underRing(23, 51, 15, 3.6, J, 175);
  return p;
}

/** 原画帧脚底叠阴影和我方金环（rx 为环的横半径） */
function ground(frames: PC[] | undefined, rx: number) {
  return frames?.map((p) => {
    const y = p.h * 0.9;
    p.under(p.w / 2 + 0.6, y, rx * 0.8, rx * 0.21, 0x12222b, 88);
    p.underRing(p.w / 2, y, rx, rx * 0.28, J, 175);
    return p;
  });
}

export function buildPuppetArt(scene: Phaser.Scene, readSheet: (key: string) => PC[] | undefined = (key) => readEnemySheet(scene, key)) {
  const walk = [0, 1, 2, 3].map((step) => ({ step, atk: -1 }));
  const atk = [0, 1, 2, 3].map((a) => ({ step: 0, atk: a }));
  addSheet(scene, 'pp_golem', ground(readSheet('pp_golem'), 9) ?? [...walk, ...atk].map(golemFrame));
  addAnim(scene, 'pp_golem_move', 'pp_golem', [0, 1, 2, 3], 8);
  // 拍地：举拳 → 过顶 → 拍地（停两拍）→ 收势；第 3 帧（拍地）出现在 0.2 秒左右，伤害在那时结算
  addAnim(scene, 'pp_golem_atk', 'pp_golem', [4, 5, 6, 6, 7], 14, 0);
  addSheet(scene, 'pp_giant', ground(readSheet('pp_giant'), 16) ?? [...walk, ...atk].map(giantFrame));
  addAnim(scene, 'pp_giant_move', 'pp_giant', [0, 1, 2, 3], 6);
  addAnim(scene, 'pp_giant_atk', 'pp_giant', [4, 5, 6, 6, 7], 10, 0);
}
