import type Phaser from 'phaser';
import type { SkillId, PassiveId } from '../config/skills';
import { PC, addSheet, OUTLINE } from './painter';

// 16px 原生像素：战斗小格 1×、升级卡和大招 2×，避免缩图损失轮廓。
type IconId = SkillId | PassiveId | 'heal' | 'lingshi';
const M = [0x68798f, 0xb3c4d3, 0xf5f0dc];
const W = [0x286449, 0x4fbf7a, 0xc2ed9c];
const A = [0x294884, 0x568fe2, 0xc6f1f5];
const F = [0x8e302d, 0xef6845, 0xffdd83];
const E = [0x71513d, 0xc29352, 0xf3d68b];
const N = [0x675a8a, 0xb1a4d0, 0xeee1f3];
const GOLD = 0xe9b94f;

function ring(p: PC, cx: number, cy: number, rx: number, ry: number, col: number) {
  for (let a = 0; a < Math.PI * 2; a += 0.08) p.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, col);
}

function spark(p: PC, x: number, y: number, col: number) {
  p.line(x - 1, y, x + 1, y, col);
  p.line(x, y - 1, x, y + 1, col);
}

function sword(p: PC, x: number, y: number, h: number) {
  p.line(x, y, x, y + h, M[1], 2);
  p.line(x, y, x, y + h - 1, M[2]);
  p.set(x + 1, y, -1);
  p.line(x - 2, y + h, x + 2, y + h, GOLD);
  p.line(x, y + h + 1, x, y + h + 3, E[0]);
  p.set(x, y + h + 3, GOLD);
}

function flame(p: PC, x: number, y: number, s = 1) {
  p.tri([x, y - 5 * s], [x - 3 * s, y + 2 * s], [x + 3 * s, y + 2 * s], F[1]);
  p.tri([x + 3 * s, y - 2 * s], [x, y + 3 * s], [x + 4 * s, y + 2 * s], F[0]);
  p.ellipse(x, y + s, 3 * s, 3 * s, F[1]);
  p.tri([x, y - 2 * s], [x - 2 * s, y + 2 * s], [x + 2 * s, y + 2 * s], F[2]);
  p.set(x, y + 2 * s, M[2]);
}

function leaf(p: PC, x: number, y: number, s = 1) {
  p.tri([x - 4 * s, y + 3 * s], [x - 2 * s, y - 3 * s], [x + 4 * s, y - 4 * s], W[1]);
  p.tri([x - 4 * s, y + 3 * s], [x + 4 * s, y - 4 * s], [x + 2 * s, y + 2 * s], W[0]);
  p.line(x - 4 * s, y + 3 * s, x + 2 * s, y - 2 * s, W[2]);
}

function peak(p: PC, x: number, y: number, w: number, h: number) {
  p.tri([x, y - h], [x - w, y], [x + w, y], E[1]);
  p.tri([x, y - h], [x + 1, y], [x + w, y], E[0]);
  p.line(x, y - h, x - w + 1, y - 1, E[2]);
}

function gem(p: PC, x: number, y: number, w: number, h: number, c: number[]) {
  p.tri([x, y - h], [x - w, y], [x, y + h], c[1]);
  p.tri([x, y - h], [x + w, y], [x, y + h], c[0]);
  p.line(x, y - h, x - w, y, c[2]);
  p.line(x, y - h + 1, x, y + h - 1, c[2]);
}

const DRAW: Record<IconId, (p: PC) => void> = {
  fuchen(p) {
    p.line(2, 13, 8, 7, E[0], 3); p.line(2, 12, 7, 7, E[2]);
    p.line(6, 6, 9, 9, GOLD);
    for (let i = 0; i < 5; i++) {
      p.strand([[8, 7], [9 + i, 4], [8 + i, 1 + i % 2]], i % 2 ? M[1] : M[2]);
    }
    p.line(11, 8, 13, 5, M[2]); p.set(14, 3, M[1]);
  },
  // 专属术：月牙剑气、燃烧符纸、连弩、毒雾、提线石偶。
  slash(p) {
    p.strand([[3, 2], [8, 2], [12, 5], [13, 8], [11, 12], [6, 14]], M[0], 2);
    p.strand([[4, 2], [9, 3], [12, 6], [12, 9], [9, 12], [4, 13]], M[2], 2);
    p.strand([[8, 5], [9, 8], [7, 10]], M[1]);
    p.line(2, 10, 8, 4, M[2]); p.line(1, 9, 4, 12, GOLD);
  },
  talisman(p) {
    p.rect(4, 2, 7, 11, E[1]); p.rect(4, 2, 6, 10, F[2]);
    p.line(5, 3, 9, 3, F[0]); p.strand([[7, 5], [6, 7], [8, 7], [7, 10]], F[0]);
    p.set(5, 9, F[1]); p.set(9, 5, F[1]);
    flame(p, 11, 11, 0.6); p.set(3, 1, F[1]);
  },
  crossbow(p) {
    p.strand([[3, 3], [8, 5], [12, 10]], E[1], 2);
    p.strand([[3, 3], [3, 10], [12, 10]], M[1]);
    p.line(4, 12, 11, 5, E[0], 3); p.line(5, 11, 12, 4, M[2]);
    p.tri([13, 2], [9, 4], [12, 6], A[1]); p.set(13, 2, A[2]);
    p.set(3, 12, A[1]); p.set(5, 14, A[2]);
  },
  duwu(p) {
    p.ellipse(8, 10, 6, 4, W[0]); p.circle(5, 8, 3, W[1]);
    p.circle(9, 6, 3, W[1]); p.circle(11, 10, 3, W[1]);
    p.line(3, 7, 5, 7, W[2]); p.line(8, 4, 10, 4, W[2]);
    p.rect(6, 8, 5, 3, W[2]); p.rect(7, 11, 3, 1, W[2]);
    p.set(7, 9, W[0]); p.set(9, 9, W[0]); p.set(8, 11, W[0]);
    p.set(2, 3, W[1]); p.set(12, 2, W[2]);
  },
  puppet(p) {
    p.line(3, 1, 12, 1, E[1]); p.line(4, 2, 3, 8, GOLD); p.line(11, 2, 12, 8, GOLD);
    p.rect(5, 3, 6, 4, M[1]); p.rect(5, 3, 5, 3, M[2]);
    p.set(6, 4, F[0]); p.set(9, 4, F[0]);
    p.rect(4, 8, 8, 3, M[1]); p.rect(2, 8, 2, 4, E[1]); p.rect(12, 8, 2, 4, E[1]);
    p.rect(7, 8, 2, 3, GOLD); p.rect(5, 11, 6, 1, F[0]);
    p.rect(4, 12, 3, 2, M[2]); p.rect(9, 12, 3, 2, M[1]);
  },
  // 普通术：每个形状对应实际施放物，环形技能保留明显的空心轮廓。
  flysword(p) {
    p.line(3, 10, 11, 2, M[0], 3); p.line(4, 10, 12, 2, M[1], 2);
    p.line(4, 9, 11, 2, M[2]); p.set(13, 1, M[2]);
    p.line(2, 8, 7, 13, GOLD); p.line(2, 12, 4, 10, E[0], 2); p.set(1, 13, GOLD);
    p.line(2, 5, 5, 2, M[0]); p.line(10, 13, 13, 10, M[1]);
  },
  fireball(p) {
    p.tri([2, 2], [12, 7], [7, 13], F[0]);
    p.strand([[3, 2], [5, 6], [9, 9]], F[1], 3);
    p.circle(10, 10, 4, F[1]); p.circle(10, 10, 2.5, F[2]);
    p.rect(10, 9, 2, 2, M[2]); p.set(1, 5, F[2]); p.set(7, 2, F[1]);
  },
  leaf(p) { leaf(p, 8, 8, 1.3); p.line(2, 13, 5, 10, E[1]); p.set(12, 2, W[2]); },
  waterdragon(p) {
    p.strand([[3, 12], [6, 13], [10, 11], [11, 8], [7, 7], [7, 4], [10, 3]], A[0], 3);
    p.strand([[3, 11], [6, 12], [9, 10], [10, 9], [6, 7], [6, 4], [9, 2]], A[1], 2);
    p.line(9, 3, 13, 3, A[2], 2); p.line(12, 4, 13, 5, A[1]);
    p.line(8, 3, 8, 1, GOLD); p.set(11, 2, M[2]); p.set(11, 3, OUTLINE);
    p.line(3, 12, 1, 10, A[2]); p.line(7, 6, 10, 6, A[2]);
  },
  stonespike(p) {
    p.strand([[2, 13], [6, 12], [8, 14], [12, 12], [14, 13]], E[0]);
    peak(p, 4, 12, 2, 6); peak(p, 8, 12, 3, 11); peak(p, 12, 12, 2, 8);
    p.set(2, 9, E[2]); p.set(13, 3, E[1]);
  },
  jinzhen(p) {
    for (const [x, y] of [[2, 5], [7, 2], [12, 4]]) {
      p.line(x, y, x + 1, y + 6, M[1]); p.line(x + 1, y, x + 2, y + 5, M[2]);
      p.line(x - 1, y + 1, x + 2, y, GOLD); p.set(x + 1, y + 8, M[2]);
    }
    p.set(7, 13, GOLD);
  },
  lihuo(p) {
    ring(p, 7.5, 8, 5.5, 5, F[0]); ring(p, 7.5, 8, 4.5, 4, F[1]);
    flame(p, 7, 3, 0.5); flame(p, 12, 10, 0.5); flame(p, 3, 10, 0.5);
  },
  tengfu(p) {
    p.strand([[4, 14], [5, 10], [3, 6], [4, 3], [6, 2]], W[0], 2);
    p.strand([[10, 14], [12, 10], [9, 8], [10, 4], [12, 3]], W[1], 2);
    p.strand([[4, 11], [10, 10], [12, 7], [8, 6], [4, 7]], W[2]);
    leaf(p, 4, 5, 0.5); leaf(p, 12, 5, 0.5); p.line(8, 12, 7, 14, W[1]);
  },
  hanbing(p) {
    ring(p, 7.5, 8, 5.5, 4, A[1]); ring(p, 7.5, 8, 4.5, 3, A[2]);
    for (const [x, y] of [[3, 8], [7, 4], [12, 8], [7, 12]]) gem(p, x, y, 1, 3, A);
  },
  luoshi(p) {
    p.line(4, 2, 3, 5, E[2]); p.line(8, 1, 7, 3, E[1]); p.line(12, 2, 11, 4, E[2]);
    p.ellipse(8, 9, 5, 4, E[0]); p.tri([3, 8], [7, 4], [13, 8], E[1]);
    p.tri([3, 8], [7, 4], [7, 10], E[2]); p.line(5, 13, 11, 13, E[1]);
    p.set(2, 12, E[2]); p.set(13, 12, E[1]);
  },
  // 五行大招：剑阵、古树、巨浪、天火、群山；轮廓与普通术拉开。
  wanjian(p) {
    p.line(2, 3, 5, 9, M[1], 2); p.line(2, 3, 4, 8, M[2]);
    p.line(13, 3, 10, 9, M[1], 2); p.line(13, 3, 11, 8, M[2]);
    p.line(3, 10, 6, 8, GOLD); p.line(9, 8, 12, 10, GOLD);
    p.line(5, 10, 6, 12, E[1]); p.line(10, 10, 9, 12, E[1]);
    sword(p, 7, 1, 8); p.set(7, 14, GOLD);
  },
  senluo(p) {
    p.circle(4, 6, 3, W[0]); p.circle(11, 6, 3, W[0]); p.circle(8, 4, 4, W[1]);
    p.line(6, 1, 9, 1, W[2]); p.line(2, 4, 4, 3, W[2]); p.line(11, 3, 13, 4, W[2]);
    p.strand([[7, 12], [7, 7], [5, 5]], E[1], 2); p.line(8, 8, 10, 5, E[2]);
    p.strand([[1, 14], [4, 13], [7, 11], [11, 13], [14, 14]], W[2]);
    p.line(7, 12, 6, 14, E[1]); p.line(8, 11, 10, 14, E[1]);
  },
  canghai(p) {
    p.strand([[2, 13], [6, 10], [7, 6], [10, 3], [13, 4], [13, 7]], A[0], 3);
    p.strand([[2, 12], [5, 9], [6, 5], [9, 2], [12, 2], [14, 4], [13, 6], [11, 6]], A[2], 2);
    p.strand([[4, 13], [8, 10], [9, 7], [12, 8], [14, 10]], A[1], 2);
    p.strand([[2, 14], [7, 13], [10, 11], [14, 12]], A[2]); p.set(3, 4, A[2]);
  },
  tianhuo(p) {
    p.tri([11, 1], [14, 9], [5, 12], F[0]); p.tri([11, 1], [12, 8], [5, 11], F[1]);
    p.line(10, 3, 8, 8, F[2], 2); p.circle(7, 10, 4, F[1]); p.circle(7, 10, 2, F[2]);
    p.set(7, 9, M[2]); p.line(2, 14, 13, 14, F[0]);
    p.line(2, 10, 1, 8, F[2]); p.line(12, 11, 14, 9, F[2]); p.set(4, 3, F[1]);
  },
  kunlun(p) {
    ring(p, 8, 5, 4, 3, GOLD);
    peak(p, 4, 12, 3, 7); peak(p, 12, 12, 3, 7); peak(p, 8, 13, 5, 12);
    p.tri([8, 1], [6, 6], [10, 6], M[2]); p.set(8, 6, M[1]);
    p.line(1, 14, 5, 14, GOLD); p.line(10, 14, 14, 14, GOLD);
  },
  // 心法用对应效果的器物/符号，不再用“诀”的单字缩写。
  ruijin(p) {
    gem(p, 7, 8, 4, 6, M); spark(p, 12, 3, GOLD); p.line(3, 12, 2, 13, M[1]);
  },
  yanyang(p) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4)
      p.line(7.5 + Math.cos(a) * 5, 7.5 + Math.sin(a) * 5, 7.5 + Math.cos(a) * 6.5, 7.5 + Math.sin(a) * 6.5, F[1]);
    p.circle(8, 8, 4, F[1]); p.circle(8, 8, 2.5, F[2]); p.set(7, 6, M[2]);
  },
  changsheng(p) {
    p.ellipse(8, 10, 4, 4, W[0]); p.ellipse(7, 10, 3, 3, W[1]);
    p.circle(8, 5, 3, W[1]); p.line(7, 2, 9, 2, E[1]);
    p.line(5, 7, 10, 7, GOLD); p.line(10, 7, 12, 10, GOLD);
    p.line(6, 4, 6, 5, W[2]); p.line(5, 9, 5, 11, W[2]);
  },
  roushui(p) {
    for (let y = 4; y <= 12; y += 4) {
      p.strand([[2, y + 1], [5, y - 1], [8, y], [11, y + 1], [14, y - 1]], y === 8 ? A[2] : A[1], 2);
    }
  },
  houtu(p) {
    p.rect(3, 3, 10, 6, E[0]); p.tri([3, 8], [13, 8], [8, 14], E[0]);
    p.rect(4, 3, 7, 5, E[1]); p.tri([4, 8], [11, 8], [8, 12], E[1]);
    p.line(4, 3, 11, 3, E[2]); p.line(4, 3, 4, 8, E[2]); p.line(8, 5, 8, 10, GOLD);
  },
  pojun(p) {
    p.strand([[3, 2], [6, 5], [4, 7], [7, 10]], M[2], 2);
    p.strand([[8, 2], [11, 5], [9, 7], [12, 10]], M[1], 2);
    p.tri([7, 9], [5, 13], [9, 13], F[1]); p.set(6, 13, F[2]);
  },
  liaoyuan(p) {
    p.line(2, 13, 13, 13, E[0], 2);
    flame(p, 4, 10, 0.65); flame(p, 11, 9, 0.75); flame(p, 7, 6, 0.8);
  },
  fanmao(p) {
    p.rect(6, 2, 4, 3, E[1]); p.rect(5, 5, 6, 8, W[0]); p.rect(4, 7, 8, 5, W[1]);
    p.rect(6, 6, 4, 5, W[2]); p.set(6, 8, W[0]); p.set(9, 8, W[0]); p.line(7, 10, 8, 10, W[0]);
    p.set(12, 3, W[1]); p.set(3, 4, W[2]);
  },
  xuanming(p) {
    gem(p, 4, 9, 2, 4, A); gem(p, 11, 9, 2, 4, A); gem(p, 8, 7, 3, 6, A);
    p.line(3, 13, 12, 13, A[2]);
  },
  zhenyue(p) {
    p.line(5, 12, 10, 5, E[1], 2);
    p.strand([[6, 3], [10, 2], [14, 5], [11, 8], [6, 5], [6, 3]], E[0], 2);
    p.line(7, 3, 11, 3, E[2], 2); p.line(6, 4, 10, 7, E[1]);
    p.line(1, 13, 3, 13, GOLD); p.line(9, 12, 11, 14, GOLD);
  },
  ningshen(p) {
    p.line(4, 2, 11, 2, GOLD, 2); p.line(4, 13, 11, 13, GOLD, 2);
    p.strand([[4, 4], [6, 6], [9, 9], [11, 11]], N[1]);
    p.strand([[11, 4], [9, 6], [6, 9], [4, 11]], N[2]);
    p.tri([5, 4], [10, 4], [8, 7], A[1]); p.tri([8, 9], [5, 12], [11, 12], A[2]);
  },
  guanri(p) {
    ring(p, 9, 7, 4, 5, E[1]); ring(p, 9, 7, 2, 3, F[1]);
    p.line(2, 12, 12, 2, N[2], 2); p.tri([13, 1], [8, 2], [12, 6], M[2]);
    p.line(2, 9, 5, 12, N[1]);
  },
  qingshen(p) {
    p.rect(8, 4, 4, 7, E[0]); p.rect(6, 11, 7, 3, E[1]);
    p.line(6, 13, 13, 13, GOLD); p.rect(8, 4, 4, 2, GOLD);
    p.strand([[2, 3], [4, 7], [8, 9]], N[2], 2);
    p.strand([[2, 7], [4, 10], [7, 10]], N[1]); p.line(2, 12, 4, 12, N[1]);
  },
  juling(p) {
    ring(p, 7.5, 8, 5.5, 5, N[0]); gem(p, 8, 8, 3, 5, N);
    p.line(1, 5, 3, 7, N[2]); p.line(12, 8, 14, 6, N[2]); spark(p, 3, 2, GOLD);
  },
  heal(p) {
    p.rect(6, 1, 4, 2, E[1]); p.rect(6, 3, 4, 2, M[2]);
    p.ellipse(8, 10, 5, 4, F[0]); p.rect(4, 7, 8, 4, F[1]);
    p.rect(6, 5, 4, 2, F[1]); p.line(5, 8, 5, 11, F[2]);
    p.rect(7, 8, 3, 3, F[2]);
  },
  lingshi(p) {
    gem(p, 5, 10, 3, 4, A); gem(p, 10, 7, 4, 6, W); spark(p, 3, 3, M[2]);
  },
};

export const skillIconKey = (id: IconId) => `skill_icon_${id}`;

/** 图标只在启动时生成，HUD 切换贴图即可；与战斗弹幕贴图独立。 */
export function buildSkillIcons(scene: Phaser.Scene) {
  for (const id of Object.keys(DRAW) as IconId[]) {
    const key = skillIconKey(id);
    if (scene.textures.exists(key)) continue;
    const p = new PC(16, 16);
    DRAW[id](p);
    p.outline(OUTLINE);
    addSheet(scene, key, [p]);
  }
}
