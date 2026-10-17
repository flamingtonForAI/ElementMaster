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

// 穿山甲（土）：拱背鳞甲，会钻地；帧 2、3 是地面上拱起的土包（暖金鳞 → 赭褐 → 深褐暗部）
function chuanshan(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xc89452, S = 0x8e6036, D = 0x5e3c26, H = 0xecc47c, EY = 0xffe254, SN = 0xd8a080;
  if (f >= 2) {
    // 土包 + 露出一截鳞背
    const w = f === 3 ? 1 : 0;
    const MU = 0x7a5a36, MS = 0x56402a, MH = 0xa88050;
    p.ellipse(12, 19, 8, 3.5, MU);
    p.ellipse(13, 20, 6, 2.2, MS);
    p.span(16, 8, 14, MH);
    p.ellipse(12 + w, 16, 4, 2.2 + w * 0.5, B);
    p.span(15 - w, 10 + w, 14 + w, H);
    p.span(17, 10 + w, 14 + w, S);
    for (const x of [6, 17, 19]) p.set(x + w, 17 + (x % 2), MH);
    p.set(4, 20, MS);
    p.set(20 - w, 21, MU);
    finish(p, 'earth', 12, 22, 7, 2);
    return p;
  }
  const t = f === 1 ? 1 : 0;
  // 尾巴往下卷
  p.strand([[6, 15], [3, 17], [3, 20], [5, 21]], S, 3);
  p.strand([[6, 14], [4, 16]], B, 2);
  // 腿
  p.rect(8 - t, 18, 2, 3, D);
  p.rect(14 + t, 18, 2, 3, S);
  // 拱背
  p.ellipse(11, 14, 7, 5, B);
  p.ellipse(12, 16.5, 6, 2.5, S);
  // 鳞片：三排弧形暗纹 + 受光边
  for (const [y, x0, x1] of [[11, 7, 15], [14, 5, 17], [17, 6, 16]] as const)
    for (let x = x0; x <= x1; x += 3) {
      p.set(x, y, D);
      p.set(x + 1, y - 1, H);
    }
  p.span(9, 8, 13, H);
  // 头和长吻
  p.ellipse(18, 15, 3, 2.5, B);
  p.strand([[20, 16], [23, 17]], SN, 2);
  p.set(19, 17, S);
  p.set(18, 14, EY);
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 山魈（土）：独脚跳的山精，赤面蓝颊、白眉，举着石块（赭黄毛 → 褐 → 深褐）
function shanxiao(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xb07a44, S = 0x784c2c, D = 0x4e3020, H = 0xd8a868;
  const FACE = 0xe0503c, BLUE = 0x5a8ce8, BROW = 0xf0e8d4, EY = 0xffe254, RK = 0x8a8f9c, RKH = 0xc4c8d0;
  const up = f === 1 ? -1 : 0;
  // 独脚
  p.rect(11, 18 + up, 3, 4 - up, S);
  p.span(21, 10, 15, D);
  p.oy = up;
  // 身体（佝偻）
  p.ellipse(12, 13, 5.5, 5, B);
  p.ellipse(13.5, 15, 3.5, 3, S);
  p.ellipse(10, 11, 2.5, 2, H);
  // 双臂举石
  p.strand([[8, 12], [7, 7], [9, 4]], B, 2);
  p.strand([[16, 12], [17, 7], [15, 4]], S, 2);
  p.ellipse(12, 3, 4, 2.6, RK);
  p.span(2, 10, 13, RKH);
  // 脸
  p.ellipse(16, 10, 3, 2.8, FACE);
  p.line(17, 9, 17, 12, BLUE);
  p.set(15, 11, BLUE);
  p.span(8, 14, 18, BROW);
  p.set(16, 9, EY);
  p.set(18, 9, EY);
  p.oy = 0;
  finish(p, 'earth', 12, 22, 6, 2);
  return p;
}

// 赤狐（火）：大尾巴尖上烧着火的狐狸（暖橙高光 → 朱橙 → 绛红暗部），白胸口
function chihu(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xe06a2e, S = 0xa8402a, D = 0x6a2426, H = 0xffac58, W = 0xf4e6cc, O = 0xff9e38, Y = 0xffe45c, EY = 0xfff07a, M = 0x2a1418;
  const t = f === 1 ? 1 : 0;
  // 尾巴：蓬起，尾尖是火
  p.strand([[6, 15], [3, 12 - t], [3, 8 - t]], S, 3);
  p.strand([[6, 14], [4, 11 - t]], B, 2);
  p.circle(3, 6 - t, 2, O);
  p.set(3, 4 - t, Y);
  p.set(2, 5 - t, Y);
  // 四条细腿，交替迈步
  p.strand([[8, 17], [7 - t, 21]], D, 2);
  p.strand([[10, 17], [11 + t, 21]], S, 2);
  p.strand([[14, 17], [13 + t, 21]], D, 2);
  p.strand([[16, 17], [17 - t, 21]], S, 2);
  // 身体
  p.ellipse(12, 15, 6.5, 3.5, B);
  p.ellipse(12.5, 17, 5, 1.6, S);
  p.span(12, 8, 15, H);
  // 头、尖吻、白胸
  p.ellipse(18, 12, 3.5, 3, B);
  p.strand([[20, 13], [23, 14]], B, 2);
  p.set(23, 14, M);
  p.span(15, 17, 21, W);
  p.ellipse(16, 15, 1.5, 1.5, W);
  p.span(10, 17, 19, H);
  // 耳朵
  p.strand([[16, 10], [16, 6]], B, 2);
  p.set(16, 6, D);
  p.strand([[19, 10], [20, 6]], S, 2);
  p.set(19, 11, EY);
  finish(p, 'fire', 12, 22, 7, 2);
  return p;
}

// 火精（火）：飘着的一团火，焰心发白，两只黑眼（朱红外焰 → 橙 → 金黄 → 白焰心）
function huojing(f: number): PC {
  const p = new PC(24, 24);
  const R = 0xd83c28, O = 0xff8a30, Y = 0xffd850, W = 0xfff6c8, D = 0x8a2222, EY = 0x3a1018;
  const w = f === 1 ? 1 : -1;
  p.oy = f === 1 ? -1 : 0;
  // 外焰和窜起的火舌
  p.ellipse(12, 14, 6, 6, R);
  p.strand([[8, 11], [7 + w, 6], [9, 3]], R, 3);
  p.strand([[12, 9], [12 - w, 4], [13, 1]], O, 3);
  p.strand([[16, 11], [17 + w, 6], [16, 4]], R, 2);
  // 内焰
  p.ellipse(12, 14, 4.2, 4.5, O);
  p.ellipse(12, 15, 2.8, 3, Y);
  p.ellipse(11.5, 15.5, 1.4, 1.6, W);
  // 下摆
  p.strand([[9, 19], [10, 21]], D, 2);
  p.strand([[15, 19], [14, 21]], D, 2);
  p.set(10, 12, EY);
  p.set(14, 12, EY);
  p.set(10, 11, EY);
  p.set(14, 11, EY);
  p.oy = 0;
  finish(p, 'fire', 12, 22, 5, 1.6);
  return p;
}

// 残兵（金）：披破甲的骷髅兵，握断剑，眼窝里一点青火；帧 2 是倒地的尸骸（碎骨、头盔、断剑）
function canbing(f: number): PC {
  const p = new PC(24, 24);
  const BO = 0xe2dac4, BS = 0xa49c88, A = 0x8e96a4, AH = 0xc4cad4, AS = 0x5c6272, AD = 0x3a3c4c, RU = 0xa0643c, EY = 0x8ff0ff, BL = 0xd8e0ea, WD = 0x6a4a30;
  if (f === 2) {
    p.ellipse(12, 20, 7, 2.2, BS);
    p.strand([[5, 20], [10, 19]], BO, 2);
    p.strand([[13, 21], [19, 19]], BO, 2);
    p.set(8, 18, BO);
    p.set(17, 18, BS);
    p.line(14, 17, 21, 14, BL);
    p.set(13, 17, WD);
    p.ellipse(10, 17, 3.5, 2.5, A);
    p.span(15, 8, 11, AH);
    p.span(19, 7, 13, AD);
    finish(p, 'metal', 12, 22, 7, 2);
    return p;
  }
  const t = f === 1 ? 1 : 0;
  // 骨腿
  p.rect(9 - t, 17, 2, 5, BS);
  p.rect(13 + t, 17, 2, 5, BO);
  // 破甲：锈迹，破口露出肋骨
  p.rect(7, 10, 10, 8, A);
  p.span(10, 7, 16, AH);
  for (const y of [13, 16]) p.span(y, 8, 15, AS);
  p.rect(15, 10, 2, 8, AS);
  p.set(9, 14, RU);
  p.set(10, 15, RU);
  p.set(14, 12, RU);
  p.span(12, 10, 12, AD);
  p.set(11, 13, BO);
  // 骨手和断剑
  p.rect(5, 11 + t, 2, 5, BO);
  p.rect(17, 11 - t, 2, 4, BS);
  p.line(19, 13 - t, 22, 6 - t, BL);
  p.set(18, 14 - t, WD);
  // 骷髅头 + 破盔
  p.rect(8, 4, 7, 6, BO);
  p.rect(8, 2, 8, 3, A);
  p.span(2, 9, 14, AH);
  p.set(16, 4, AS);
  p.rect(9, 6, 2, 2, AD);
  p.rect(12, 6, 2, 2, AD);
  p.set(10, 6, EY);
  p.set(13, 6, EY);
  p.span(9, 9, 13, BS);
  finish(p, 'metal', 12, 22, 6, 2);
  return p;
}

// 飞镰（金）：裹着破布的游魂提一把长镰，上下飘（冷灰布 → 深灰 → 亮钢刃）
function feilian(f: number): PC {
  const p = new PC(24, 24);
  const C = 0x6c7080, CS = 0x464a5a, CH = 0x9aa0b0, BL = 0xe4ecf4, BS = 0x9aa6b8, WD = 0x6a4a30, EY = 0xffe254;
  p.oy = f === 1 ? -1 : 0;
  // 破布身子，下摆碎成条
  p.ellipse(11, 11, 5, 5, C);
  p.ellipse(12.5, 12.5, 3, 3.5, CS);
  p.ellipse(9.5, 9, 2.4, 1.8, CH);
  for (const [x, l] of [[7, 5], [10, 7], [13, 6], [15, 4]]) p.line(x, 14, x + f, 14 + l, x % 2 ? CS : C, 2);
  // 兜帽下的眼
  p.span(10, 10, 13, 0x1c1424);
  p.set(11, 10, EY);
  p.set(13, 10, EY);
  // 长柄弯镰
  p.line(15, 18, 19, 4, WD, 2);
  p.strand([[19, 4], [16, 2], [11, 2], [8, 4]], BL, 2);
  p.strand([[18, 5], [13, 4], [9, 5]], BS, 1);
  p.oy = 0;
  finish(p, 'metal', 12, 22, 5, 1.6);
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

// 山魈王（土，Boss）：佝偻巨猿，白鬃赤面、蓝颊、金臂环，长臂撑地走（赭黄 → 褐 → 深褐）
function shanxiaoBoss(f: number): PC {
  const p = new PC(56, 48);
  const B = 0xb07a44, S = 0x7a4e2e, D = 0x4e3020, H = 0xdcae6c;
  const MANE = 0xf0eadc, MS = 0xb8b0a4, FACE = 0xe0503c, FD = 0xa83228, BLUE = 0x5a8ce8, EY = 0xffe254, M = 0x2a1824, GD = 0xebb84a;
  const ph = (f / 4) * Math.PI * 2;
  const s = Math.sin(ph);
  const bob = Math.round(Math.abs(s));
  // 后腿
  p.strand([[18, 32], [16 - Math.round(2 * s), 39], [15 - Math.round(2 * s), 43]], S, 5);
  p.strand([[26, 33], [27 + Math.round(2 * s), 40], [28 + Math.round(2 * s), 43]], D, 5);
  p.oy = bob;
  // 远侧手臂
  p.strand([[34, 22], [40, 30], [42 + Math.round(2 * s), 42 - bob]], S, 5);
  // 身体
  p.ellipse(26, 26, 13, 10, B);
  p.ellipse(28, 30, 10, 5, S);
  p.ellipse(21, 21, 7, 4, H);
  // 白鬃
  for (let i = 0; i < 6; i++) p.strand([[26 + i * 3, 17], [22 + i * 3, 11 + (i % 2) * 2]], i % 2 ? MS : MANE, 4);
  p.ellipse(36, 18, 8, 6, MANE);
  p.ellipse(38, 21, 6, 4, MS);
  // 脸
  p.ellipse(42, 20, 6, 5.5, FACE);
  p.ellipse(44, 23, 4, 2.5, FD);
  p.line(44, 18, 45, 24, BLUE, 2);
  p.line(40, 21, 40, 24, BLUE);
  p.span(17, 38, 46, MANE);
  p.set(41, 19, EY);
  p.set(42, 19, EY);
  p.set(45, 19, EY);
  p.span(25, 42, 47, M);
  p.set(43, 26, 0xffffff);
  p.set(46, 26, 0xffffff);
  // 近侧手臂 + 金臂环
  p.strand([[30, 26], [36, 33], [37 - Math.round(2 * s), 42 - bob]], B, 6);
  p.strand([[33, 29], [35, 31]], GD, 3);
  p.span(42 - bob, 34 - Math.round(2 * s), 40 - Math.round(2 * s), D);
  p.oy = 0;
  finish(p, 'earth', 28, 43, 18, 3.5);
  return p;
}

// 毕方（火，Boss）：独脚的青鹤，身上赤纹、白喙，双翼和尾羽烧着火（青身 → 深青 → 赤纹，火翼橙黄）
function bifang(f: number): PC {
  const p = new PC(56, 48);
  const B = 0x3a8a8a, BS = 0x22585e, BH = 0x6ac0b4, RD = 0xd83c28, O = 0xff9e38, Y = 0xffe45c, BK = 0xf0ead8, EY = 0xffe254, LEG = 0xc8372d;
  const s = Math.sin((f / 4) * Math.PI * 2);
  const flap = Math.round(s * 5);
  // 独脚
  p.strand([[26, 32], [27, 39], [26, 44]], LEG, 2);
  p.strand([[26, 44], [22, 45]], LEG, 1);
  p.strand([[26, 44], [30, 45]], LEG, 1);
  p.oy = -Math.round(Math.abs(s));
  // 远侧火翼
  p.strand([[24, 22], [16, 14 - flap], [8, 10 - Math.round(flap * 1.4)]], RD, 5);
  p.strand([[16, 14 - flap], [6, 15 - flap]], O, 3);
  // 尾羽火
  p.strand([[16, 28], [8, 30], [3, 27]], RD, 4);
  p.strand([[14, 28], [6, 26]], O, 2);
  p.set(3, 27, Y);
  p.set(4, 25, Y);
  // 身体
  p.ellipse(26, 26, 11, 7, B);
  p.ellipse(27, 29, 9, 3.5, BS);
  p.ellipse(23, 23, 6, 3, BH);
  for (const [x, y] of [[21, 27], [27, 25], [31, 28], [25, 30]]) p.span(y, x, x + 1, RD);
  // 长颈、头、红冠、白喙
  p.strand([[34, 22], [38, 15], [39, 10]], B, 4);
  p.strand([[35, 22], [39, 15]], BS, 2);
  p.ellipse(40, 9, 4, 3.5, B);
  p.span(7, 38, 41, BH);
  p.strand([[39, 6], [37, 2], [40, 3]], RD, 2);
  p.strand([[43, 9], [50, 11]], BK, 2);
  p.set(51, 11, BK);
  p.set(41, 8, EY);
  // 近侧火翼
  p.strand([[28, 23], [36, 16 - flap], [44, 13 - Math.round(flap * 1.4)]], O, 5);
  p.strand([[30, 22], [38, 17 - flap]], Y, 2);
  p.strand([[36, 16 - flap], [46, 18 - flap]], RD, 3);
  p.oy = 0;
  finish(p, 'fire', 27, 44, 16, 3.5);
  return p;
}

// 刑天（金，Boss）：断首的巨人，以乳为目、以脐为口，左手持干（盾）、右手举戚（斧）（铜褐皮 → 褐 → 深褐，钢灰战裙）
function xingtian(f: number): PC {
  const p = new PC(56, 56);
  const SK = 0xb7875a, SS = 0x8a603e, SD = 0x5a3c2c, SH = 0xdcae7c;
  const A = 0x8e96a4, AH = 0xc4cad4, AS = 0x5c6272, BL = 0xe0e8f0, BLS = 0x9aa6b8, WD = 0x6a4a30, GD = 0xd8b04a;
  const WH = 0xf6f0e0, PU = 0x1c1424, M = 0x2a1418, NECK = 0xa83228, NECKD = 0x6e1c22;
  const s = Math.sin((f / 4) * Math.PI * 2);
  const st = Math.round(2 * s);
  // 腿
  p.strand([[22, 38], [21 - st, 46], [20 - st, 52]], SS, 6);
  p.strand([[32, 38], [33 + st, 46], [34 + st, 52]], SD, 6);
  p.span(52, 16 - st, 23 - st, SD);
  p.span(52, 31 + st, 38 + st, SD);
  p.oy = Math.round(Math.abs(s));
  // 远侧手臂举戚
  p.strand([[36, 20], [42, 14], [44, 8]], SS, 5);
  p.line(44, 4, 46, 40, WD, 2);
  p.ellipse(49, 9, 5, 7, BL);
  p.ellipse(50.5, 10, 3, 5, BLS);
  p.span(3, 47, 50, 0xf8fcff);
  // 无头的躯干
  p.ellipse(28, 26, 12, 13, SK);
  p.ellipse(31, 29, 8, 9, SS);
  p.ellipse(24, 20, 6, 5, SH);
  // 断颈
  p.ellipse(28, 13, 5, 2, NECK);
  p.span(13, 26, 30, NECKD);
  // 乳目、脐口
  p.ellipse(24, 23, 2.2, 1.6, WH);
  p.ellipse(32, 23, 2.2, 1.6, WH);
  p.set(24, 23, PU);
  p.set(32, 23, PU);
  p.span(21, 22, 26, SD);
  p.span(21, 30, 34, SD);
  p.ellipse(28, 31, 4, 2, M);
  for (const x of [26, 28, 30]) p.set(x, 30, WH);
  // 战裙
  p.rect(17, 36, 22, 5, A);
  p.span(36, 17, 38, AH);
  p.span(40, 17, 38, AS);
  for (const x of [20, 25, 30, 35]) p.line(x, 37, x, 40, AS);
  // 近侧手臂持干
  p.strand([[18, 22], [14, 28], [14, 32]], SK, 5);
  p.ellipse(11, 30, 7.5, 10.5, GD);
  p.ellipse(11, 30, 6.2, 9.2, 0x8a6a34);
  p.ellipse(12, 31, 4.5, 7.5, 0x6a4e28);
  p.circle(11, 30, 2, GD);
  p.oy = 0;
  finish(p, 'metal', 28, 52, 18, 3.5);
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
  two('en_shanxiao', shanxiao, 5);
  // 穿山甲：0、1 走路，2、3 钻地的土包
  addSheet(scene, 'en_chuanshan', [0, 1, 2, 3].map(chuanshan));
  addAnim(scene, 'en_chuanshan_move', 'en_chuanshan', [0, 1], 5);
  addAnim(scene, 'en_chuanshan_dig', 'en_chuanshan', [2, 3], 8);
  addSheet(scene, 'boss_langyao', [0, 1, 2, 3].map(langyao));
  addAnim(scene, 'boss_langyao_move', 'boss_langyao', [0, 1, 2, 3], 8);
  two('boss_shuyao', shuyao, 2);
  addSheet(scene, 'boss_shanxiao', [0, 1, 2, 3].map(shanxiaoBoss));
  addAnim(scene, 'boss_shanxiao_move', 'boss_shanxiao', [0, 1, 2, 3], 6);
  two('en_chihu', chihu, 9);
  two('en_huojing', huojing, 6);
  two('en_feilian', feilian, 4);
  // 残兵：0、1 走路，2 是倒地的尸骸
  addSheet(scene, 'en_canbing', [0, 1, 2].map(canbing));
  addAnim(scene, 'en_canbing_move', 'en_canbing', [0, 1], 4);
  addSheet(scene, 'boss_bifang', [0, 1, 2, 3].map(bifang));
  addAnim(scene, 'boss_bifang_move', 'boss_bifang', [0, 1, 2, 3], 8);
  addSheet(scene, 'boss_xingtian', [0, 1, 2, 3].map(xingtian));
  addAnim(scene, 'boss_xingtian_move', 'boss_xingtian', [0, 1, 2, 3], 5);
}
