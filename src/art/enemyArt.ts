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

// 石俑（土）：方肩短腿的陶土墓俑，大陶脸、发髻、厚拳，不持兵器（暖金高光 → 陶褐 → 紫褐暗部）
// 地域外观：moss 竹林苔封俑，肩头、发际和甲缝长青苔；rock 山林山岩俑，肩甲换成灰岩块、身上带裂纹；
// lava 赤焰谷熔壳俑，肩头和头顶结黑色熔壳、甲缝透出火光；armor 兵冢残甲俑，套着残破铁肩甲、胸口插一支断箭。土黄仍占主体
function shiyong(f: number, skin: '' | 'moss' | 'rock' | 'lava' | 'armor' = ''): PC {
  const p = new PC(24, 24);
  const B = 0xcd9d54, S = 0x8e6438, H = 0xf0ce86, D = 0x61422c, HR = 0x4a2e2a, EY = 0xffe254;
  const t = f === 1 ? 1 : 0;
  // 短腿，两脚分开
  p.rect(8, 18, 3, 2, D);
  p.rect(13, 18, 3, 2, D);
  p.rect(7 - t, 20, 4, 2, B);
  p.span(20, 7 - t, 9 - t, H);
  p.rect(13 + t, 20, 4, 2, S);
  // 甲身：三道甲片
  p.rect(7, 10, 10, 8, B);
  p.span(10, 8, 15, H);
  p.span(13, 7, 16, S);
  p.span(16, 7, 16, S);
  p.rect(15, 11, 2, 7, S);
  p.span(17, 7, 16, D);
  // 手臂与厚拳，离开身体一格，走路时一前一后
  p.rect(4, 12, 2, 3, D);
  p.rect(2, 15 - t, 4, 3, B);
  p.set(2, 15 - t, H);
  p.set(5, 17 - t, S);
  p.rect(18, 12, 2, 3, D);
  p.rect(18, 15 + t, 4, 3, S);
  p.set(18, 15 + t, B);
  // 圆角方肩甲，比身体宽
  p.rect(3, 9, 5, 3, B);
  p.span(9, 4, 7, H);
  p.set(3, 9, -1);
  p.set(3, 10, H);
  p.rect(16, 9, 5, 3, S);
  p.span(9, 16, 19, B);
  p.set(20, 9, -1);
  // 大陶脸，朝右：发际、浓眉、发光眼、抿嘴
  p.rect(9, 2, 7, 8, B);
  p.span(2, 9, 15, HR);
  p.set(9, 3, HR);
  p.set(10, 3, H);
  p.span(3, 11, 14, H);
  p.rect(15, 3, 1, 7, S);
  p.set(9, 6, S);
  p.span(4, 11, 12, D);
  p.span(4, 14, 15, D);
  p.set(12, 5, EY);
  p.set(14, 5, EY);
  p.span(8, 12, 14, S);
  p.span(10, 9, 15, D);
  // 发髻
  p.rect(11, 0, 3, 2, HR);
  p.set(11, 0, S);
  if (skin === 'rock') {
    const RK = 0x8a8f9c, RKH = 0xc4c8d0, RKD = 0x5c6070;
    p.rect(3, 8, 5, 3, RK);
    p.span(7, 4, 5, RK);
    p.set(4, 6, RKH);
    p.span(8, 3, 5, RKH);
    p.set(7, 10, RKD);
    p.rect(16, 8, 5, 3, RKD);
    p.span(7, 18, 19, RK);
    p.set(19, 6, RK);
    p.span(8, 17, 18, RK);
    p.line(9, 11, 11, 14, D);
    p.set(12, 15, D);
    p.set(10, 4, S);
    p.set(10, 5, S);
    p.set(3, 16 - t, RKD);
    p.set(19, 15 + t, RK);
  }
  if (skin === 'lava') {
    const CR = 0x3e3236, CRH = 0x5e4e50, GL = 0xff8a30, GY = 0xffd05a;
    p.rect(3, 8, 5, 3, CR);
    p.span(8, 4, 6, CRH);
    p.set(7, 7, CR);
    p.rect(16, 8, 5, 3, CR);
    p.set(17, 8, CRH);
    p.span(1, 10, 14, CR);
    p.set(12, 0, CR);
    p.set(5, 10, GL);
    p.set(18, 10, GL);
    p.line(9, 11, 10, 13, GL);
    p.set(10, 12, GY);
    p.line(14, 14, 13, 16, GL);
    p.set(10, 7, GL);
    p.set(19, 17 + t, GL);
  }
  if (skin === 'armor') {
    const A = 0x8e96a4, AH = 0xc4cad4, AS = 0x5c6272, RU = 0xa0643c, WD = 0x6a4a30, FE = 0xe2dac4;
    p.rect(3, 8, 5, 3, A);
    p.span(8, 4, 7, AH);
    p.set(5, 10, AS);
    p.set(6, 9, RU);
    p.rect(16, 8, 4, 3, AS);
    p.span(8, 16, 18, A);
    p.set(19, 10, RU);
    p.line(13, 13, 17, 9, WD);
    p.set(17, 8, FE);
    p.set(18, 9, FE);
    p.set(12, 14, D);
    p.set(8, 15, AS);
    p.set(9, 15, AH);
  }
  if (skin === 'moss') {
    const MS = 0x4f7d3a, MH = 0x86b850;
    p.span(9, 4, 6, MH);
    p.span(10, 3, 5, MS);
    p.span(9, 17, 19, MS);
    p.span(2, 10, 13, MS);
    p.set(11, 2, MH);
    p.set(14, 1, MS);
    p.span(13, 8, 10, MS);
    p.set(9, 14, MS);
    p.set(14, 16, MS);
    p.set(19, 17 + t, MS);
  }
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 藤怪（木）：歪扭的根团妖，三根粗根足、钩形藤臂、白木裂面具（嫩黄绿高光 → 翠绿 → 青蓝深绿暗部）
function tengguai(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x52a648, S = 0x2f6e3d, D = 0x1e4c36, H = 0x98e06c, HL = 0xc8f488;
  const T = 0xf2e8c8, TS = 0xc4ae7e, M = 0x2a1620, EY = 0xff5e4d;
  const w = f === 1 ? 1 : 0;
  // 三根粗根足
  p.strand([[9, 17], [6, 20], [4 - w, 22]], S, 2);
  p.strand([[11, 18], [11 + w, 22]], B, 2);
  p.strand([[13, 17], [16, 20], [18 + w, 22]], D, 2);
  // 扭成一股的树干身体
  p.ellipse(11, 12, 4.2, 5.6, B);
  p.ellipse(13, 14, 2.6, 3.6, S);
  p.line(9, 9, 10, 16, H);
  p.set(9, 9, HL);
  p.line(12, 9, 11, 13, S);
  // 钩形藤臂，和身体之间留空
  p.strand([[8, 10], [5, 8], [2, 10], [2, 13]], B, 2);
  p.set(3, 15 + w, S);
  p.set(4, 7, H);
  p.strand([[15, 13], [18, 12], [21, 14], [21, 17 - w]], S, 2);
  p.set(20, 18 - w, D);
  p.set(19, 11, H);
  // 两片大叶从脑后长出
  p.strand([[11, 5], [8, 2], [5, 1]], B, 2);
  p.set(6, 1, H);
  p.strand([[13, 4], [14, 1], [17, 0 + w]], H, 2);
  p.set(15, 1, HL);
  // 白木面具当头：尖下巴，中间一道裂纹，两个空眼洞透红光
  p.span(3, 11, 15, T);
  p.span(4, 10, 16, T);
  p.span(5, 10, 16, T);
  p.span(6, 10, 16, T);
  p.span(7, 11, 15, TS);
  p.span(8, 12, 14, TS);
  p.set(13, 9, TS);
  p.line(13, 3, 13, 8, TS);
  p.span(5, 11, 12, M);
  p.span(5, 14, 15, M);
  p.set(12, 5, EY);
  p.set(15, 5, EY);
  p.set(11, 4, 0xfffaf0);
  finish(p, 'wood', 12, 22, 7, 2);
  return p;
}

// 水鬼（水）：前倾飘行的游魂，白脸探前、黑发后拖、S 形水尾（冰青白高光 → 幽蓝 → 靛紫暗部）
function shuigui(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xa6cef2, S = 0x6488c4, D = 0x425b96, H = 0xe4f4ff, HR = 0x252a4c, HRH = 0x3e4a7a, SK = 0xdcf0f6, EYE = 0x161830;
  const w = f === 1 ? 1 : -1;
  p.oy = f === 1 ? -1 : 0;
  // S 形水尾
  p.strand([[12, 15], [10, 17], [12, 19], [14 + w, 20]], S, 3);
  p.strand([[14 + w, 20], [15 + w, 21]], D, 2);
  p.set(11, 17, B);
  // 宽袖长衫，前倾
  p.ellipse(13, 12, 4.5, 4, B);
  p.ellipse(14.5, 13.5, 3, 2.6, S);
  p.span(9, 11, 14, H);
  // 探前的手
  p.strand([[16, 11], [19, 12]], B, 2);
  p.set(20, 13, SK);
  p.set(21, 13, SK);
  // 黑发：两大束向后拖
  p.ellipse(14, 5, 4, 3.2, HR);
  p.strand([[12, 4], [8, 4 + w], [4, 6]], HR, 3);
  p.strand([[11, 7], [7, 9], [4, 10 - w]], HR, 2);
  p.set(13, 3, HRH);
  p.set(9, 4 + w, HRH);
  // 白脸偏右，深色眼窝
  p.rect(15, 5, 3, 4, SK);
  p.set(18, 6, SK);
  p.set(18, 7, SK);
  p.span(4, 15, 17, HR);
  p.set(16, 6, EYE);
  p.set(18, 6, EYE);
  p.set(17, 8, 0xa8c4d4);
  p.oy = 0;
  finish(p, 'water', 12, 22, 5, 1.6);
  return p;
}

// 火鸦（火）：深色乌鸦，三角火翼、胸口一团亮火囊、火尾（金白火尖 → 橘红 → 朱红火羽 → 绛紫羽暗部）
function huoya(f: number): PC {
  const p = new PC(24, 24);
  const BK = 0x5a2230, BH = 0x84353a, R = 0xd83c28, O = 0xff9e38, Y = 0xffe45c, EY = 0xfff6a0;
  const up = f === 0;
  // 火尾
  p.strand([[8, 12], [5, 10], [2, 9]], R, 2);
  p.strand([[8, 13], [4, 14], [2, 13]], O, 2);
  p.set(1, 9, Y);
  p.set(2, 13, Y);
  // 远侧翅膀
  if (up) {
    p.strand([[13, 10], [14, 6], [16, 3]], BK, 2);
    p.set(16, 2, R);
    p.set(17, 3, O);
  } else {
    p.strand([[13, 13], [15, 16], [17, 17]], BK, 2);
    p.set(17, 18, R);
  }
  // 身体
  p.ellipse(12, 12, 4.6, 3.2, BK);
  p.span(10, 10, 14, BH);
  // 头和尖喙
  p.ellipse(17, 10, 2.6, 2.4, BK);
  p.set(16, 9, BH);
  p.set(17, 9, EY);
  p.span(10, 19, 20, Y);
  p.set(21, 11, O);
  p.set(20, 11, O);
  // 胸口火囊：死后自爆的提示
  p.ellipse(14.5, 13, 2.3, 1.8, O);
  p.set(14, 12, Y);
  p.set(15, 12, Y);
  p.set(16, 13, R);
  // 近侧三角火翼
  if (up) {
    p.strand([[11, 11], [8, 6], [5, 2]], R, 3);
    p.strand([[12, 10], [10, 5], [10, 1]], O, 2);
    p.set(5, 2, Y);
    p.set(4, 1, Y);
    p.set(10, 1, Y);
    p.set(7, 5, O);
  } else {
    p.strand([[11, 13], [8, 17], [5, 19]], R, 3);
    p.strand([[12, 14], [11, 18], [10, 20]], O, 2);
    p.set(4, 19, Y);
    p.set(10, 20, Y);
  }
  // 爪
  p.set(12, 16, BK);
  p.set(14, 16, BK);
  finish(p, 'fire', 12, 22, 4, 1.4);
  return p;
}

// 铁甲兵（金）：窄身前倾，长枪斜指前上（冲锋预告）、宽檐盔护颈、空面甲、冷白肩甲（冷白钢高光 → 银灰 → 靛蓝钢影）
function tiejia(f: number): PC {
  const p = new PC(28, 28);
  const A = 0xaab6c4, S = 0x68768a, H = 0xe6eef6, RD = 0xc83a2e, D = 0x262438, WD = 0x704830, BL = 0xf0f6fc;
  const t = f === 1 ? 1 : 0;
  // 前后跨步的腿
  p.rect(10 - t, 21, 3, 4, D);
  p.rect(9 - t, 25, 4, 1, S);
  p.rect(16 + t, 21, 3, 4, S);
  p.rect(16 + t, 25, 4, 1, A);
  // 甲裙
  p.rect(10, 19, 9, 3, S);
  p.span(19, 10, 18, A);
  p.span(21, 11, 17, D);
  // 窄身鱼鳞甲
  p.rect(11, 11, 8, 8, A);
  p.span(11, 11, 17, H);
  p.span(14, 11, 18, S);
  p.span(17, 11, 18, S);
  p.rect(18, 12, 1, 7, S);
  p.span(18, 11, 18, RD);
  // 远侧手臂
  p.rect(9, 12, 2, 5, S);
  // 盔：圆顶 + 短盔檐 + 两侧垂下的护颈，面甲全黑，盔顶一点红缨
  p.ellipse(15, 5.5, 3.6, 3.2, A);
  p.span(3, 13, 16, H);
  p.set(12, 4, H);
  p.span(7, 11, 19, H);
  p.rect(11, 8, 2, 3, S);
  p.set(11, 8, A);
  p.rect(13, 8, 5, 3, D);
  p.rect(18, 8, 1, 3, S);
  p.set(16, 9, 0xff6a5a);
  p.set(15, 1, A);
  p.set(15, 0, RD);
  p.set(14, 0, RD);
  // 长枪：枪杆斜过身前，枪头朝右上
  p.line(4, 23, 23, 6, WD);
  p.span(5, 22, 24, BL);
  p.span(4, 23, 25, BL);
  p.span(3, 24, 26, BL);
  p.span(2, 25, 26, H);
  p.set(27, 1, BL);
  p.set(26, 1, H);
  p.set(21, 8, RD);
  p.set(22, 7, RD);
  // 双手握杆 + 冷白肩甲
  p.rect(13, 14, 2, 2, A);
  p.rect(19, 9 - t, 2, 2, A);
  p.rect(17, 11, 4, 2, BL);
  p.set(20, 12, A);
  finish(p, 'metal', 14, 26, 7, 2);
  return p;
}

// 竹叶青（木）：低伏成扁 S 的粗竹节蛇，大三角头、尾尖一簇竹叶、米黄腹（暖柠绿高光 → 竹翠 → 深青节环）
function zhushe(f: number): PC {
  const p = new PC(24, 24);
  const B = 0x62c44a, S = 0x34863c, D = 0x245c34, H = 0xbef27c, BL = 0xeee2a6, EY = 0xffe44a, TG = 0xee403a;
  const ph = f === 1 ? 1.6 : 0;
  // 竹节身：低伏成扁 S，上亮下米黄腹，每 4 格一道深色节环；尾端收细
  const bodyY = (x: number) => Math.round(17.5 + 2 * Math.sin((x + ph) / 3));
  for (let x = 1; x <= 15; x++) {
    const y = bodyY(x);
    const node = x % 4 === 0;
    if (x >= 4) p.set(x, y - 2, node ? S : H);
    p.set(x, y - 1, node ? D : B);
    if (x >= 2) p.set(x, y, node ? D : B);
    if (x >= 3) p.set(x, y + 1, node ? S : BL);
  }
  // 尾尖一簇竹叶
  const ty = bodyY(1);
  p.strand([[2, ty - 1], [0, ty - 4]], H, 2);
  p.set(3, ty - 3, B);
  p.set(4, ty - 4, B);
  // 压低的脖子
  p.strand([[15, bodyY(15) - 1], [17, 15]], B, 3);
  // 大三角头：后脑宽、吻部收尖，朝右
  p.span(11, 16, 18, H);
  p.span(12, 15, 20, B);
  p.span(13, 15, 22, B);
  p.span(14, 15, 20, BL);
  p.span(15, 16, 17, S);
  p.set(15, 12, H);
  p.set(18, 12, EY);
  p.set(19, 12, D);
  // 信子
  p.set(23, 13 + (f === 1 ? -1 : 0), TG);
  if (f === 1) p.set(23, 11, TG);
  finish(p, 'wood', 12, 22, 7, 2);
  return p;
}

// 瘴蟾（土）：宽扁泥蟾，后腿粗大，背上三个大毒囊，浅黄喉袋吐弹前鼓起；绿色只在毒囊上
function zhangchan(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xac883e, S = 0x76582a, D = 0x56401e, H = 0xdcbe66, PO = 0x9ed84a, PS = 0x5f9a34, PH = 0xe2ff8e;
  const TH = 0xf2e2a0, EY = 0xff5a3a, M = 0x2a1816;
  const puff = f === 1 ? 0.7 : 0;
  // 远侧后腿
  p.ellipse(4.5, 17, 2.4, 2.6, D);
  // 宽扁身体 + 大扁头
  p.ellipse(10, 16, 6.5, 3.8, B);
  p.ellipse(15.5, 14.5, 4.6, 3.4, B);
  p.ellipse(11, 18.2, 6, 1.6, S);
  p.span(13, 13, 18, H);
  // 近侧粗后腿：大腿根单独一块亮面，脚掌向后摊开
  p.ellipse(6, 17, 3.4, 2.8, H);
  p.ellipse(6.6, 17.8, 2.8, 2, B);
  p.set(9, 17, D);
  p.set(9, 18, D);
  p.span(20, 1, 8, S);
  p.set(1, 19, S);
  p.rect(15, 19, 2, 2, S);
  p.set(17, 20, D);
  // 背上三个毒囊，彼此分开，只占背部
  for (const [x, y, r] of [[5, 12, 1.7], [8.5, 11, 2], [12, 11.5, 1.6]] as const) {
    p.circle(x, y, r + puff, PO);
    p.set(Math.round(x), Math.round(y + r * 0.6), PS);
    p.set(Math.round(x - 1), Math.round(y - r * 0.6), PH);
  }
  // 头顶两颗鼓眼
  p.circle(15.5, 11, 1.6, H);
  p.circle(19, 11.5, 1.3, B);
  p.set(16, 11, EY);
  p.set(15, 11, M);
  p.set(19, 11, EY);
  // 阔嘴一直咧到腮
  p.span(15, 15, 20, M);
  p.set(14, 14, M);
  // 喉袋：吐弹前鼓成圆
  p.circle(17, 17.5, 1.5 + puff * 1.4, TH);
  p.set(16, 17, 0xfff6d0);
  finish(p, 'earth', 11, 22, 8, 2);
  return p;
}

// 穿山甲（土）：豆形拱背，三列大甲片、尖长吻、粗锥尾；帧 2、3 是土包里露出的三角背甲（暖金鳞 → 赭褐 → 深褐暗部）
function chuanshan(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xc89452, S = 0x8e6036, D = 0x5e3c26, H = 0xecc47c, EY = 0x2a1820, SN = 0xd8a080;
  if (f >= 2) {
    // 土包 + 一排三角背甲
    const w = f === 3 ? 1 : 0;
    const MU = 0x7a5a36, MS = 0x56402a, MH = 0xa88050;
    p.ellipse(12, 19, 8.5, 3.5, MU);
    p.ellipse(13, 20, 6.5, 2.2, MS);
    p.span(16, 7, 13, MH);
    for (const [x, h] of [[7, 3], [12, 4], [17, 3]] as const) {
      for (let k = 0; k <= h + w; k++) p.span(17 - k, x - (h + w - k), x + (h + w - k) - 1, k === h + w ? H : B);
      p.set(x, 17, S);
    }
    for (const x of [5, 19]) p.set(x - w, 18, MH);
    p.set(4, 20, MS);
    p.set(20 - w, 21, MU);
    finish(p, 'earth', 12, 22, 7, 2);
    return p;
  }
  const t = f === 1 ? 1 : 0;
  // 粗锥尾往后拖地
  p.strand([[6, 15], [3, 18], [1, 20]], S, 3);
  p.strand([[6, 14], [3, 17]], B, 2);
  p.set(1, 21, D);
  // 短腿
  p.rect(8 - t, 18, 2, 3, D);
  p.rect(14 + t, 18, 2, 3, S);
  // 豆形拱背
  p.ellipse(11.5, 14, 7, 5, B);
  p.ellipse(12, 17, 6, 1.8, S);
  // 三列大甲片：从后往前叠成瓦，每片暗底边、亮顶尖，背脊轮廓自然起伏
  for (const [y, xs] of [[10.5, [9, 13]], [13, [6.5, 10.5, 14.5]], [15.5, [8, 12, 16]]] as const)
    for (const x of xs) {
      p.ellipse(x, y, 2.4, 1.8, S);
      p.ellipse(x - 0.3, y - 0.5, 1.9, 1.2, B);
      p.set(Math.round(x - 1), Math.round(y - 1.2), H);
    }
  // 头和尖长吻
  p.ellipse(18, 15.5, 2.6, 2.2, B);
  p.strand([[20, 16], [23, 17]], SN, 2);
  p.set(23, 18, SN);
  p.set(18, 17, S);
  p.set(18, 14, EY);
  finish(p, 'earth', 12, 22, 7, 2);
  return p;
}

// 山魈（土）：佝偻的独脚山精，一只粗臂把灰色巨石举到脑后作势要投，赤面白眉蓝颊探在肩前（赭黄毛 → 褐 → 深褐）
function shanxiao(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xb07a44, S = 0x784c2c, D = 0x4e3020, H = 0xd8a868;
  const FACE = 0xe0503c, BLUE = 0x5a8ce8, BROW = 0xf0e8d4, EY = 0xffe254, RK = 0x8a8f9c, RKH = 0xc4c8d0, RKD = 0x5c6070;
  const up = f === 1 ? -1 : 0;
  // 单只粗脚，大脚掌
  p.rect(9, 16, 4, 5 - up, S);
  p.span(20, 8, 14, D);
  p.span(21, 8, 14, D);
  p.oy = up;
  // 佝偻的身子，向前倾
  p.ellipse(10.5, 13, 6, 4.6, B);
  p.ellipse(12, 15.5, 4, 2.2, S);
  p.span(9, 7, 11, H);
  p.set(6, 11, H);
  // 举到脑后的粗臂 + 巨石（占上身约三分之一）
  p.strand([[8, 10], [5, 7], [5, 4]], B, 3);
  p.set(4, 6, H);
  p.ellipse(6, 2.8, 5, 2.9, RK);
  p.span(0, 4, 8, RKH);
  p.set(2, 2, RKH);
  p.span(5, 4, 9, RKD);
  p.set(10, 3, RKD);
  // 垂下的前臂
  p.strand([[14, 13], [16, 15], [17, 17]], S, 2);
  p.set(18, 17, D);
  // 头探在肩前：褐毛头顶、白眉、赤面、蓝颊棱、黄眼
  p.ellipse(15, 8, 3.8, 3.4, B);
  p.span(5, 13, 16, H);
  p.ellipse(16.5, 10, 3, 2.8, FACE);
  p.span(7, 13, 19, BROW);
  p.set(15, 8, EY);
  p.set(18, 8, EY);
  p.line(16, 9, 16, 11, BLUE);
  p.line(19, 9, 19, 10, BLUE);
  p.span(12, 16, 18, D);
  p.oy = 0;
  finish(p, 'earth', 11, 22, 6, 2);
  return p;
}

// 赤狐（火）：细腰四足、尖耳，一条比身子还大的火焰尾向后上方扬起（暖橙高光 → 朱橙 → 绛红暗部），奶白胸口与吻
function chihu(f: number): PC {
  const p = new PC(24, 24);
  const B = 0xe06a2e, S = 0xa8402a, D = 0x6a2426, H = 0xffac58, W = 0xf4e6cc, O = 0xff9e38, Y = 0xffe45c, FW = 0xfff6c8, EY = 0xfff07a, M = 0x2a1418;
  const t = f === 1 ? 1 : 0;
  // 火焰大尾：从尾根扬起，越往上越亮
  p.ellipse(5, 11.5, 3.4, 2.6, S);
  p.ellipse(4, 9.5 - t * 0.5, 3.6, 2.8, B);
  p.span(8, 2, 5, H);
  p.ellipse(3, 6.5 - t, 3, 3, O);
  p.ellipse(2.8, 6 - t, 1.8, 2, Y);
  p.set(2, 5 - t, FW);
  p.strand([[1, 4 - t], [0, 1]], O, 1);
  p.strand([[4, 4 - t], [5, 1 + t]], O, 2);
  p.set(5, 1 + t, Y);
  p.set(7, 12, B);
  // 四条细腿，交替迈步
  p.strand([[8, 16], [7 - t, 21]], D, 2);
  p.strand([[10, 16], [11 + t, 21]], S, 2);
  p.strand([[14, 16], [13 + t, 21]], D, 2);
  p.strand([[16, 16], [17 - t, 21]], S, 2);
  // 细腰身子：胸口厚、腰收细
  p.ellipse(11, 14.5, 4.5, 2.4, B);
  p.ellipse(15.5, 14, 2.8, 3, B);
  p.span(16, 8, 14, S);
  p.span(12, 8, 13, H);
  p.ellipse(16.5, 15, 1.6, 1.8, W);
  // 头：尖吻奶白下颌，长尖耳
  p.ellipse(18.5, 11, 3, 2.6, B);
  p.span(9, 17, 19, H);
  p.strand([[20, 12], [23, 12]], B, 2);
  p.span(13, 19, 22, W);
  p.set(23, 12, M);
  p.strand([[17, 9], [16, 5]], B, 2);
  p.set(16, 5, D);
  p.set(17, 7, D);
  p.strand([[19, 9], [20, 5]], S, 2);
  p.set(20, 11, EY);
  p.set(19, 11, M);
  finish(p, 'fire', 12, 22, 7, 2);
  return p;
}

// 火精（火）：漂浮的深炭色破炉壳，矮梨形，中央炉口透出亮火核，顶上破口窜出两瓣短火舌，壳缝透火光
// 刻意不画成一团火，免得和玩家的火系弹丸混淆
function huojing(f: number): PC {
  const p = new PC(24, 24);
  const SH = 0x463a40, SS = 0x2e2428, SL = 0x6e5e64, R = 0xd83c28, O = 0xff8a30, Y = 0xffd850, W = 0xfff6c8;
  const w = f === 1 ? 1 : 0;
  p.oy = f === 1 ? -1 : 0;
  // 两瓣短火舌
  p.strand([[10, 9], [9, 5], [10, 3 - w]], R, 2);
  p.strand([[10, 8], [10, 5]], O, 1);
  p.set(10, 2 - w, Y);
  p.strand([[14, 9], [15, 7], [15, 5 + w]], O, 2);
  p.set(15, 7, Y);
  p.set(16, 4 + w, Y);
  // 矮梨形炉壳
  p.ellipse(12, 15, 6, 5, SH);
  p.ellipse(12, 10.5, 4, 2.6, SH);
  p.ellipse(14.5, 16, 3.4, 3.6, SS);
  p.span(9, 9, 11, SL);
  p.set(7, 13, SL);
  p.set(7, 14, SL);
  // 顶上破口
  p.span(8, 11, 13, SS);
  p.set(12, 8, O);
  // 壳缝透火光
  p.line(8, 15, 9, 18, R);
  p.set(16, 11, R);
  p.set(17, 12, O);
  // 炉口火核：吐火时一明一暗
  p.ellipse(12.5, 15, 2.8 + w * 0.4, 2.4 + w * 0.4, O);
  p.ellipse(12.5, 15, 1.7, 1.5, Y);
  p.set(12, 15, W);
  p.set(13, 14, W);
  // 炉口上方一对火眼
  p.set(10, 12, Y);
  p.set(14, 12, Y);
  // 下方滴落的火星
  p.set(11, 21, O);
  p.set(14, 20 + w, R);
  p.oy = 0;
  finish(p, 'fire', 12, 22, 5, 1.6);
  return p;
}

// 残兵（金）：蹒跚的骷髅兵，歪斜断盔、只剩一侧肩甲、握断刀、背插破战旗（暗铁灰 + 脏白骨 + 少量锈褐）
// 帧 2 是倒地的尸骸，保留同一顶盔和断旗
function canbing(f: number): PC {
  const p = new PC(24, 24);
  const BO = 0xe2dac4, BS = 0xa49c88, A = 0x8e96a4, AH = 0xc4cad4, AS = 0x5c6272, AD = 0x3a3c4c, RU = 0xa0643c, EY = 0x8ff0ff, BL = 0xd8e0ea, WD = 0x6a4a30;
  const FL = 0x7a3e38, FLS = 0x52302e;
  if (f === 2) {
    // 散落的骨头、断刀、倒下的旗
    p.line(2, 20, 9, 15, WD);
    p.span(14, 6, 9, FL);
    p.span(15, 6, 8, FLS);
    p.set(9, 16, FL);
    p.ellipse(13, 20, 7, 2.2, BS);
    p.strand([[7, 20], [12, 19]], BO, 2);
    p.strand([[14, 21], [19, 19]], BO, 2);
    p.set(17, 18, BS);
    p.line(16, 17, 21, 15, BL);
    p.set(15, 17, WD);
    // 歪倒的断盔压着头骨
    p.rect(10, 15, 4, 3, BO);
    p.set(11, 16, AD);
    p.span(14, 9, 13, A);
    p.span(13, 10, 12, AH);
    p.set(14, 15, AS);
    finish(p, 'metal', 12, 22, 7, 2);
    return p;
  }
  const t = f === 1 ? 1 : 0;
  // 背后斜插的破战旗
  p.line(9, 12, 5, 1, WD);
  for (let y = 1; y <= 7; y++) p.span(y, 1, y < 5 ? 4 : 3, y % 3 === 0 ? FLS : FL);
  p.set(1, 8, FL);
  p.set(3, 8, FLS);
  p.set(4, 7, -1);
  // 一长一短的骨腿，蹒跚
  p.rect(9 - t, 17, 2, 5, BS);
  p.rect(13 + t, 18, 2, 4, BO);
  p.set(15 + t, 21, BO);
  // 破甲身：锈迹，右侧破口露出肋骨
  p.rect(8, 10, 8, 7, A);
  p.span(10, 8, 13, AH);
  p.span(13, 8, 12, AS);
  p.span(16, 8, 15, AD);
  p.set(9, 14, RU);
  p.set(10, 15, RU);
  p.set(11, 11, RU);
  for (const y of [11, 13, 15]) p.span(y, 13, 15, BO);
  p.span(12, 13, 15, AD);
  p.span(14, 13, 15, AD);
  // 只剩远侧一块肩甲
  p.rect(5, 9, 4, 3, A);
  p.span(9, 5, 8, AH);
  p.set(8, 11, AS);
  // 垂下的远侧骨臂
  p.strand([[6, 12], [6, 16 + t]], BS, 2);
  // 近侧骨臂握断刀
  p.strand([[16, 11], [18, 14 - t]], BO, 2);
  p.set(18, 15 - t, WD);
  p.line(19, 13 - t, 21, 9 - t, BL);
  p.set(22, 9 - t, BS);
  p.set(20, 12 - t, AH);
  // 骷髅头 + 歪斜的断盔
  p.rect(9, 4, 6, 5, BO);
  p.rect(10, 8, 4, 1, BS);
  p.set(11, 8, AD);
  p.set(13, 8, AD);
  p.rect(10, 5, 2, 2, AD);
  p.rect(13, 5, 2, 2, AD);
  p.set(11, 6, EY);
  p.set(14, 6, EY);
  p.span(1, 8, 11, AH);
  p.span(2, 8, 13, A);
  p.span(3, 9, 15, A);
  p.span(4, 13, 16, AS);
  p.set(12, 1, AS);
  p.set(16, 5, AS);
  finish(p, 'metal', 12, 22, 6, 2);
  return p;
}

// 飞镰（金）：横向悬浮的中空古镰框，一弯大月牙刃，中央一面铜面甲由两段短粗链拴住（冷白刃 → 银灰 → 靛灰钢影）
function feilian(f: number): PC {
  const p = new PC(24, 24);
  const BL = 0xe4ecf4, BS = 0x9aa6b8, BD = 0x5c6272, CH = 0x6c7080, MK = 0x8a6a34, MKH = 0xc8a050, MKD = 0x5a4224, EY = 0x8ff0ff;
  p.oy = f === 1 ? -1 : 0;
  // 月牙刃：外缘亮，中心镂空
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 24; x++) {
      const r1 = Math.hypot(x + 0.5 - 12, y + 0.5 - 10);
      const r2 = Math.hypot(x + 0.5 - 14.5, y + 0.5 - 12.5);
      if (r1 <= 9.5 && r2 > 7.6) p.set(x, y, r1 > 8.4 ? BL : r2 < 8.7 ? BD : BS);
    }
  // 两段短粗链
  for (const [x, y, c] of [[11, 10, CH], [10, 9, BS], [9, 8, CH], [11, 14, CH], [9, 14, BS], [8, 14, CH]] as const) p.set(x, y, c);
  p.set(10, 14, CH);
  // 中央铜面甲
  p.ellipse(14.5, 12.5, 2.8, 3.2, MK);
  p.span(10, 13, 15, MKH);
  p.span(15, 14, 15, MKD);
  p.set(13, 12, EY);
  p.set(16, 12, EY);
  p.set(17, 13, MKD);
  p.oy = 0;
  finish(p, 'metal', 12, 22, 5, 1.6);
  return p;
}

// 狼妖（金，Boss）：四足低伏的银白巨狼，前肩厚重、背上一排刃状铁鬃、夸张前爪，张口獠牙（暖银白高光 → 冷蓝银灰 → 靛灰暗部）
function langyao(f: number): PC {
  const p = new PC(56, 48);
  const W = 0xecf0f6, S = 0xa4b0c4, D = 0x68748a, ST = 0x8a98b0, STH = 0xdfe8f4, EY = 0xff3a3a, M = 0x2a1824, GD = 0xebb84a, CL = 0x3a3446;
  const ph = (f / 4) * Math.PI * 2;
  const s = Math.round(3 * Math.sin(ph));
  // 后腿（小、在后）
  p.strand([[15, 33], [12 - s, 38], [14 - s, 42]], D, 4);
  p.strand([[20, 34], [21 + s, 39], [20 + s, 42]], S, 4);
  // 刃状尾
  p.strand([[10, 27], [5, 22], [2, 15]], S, 4);
  p.strand([[9, 26], [5, 21]], W, 2);
  for (const [x, y] of [[4, 19], [2, 14], [6, 23]] as const) p.tri([x, y], [x + 2, y + 1], [x - 2, y - 3], ST);
  // 远侧前腿
  p.strand([[36, 32], [38 - s, 37], [37 - s, 42]], D, 5);
  p.span(43, 35 - s, 40 - s, CL);
  // 身子整体压低
  p.oy = 3;
  // 后半身低、前胸厚
  p.ellipse(22, 28, 12, 6, W);
  p.ellipse(36, 23, 10, 9, W);
  p.ellipse(28, 32, 12, 2.6, S);
  p.ellipse(28, 21, 8, 3, 0xffffff);
  // 背上一排刃状铁鬃，越靠前越高
  for (let i = 0; i < 6; i++) {
    const bx = 22 + i * 3.4, by = 22 - i * 1.2;
    const tip: [number, number] = [bx - 4, by - 7 - i * 0.6];
    p.tri([bx - 2, by], [bx + 2, by], tip, ST);
    p.line(bx - 2, by, tip[0], tip[1], STH);
  }
  // 金项圈
  p.strand([[42, 20], [43, 29]], GD, 2);
  // 压低前伸的头：张口獠牙、红眼、后掠尖耳
  p.ellipse(47, 26, 6, 5, W);
  p.ellipse(51.5, 27.5, 4, 2.6, W);
  p.span(30, 46, 53, S);
  p.span(29, 47, 54, M);
  p.set(54, 28, M);
  p.set(49, 30, 0xffffff);
  p.set(52, 30, 0xffffff);
  p.set(50, 28, 0xffffff);
  p.rect(46, 24, 2, 1, EY);
  p.span(23, 45, 48, D);
  p.tri([42, 22], [46, 21], [39, 14], S);
  p.line(43, 21, 40, 15, STH);
  p.oy = 0;
  // 近侧粗前腿，肘部外撇 + 夸张前爪
  p.strand([[40, 31], [43 + s, 36], [42 + s, 41]], S, 6);
  p.ellipse(43 + s, 42, 4, 1.8, W);
  for (const x of [45, 47, 49]) p.line(x + s, 42, x + s + 1, 43, CL);
  finish(p, 'metal', 28, 43, 18, 3.5);
  return p;
}

// 千年树妖（木，Boss）：裂口空心的古树脸、两根节瘤枝臂、三叉根脚、偏向一侧的大树冠，青苔点缀
// （6 级色相偏移树冠：暖金绿受光簇 → 翠绿 → 青松绿背光）
function shuyao(f: number): PC {
  const p = new PC(64, 64);
  const T = 0x724e30, TS = 0x4c3120, TD = 0x34201a, TH = 0x9c7448;
  const L = 0x428f3e, LS = 0x265e36, LD = 0x18422d, LH = 0x74c856, LHL = 0xb4ec6e, MS = 0x5f8a3c;
  const EY = 0xa8ff6a, M = 0x1a1014;
  const w = f === 1 ? 1 : 0;
  // 三叉根脚，根与根之间留空
  p.strand([[25, 52], [17, 56], [9, 60]], TS, 4);
  p.strand([[18, 56], [15, 61]], TD, 2);
  p.strand([[32, 54], [31, 61]], TS, 4);
  p.strand([[39, 52], [47, 56], [55, 60]], TD, 4);
  p.strand([[46, 56], [49, 61]], TD, 2);
  p.set(10, 59, MS);
  p.set(11, 58, MS);
  // 微扭的树干
  for (let y = 22; y <= 56; y++) {
    const hw = 9 + Math.round((y - 22) / 9);
    const cx = 31 + Math.round(Math.sin((y - 22) / 11));
    p.span(y, cx - hw, cx + hw - 1, T);
    p.span(y, cx + hw - 4, cx + hw - 1, TS);
    p.set(cx + hw - 1, y, TD);
    p.set(cx - hw + 1, y, TH);
  }
  p.line(25, 28, 26, 50, TS);
  p.line(38, 30, 37, 52, TD);
  p.line(30, 50, 33, 56, TS);
  // 树干青苔
  for (const [x, y] of [[23, 24], [24, 25], [23, 26], [22, 40], [23, 41], [24, 53]]) p.set(x, y, MS);
  // 空心树脸：凸起的眉棱、深眼洞里一点绿光、裂开的树洞嘴
  p.span(32, 23, 30, TH);
  p.span(32, 34, 41, TH);
  p.ellipse(27, 36, 3.4, 2.8, M);
  p.ellipse(38, 36, 3.4, 2.8, M);
  p.rect(27, 36, 2, 1, EY);
  p.rect(38, 36, 2, 1, EY);
  p.ellipse(32, 46, 5.5, 3.8, M);
  for (const x of [29, 32, 35]) p.set(x, 43, T);
  for (const x of [30, 34]) p.set(x, 49, T);
  // 偏左的大树冠（球体光影 + 暖黄绿像素叶簇）
  const blobs: [number, number, number][] = [[28, 13, 13], [14, 17, 9], [42, 16, 8], [7, 21, 6], [50, 21, 5], [21, 6, 7], [35, 6, 6]];
  for (const [x, y, r] of blobs) p.circle(x + (x < 30 ? -w : w), y, r, L);
  for (const [x, y, r] of blobs) p.circle(x + 2 + (x < 30 ? -w : w), y + 3, r * 0.62, LS);
  for (const [x, y, r] of blobs) p.circle(x + 4 + (x < 30 ? -w : w), y + 5, r * 0.35, LD);
  for (const [x, y, r] of blobs) p.circle(x - 2, y - 3, r * 0.42, LH);
  for (const [x, y, r] of blobs) p.circle(x - 3, y - 4, r * 0.22, LHL);
  // 节瘤枝臂从树干两侧伸出，压在树冠前面，末端分叉成爪
  p.strand([[23, 36], [15, 33 - w], [9, 28 - w]], T, 4);
  p.circle(15, 33 - w, 2.4, TH);
  p.strand([[9, 28 - w], [4, 25 - w]], TS, 2);
  p.strand([[9, 28 - w], [4, 31 - w]], TS, 2);
  p.strand([[9, 28 - w], [9, 23 - w]], TS, 2);
  p.strand([[40, 37], [49, 34 + w], [55, 30 + w]], TS, 4);
  p.circle(48, 34 + w, 2.2, T);
  p.strand([[55, 30 + w], [60, 27 + w]], TD, 2);
  p.strand([[55, 30 + w], [60, 33 + w]], TD, 2);
  p.strand([[55, 30 + w], [56, 25 + w]], TD, 2);
  finish(p, 'wood', 32, 60, 22, 3.5);
  return p;
}

// 山魈王（土，Boss）：上宽下窄的佝偻巨猿，肩背两块岩峰、白鬃赤面、蓝颊，长臂撑地走、金臂环（赭黄 → 褐 → 深褐）
function shanxiaoBoss(f: number): PC {
  const p = new PC(56, 48);
  const B = 0xb07a44, S = 0x7a4e2e, D = 0x4e3020, H = 0xdcae6c;
  const MANE = 0xf0eadc, MS = 0xb8b0a4, FACE = 0xe0503c, FD = 0xa83228, BLUE = 0x5a8ce8, EY = 0xffe254, M = 0x2a1824, GD = 0xebb84a;
  const RK = 0x8a8f9c, RKH = 0xc4c8d0, RKD = 0x5c6070;
  const ph = (f / 4) * Math.PI * 2;
  const s = Math.round(2 * Math.sin(ph));
  const bob = Math.round(Math.abs(Math.sin(ph)));
  // 短粗后腿
  p.strand([[21, 34], [20 - s, 40], [19 - s, 43]], D, 5);
  p.strand([[29, 34], [30 + s, 40], [31 + s, 43]], S, 5);
  p.span(43, 16 - s, 22 - s, D);
  p.span(43, 28 + s, 34 + s, S);
  p.oy = bob;
  // 远侧长臂撑地，垂在躯干外
  p.strand([[15, 17], [9, 28], [9 + s, 40]], S, 5);
  p.ellipse(9 + s, 41, 3.4, 2.4, D);
  // 上宽下窄的躯干
  for (let y = 14; y <= 35; y++) {
    const hw = 12 - Math.round((y - 14) * 0.3);
    p.span(y, 25 - hw, 24 + hw, B);
    p.span(y, 24 + hw - 4, 24 + hw, S);
  }
  p.ellipse(20, 19, 6, 3.5, H);
  p.span(35, 19, 30, D);
  // 肩背两块岩峰
  for (const [cx, top, w] of [[16, 5, 6], [29, 3, 7]] as const) {
    for (let y = top; y <= 15; y++) {
      const hw = Math.min(w, Math.round((y - top) * 0.9) + 1);
      p.span(y, cx - hw, cx + hw - 1, RK);
      p.set(cx + hw - 1, y, RKD);
      if (y < top + 4) p.set(cx - hw, y, RKH);
    }
    p.line(cx, top + 3, cx + 2, top + 8, RKD);
  }
  // 近侧巨臂撑地 + 金臂环
  p.strand([[35, 20], [42, 30], [43 - s, 40]], B, 7);
  p.strand([[39, 25], [42, 23]], GD, 3);
  p.set(38, 25, 0xfff0a0);
  p.ellipse(43 - s, 41, 4.4, 2.8, S);
  p.span(43, 39 - s, 47 - s, D);
  // 白鬃围着脸
  p.ellipse(38, 15, 7.5, 6.5, MANE);
  p.ellipse(39, 19, 5.5, 3.5, MS);
  for (let i = 0; i < 4; i++) p.strand([[35 + i * 2, 10], [32 + i * 2, 6 + (i % 2)]], i % 2 ? MS : MANE, 3);
  // 加大的赤面：白眉、蓝颊棱、獠牙
  p.ellipse(44, 18, 6, 5.5, FACE);
  p.ellipse(46, 21, 4, 2.5, FD);
  p.span(14, 39, 50, MANE);
  p.span(15, 40, 49, MANE);
  p.rect(41, 16, 2, 1, EY);
  p.rect(46, 16, 2, 1, EY);
  p.line(43, 18, 43, 22, BLUE, 2);
  p.line(48, 18, 48, 21, BLUE);
  p.span(23, 43, 49, M);
  p.set(44, 24, 0xffffff);
  p.set(48, 24, 0xffffff);
  p.oy = 0;
  finish(p, 'earth', 28, 43, 18, 3.5);
  return p;
}


// 毕方（火，Boss）：纤长独脚的青鹤，长颈尖喙，青灰身配朱红翼缘，双翼扬成高而窄的 V，翼尖与尾羽烧着火
function bifang(f: number): PC {
  const p = new PC(56, 48);
  const B = 0x3a8a8a, BS = 0x22585e, BH = 0x6ac0b4, RD = 0xd83c28, O = 0xff9e38, Y = 0xffe45c, BK = 0xf0ead8, EY = 0xffe254, LEG = 0xc8372d;
  const s = Math.sin((f / 4) * Math.PI * 2);
  // k：0 = 双翼扬到最高，1 = 压到最低
  const k = (1 - s) / 2;
  // 纤长独脚
  p.strand([[27, 30], [28, 37], [27, 44]], LEG, 2);
  p.strand([[27, 44], [23, 45]], LEG, 1);
  p.strand([[27, 44], [31, 45]], LEG, 1);
  p.oy = -Math.round(Math.abs(s));
  // 远侧翼：高而窄，翼缘朱红，翼尖着火
  const far: [number, number] = [Math.round(15 - 5 * k), Math.round(2 + 14 * k)];
  p.tri([18, 24], [29, 21], far, BS);
  p.tri([22, 23], [27, 21], far, B);
  p.line(18, 24, far[0], far[1], RD, 2);
  p.circle(far[0] + 0.5, far[1] + 0.5, 2, O);
  p.set(far[0], far[1], Y);
  p.set(far[0] - 1, far[1] - 2, O);
  // 长尾羽，尾端着火
  p.strand([[19, 27], [11, 31], [4, 31]], BS, 3);
  p.strand([[19, 28], [10, 33], [5, 34]], RD, 2);
  p.circle(4, 32, 2.2, O);
  p.set(3, 31, Y);
  p.set(4, 32, Y);
  p.set(1, 30, O);
  p.set(2, 35, RD);
  // 修长的身子
  p.ellipse(26, 25, 8.5, 5, B);
  p.ellipse(27, 28, 7, 2.4, BS);
  p.ellipse(23, 23, 5, 2.2, BH);
  for (const [x, y] of [[21, 26], [26, 24], [30, 27]]) p.span(y, x, x + 1, RD);
  // S 形长颈、头、红冠、白色长尖喙
  p.strand([[32, 22], [36, 17], [35, 12], [38, 7]], B, 4);
  p.strand([[33, 22], [36, 18]], BS, 1);
  p.ellipse(40, 6, 3.2, 2.8, B);
  p.span(4, 39, 41, BH);
  p.strand([[39, 3], [38, 0]], RD, 2);
  p.set(40, 1, RD);
  p.strand([[43, 6], [49, 7]], BK, 2);
  p.strand([[49, 7], [52, 8]], BK, 1);
  p.set(41, 5, EY);
  // 近侧翼：高而窄，盖在身前
  const near: [number, number] = [Math.round(37 + 7 * k), Math.round(1 + 15 * k)];
  p.tri([23, 24], [35, 22], near, B);
  p.tri([27, 23], [33, 22], near, BH);
  p.line(35, 22, near[0], near[1], RD, 2);
  p.line(34, 22, near[0] - 1, near[1] + 1, O);
  p.circle(near[0] + 0.5, near[1] + 0.5, 2.4, O);
  p.set(near[0], near[1], Y);
  p.set(near[0] + 1, near[1], Y);
  p.set(near[0] + 1, near[1] - 3, O);
  p.set(near[0] + 2, near[1] - 2, Y);
  p.oy = 0;
  finish(p, 'fire', 27, 44, 16, 3.5);
  return p;
}

// 刑天（金，Boss）：断首的巨人，倒梯形宽厚躯干，以乳为目、以脐为口；左手持干（大圆盾）、右手举戚（短柄阔斧）
// （铜褐皮 → 褐 → 深褐，钢灰战裙）
function xingtian(f: number): PC {
  const p = new PC(56, 56);
  const SK = 0xb7875a, SS = 0x8a603e, SD = 0x5a3c2c, SH = 0xdcae7c;
  const A = 0x8e96a4, AH = 0xc4cad4, AS = 0x5c6272, BL = 0xe0e8f0, BLS = 0x9aa6b8, WD = 0x6a4a30, GD = 0xd8b04a;
  const WH = 0xf6f0e0, PU = 0x1c1424, M = 0x2a1418, NECK = 0xa83228, NECKD = 0x6e1c22;
  const s = Math.sin((f / 4) * Math.PI * 2);
  const st = Math.round(2 * s);
  // 粗腿
  p.strand([[22, 38], [21 - st, 46], [20 - st, 52]], SS, 7);
  p.strand([[33, 38], [34 + st, 46], [35 + st, 52]], SD, 7);
  p.span(52, 15 - st, 24 - st, SD);
  p.span(52, 31 + st, 40 + st, SD);
  p.oy = Math.round(Math.abs(s));
  // 倒梯形躯干：宽肩窄腰
  for (let y = 12; y <= 36; y++) {
    const hw = 16 - Math.round((y - 12) * 0.28);
    p.span(y, 28 - hw, 27 + hw, SK);
    p.span(y, 27 + hw - 5, 27 + hw, SS);
    p.set(27 + hw, y, SD);
  }
  p.ellipse(21, 17, 7, 3.5, SH);
  p.line(28, 26, 28, 35, SS);
  p.span(27, 22, 26, SS);
  p.span(27, 30, 34, SD);
  // 断颈
  p.ellipse(28, 12, 5.5, 2, NECK);
  p.span(12, 25, 31, NECKD);
  // 乳目：压低的粗怒眉切掉眼眶上沿，瞳孔盯向前方
  p.ellipse(21.5, 21, 3.2, 1.8, WH);
  p.ellipse(34.5, 21, 3.2, 1.8, WH);
  p.rect(23, 20, 2, 2, PU);
  p.rect(36, 20, 2, 2, PU);
  p.line(17, 18, 25, 20, SD, 2);
  p.line(39, 18, 31, 20, SD, 2);
  // 胸肌下缘
  p.span(24, 18, 25, SS);
  p.span(24, 31, 37, SD);
  // 脐口：上下两排牙
  p.ellipse(28, 31, 5, 2.8, M);
  for (const x of [25, 27, 29, 31]) p.set(x, 29, WH);
  for (const x of [26, 28, 30]) p.set(x, 33, WH);
  // 右臂高举短柄阔斧，压在躯干外侧
  p.strand([[39, 17], [44, 11], [46, 6]], SS, 6);
  p.set(42, 12, SH);
  p.line(45, 1, 47, 19, WD, 2);
  for (let y = 0; y <= 14; y++)
    for (let x = 47; x <= 55; x++) {
      const d = ((x + 0.5 - 47) / 8.5) ** 2 + ((y + 0.5 - 7) / 7.5) ** 2;
      if (d <= 1) p.set(x, y, d > 0.62 ? BL : BLS);
    }
  p.line(47, 1, 47, 13, AS);
  // 钢灰战裙
  p.rect(17, 36, 23, 5, A);
  p.span(36, 17, 39, AH);
  p.span(40, 17, 39, AS);
  for (const x of [21, 26, 31, 36]) p.line(x, 37, x, 40, AS);
  // 近侧手臂持干：大圆盾
  p.strand([[16, 20], [12, 26], [12, 30]], SK, 6);
  p.ellipse(10, 30, 8, 11, GD);
  p.ellipse(10, 30, 6.6, 9.6, 0x8a6a34);
  p.ellipse(11, 31, 4.8, 7.6, 0x6a4e28);
  p.circle(10, 30, 2.2, GD);
  p.set(9, 29, 0xfff0a0);
  for (const [x, y] of [[10, 21], [4, 30], [10, 39], [16, 30]] as const) p.set(x, y, 0xfff0a0);
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
  two('en_shiyong_moss', (f) => shiyong(f, 'moss'), 4);
  two('en_shiyong_rock', (f) => shiyong(f, 'rock'), 4);
  two('en_shiyong_lava', (f) => shiyong(f, 'lava'), 4);
  two('en_shiyong_armor', (f) => shiyong(f, 'armor'), 4);
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
