import Phaser from 'phaser';
import { PC, addSheet, rng } from './painter';

export const SCROLL_ART_W = 112;
export const SCROLL_ART_H = 68;

/** 渐变天幕 */
function sky(p: PC, cols: number[]) {
  for (let y = 0; y < SCROLL_ART_H; y++) {
    const idx = Math.min(cols.length - 1, Math.floor((y / SCROLL_ART_H) * cols.length));
    p.span(y, 0, SCROLL_ART_W - 1, cols[idx]);
  }
}

/** 远山剪影 */
function ridge(p: PC, baseY: number, amp: number, freq: number, phase: number, col: number, hiCol?: number) {
  for (let x = 0; x < SCROLL_ART_W; x++) {
    const h = Math.round(
      Math.sin(x * freq + phase) * amp +
      Math.cos(x * freq * 2.1 - phase * 0.7) * (amp * 0.45),
    );
    const top = Math.max(4, Math.min(SCROLL_ART_H - 1, baseY - h));
    p.rect(x, top, 1, SCROLL_ART_H - top, col);
    if (hiCol && x % 2 === 0) p.set(x, top, hiCol);
  }
}

/** 内嵌古画锦绫边框 */
function frameBorder(p: PC, colOuter: number, colInner: number) {
  p.rect(0, 0, SCROLL_ART_W, 1, colOuter);
  p.rect(0, SCROLL_ART_H - 1, SCROLL_ART_W, 1, colOuter);
  p.rect(0, 0, 1, SCROLL_ART_H, colOuter);
  p.rect(SCROLL_ART_W - 1, 0, 1, SCROLL_ART_H, colOuter);
  for (const [cx, cy] of [[2, 2], [SCROLL_ART_W - 5, 2], [2, SCROLL_ART_H - 5], [SCROLL_ART_W - 5, SCROLL_ART_H - 5]]) {
    p.rect(cx, cy, 3, 3, colInner);
    p.set(cx + 1, cy + 1, colOuter);
  }
}

/** 第 1 关绘卷：《古道斩狼 · 初窥异变》—— 苍月荒碑、剑气斩狼、远山幽篁泛起青芒 */
function drawScroll1(): PC {
  const p = new PC(SCROLL_ART_W, SCROLL_ART_H);
  const R = rng(101);
  sky(p, [0x121828, 0x1a2438, 0x243448, 0x2c424c, 0x1c2c34]);
  for (let i = 0; i < 20; i++) p.set(Math.floor(R() * SCROLL_ART_W), Math.floor(R() * 28), 0xd8e8f8, 160);
  p.circle(26, 18, 9, 0xd8ecff);
  p.circle(26, 18, 7, 0xf4fbff);
  // 远方幽篁竹海与诡异青色灵气
  ridge(p, 44, 8, 0.055, 0.5, 0x18302c, 0x386c58);
  for (let x = 66; x < 106; x += 4) {
    const bh = 12 + Math.floor(R() * 15);
    p.line(x, 50, x, 50 - bh, 0x2c5c48);
    p.set(x - 1, 50 - bh + 2, 0x58b882);
    p.set(x + 1, 50 - bh + 4, 0x58b882);
  }
  p.under(86, 36, 16, 8, 0x68e090, 95);
  for (let i = 0; i < 12; i++) {
    p.set(72 + Math.floor(R() * 30), 20 + Math.floor(R() * 24), 0x8fffa8);
  }
  // 近景古道与残碑
  ridge(p, 56, 4, 0.04, 2.1, 0x16141e, 0x383244);
  p.rect(16, 38, 7, 16, 0x464254);
  p.rect(17, 37, 5, 2, 0x645e74);
  // 银青剑气斜斩而过
  p.line(34, 52, 68, 18, 0x88e8ff, 2);
  p.line(36, 53, 70, 19, 0xffffff, 1);
  // 狼妖溃散剪影与逸出的青芒
  p.ellipse(52, 42, 7, 4, 0x261e2e);
  p.circle(50, 38, 3, 0x78f098);
  frameBorder(p, 0x5a7868, 0x8fe0a0);
  return p;
}

/** 第 3 关绘卷：《崇山裂脉 · 地火冲霄》—— 险峰崩石、赤焰谷地火冲破天际 */
function drawScroll3(): PC {
  const p = new PC(SCROLL_ART_W, SCROLL_ART_H);
  const R = rng(303);
  sky(p, [0x1c1018, 0x341620, 0x582224, 0x883628, 0xc4582c]);
  // 远方赤焰火柱冲霄
  p.under(76, 30, 24, 24, 0xff7830, 140);
  p.tri([64, 60], [88, 60], [76, 6], 0xff6a28);
  p.tri([69, 60], [83, 60], [76, 12], 0xffb848);
  p.tri([73, 60], [79, 60], [76, 18], 0xfff0a8);
  for (let i = 0; i < 24; i++) {
    const fx = 36 + Math.floor(R() * 70);
    const fy = 6 + Math.floor(R() * 44);
    p.set(fx, fy, i % 2 === 0 ? 0xffd258 : 0xff7838);
  }
  // 两侧崩裂的崇山险峰
  p.tri([0, 66], [52, 66], [22, 16], 0x241820);
  p.tri([10, 66], [52, 66], [22, 16], 0x382428);
  p.tri([82, 66], [112, 66], [98, 22], 0x241820);
  // 山间坠落的巨石与地脉火纹
  for (const [rx, ry, rr] of [[34, 24, 3], [44, 34, 4], [56, 20, 2], [50, 44, 3]]) {
    p.circle(rx, ry, rr, 0x48322c);
    p.set(rx + 1, ry + 1, 0xff9448);
  }
  p.line(22, 16, 28, 38, 0xff8a38, 1);
  p.line(28, 38, 20, 56, 0xffb848, 1);
  frameBorder(p, 0x8a4832, 0xffa858);
  return p;
}

/** 第 6 关绘卷：《云梦涤毒 · 四极告警》—— 毒泽化清波，左眺北境冰封、右望西域瀚海 */
function drawScroll6(): PC {
  const p = new PC(SCROLL_ART_W, SCROLL_ART_H);
  sky(p, [0x141c2c, 0x1e2c3e, 0x284252, 0x243a44, 0x16262e]);
  // 左侧北境寒江冰峰
  p.tri([0, 46], [42, 46], [14, 14], 0x487898);
  p.tri([14, 14], [42, 46], [28, 46], 0x88c4e8);
  p.tri([24, 46], [52, 46], [36, 22], 0x6298b8);
  // 右侧西域瀚海金沙
  ridge(p, 44, 6, 0.06, 1.2, 0x685032, 0xc89e58);
  p.under(90, 24, 18, 12, 0xe8b868, 90);
  // 前景云梦大泽：散去的紫绿毒雾与初绽的清波莲光
  p.rect(0, 46, SCROLL_ART_W, 22, 0x12282a);
  for (let y = 48; y < 64; y += 3) {
    p.span(y, 10 + (y - 48) * 2, 102 - (y - 48) * 2, 0x244e52);
  }
  p.underRing(56, 54, 24, 7, 0x78e8d8, 190);
  p.underRing(56, 54, 14, 4, 0xc8fff4, 220);
  p.circle(56, 52, 3, 0x98ffd0);
  frameBorder(p, 0x487878, 0x88e8d8);
  return p;
}

/** 第 9 关绘卷：《归墟裂渊 · 元凶现形》—— 沧海怒潮与海底赤火交织，天穹裂开昆仑异象 */
function drawScroll9(): PC {
  const p = new PC(SCROLL_ART_W, SCROLL_ART_H);
  const R = rng(909);
  sky(p, [0x100c1e, 0x1e1636, 0x2e2048, 0x1c2c4c, 0x102038]);
  // 天穹之上的昆仑裂隙与混沌异光
  p.line(26, 8, 86, 16, 0xd898ff, 3);
  p.line(28, 8, 84, 16, 0xffffff, 1);
  p.line(48, 11, 38, 24, 0xb878f0, 1);
  p.line(66, 13, 76, 26, 0xb878f0, 1);
  p.ellipse(52, 10, 3, 1, 0xff3848);
  p.ellipse(62, 11, 3, 1, 0xff3848);
  // 归墟海面：左水浪、右火柱交汇入深渊
  p.rect(0, 40, SCROLL_ART_W, 28, 0x0e1c30);
  p.tri([4, 52], [40, 52], [22, 30], 0x286498);
  p.tri([12, 52], [40, 52], [22, 30], 0x58a8e8);
  p.span(30, 19, 25, 0xe8f8ff);
  p.tri([74, 52], [106, 52], [90, 28], 0xc84828);
  p.tri([80, 52], [100, 52], [90, 32], 0xff9838);
  p.underRing(56, 54, 20, 6, 0x58b8ff, 180);
  p.underRing(56, 54, 12, 4, 0xff8848, 180);
  for (let i = 0; i < 14; i++) p.set(14 + Math.floor(R() * 84), 32 + Math.floor(R() * 28), 0x98dcff);
  frameBorder(p, 0x585288, 0xa898f0);
  return p;
}

/** 第 10 关终章绘卷：《昆仑定脉 · 重定乾坤》—— 昆仑雪巅耸入星河，五行神光化周天星盘 */
function drawScroll10(): PC {
  const p = new PC(SCROLL_ART_W, SCROLL_ART_H);
  const R = rng(1010);
  sky(p, [0x0e1022, 0x181e38, 0x242e52, 0x364268, 0x4c5878]);
  for (let i = 0; i < 30; i++) {
    p.set(Math.floor(R() * SCROLL_ART_W), Math.floor(R() * 38), i % 3 === 0 ? 0xffe898 : 0xd8e8ff);
  }
  // 昆仑周天光轮
  p.under(56, 28, 30, 16, 0xffd868, 70);
  p.underRing(56, 28, 24, 11, 0xffe488, 170);
  // 万山之祖 · 昆仑主峰与群峰
  ridge(p, 56, 7, 0.06, 0.8, 0x1e263c, 0x485878);
  p.tri([26, 66], [86, 66], [56, 16], 0x2c3856);
  p.tri([40, 66], [86, 66], [56, 16], 0x44567c);
  // 昆仑雪冠与金色祖脉灵纹
  p.tri([44, 36], [68, 36], [56, 16], 0xdcecff);
  p.tri([51, 36], [68, 36], [56, 16], 0xffffff);
  p.line(56, 16, 56, 62, 0xffd868, 2);
  p.line(56, 34, 44, 52, 0xffc848, 1);
  p.line(56, 34, 68, 52, 0xffc848, 1);
  // 五行灵珠环绕昆仑之巅（金、木、水、火、土）
  const orbs: [number, number, number][] = [
    [56, 9, 0xf0e4a8],  // 金
    [82, 20, 0x68e088], // 木
    [74, 40, 0x68c4ff], // 水
    [38, 40, 0xff7848], // 火
    [30, 20, 0xe8b058], // 土
  ];
  for (let i = 0; i < orbs.length; i++) {
    const [x0, y0, col] = orbs[i];
    const [x1, y1] = orbs[(i + 1) % orbs.length];
    p.line(x0, y0, x1, y1, 0xffe898, 1, 130);
    p.circle(x0, y0, 3, col);
    p.set(x0, y0, 0xffffff);
  }
  frameBorder(p, 0x987838, 0xffd868);
  return p;
}

export function buildStoryArt(scene: Phaser.Scene) {
  addSheet(scene, 'story_scroll_1', [drawScroll1()]);
  addSheet(scene, 'story_scroll_3', [drawScroll3()]);
  addSheet(scene, 'story_scroll_6', [drawScroll6()]);
  addSheet(scene, 'story_scroll_9', [drawScroll9()]);
  addSheet(scene, 'story_scroll_10', [drawScroll10()]);
}
