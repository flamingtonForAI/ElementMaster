import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, OUTLINE_LIT } from './painter';
import { EL_INFO, type El } from '../config/elements';

// 敌人只画朝右，朝左翻转。脚下的元素色底座烘焙进贴图，不只靠颜色区分时再配合名字/字形。
// 采用冷暖色相偏移（Hue-Shifted Ramp）+ selectiveOutline + 偏青蓝定向投影。

function finish(p: PC, el: El, cx: number, cy: number, rx: number, ry: number) {
  p.selectiveOutline(OUTLINE_LIT, OUTLINE);
  p.under(cx + 0.8, cy, rx + 0.5, ry, 0x12222b, 75);
  p.underRing(cx, cy, rx + 1, ry + 0.8, EL_INFO[el].color, 175);
}

// 石俑（土）：兵马俑式的陶土武士（暖金高光 → 陶褐 → 紫褐暗部）
function shiyong(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xcd9d54, S = 0x8e6438, H = 0xf0ce86, D = 0x61422c, EY = 0xffe254;
  const t = f === 1 ? 1 : 0;
  // 腿
  p.rect(8 - t, 18, 3, 4, S);
  p.rect(13 + t, 18, 3, 4, D);
  // 身体：铠甲片
  p.rect(6, 10, 12, 9, B);
  p.span(10, 6, 17, H);
  p.set(6, 11, H);
  for (const y of [13, 16]) p.span(y, 7, 16, S);
  p.rect(16, 10, 2, 9, S);
  p.rect(17, 12, 1, 7, D);
  p.line(9, 11, 11, 15, D);
  // 手臂
  p.rect(4, 11 + t, 2, 6, B);
  p.set(4, 11 + t, H);
  p.rect(18, 11 - t, 2, 6, S);
  // 头
  p.rect(8, 3, 8, 8, B);
  p.span(3, 8, 15, H);
  p.set(8, 4, H);
  p.rect(14, 3, 2, 8, S);
  p.rect(11, 1, 2, 2, S);
  p.set(11, 1, H);
  p.set(10, 7, EY);
  p.set(13, 7, EY);
  p.span(9, 10, 13, D);
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 藤怪（木）：球茎植物妖（嫩黄绿高光 → 翠绿 → 青蓝深绿暗部）
function tengguai(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x52a648, S = 0x2f6e3d, D = 0x1e4c36, H = 0x98e06c, HL = 0xc8f488, M = 0x2a1620, T = 0xf6f2e4, EY = 0xff5e4d;
  const w = f === 1 ? 1 : 0;
  // 藤蔓脚
  p.strand([[8, 18], [6, 21 + w], [4, 22]], S, 2);
  p.strand([[16, 18], [18, 21 - w], [20, 22]], D, 2);
  p.strand([[12, 19], [12, 22]], S, 2);
  // 身体
  p.ellipse(12, 13, 7.5, 6.5 + w * 0.3, B);
  p.ellipse(14.5, 15, 4.2, 3.6, S);
  p.ellipse(16, 16, 2.5, 2, D);
  p.ellipse(10, 10, 3.2, 2.2, H);
  p.set(9, 9, HL);
  // 叶子
  p.strand([[12, 7], [9, 3], [6, 2]], B, 2);
  p.set(7, 2, H);
  p.strand([[12, 7], [15, 2], [18, 2 + w]], H, 2);
  p.set(16, 2, HL);
  // 嘴和牙
  p.span(14, 9, 16, M);
  p.span(15, 10, 15, M);
  for (const x of [9, 11, 13, 15]) p.set(x, 14, T);
  p.set(10, 11, EY);
  p.set(15, 11, EY);
  finish(p, 'wood', 12, 22, 7, 2);
  return p;
}

// 水鬼（水）：长发苍白的游魂（冰青白高光 → 幽蓝 → 靛紫暗部）
function shuigui(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xa6cef2, S = 0x6488c4, D = 0x425b96, H = 0xe4f4ff, HR = 0x1c2038, EY = 0xbff8ff;
  const w = f === 1 ? 1 : -1;
  const lift = f === 1 ? 1 : 0;
  p.oy = -lift;
  // 尾巴
  p.strand([[12, 15], [11 + w, 18], [13 + w, 20], [12, 21]], S, 3);
  p.set(13 + w, 20, D);
  // 身体
  p.ellipse(12, 12, 5.5, 5, B);
  p.ellipse(14, 13, 3.2, 3.5, S);
  p.ellipse(10, 10, 2.5, 2, H);
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

// 火鸦（火）：拖着火尾的乌鸦（金白火尖 → 橘红 → 朱红火羽 → 绛紫羽暗部）
function huoya(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x521c24, R = 0xd83c28, O = 0xff9e38, Y = 0xffe45c, EY = 0xfff6a0;
  const up = f === 0;
  // 火尾
  p.strand([[7, 11], [4, 9], [2, 11]], O, 2);
  p.strand([[7, 12], [3, 13]], Y, 2);
  p.set(2, 11, Y);
  // 身体
  p.ellipse(12, 11, 5, 3.5, R);
  p.ellipse(13, 12, 3.5, 2.2, B);
  p.span(9, 10, 14, O);
  // 头和喙
  p.ellipse(17, 9, 3, 2.8, R);
  p.span(9, 20, 21, Y);
  p.set(20, 10, O);
  p.set(17, 8, EY);
  // 翅膀
  if (up) {
    p.strand([[11, 9], [9, 4], [6, 2]], O, 2);
    p.strand([[13, 9], [14, 4], [16, 2]], R, 2);
    p.set(6, 2, Y);
    p.set(7, 3, Y);
  } else {
    p.strand([[11, 12], [8, 16], [5, 17]], O, 2);
    p.strand([[13, 12], [14, 16], [16, 18]], R, 2);
    p.set(5, 17, Y);
    p.set(6, 16, Y);
  }
  finish(p, 'fire', 12, 22, 4, 1.4);
  return p;
}

// 铁甲兵（金）：红缨头盔、持长枪（冷白钢高光 → 银灰 → 靛蓝钢影）
function tiejia(f: number): PC {
  const p = new PC(28, 28);
  const A = 0xaab6c4, S = 0x68768a, H = 0xe6eef6, RD = 0xc83a2e, RDH = 0xf0644e, D = 0x262438, WD = 0x704830, BL = 0xf0f6fc;
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
  p.set(8, 13, H);
  for (const y of [15, 18]) p.span(y, 9, 18, S);
  p.rect(18, 12, 2, 10, S);
  p.span(21, 8, 19, RD);
  // 手臂握枪
  p.rect(19, 14 - t, 3, 3, A);
  p.rect(6, 13 + t, 2, 6, S);
  // 头盔
  p.rect(9, 4, 10, 8, A);
  p.span(4, 9, 18, H);
  p.set(9, 5, H);
  p.rect(17, 4, 2, 8, S);
  p.span(8, 11, 18, D);
  p.set(16, 8, 0xff6a5a);
  // 红缨
  p.rect(13, 1, 3, 3, RD);
  p.set(13, 1, RDH);
  p.set(12, 2, RD);
  finish(p, 'metal', 14, 26, 7, 2);
  return p;
}

// 竹叶青（木）：盘身昂首的青蛇（暖柠绿高光 → 竹翠 → 深青腹影）
function zhushe(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x62c44a, S = 0x34863c, H = 0xbef27c, EY = 0xffe44a, TG = 0xee403a;
  const w = f === 1 ? 1 : -1;
  // 盘起的身体
  p.strand([[4, 20], [8, 19 + w], [12, 20], [16, 19 - w], [18, 17]], S, 3);
  p.strand([[5, 19], [9, 18 + w], [13, 19], [16, 18 - w]], B, 2);
  p.set(8, 18 + w, H);
  // 昂起的脖子和头
  p.strand([[18, 17], [17, 13], [16, 10]], B, 3);
  p.ellipse(18, 8, 3.5, 2.5, B);
  p.span(7, 16, 20, H);
  p.set(19, 7, EY);
  // 信子
  if (f === 1) {
    p.set(22, 9, TG);
    p.set(23, 8, TG);
  } else p.set(22, 9, TG);
  finish(p, 'wood', 12, 22, 7, 2);
  return p;
}

// 瘴蟾（土）：背上鼓着毒囊的蟾蜍
function zhangchan(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xac883e, S = 0x76582a, H = 0xdcbe66, PO = 0x9ed84a, PH = 0xe2ff8e, EY = 0xff5a3a, M = 0x2a1816;
  const puff = f === 1 ? 0.6 : 0;
  // 后腿
  p.ellipse(7, 19, 3.5, 2.2, S);
  p.ellipse(17, 19, 3.5, 2.2, S);
  // 身体
  p.ellipse(12, 15, 7, 5, B);
  p.ellipse(12, 17, 5.5, 2.5, H);
  // 背上的毒囊
  p.circle(9, 11, 2 + puff, PO);
  p.circle(14, 10, 2.4 + puff, PO);
  p.set(13, 9, PH);
  p.set(8, 10, PH);
  // 眼睛和嘴
  p.circle(17, 10, 1.6, B);
  p.set(17, 10, EY);
  p.span(15, 16, 18, M);
  // 前脚
  p.rect(15, 19, 2, 2, S);
  p.rect(9, 19, 2, 2, S);
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 狼妖（金，Boss）：银白巨狼，四足奔跑（暖银白高光 → 冷蓝银灰 → 靛灰暗部）
function langyao(f: number): PC {
  const p = new PC(56, 48);
  const W = 0xecf0f6, S = 0xa4b0c4, D = 0x68748a, EY = 0xff3a3a, M = 0x2a1824, GD = 0xebb84a;
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

// 千年树妖（木，Boss）：带脸的古树（6 级色相偏移树冠：暖金绿受光簇 → 翠绿 → 青松绿背光）
function shuyao(f: number): PC {
  const p = new PC(64, 64);
  const T = 0x724e30, TS = 0x4c3120, TD = 0x34201a, TH = 0x9c7448;
  const L = 0x428f3e, LS = 0x265e36, LD = 0x18422d, LH = 0x74c856, LHL = 0xb4ec6e;
  const EY = 0xa8ff6a, M = 0x1a1014;
  const w = f === 1 ? 1 : 0;
  // 根
  p.strand([[24, 52], [16, 58], [10, 60]], TS, 4);
  p.strand([[40, 52], [48, 58], [54, 60]], TD, 4);
  p.strand([[32, 54], [32, 60]], TS, 4);
  // 树干
  for (let y = 22; y <= 56; y++) {
    const hw = 9 + Math.round((y - 22) / 9);
    p.span(y, 32 - hw, 31 + hw, T);
    p.span(y, 31 + hw - 3, 31 + hw, TS);
    p.set(31 + hw, y, TD);
    p.set(32 - hw + 1, y, TH);
  }
  p.line(26, 30, 27, 50, TS);
  p.line(37, 34, 36, 52, TD);
  // 脸
  p.ellipse(27, 36, 3, 2.5, M);
  p.ellipse(37, 36, 3, 2.5, M);
  p.set(27, 36, EY);
  p.set(37, 36, EY);
  p.ellipse(32, 45, 5, 3, M);
  p.span(44, 29, 35, TS);
  // 枝干手臂
  p.strand([[23, 30], [14, 26 - w], [8, 20 - w]], T, 4);
  p.strand([[41, 30], [50, 26 + w], [56, 20 + w]], TS, 4);
  // 树冠（球体光影 + 暖黄绿像素叶簇）
  const blobs: [number, number, number][] = [[32, 14, 13], [18, 18, 9], [46, 18, 9], [10, 16, 6], [54, 16, 6], [25, 8, 7], [39, 8, 7]];
  for (const [x, y, r] of blobs) p.circle(x + (x < 32 ? -w : w), y, r, L);
  for (const [x, y, r] of blobs) p.circle(x + 2 + (x < 32 ? -w : w), y + 3, r * 0.62, LS);
  for (const [x, y, r] of blobs) p.circle(x + 4 + (x < 32 ? -w : w), y + 5, r * 0.35, LD);
  for (const [x, y, r] of blobs) p.circle(x - 2, y - 3, r * 0.42, LH);
  for (const [x, y, r] of blobs) p.circle(x - 3, y - 4, r * 0.22, LHL);
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
  two('en_zhushe', zhushe, 6);
  two('en_zhangchan', zhangchan, 3);
  addSheet(scene, 'boss_langyao', [0, 1, 2, 3].map(langyao));
  addAnim(scene, 'boss_langyao_move', 'boss_langyao', [0, 1, 2, 3], 8);
  two('boss_shuyao', shuyao, 2);
}
