// 程序化合成：直接算采样写进 Float32Array，再包成 AudioBuffer 播放

let SR = 44100;

export function setSampleRate(r: number) {
  SR = r;
}

export function buf(sec: number) {
  return new Float32Array(Math.ceil(sec * SR));
}

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Wave = 'sine' | 'square' | 'saw' | 'tri';

function wave(w: Wave, ph: number) {
  switch (w) {
    case 'sine':
      return Math.sin(ph * Math.PI * 2);
    case 'square':
      return ph < 0.5 ? 0.6 : -0.6;
    case 'saw':
      return (ph * 2 - 1) * 0.7;
    case 'tri':
      return ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
  }
}

/** 线性起音 a 秒后按时间常数 d 指数衰减 */
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

/** 结尾 5ms 淡出，避免爆音 */
const tail = (i: number, n: number) => Math.min(1, (n - i) / (0.005 * SR));

export interface ToneOpts {
  f: number;
  /** 终止频率，按指数滑到这里 */
  f1?: number;
  dur: number;
  at?: number;
  wave?: Wave;
  a?: number;
  d?: number;
  vol?: number;
  /** 颤音深度（频率比例） */
  vib?: number;
}

export function tone(out: Float32Array, o: ToneOpts) {
  const s0 = Math.floor((o.at ?? 0) * SR);
  const n = Math.min(out.length - s0, Math.floor(o.dur * SR));
  const w = o.wave ?? 'sine';
  const a = o.a ?? 0.002;
  const d = o.d ?? o.dur / 3;
  const vol = o.vol ?? 1;
  const ratio = o.f1 ? o.f1 / o.f : 1;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = ratio === 1 ? o.f : o.f * Math.pow(ratio, t / o.dur);
    if (o.vib) f *= 1 + o.vib * Math.sin(Math.PI * 2 * 5.5 * t);
    ph += f / SR;
    ph -= Math.floor(ph);
    out[s0 + i] += wave(w, ph) * env(t, a, d) * vol * tail(i, n);
  }
}

export interface NoiseOpts {
  dur: number;
  at?: number;
  a?: number;
  d?: number;
  vol?: number;
  type?: 'lp' | 'hp' | 'bp';
  f?: number;
  f1?: number;
  q?: number;
}

/** 白噪声过状态变量滤波器，截止频率可扫 */
export function noise(out: Float32Array, o: NoiseOpts) {
  const s0 = Math.floor((o.at ?? 0) * SR);
  const n = Math.min(out.length - s0, Math.floor(o.dur * SR));
  const a = o.a ?? 0.002;
  const d = o.d ?? o.dur / 3;
  const vol = o.vol ?? 1;
  const type = o.type ?? 'lp';
  const f0 = o.f ?? 2000;
  const ratio = o.f1 ? o.f1 / f0 : 1;
  const damp = 1 / (o.q ?? 0.8);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fc = Math.min(SR / 6, f0 * Math.pow(ratio, t / o.dur));
    const F = 2 * Math.sin((Math.PI * fc) / SR);
    const x = Math.random() * 2 - 1;
    low += F * band;
    const high = x - low - damp * band;
    band += F * high;
    const s = type === 'lp' ? low : type === 'hp' ? high : band;
    out[s0 + i] += s * env(t, a, d) * vol * tail(i, n);
  }
}

// ---------- 乐器 ----------

/** 编钟：非整数倍泛音，高泛音衰减更快 */
export function bell(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const parts: [number, number, number][] = [[1, 1, 1], [2.76, 0.5, 0.5], [5.4, 0.25, 0.25], [8.93, 0.12, 0.12]];
  for (const [r, amp, dk] of parts) tone(out, { f: f * r, dur, at, d: dur * dk * 0.4, vol: vol * amp * 0.5 });
}

/** 锣：低沉的非谐泛音，音高略往下沉 */
export function gong(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const parts: [number, number][] = [[1, 1], [1.48, 0.6], [1.93, 0.5], [2.6, 0.35], [3.3, 0.2], [4.1, 0.12]];
  for (const [r, amp] of parts) tone(out, { f: f * r, f1: f * r * 0.97, dur, at, a: 0.01, d: dur * 0.35, vol: vol * amp * 0.3 });
  noise(out, { dur: dur * 0.5, at, type: 'bp', f: f * 6, q: 1.2, d: dur * 0.15, vol: vol * 0.15 });
}

/** 大鼓 */
export function taiko(out: Float32Array, at = 0, vol = 1, f = 110) {
  tone(out, { f, f1: f * 0.45, dur: 0.5, at, d: 0.16, vol });
  noise(out, { dur: 0.08, at, type: 'lp', f: 900, f1: 200, d: 0.03, vol: vol * 0.35 });
}

/** 梆子 / 木鱼 */
export function block(out: Float32Array, at = 0, vol = 1) {
  tone(out, { f: 980, f1: 900, dur: 0.08, at, d: 0.022, vol: vol * 0.7 });
  noise(out, { dur: 0.02, at, type: 'bp', f: 2400, q: 2, d: 0.006, vol: vol * 0.4 });
}

/** 钹 */
export function cymbal(out: Float32Array, at = 0, vol = 1) {
  noise(out, { dur: 1.2, at, type: 'hp', f: 5000, d: 0.32, vol: vol * 0.5 });
  noise(out, { dur: 0.6, at, type: 'bp', f: 3400, q: 1.5, d: 0.15, vol: vol * 0.3 });
}

/** 古琴：Karplus-Strong 拨弦 */
export function pluck(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const s0 = Math.floor(at * SR);
  const n = Math.min(out.length - s0, Math.floor(dur * SR));
  // 两点平均带来半个采样的延迟
  const N = Math.max(2, Math.round(SR / f - 0.5));
  const ring = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    // 先低通一下激励噪声，音色更温润
    prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
    ring[i] = prev;
  }
  const g = Math.pow(0.001, 1 / (f * dur));
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const nx = (idx + 1) % N;
    const y = ring[idx];
    ring[idx] = (y + ring[nx]) * 0.5 * g;
    idx = nx;
    out[s0 + i] += y * vol * tail(i, n);
  }
}

/** 笛：近正弦 + 气声，延后起颤音 */
export function dizi(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const s0 = Math.floor(at * SR);
  const n = Math.min(out.length - s0, Math.floor(dur * SR));
  let ph = 0;
  let low = 0;
  let band = 0;
  const F = 2 * Math.sin((Math.PI * Math.min(SR / 6, f * 2)) / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const scoop = t < 0.04 ? 0.97 + 0.03 * (t / 0.04) : 1;
    const vib = t > 0.15 ? 1 + 0.01 * Math.sin(Math.PI * 2 * 5.5 * t) * Math.min(1, (t - 0.15) / 0.2) : 1;
    ph += (f * scoop * vib) / SR;
    ph -= Math.floor(ph);
    const s = Math.sin(ph * Math.PI * 2) + 0.18 * Math.sin(ph * Math.PI * 4) + 0.06 * Math.sin(ph * Math.PI * 6);
    const x = Math.random() * 2 - 1;
    low += F * band;
    band += F * (x - low - 0.5 * band);
    const amp = Math.min(1, t / 0.04) * (0.85 + 0.15 * Math.exp(-t / 0.1)) * Math.min(1, (n - i) / (0.06 * SR));
    out[s0 + i] += (s * 0.8 + band * 0.12) * amp * vol;
  }
}

/** 唢呐：锯齿波过共振峰，从下方滑入，颤音更重 */
export function suona(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const s0 = Math.floor(at * SR);
  const n = Math.min(out.length - s0, Math.floor(dur * SR));
  let ph = 0;
  let low = 0;
  let band = 0;
  const F = 2 * Math.sin((Math.PI * 1500) / SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const scoop = t < 0.06 ? Math.pow(2, (-1 + t / 0.06) / 12) : 1;
    const vib = 1 + 0.018 * Math.sin(Math.PI * 2 * 6.2 * t) * Math.min(1, t / 0.25);
    ph += (f * scoop * vib) / SR;
    ph -= Math.floor(ph);
    const x = ph * 2 - 1;
    low += F * band;
    band += F * (x - low - 0.7 * band);
    const amp = Math.min(1, t / 0.025) * Math.min(1, (n - i) / (0.05 * SR));
    out[s0 + i] += Math.tanh((band * 1.6 + x * 0.25) * 1.5) * 0.6 * amp * vol;
  }
}

/** 持续低音：根音 + 五度，慢起慢收 */
export function drone(out: Float32Array, f: number, dur: number, at = 0, vol = 1) {
  const s0 = Math.floor(at * SR);
  const n = Math.min(out.length - s0, Math.floor(dur * SR));
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p1 += f / SR;
    p2 += (f * 1.5) / SR;
    const amp = Math.min(1, t / 0.4) * Math.min(1, (n - i) / (0.4 * SR));
    out[s0 + i] += (Math.sin(p1 * Math.PI * 2) * 0.7 + Math.sin(p2 * Math.PI * 2) * 0.25 + Math.sin(p1 * Math.PI * 4) * 0.1) * amp * vol;
  }
}

/** 软削波，防止叠加后超出 ±1 */
export function finish(out: Float32Array, gain = 1) {
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * gain);
  return out;
}
