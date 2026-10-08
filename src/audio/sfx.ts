import { bell, buf, cymbal, finish, gong, midiHz, noise, pluck, taiko, tone } from './synth';

export interface SfxDef {
  /** 同名音效最短间隔（秒），用来给高频命中限流 */
  gap: number;
  /** 同时发声上限 */
  max: number;
  vol: number;
  /** 每次播放随机变调幅度 */
  jitter?: number;
  render: () => Float32Array;
}

const def = (vol: number, gap: number, max: number, render: () => Float32Array, jitter = 0): SfxDef => ({ vol, gap, max, render, jitter });

// 五声音阶（宫调）的半音偏移，用于琶音
const PENTA = [0, 2, 4, 7, 9];
const penta = (root: number, i: number) => root + PENTA[i % 5] + 12 * Math.floor(i / 5);

export const SFX = {
  // ---- 术 ----
  slash: def(0.5, 0.05, 3, () => {
    const b = buf(0.22);
    noise(b, { dur: 0.18, type: 'bp', f: 3200, f1: 900, q: 1.2, a: 0.01, d: 0.06, vol: 1 });
    tone(b, { f: 2400, f1: 2200, at: 0.01, dur: 0.14, wave: 'square', d: 0.03, vol: 0.12 });
    tone(b, { f: 3600, at: 0.01, dur: 0.16, d: 0.05, vol: 0.12 });
    return finish(b);
  }, 0.06),
  sword: def(0.32, 0.06, 3, () => {
    const b = buf(0.12);
    tone(b, { f: 900, f1: 2200, dur: 0.1, d: 0.05, vol: 0.3 });
    noise(b, { dur: 0.08, type: 'bp', f: 4000, q: 1.5, d: 0.03, vol: 0.4 });
    return finish(b);
  }, 0.08),
  fireball: def(0.4, 0.08, 3, () => {
    const b = buf(0.24);
    noise(b, { dur: 0.22, type: 'lp', f: 400, f1: 2500, a: 0.05, d: 0.1, vol: 1 });
    tone(b, { f: 180, f1: 320, dur: 0.2, wave: 'tri', d: 0.1, vol: 0.25 });
    return finish(b);
  }, 0.08),
  explode: def(0.55, 0.06, 4, () => {
    const b = buf(0.5);
    noise(b, { dur: 0.5, type: 'lp', f: 3000, f1: 200, d: 0.14, vol: 1.2 });
    tone(b, { f: 110, f1: 40, dur: 0.4, d: 0.14, vol: 0.9 });
    return finish(b);
  }, 0.1),
  leaf: def(0.28, 0.07, 3, () => {
    const b = buf(0.12);
    noise(b, { dur: 0.1, type: 'bp', f: 5000, f1: 3000, q: 4, d: 0.04, vol: 0.9 });
    tone(b, { f: 1800, f1: 2400, dur: 0.06, d: 0.02, vol: 0.12 });
    return finish(b);
  }, 0.1),
  water: def(0.42, 0.2, 2, () => {
    const b = buf(0.38);
    noise(b, { dur: 0.36, type: 'bp', f: 600, f1: 1800, q: 3, a: 0.03, d: 0.14, vol: 1.4 });
    tone(b, { f: 300, f1: 520, dur: 0.3, d: 0.12, vol: 0.25, vib: 0.08 });
    return finish(b);
  }, 0.06),
  spike: def(0.5, 0.05, 4, () => {
    const b = buf(0.28);
    noise(b, { dur: 0.25, type: 'lp', f: 1500, f1: 150, d: 0.07, vol: 1 });
    tone(b, { f: 140, f1: 55, dur: 0.25, d: 0.08, vol: 0.9 });
    noise(b, { dur: 0.05, type: 'hp', f: 3000, d: 0.015, vol: 0.35 });
    return finish(b);
  }, 0.1),

  // ---- 命中 / 击杀 ----
  hit: def(0.28, 0.035, 5, () => {
    const b = buf(0.07);
    noise(b, { dur: 0.05, type: 'bp', f: 1800, q: 1.5, d: 0.012, vol: 1 });
    tone(b, { f: 260, f1: 120, dur: 0.06, d: 0.02, vol: 0.5 });
    return finish(b);
  }, 0.15),
  /** 克制命中：叠一声编钟，让“克”被听见 */
  hitCounter: def(0.3, 0.07, 4, () => {
    const b = buf(0.4);
    bell(b, 1568, 0.38, 0, 0.9);
    noise(b, { dur: 0.04, type: 'bp', f: 2200, q: 1.5, d: 0.01, vol: 0.5 });
    return finish(b);
  }, 0.04),
  crit: def(0.34, 0.06, 3, () => {
    const b = buf(0.1);
    noise(b, { dur: 0.07, type: 'bp', f: 3000, q: 1.2, d: 0.02, vol: 1 });
    tone(b, { f: 1200, f1: 600, dur: 0.07, wave: 'square', d: 0.02, vol: 0.25 });
    tone(b, { f: 300, f1: 120, dur: 0.08, d: 0.03, vol: 0.5 });
    return finish(b);
  }, 0.1),
  kill: def(0.26, 0.03, 6, () => {
    const b = buf(0.1);
    tone(b, { f: 520, f1: 160, dur: 0.09, wave: 'square', d: 0.035, vol: 0.35 });
    noise(b, { dur: 0.08, type: 'lp', f: 2000, f1: 400, d: 0.025, vol: 0.6 });
    return finish(b);
  }, 0.2),
  killBig: def(0.6, 0.2, 2, () => {
    const b = buf(1.4);
    gong(b, 180, 1.4, 0, 1);
    taiko(b, 0, 0.9, 90);
    return finish(b);
  }),
  hurt: def(0.5, 0.12, 2, () => {
    const b = buf(0.2);
    tone(b, { f: 220, f1: 70, dur: 0.18, wave: 'saw', d: 0.06, vol: 0.5 });
    noise(b, { dur: 0.1, type: 'lp', f: 1200, d: 0.04, vol: 0.7 });
    return finish(b);
  }, 0.06),

  // ---- 拾取 ----
  gem: def(0.2, 0.025, 4, () => {
    const b = buf(0.1);
    tone(b, { f: 1320, dur: 0.09, d: 0.03, vol: 0.6 });
    tone(b, { f: 2640, dur: 0.05, d: 0.015, vol: 0.15 });
    return finish(b);
  }),
  chest: def(0.5, 0.3, 1, () => {
    const b = buf(1.2);
    for (let i = 0; i < 6; i++) bell(b, midiHz(penta(72, i)), 0.8, i * 0.07, 0.6);
    return finish(b);
  }),
  pill: def(0.4, 0.2, 1, () => {
    const b = buf(0.5);
    tone(b, { f: 660, f1: 990, dur: 0.25, a: 0.02, d: 0.1, vol: 0.4 });
    bell(b, 1320, 0.4, 0.08, 0.5);
    return finish(b);
  }),

  // ---- 成长 ----
  levelup: def(0.5, 0.3, 1, () => {
    const b = buf(1.0);
    for (let i = 0; i < 6; i++) pluck(b, midiHz(penta(67, i)), 0.7, i * 0.055, 0.5);
    bell(b, midiHz(penta(67, 8)), 0.6, 0.33, 0.4);
    return finish(b);
  }),
  benming: def(0.6, 0.4, 1, () => {
    const b = buf(1.6);
    gong(b, 220, 1.6, 0, 0.9);
    bell(b, 880, 0.9, 0.05, 0.4);
    noise(b, { dur: 0.8, type: 'hp', f: 6000, a: 0.05, d: 0.3, vol: 0.12 });
    return finish(b);
  }),

  // ---- 界面 ----
  select: def(0.3, 0.05, 2, () => {
    const b = buf(0.12);
    tone(b, { f: 880, dur: 0.05, wave: 'square', d: 0.02, vol: 0.2 });
    tone(b, { f: 1320, at: 0.04, dur: 0.07, wave: 'square', d: 0.03, vol: 0.2 });
    return finish(b);
  }),
  tick: def(0.22, 0.03, 2, () => {
    const b = buf(0.03);
    tone(b, { f: 1500, dur: 0.025, wave: 'square', d: 0.008, vol: 0.2 });
    return finish(b);
  }),
  deny: def(0.3, 0.1, 1, () => {
    const b = buf(0.2);
    tone(b, { f: 160, dur: 0.08, wave: 'square', d: 0.04, vol: 0.3 });
    tone(b, { f: 150, at: 0.09, dur: 0.1, wave: 'square', d: 0.05, vol: 0.3 });
    return finish(b);
  }),

  // ---- 战况 ----
  warn: def(0.7, 0.5, 1, () => {
    const b = buf(0.9);
    taiko(b, 0, 1, 100);
    taiko(b, 0.16, 0.8, 100);
    taiko(b, 0.4, 1, 80);
    return finish(b);
  }),
  boss: def(0.8, 1, 1, () => {
    const b = buf(2.6);
    for (let i = 0; i < 6; i++) taiko(b, i * 0.12 - i * i * 0.006, 0.5 + i * 0.08, 90);
    gong(b, 98, 2.4, 0.62, 1.2);
    cymbal(b, 0.62, 0.6);
    return finish(b);
  }),
  /** 小怪冲锋蓄力 */
  charge: def(0.22, 0.3, 2, () => {
    const b = buf(0.5);
    tone(b, { f: 120, f1: 260, dur: 0.5, wave: 'square', a: 0.35, d: 0.1, vol: 0.25 });
    return finish(b);
  }),
  bossCharge: def(0.45, 0.5, 1, () => {
    const b = buf(0.75);
    tone(b, { f: 80, f1: 220, dur: 0.72, wave: 'saw', a: 0.55, d: 0.15, vol: 0.4 });
    noise(b, { dur: 0.72, type: 'lp', f: 300, f1: 1500, a: 0.6, d: 0.1, vol: 0.4 });
    return finish(b);
  }),
  bossShot: def(0.4, 0.2, 2, () => {
    const b = buf(0.32);
    noise(b, { dur: 0.3, type: 'bp', f: 800, f1: 2500, q: 1.2, a: 0.02, d: 0.1, vol: 1 });
    tone(b, { f: 400, f1: 900, dur: 0.2, wave: 'tri', d: 0.08, vol: 0.2 });
    return finish(b);
  }),

  // ---- 结算 ----
  win: def(0.6, 1, 1, () => {
    const b = buf(2.4);
    const notes = [5, 6, 7, 8, 10];
    notes.forEach((d, i) => pluck(b, midiHz(penta(55, d)), 1.2, i * 0.13, 0.5));
    bell(b, midiHz(penta(55, 10)), 1.6, 0.65, 0.6);
    taiko(b, 0.65, 1, 90);
    cymbal(b, 0.65, 0.4);
    return finish(b);
  }),
  lose: def(0.6, 1, 1, () => {
    const b = buf(2.6);
    // 羽调下行
    [69, 67, 64, 62, 57].forEach((m, i) => pluck(b, midiHz(m - 12), 1.4, i * 0.22, 0.55));
    gong(b, 73, 1.8, 1.0, 0.9);
    return finish(b);
  }),
} satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;
