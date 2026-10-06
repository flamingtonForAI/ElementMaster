import Phaser from 'phaser';
import { PC, addSheet, addAnim, OUTLINE, rng } from './painter';

function single(scene: Phaser.Scene, key: string, p: PC) {
  addSheet(scene, key, [p]);
}

// 剑气：月牙形，3 帧（起、满、散）
function slashFrame(f: number): PC {
  const p = new PC(64, 64);
  const span = [40, 65, 70][f];
  const thick = [5, 10, 4][f];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const dx = x + 0.5 - 32;
      const dy = y + 0.5 - 32;
      const r = Math.hypot(dx, dy);
      const a = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (Math.abs(a) > span) continue;
      const taper = Math.cos(((a / span) * Math.PI) / 2);
      const t = thick * taper + 1;
      const d = 30 - r;
      if (d < 0 || d > t) continue;
      const col = d < 1.5 ? 0xffffff : d < t * 0.55 ? 0xd6e8ff : 0x8fb0e0;
      p.set(x, y, col, f === 2 ? 150 : 255);
    }
  }
  return p;
}

function flySword(): PC {
  const p = new PC(18, 7);
  p.line(1, 3, 3, 3, 0xe0b04a);
  p.rect(4, 2, 3, 3, 0x6b4630);
  p.line(7, 1, 7, 5, 0xe0b04a);
  p.line(8, 3, 16, 3, 0xe8f0f6);
  p.line(8, 2, 14, 2, 0xffffff);
  p.line(8, 4, 15, 4, 0x9fb0bf);
  p.set(17, 3, 0xe8f0f6);
  p.outline(0x3b5070);
  return p;
}

function wave(): PC {
  const p = new PC(14, 24);
  for (let y = 0; y < 24; y++) {
    const t = Math.abs(y - 11.5) / 11.5;
    const xr = Math.round(10 - t * t * 8);
    const w = Math.max(1, Math.round(4 * (1 - t)));
    for (let i = 0; i < w; i++) p.set(xr - i, y, i === 0 ? 0xffffff : 0xb8d4ff);
  }
  return p;
}

function fireball(f: number): PC {
  const p = new PC(14, 14);
  p.circle(8, 7, 4.5, 0xe8503f);
  p.circle(8.5, 6.5, 3, 0xff9a3a);
  p.circle(9, 6, 1.6, 0xfff0a0);
  p.strand([[4, 7], [1, 6 + f], [0, 8]], 0xff9a3a, 2);
  p.outline(0x6a1a12);
  return p;
}

function explosion(f: number): PC {
  const p = new PC(48, 48);
  const R = rng(91 + f);
  const r = [9, 16, 20, 22][f];
  const ring = (inner: number, outer: number, cols: number[], jitter: number) => {
    for (let y = 0; y < 48; y++)
      for (let x = 0; x < 48; x++) {
        const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24) + (R() - 0.5) * jitter;
        if (d < inner || d > outer) continue;
        const k = (d - inner) / Math.max(1, outer - inner);
        p.set(x, y, cols[Math.min(cols.length - 1, Math.floor(k * cols.length))]);
      }
  };
  if (f === 0) {
    ring(0, r, [0xffffff, 0xfff0a0, 0xffc34a], 1.5);
  } else if (f === 1) {
    ring(0, r, [0xfff0a0, 0xffc34a, 0xff8a3a, 0xe8503f], 3);
  } else if (f === 2) {
    ring(r * 0.45, r, [0xffc34a, 0xff8a3a, 0xe8503f, 0x8e2a20], 4);
    for (let i = 0; i < 8; i++) {
      const a = R() * Math.PI * 2;
      p.circle(24 + Math.cos(a) * r * 0.9, 24 + Math.sin(a) * r * 0.9, 2, 0xffc34a);
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const a = R() * Math.PI * 2;
      const d = r * (0.5 + R() * 0.5);
      p.circle(24 + Math.cos(a) * d, 24 + Math.sin(a) * d, 1.5 + R() * 1.5, R() < 0.3 ? 0xe8503f : 0x5a4a4a);
    }
  }
  return p;
}

function leaf(): PC {
  const p = new PC(9, 7);
  p.ellipse(4.5, 3.5, 4, 2.5, 0x5fc46a);
  p.line(1, 3, 7, 3, 0x2e7a4a);
  p.set(2, 2, 0xb6f09a);
  p.set(3, 2, 0xb6f09a);
  p.outline(0x163a24);
  return p;
}

function waterDragon(f: number): PC {
  const p = new PC(28, 14);
  const B = 0x4a7fe8, H = 0xa8d0ff, D = 0x2a4a90;
  // 身体波浪
  for (let x = 0; x < 18; x++) {
    const y = 7 + Math.round(Math.sin((x + f * 3) * 0.6) * 2);
    const w = 1 + Math.floor(x / 6);
    for (let k = -w; k <= w; k++) p.set(x, y + k, k === -w ? H : B);
  }
  // 头
  p.ellipse(21, 7, 4.5, 3.5, B);
  p.span(5, 19, 23, H);
  p.span(9, 20, 26, D);
  p.set(25, 7, B);
  p.set(26, 8, B);
  p.set(21, 6, 0xffffff);
  // 龙须和角
  p.strand([[23, 9], [26, 11], [27, 13]], H, 1);
  p.strand([[19, 4], [17, 1]], 0xe0f0ff, 1);
  p.outline(0x162a5a);
  return p;
}

function spike(f: number): PC {
  const p = new PC(20, 26);
  const B = 0xc79a55, S = 0x8f6a3a, H = 0xe6c07f;
  const h = [7, 18, 22][f];
  for (let i = 0; i < h; i++) {
    const y = 23 - i;
    const hw = Math.max(0, Math.round((1 - i / h) * 5));
    p.span(y, 10 - hw, 9 + hw, B);
    p.set(9 + hw, y, S);
    p.set(10 - hw, y, H);
  }
  // 旁边的小石刺
  if (f > 0) {
    for (let i = 0; i < h * 0.45; i++) {
      const hw = Math.max(0, Math.round((1 - i / (h * 0.45)) * 2));
      p.span(23 - i, 4 - hw, 3 + hw, S);
      p.span(23 - i, 16 - hw, 15 + hw, B);
    }
  }
  p.outline(OUTLINE);
  // 地面碎石
  p.under(10, 24, 9, 1.8, 0x000000, 70);
  return p;
}

function crack(): PC {
  const p = new PC(20, 8);
  p.strand([[2, 4], [6, 3], [9, 5], [13, 3], [17, 4]], 0x3a2a1a, 1);
  p.strand([[9, 5], [10, 7]], 0x3a2a1a, 1);
  p.strand([[6, 3], [5, 1]], 0x3a2a1a, 1);
  return p;
}

function gem(col: number, hi: number, dark: number): PC {
  const p = new PC(7, 9);
  for (let y = 0; y < 9; y++) {
    const hw = y <= 4 ? y * 0.75 : (8 - y) * 0.75;
    p.span(y, Math.round(3 - hw), Math.round(3 + hw), col);
  }
  p.set(2, 3, hi);
  p.set(3, 2, hi);
  p.set(4, 5, dark);
  p.set(4, 6, dark);
  p.outline(OUTLINE);
  return p;
}

function chest(): PC {
  const p = new PC(18, 15);
  const R = 0xa8322a, RS = 0x6e1e1a, G = 0xe0b04a, GS = 0xa77a2a;
  p.rect(2, 6, 14, 8, R);
  p.rect(2, 3, 14, 4, R);
  p.span(3, 3, 14, 0xc84a3a);
  p.span(13, 2, 15, RS);
  p.span(6, 2, 15, G);
  p.rect(2, 3, 1, 11, G);
  p.rect(15, 3, 1, 11, GS);
  p.rect(8, 7, 2, 3, G);
  p.set(8, 9, GS);
  p.outline(OUTLINE);
  p.under(9, 14, 8, 1.5, 0x000000, 70);
  return p;
}

function pill(): PC {
  const p = new PC(9, 9);
  p.circle(4.5, 4.5, 3.6, 0xc0392b);
  p.circle(4, 4, 2, 0xe8604a);
  p.set(3, 3, 0xffd0c0);
  p.span(4, 1, 7, 0xe0b04a);
  p.outline(OUTLINE);
  p.under(4.5, 8, 3.5, 1, 0x000000, 70);
  return p;
}

function ring(): PC {
  const p = new PC(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32);
      if (r <= 31 && r >= 29) p.set(x, y, 0xffffff);
    }
  return p;
}

function disc(): PC {
  const p = new PC(64, 64);
  p.circle(32, 32, 31, 0xffffff);
  return p;
}

function eLeaf(): PC {
  const p = new PC(9, 9);
  p.ellipse(4.5, 4.5, 3.5, 3.5, 0x8fd04a);
  p.circle(4.5, 4.5, 1.8, 0xe8ff9a);
  p.outline(0x2a4a12);
  return p;
}

function eWind(): PC {
  const p = new PC(11, 11);
  p.circle(5.5, 5.5, 3.6, 0xdfe8ff);
  p.circle(5.5, 5.5, 2, 0xffffff);
  p.outline(0x4a3a6a);
  return p;
}

// ---------- 地面与装饰 ----------

function valueNoise(size: number, cells: number, R: () => number) {
  const g: number[] = [];
  for (let i = 0; i < cells * cells; i++) g.push(R());
  const at = (x: number, y: number) => g[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];
  const out = new Float32Array(size * size);
  const step = size / cells;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = x / step, gy = y / step;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = gx - x0, ty = gy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const b = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      out[y * size + x] = a * (1 - sy) + b * sy;
    }
  return out;
}

function ground(seed: number, tones: number[], speck: number[], blades: number[]): PC {
  const N = 128;
  const R = rng(seed);
  const p = new PC(N, N);
  const n1 = valueNoise(N, 4, R);
  const n2 = valueNoise(N, 16, R);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = n1[y * N + x] * 0.65 + n2[y * N + x] * 0.35 + (R() - 0.5) * 0.12;
      const idx = Math.min(tones.length - 1, Math.max(0, Math.floor(v * tones.length)));
      p.set(x, y, tones[idx]);
    }
  // 小碎点
  for (let i = 0; i < 160; i++) p.set(Math.floor(R() * N), Math.floor(R() * N), speck[Math.floor(R() * speck.length)]);
  // 草叶
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(R() * N), y = Math.floor(R() * N);
    const c = blades[Math.floor(R() * blades.length)];
    p.set(x, y, c);
    p.set(x + 1, y - 1, c);
    p.set(x - 1, y - 1, c);
  }
  return p;
}

function rock(): PC {
  const p = new PC(16, 12);
  p.ellipse(8, 7, 6.5, 4.5, 0x7d7468);
  p.ellipse(7, 6, 4.5, 3, 0x9c9384);
  p.ellipse(6, 5, 2, 1.2, 0xbab2a2);
  p.span(10, 4, 12, 0x5d564d);
  p.outline(OUTLINE);
  p.under(8, 10.5, 7, 1.6, 0x000000, 60);
  return p;
}

function tuft(): PC {
  const p = new PC(10, 9);
  const c = [0x9a9450, 0xb8ae62, 0x77763e];
  p.strand([[5, 8], [5, 2]], c[0], 1);
  p.strand([[4, 8], [2, 3]], c[1], 1);
  p.strand([[6, 8], [8, 3]], c[2], 1);
  p.strand([[3, 8], [1, 5]], c[2], 1);
  p.strand([[7, 8], [9, 5]], c[1], 1);
  return p;
}

function tablet(): PC {
  const p = new PC(16, 24);
  p.rect(4, 4, 8, 16, 0x8c8a86);
  p.rect(4, 4, 2, 16, 0xaaa8a2);
  p.rect(10, 4, 2, 16, 0x6c6a66);
  p.ellipse(8, 4, 4, 2.2, 0x8c8a86);
  p.rect(2, 19, 12, 3, 0x6c6a66);
  for (const y of [8, 11, 14]) p.span(y, 7, 9, 0x4a4844);
  p.set(8, 16, 0x4a4844);
  p.strand([[5, 12], [6, 14], [5, 17]], 0x4a5a3a, 1);
  p.outline(OUTLINE);
  p.under(8, 22, 8, 1.6, 0x000000, 60);
  return p;
}

function deadTree(): PC {
  const p = new PC(32, 40);
  const T = 0x5a4434, S = 0x3e2e24, H = 0x7a6250;
  p.strand([[16, 38], [16, 20], [15, 12]], T, 4);
  p.strand([[16, 24], [10, 16], [6, 12], [4, 8]], T, 2);
  p.strand([[16, 20], [22, 13], [26, 10], [28, 6]], T, 2);
  p.strand([[15, 14], [13, 6], [14, 2]], T, 2);
  p.strand([[10, 16], [9, 10]], S, 1);
  p.strand([[22, 13], [24, 16]], S, 1);
  p.line(18, 22, 18, 37, S);
  p.line(14, 22, 14, 37, H);
  p.outline(OUTLINE);
  p.under(16, 38, 9, 2, 0x000000, 60);
  return p;
}

function bamboo(seed: number): PC {
  const p = new PC(22, 60);
  const R = rng(seed);
  const G = 0x5aa64a, GS = 0x3a7a34, GH = 0x9ad87a, J = 0x2f5e2a, L = 0x4f9a42, LH = 0x86c86a;
  const stalks = [5, 11, 16];
  for (const [i, x] of stalks.entries()) {
    const top = 4 + Math.floor(R() * 10) + i * 2;
    for (let y = top; y < 58; y++) {
      p.set(x, y, GH);
      p.set(x + 1, y, G);
      p.set(x + 2, y, GS);
    }
    for (let y = top + 6; y < 56; y += 9 + Math.floor(R() * 3)) p.span(y, x, x + 2, J);
    // 竹叶
    for (let k = 0; k < 3; k++) {
      const ly = top + 2 + k * 8;
      const dir = (k + i) % 2 === 0 ? 1 : -1;
      p.strand([[x + 1, ly], [x + 1 + dir * 3, ly - 1], [x + 1 + dir * 6, ly + 1]], k % 2 ? L : LH, 2);
    }
  }
  p.outline(0x142a14);
  p.under(11, 58, 10, 2, 0x000000, 60);
  return p;
}

function shoot(): PC {
  const p = new PC(9, 12);
  for (let i = 0; i < 9; i++) {
    const hw = Math.round((1 - i / 9) * 3);
    p.span(10 - i, 4 - hw, 4 + hw, i % 3 === 0 ? 0x8a7a3a : 0xb0a04a);
  }
  p.set(4, 1, 0x7ab84a);
  p.outline(OUTLINE);
  p.under(4.5, 10.5, 4, 1.2, 0x000000, 60);
  return p;
}

function mossRock(): PC {
  const p = rock();
  for (let x = 2; x < 14; x++) for (let y = 2; y < 6; y++) if (p.get(x, y) === 0x9c9384 || p.get(x, y) === 0xbab2a2) p.set(x, y, 0x5f9a4a);
  return p;
}

function fern(): PC {
  const p = new PC(14, 10);
  const c = [0x3f8a3f, 0x5fb35a, 0x2c6a2c];
  p.strand([[7, 9], [2, 3]], c[0], 1);
  p.strand([[7, 9], [12, 3]], c[1], 1);
  p.strand([[7, 9], [7, 1]], c[2], 1);
  for (let i = 0; i < 4; i++) {
    p.set(3 + i, 4 + i, c[1]);
    p.set(11 - i, 4 + i, c[0]);
  }
  return p;
}

export function buildFx(scene: Phaser.Scene) {
  const px = new PC(2, 2);
  px.rect(0, 0, 2, 2, 0xffffff);
  single(scene, 'px', px);

  addSheet(scene, 'fx_slash', [0, 1, 2].map(slashFrame));
  addAnim(scene, 'fx_slash', 'fx_slash', [0, 1, 1, 2], 20, 0);
  single(scene, 'pj_sword', flySword());
  single(scene, 'pj_wave', wave());
  addSheet(scene, 'pj_fireball', [0, 1].map(fireball));
  addAnim(scene, 'pj_fireball', 'pj_fireball', [0, 1], 10);
  addSheet(scene, 'fx_explosion', [0, 1, 2, 3].map(explosion));
  addAnim(scene, 'fx_explosion', 'fx_explosion', [0, 1, 2, 3], 16, 0);
  single(scene, 'pj_leaf', leaf());
  addSheet(scene, 'pj_water', [0, 1].map(waterDragon));
  addAnim(scene, 'pj_water', 'pj_water', [0, 1], 8);
  addSheet(scene, 'fx_spike', [0, 1, 2].map(spike));
  addAnim(scene, 'fx_spike', 'fx_spike', [0, 1, 2, 2, 2, 2, 1, 0], 20, 0);
  single(scene, 'fx_crack', crack());
  single(scene, 'gem_s', gem(0x5aa8ff, 0xd8f0ff, 0x2a5aa8));
  single(scene, 'gem_m', gem(0x5fd06a, 0xd8ffd8, 0x2a7a3a));
  single(scene, 'gem_l', gem(0xff5a6a, 0xffe0e0, 0xa82a3a));
  single(scene, 'chest', chest());
  single(scene, 'pill', pill());
  single(scene, 'fx_ring', ring());
  single(scene, 'fx_disc', disc());
  single(scene, 'ep_leaf', eLeaf());
  single(scene, 'ep_wind', eWind());

  single(scene, 'ground_1', ground(11, [0x5e5338, 0x665b3d, 0x6e6443, 0x76693f], [0x857a52, 0x4f4630, 0x8a8a6a], [0x8a8a4a, 0x9a9450]));
  single(scene, 'ground_2', ground(23, [0x2c4430, 0x314c34, 0x365237, 0x3c5a3a], [0x4f6e3e, 0x223424, 0x6a8a4a], [0x4f8a42, 0x6aa04a, 0x9db35a]));
  single(scene, 'dc_rock', rock());
  single(scene, 'dc_tuft', tuft());
  single(scene, 'dc_tablet', tablet());
  single(scene, 'dc_deadtree', deadTree());
  addSheet(scene, 'dc_bamboo', [1, 2, 3].map(bamboo));
  single(scene, 'dc_shoot', shoot());
  single(scene, 'dc_mossrock', mossRock());
  single(scene, 'dc_fern', fern());
}
