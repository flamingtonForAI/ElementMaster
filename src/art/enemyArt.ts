import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE } from './painter';
import { EL_INFO, type El } from '../config/elements';

// 敌人只画朝右，朝左翻转。脚下的元素色底座烘焙进贴图，不只靠颜色区分时再配合名字/字形。

function finish(p: PC, el: El, cx: number, cy: number, rx: number, ry: number) {
  p.outline(OUTLINE);
  p.under(cx, cy, rx, ry, 0x000000, 60);
  p.underRing(cx, cy, rx + 1, ry + 0.8, EL_INFO[el].color, 170);
}

// 石俑（土）：兵马俑式的陶土武士
function shiyong(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xc79a55, S = 0x8f6a3a, H = 0xe6c07f, D = 0x6e5030, EY = 0xffd84a;
  const t = f === 1 ? 1 : 0;
  // 腿
  p.rect(8 - t, 18, 3, 4, S);
  p.rect(13 + t, 18, 3, 4, S);
  // 身体：铠甲片
  p.rect(6, 10, 12, 9, B);
  p.span(10, 6, 17, H);
  for (const y of [13, 16]) p.span(y, 7, 16, S);
  p.rect(16, 10, 2, 9, S);
  p.line(9, 11, 11, 15, D);
  // 手臂
  p.rect(4, 11 + t, 2, 6, B);
  p.rect(18, 11 - t, 2, 6, S);
  // 头
  p.rect(8, 3, 8, 8, B);
  p.span(3, 8, 15, H);
  p.rect(14, 3, 2, 8, S);
  p.rect(11, 1, 2, 2, S);
  p.set(10, 7, EY);
  p.set(13, 7, EY);
  p.span(9, 10, 13, D);
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 藤怪（木）：球茎植物妖
function tengguai(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x4f9e4a, S = 0x356e36, H = 0x84d26e, M = 0x2a1a1a, T = 0xf2efe0, EY = 0xff5a4a;
  const w = f === 1 ? 1 : 0;
  // 藤蔓脚
  p.strand([[8, 18], [6, 21 + w], [4, 22]], S, 2);
  p.strand([[16, 18], [18, 21 - w], [20, 22]], S, 2);
  p.strand([[12, 19], [12, 22]], S, 2);
  // 身体
  p.ellipse(12, 13, 7.5, 6.5 + w * 0.3, B);
  p.ellipse(14.5, 15, 4, 3.5, S);
  p.ellipse(10, 10, 3, 2, H);
  // 叶子
  p.strand([[12, 7], [9, 3], [6, 2]], B, 2);
  p.strand([[12, 7], [15, 2], [18, 2 + w]], H, 2);
  // 嘴和牙
  p.span(14, 9, 16, M);
  p.span(15, 10, 15, M);
  for (const x of [9, 11, 13, 15]) p.set(x, 14, T);
  p.set(10, 11, EY);
  p.set(15, 11, EY);
  finish(p, 'wood', 12, 22, 7, 2);
  return p;
}

// 水鬼（水）：长发苍白的游魂
function shuigui(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xa9cbef, S = 0x6a8fc4, H = 0xdcecff, HR = 0x1d2238, EY = 0xbff6ff;
  const w = f === 1 ? 1 : -1;
  const lift = f === 1 ? 1 : 0;
  p.oy = -lift;
  // 尾巴
  p.strand([[12, 15], [11 + w, 18], [13 + w, 20], [12, 21]], S, 3);
  // 身体
  p.ellipse(12, 12, 5.5, 5, B);
  p.ellipse(14, 13, 3, 3.5, S);
  // 头发：两侧长发垂下
  p.ellipse(12, 7, 5, 4, HR);
  p.strand([[7, 6], [6, 11], [7 + w, 15]], HR, 2);
  p.strand([[17, 6], [18, 11], [17 + w, 15]], HR, 2);
  p.rect(9, 7, 6, 4, H);
  p.set(10, 9, EY);
  p.set(13, 9, EY);
  // 手
  p.strand([[7, 12], [5, 13]], B, 2);
  p.strand([[17, 12], [19, 13]], S, 2);
  p.oy = 0;
  finish(p, 'water', 12, 22, 5, 1.6);
  return p;
}

// 火鸦（火）：拖着火尾的乌鸦
function huoya(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x3a1a22, R = 0xa8322a, O = 0xff9a3a, Y = 0xffd04a, EY = 0xffee88;
  const up = f === 0;
  // 火尾
  p.strand([[7, 11], [4, 9], [2, 11]], O, 2);
  p.strand([[7, 12], [3, 13]], Y, 1);
  // 身体
  p.ellipse(12, 11, 5, 3.5, B);
  p.ellipse(11, 12, 3, 2, R);
  // 头和喙
  p.ellipse(17, 9, 3, 2.8, B);
  p.span(9, 20, 21, Y);
  p.set(20, 10, Y);
  p.set(17, 8, EY);
  // 翅膀
  if (up) {
    p.strand([[11, 9], [9, 4], [6, 2]], R, 2);
    p.strand([[13, 9], [14, 4], [16, 2]], B, 2);
    p.set(6, 2, O);
  } else {
    p.strand([[11, 12], [8, 16], [5, 17]], R, 2);
    p.strand([[13, 12], [14, 16], [16, 18]], B, 2);
    p.set(5, 17, O);
  }
  finish(p, 'fire', 12, 22, 4, 1.4);
  return p;
}

// 铁甲兵（金）：红缨头盔、持长枪
function tiejia(f: number): PC {
  const p = new PC(28, 28);
  const A = 0xa9b4bf, S = 0x6e7a87, H = 0xdbe3ea, RD = 0xc0392b, D = 0x262433, WD = 0x6b4630, BL = 0xe8f0f6;
  const t = f === 1 ? 1 : 0;
  // 长枪
  p.line(21, 3, 21, 25, WD);
  p.rect(20, 1, 3, 3, BL);
  p.set(21, 0, BL);
  p.span(4, 19, 23, RD);
  // 腿
  p.rect(10 - t, 21, 3, 5, S);
  p.rect(15 + t, 21, 3, 5, D);
  // 身体
  p.rect(8, 12, 12, 10, A);
  p.span(12, 8, 19, H);
  for (const y of [15, 18]) p.span(y, 9, 18, S);
  p.rect(18, 12, 2, 10, S);
  p.span(21, 8, 19, RD);
  // 手臂握枪
  p.rect(19, 14 - t, 3, 3, A);
  p.rect(6, 13 + t, 2, 6, S);
  // 头盔
  p.rect(9, 4, 10, 8, A);
  p.span(4, 9, 18, H);
  p.rect(17, 4, 2, 8, S);
  p.span(8, 11, 18, D);
  p.set(16, 8, 0xff6a5a);
  // 红缨
  p.rect(13, 1, 3, 3, RD);
  p.set(12, 2, RD);
  finish(p, 'metal', 14, 26, 7, 2);
  return p;
}

// 狼妖（金，Boss）：银白巨狼，四足奔跑
function langyao(f: number): PC {
  const p = new PC(56, 48);
  const W = 0xe8ecf0, S = 0xa8b2bf, D = 0x6f7a88, EY = 0xff3a3a, M = 0x2a1a22, GD = 0xe0b04a;
  const ph = (f / 4) * Math.PI * 2;
  const s = Math.sin(ph);
  const legs: [number, number][] = [[16, 1], [22, -1], [34, 1], [40, -1]];
  // 腿
  for (const [x, dir] of legs) {
    const dx = Math.round(3 * s * dir);
    p.strand([[x, 30], [x + dx, 37], [x + dx + 1, 42]], dir > 0 ? S : D, 4);
  }
  // 尾巴
  p.strand([[12, 24], [7, 18 - Math.round(s)], [4, 12], [6, 8]], W, 5);
  p.strand([[8, 18], [5, 12]], S, 2);
  // 身体
  p.ellipse(27, 26, 16, 8.5, W);
  p.ellipse(28, 30, 13, 4, S);
  p.ellipse(22, 21, 9, 3, 0xffffff);
  // 鬃毛
  for (let i = 0; i < 5; i++) p.strand([[30 + i * 3, 18], [28 + i * 3, 13 + (i % 2)]], W, 3);
  // 头
  p.ellipse(44, 20, 7, 6.5, W);
  p.ellipse(50, 23, 5, 3, W);
  p.span(26, 47, 54, M);
  p.set(53, 22, M);
  for (const x of [48, 51]) p.set(x, 25, 0xffffff);
  p.set(46, 18, EY);
  p.set(47, 18, EY);
  // 耳朵
  p.strand([[41, 15], [40, 9]], W, 3);
  p.strand([[45, 14], [46, 9]], S, 3);
  // 金项圈
  p.strand([[38, 22], [39, 28]], GD, 2);
  finish(p, 'metal', 28, 43, 18, 3.5);
  return p;
}

// 千年树妖（木，Boss）：带脸的古树
function shuyao(f: number): PC {
  const p = new PC(64, 64);
  const T = 0x6b4a2f, TS = 0x4a321f, TH = 0x8b6a45, L = 0x3f8a3f, LS = 0x2c5f2c, LH = 0x6fbf5a, EY = 0x9dff6a, M = 0x1a1010;
  const w = f === 1 ? 1 : 0;
  // 根
  p.strand([[24, 52], [16, 58], [10, 60]], TS, 4);
  p.strand([[40, 52], [48, 58], [54, 60]], TS, 4);
  p.strand([[32, 54], [32, 60]], TS, 4);
  // 树干
  for (let y = 22; y <= 56; y++) {
    const hw = 9 + Math.round((y - 22) / 9);
    p.span(y, 32 - hw, 31 + hw, T);
    p.span(y, 31 + hw - 3, 31 + hw, TS);
    p.set(32 - hw + 1, y, TH);
  }
  p.line(26, 30, 27, 50, TS);
  p.line(37, 34, 36, 52, TS);
  // 脸
  p.ellipse(27, 36, 3, 2.5, M);
  p.ellipse(37, 36, 3, 2.5, M);
  p.set(27, 36, EY);
  p.set(37, 36, EY);
  p.ellipse(32, 45, 5, 3, M);
  p.span(44, 29, 35, TS);
  // 枝干手臂
  p.strand([[23, 30], [14, 26 - w], [8, 20 - w]], T, 4);
  p.strand([[41, 30], [50, 26 + w], [56, 20 + w]], T, 4);
  // 树冠
  const blobs: [number, number, number][] = [[32, 14, 13], [18, 18, 9], [46, 18, 9], [10, 16, 6], [54, 16, 6], [25, 8, 7], [39, 8, 7]];
  for (const [x, y, r] of blobs) p.circle(x + (x < 32 ? -w : w), y, r, L);
  for (const [x, y, r] of blobs) p.circle(x + 2 + (x < 32 ? -w : w), y + 3, r * 0.6, LS);
  for (const [x, y, r] of blobs) p.circle(x - 2, y - 3, r * 0.35, LH);
  finish(p, 'wood', 32, 60, 22, 3.5);
  return p;
}

export function buildEnemies(scene: Phaser.Scene) {
  const two = (key: string, fn: (f: number) => PC, rate: number) => {
    addSheet(scene, key, [fn(0), fn(1)]);
    addAnim(scene, key + '_move', key, [0, 1], rate);
  };
  two('en_shiyong', shiyong, 4);
  two('en_tengguai', tengguai, 5);
  two('en_shuigui', shuigui, 4);
  two('en_huoya', huoya, 8);
  two('en_tiejia', tiejia, 5);
  addSheet(scene, 'boss_langyao', [0, 1, 2, 3].map(langyao));
  addAnim(scene, 'boss_langyao_move', 'boss_langyao', [0, 1, 2, 3], 8);
  two('boss_shuyao', shuyao, 2);
}
