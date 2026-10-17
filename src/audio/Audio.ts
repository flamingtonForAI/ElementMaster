import Phaser from 'phaser';
import { bell, block, buf, cymbal, dizi, drone, midiHz, noise, pluck, setSampleRate, suona, taiko } from './synth';
import { SFX, type SfxName } from './sfx';
import { BGM_FILES, TRACKS, type Inst, type LayerDef, type TrackDef } from './tracks';
import type { Rel } from '../config/elements';
import { loadSettings, writeSettings } from '../game/save';

// 音频总管：音效、BGM、静音设置。复用 Phaser 的 AudioContext（解锁、失焦挂起都由 Phaser 处理）。
// 外部音频文件可覆盖程序化版本：缓存里有 `sfx_<名字>` / `bgm_<曲名>` 就优先用文件；
// tracks.ts 的 BGM_FILES 里列出的曲子会在启动后从 public/audio 后台下载（.webm 优先，.mp3 兜底），
// 只常驻压缩数据；要播哪首才解码哪首，切走后释放（一首解码后约 50MB，全解开会有 300MB+）。

const LOOKAHEAD = 0.15;
// BGM 用 Opus（WebM 封装，体积约为 MP3 的一半）；不支持的浏览器退回 MP3
const BGM_EXT =
  typeof document !== 'undefined' && document.createElement('audio').canPlayType('audio/webm; codecs="opus"') ? 'webm' : 'mp3';
const PENTA = [0, 2, 4, 7, 9];

interface Note {
  d: number;
  steps: number;
  vel: number;
}
type Bar = (Note | null)[];

function parseBar(s: string): Bar {
  const toks = s.trim().split(/\s+/);
  const out: Bar = toks.map(() => null);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '-' || t === '.') continue;
    let steps = 1;
    while (toks[i + steps] === '-') steps++;
    out[i] = { d: t === 'X' || t === 'x' ? 0 : Number(t), steps, vel: t === 'x' ? 0.6 : t === 'X' ? 1 : 0.9 };
  }
  return out;
}

interface Player {
  readonly key: string;
  readonly bus: GainNode;
  update(now: number, intensity: number, play: boolean): void;
  dispose(): void;
}

class SynthPlayer implements Player {
  private layers: { def: LayerDef; bars: Bar[]; gain: GainNode; on: boolean; offAt: number }[];
  private tick = 0;
  private next: number;
  private readonly stepDur: number;

  constructor(private a: AudioManager, readonly key: string, private def: TrackDef, readonly bus: GainNode, start: number) {
    this.next = start;
    this.stepDur = 60 / def.bpm / 4;
    this.layers = def.layers.map((l) => {
      const gain = a.ctx!.createGain();
      gain.gain.value = 0;
      gain.connect(bus);
      return { def: l, bars: l.bars.map(parseBar), gain, on: false, offAt: -99 };
    });
  }

  update(now: number, intensity: number, play: boolean) {
    // 后台节流导致落后太多时重新对齐
    if (this.next < now - 0.2) this.next = now + 0.05;
    while (this.next < now + LOOKAHEAD) {
      if (play) this.step(this.next, intensity);
      this.next += this.stepDur;
      this.tick++;
    }
  }

  private step(t: number, I: number) {
    const bar = Math.floor(this.tick / 16);
    const pos = this.tick % 16;
    for (const L of this.layers) {
      // 进出各有阈值，避免在临界点来回切换
      if (!L.on && I >= L.def.at) {
        L.on = true;
        L.gain.gain.setTargetAtTime(L.def.vol, t, 0.25);
      } else if (L.on && L.def.at > 0 && I < L.def.at - 0.08) {
        L.on = false;
        L.offAt = t;
        L.gain.gain.setTargetAtTime(0, t, 0.8);
      }
      if (!L.on && t - L.offAt > 3) continue;
      const div = 16 / (L.def.res ?? 8);
      if (pos % div) continue;
      const n = L.bars[bar % L.bars.length][pos / div];
      if (!n) continue;
      const m = this.def.mode;
      const semi = m[((n.d % 5) + 5) % 5] + 12 * Math.floor(n.d / 5);
      const midi = this.def.root + (L.def.oct ?? 0) + semi;
      this.a.playNote(L.def.inst, midi, n.steps * div * this.stepDur, t, n.vel * (0.9 + Math.random() * 0.2), L.gain);
    }
  }

  dispose() {
    this.bus.disconnect();
  }
}

/** 文件曲没法叠层，改成跟局势开合：强度低时低通压暗、音量略收，紧起来全开并推高约 1.7dB */
const FILE_CUT_LO = 4500;
const FILE_CUT_HI = 20000;
const FILE_GAIN_LO = 0.82;

class FilePlayer implements Player {
  private src: AudioBufferSourceNode;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private last = -1;

  constructor(ctx: AudioContext, readonly key: string, buffer: AudioBuffer, readonly bus: GainNode, start: number, intensity: number) {
    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = true;
    const lp = BGM_FILES[key];
    if (lp) {
      this.src.loopStart = lp.loopStart;
      this.src.loopEnd = lp.loopEnd;
    }
    if (lp?.calm) {
      this.src.connect(bus);
    } else {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.gain = ctx.createGain();
      this.src.connect(this.filter).connect(this.gain).connect(bus);
      this.apply(intensity, 0);
    }
    this.src.start(start);
  }

  update(now: number, intensity: number) {
    if (this.filter && Math.abs(intensity - this.last) > 0.01) this.apply(intensity, now);
  }

  private apply(I: number, now: number) {
    this.last = I;
    const open = Math.min(1, I / 0.7);
    const cut = FILE_CUT_LO * Math.pow(FILE_CUT_HI / FILE_CUT_LO, open);
    const g = FILE_GAIN_LO + (1 - FILE_GAIN_LO) * Math.min(1, I);
    if (now <= 0) {
      this.filter!.frequency.value = cut;
      this.gain!.gain.value = g;
    } else {
      this.filter!.frequency.setTargetAtTime(cut, now, 0.15);
      this.gain!.gain.setTargetAtTime(g, now, 0.15);
    }
  }

  dispose() {
    this.src.stop();
    this.bus.disconnect();
  }
}

class AudioManager {
  ctx: AudioContext | null = null;
  musicOn = true;
  sfxOn = true;
  private cache: Phaser.Cache.BaseCache | null = null;
  private musicOut!: GainNode;
  private duckGain!: GainNode;
  private duckFilter!: BiquadFilterNode;
  private sfxOut!: GainNode;
  private sfxBufs = new Map<SfxName, AudioBuffer>();
  private lastPlay = new Map<SfxName, number>();
  private voices = new Map<SfxName, number[]>();
  private notes = new Map<string, AudioBuffer>();
  /** 下载好的压缩数据 */
  private bgmRaw = new Map<string, { data: ArrayBuffer; ext: string }>();
  /** 解码好的，只留在播、淡出中和等着切的 */
  private bgmBufs = new Map<string, AudioBuffer>();
  private decoding = new Map<string, Promise<void>>();
  private player: Player | null = null;
  /** 想切但文件还没到的变奏版，加载完再切 */
  private wanted: string | null = null;
  private fading: { p: Player; until: number }[] = [];
  private intensity = 0;
  private smooth = 0;
  private gemCombo = 0;
  private gemLast = -9;

  init(game: Phaser.Game) {
    if (this.ctx) return;
    const sm = game.sound;
    if (!(sm instanceof Phaser.Sound.WebAudioSoundManager)) return;
    const ctx = sm.context;
    this.ctx = ctx;
    this.cache = game.cache.audio;
    setSampleRate(ctx.sampleRate);
    const s = loadSettings();
    this.musicOn = s.musicOn;
    this.sfxOn = s.sfxOn;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.musicOn ? 0.8 : 0;
    this.musicOut.connect(master);
    this.duckFilter = ctx.createBiquadFilter();
    this.duckFilter.type = 'lowpass';
    this.duckFilter.frequency.value = 20000;
    this.duckFilter.connect(this.musicOut);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.duckFilter);
    this.sfxOut = ctx.createGain();
    this.sfxOut.gain.value = this.sfxOn ? 1 : 0;
    this.sfxOut.connect(master);

    // 启动后每帧渲染一个，避免一次性卡住
    const pending = Object.keys(SFX) as SfxName[];
    const warm = () => {
      const k = pending.shift();
      if (!k) return;
      this.sfxBuf(k);
      setTimeout(warm, 16);
    };
    warm();
    setInterval(() => this.update(), 25);
    // 菜单曲先单独拉，其余随后并行，免得首屏音乐被一起抢带宽
    void this.loadBgm('menu').then(() => {
      for (const k of Object.keys(BGM_FILES)) if (k !== 'menu') void this.loadBgm(k);
    });
  }

  /** 后台下载 BGM 文件（WebM 拉不到就换 MP3）；下载完时正在播同名的程序化版本、或在等这首，就解码后淡过去 */
  private async loadBgm(key: string, exts = BGM_EXT === 'webm' ? ['webm', 'mp3'] : ['mp3']) {
    for (const ext of exts) {
      try {
        const res = await fetch(`audio/bgm_${key}.${ext}`);
        if (!res.ok) continue;
        this.bgmRaw.set(key, { data: await res.arrayBuffer(), ext });
        break;
      } catch {
        continue;
      }
    }
    if (!this.bgmRaw.has(key)) return;
    if (this.wanted === key || (this.player instanceof SynthPlayer && this.player.key === key)) void this.decodeBgm(key);
  }

  /** 解码一首（WebM 解不开就改拉 MP3 再解），解完若还想要这首就切过去 */
  private decodeBgm(key: string): Promise<void> {
    let p = this.decoding.get(key);
    if (p) return p;
    p = (async () => {
      let raw = this.bgmRaw.get(key);
      let buf: AudioBuffer | null = null;
      try {
        // decodeAudioData 会转移 ArrayBuffer，传副本
        if (raw) buf = await this.ctx!.decodeAudioData(raw.data.slice(0));
      } catch {
        if (raw?.ext === 'webm') {
          this.bgmRaw.delete(key);
          await this.loadBgm(key, ['mp3']);
          raw = this.bgmRaw.get(key);
          try {
            if (raw) buf = await this.ctx!.decodeAudioData(raw.data.slice(0));
          } catch {
            buf = null;
          }
        }
      }
      this.decoding.delete(key);
      if (!buf) {
        this.bgmRaw.delete(key);
        // 解不开：等着的变奏版放弃，有程序化版本的照常用程序化
        if (this.wanted === key) this.music(key, 1.5);
        return;
      }
      this.bgmBufs.set(key, buf);
      if (this.wanted === key) {
        this.music(key, 1.5);
      } else if (this.player instanceof SynthPlayer && this.player.key === key) {
        this.stopMusic(1.5);
        this.music(key, 1.5);
      }
      this.evictBgm();
    })();
    this.decoding.set(key, p);
    return p;
  }

  /** 释放不在播、不在淡出、也不在等的解码数据 */
  private evictBgm() {
    const keep = new Set<string>(this.fading.map((f) => f.p.key));
    if (this.player) keep.add(this.player.key);
    if (this.wanted) keep.add(this.wanted);
    for (const k of this.bgmBufs.keys()) if (!keep.has(k)) this.bgmBufs.delete(k);
  }

  private toBuffer(data: Float32Array) {
    const b = this.ctx!.createBuffer(1, data.length, this.ctx!.sampleRate);
    b.getChannelData(0).set(data);
    return b;
  }

  private sfxBuf(name: SfxName) {
    let b = this.sfxBufs.get(name);
    if (!b) this.sfxBufs.set(name, (b = this.toBuffer(SFX[name].render())));
    return b;
  }

  private fileBuf(key: string): AudioBuffer | null {
    const c = this.cache;
    if (c?.exists(key)) return c.get(key) as AudioBuffer;
    return key.startsWith('bgm_') ? (this.bgmBufs.get(key.slice(4)) ?? null) : null;
  }

  // ---------- 音效 ----------

  sfx(name: SfxName, o: { rate?: number; vol?: number } = {}): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || ctx.state !== 'running') return false;
    const d = SFX[name];
    const now = ctx.currentTime;
    if (now - (this.lastPlay.get(name) ?? -9) < d.gap) return false;
    const v = (this.voices.get(name) ?? []).filter((end) => end > now);
    this.voices.set(name, v);
    if (v.length >= d.max) return false;
    const b = this.fileBuf(`sfx_${name}`) ?? this.sfxBuf(name);
    const src = ctx.createBufferSource();
    src.buffer = b;
    const rate = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 2 * (d.jitter ?? 0));
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = d.vol * (o.vol ?? 1);
    src.connect(g).connect(this.sfxOut);
    src.start(now);
    v.push(now + b.duration / rate);
    this.lastPlay.set(name, now);
    return true;
  }

  /** 命中：克制叠编钟，暴击更亮，被克更闷 */
  hit(rel: Rel, crit: boolean) {
    if (crit) this.sfx('crit');
    else if (rel === 'counter') this.sfx('hitCounter');
    else this.sfx('hit', { rate: rel === 'countered' ? 0.75 : 1 });
  }

  /** 连续吸经验球时音高沿五声音阶往上走 */
  gem() {
    const now = this.ctx?.currentTime ?? 0;
    const c = now - this.gemLast < 0.35 ? Math.min(this.gemCombo + 1, 9) : 0;
    const semi = PENTA[c % 5] + 12 * Math.floor(c / 5);
    if (this.sfx('gem', { rate: Math.pow(2, semi / 12) })) {
      this.gemCombo = c;
      this.gemLast = now;
    }
  }

  // ---------- BGM ----------

  playNote(inst: Inst, midi: number, dur: number, at: number, vel: number, out: AudioNode) {
    const ctx = this.ctx!;
    const drum = inst === 'taiko' || inst === 'block' || inst === 'cymbal';
    const fixed = drum || inst === 'qin' || inst === 'bell';
    const key = drum ? inst : fixed ? `${inst}:${midi}` : `${inst}:${midi}:${Math.round(dur * 100)}`;
    let b = this.notes.get(key);
    if (!b) {
      b = this.toBuffer(this.renderNote(inst, midiHz(midi), dur));
      this.notes.set(key, b);
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = vel;
    src.connect(g).connect(out);
    src.start(at);
  }

  private renderNote(inst: Inst, f: number, dur: number): Float32Array {
    switch (inst) {
      case 'qin': {
        const b = buf(1.4);
        pluck(b, f, 1.4, 0, 1.3);
        return b;
      }
      case 'bell': {
        const b = buf(1.6);
        bell(b, f, 1.6, 0, 0.8);
        return b;
      }
      case 'dizi': {
        const b = buf(dur);
        dizi(b, f, dur * 0.95, 0, 0.8);
        return b;
      }
      case 'suona': {
        const b = buf(dur);
        suona(b, f, dur * 0.95, 0, 0.8);
        return b;
      }
      case 'drone': {
        const b = buf(dur);
        drone(b, f, dur, 0, 0.8);
        return b;
      }
      case 'taiko': {
        const b = buf(0.5);
        taiko(b, 0, 0.9);
        // 曲里的鼓加一道皮面敲击声，起音更脆（音效里的鼓不加）
        noise(b, { dur: 0.015, at: 0, type: 'bp', f: 1800, q: 1.2, d: 0.004, vol: 0.3 });
        return b;
      }
      case 'block': {
        const b = buf(0.1);
        block(b, 0, 0.8);
        return b;
      }
      case 'cymbal': {
        const b = buf(1.2);
        cymbal(b, 0, 0.8);
        return b;
      }
    }
  }

  /** 切换 BGM（同一首在播则不动），旧曲淡出 */
  music(key: string, fade = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.wanted = null;
    if (this.player?.key === key) return;
    const def = TRACKS[key];
    const file = this.fileBuf(`bgm_${key}`);
    // 文件已下载但还没解码：旧曲先接着播，解完再换；
    // 变奏版（紧张、狂暴）没有程序化版本，文件还没下载完也先记下，到了再换
    if (!file && (this.bgmRaw.has(key) || this.decoding.has(key) || !def)) {
      this.wanted = key;
      if (this.bgmRaw.has(key)) void this.decodeBgm(key);
      return;
    }
    const fresh = !this.player;
    this.stopMusic(fade);
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(1, now + Math.max(0.05, fade));
    bus.connect(this.duckGain);
    // 局内切曲（半场、Boss、狂暴）沿用当前强度，免得新曲从最暗开起；从无到有才清零
    if (fresh) this.intensity = this.smooth = 0;
    this.player = file ? new FilePlayer(ctx, key, file, bus, now + 0.05, this.smooth) : new SynthPlayer(this, key, def, bus, now + 0.05);
  }

  stopMusic(fade = 0.8) {
    this.wanted = null;
    const p = this.player;
    if (!p || !this.ctx) return;
    const now = this.ctx.currentTime;
    p.bus.gain.cancelScheduledValues(now);
    p.bus.gain.setTargetAtTime(0, now, Math.max(0.01, fade / 3));
    this.fading.push({ p, until: now + fade + 0.5 });
    this.player = null;
  }

  /** 局势强度 0~1，决定程序化 BGM 叠几层 */
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  /** 暂停、升级时压低并闷住 BGM */
  duck(on: boolean) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.duckGain.gain.setTargetAtTime(on ? 0.4 : 1, now, 0.12);
    this.duckFilter.frequency.setTargetAtTime(on ? 800 : 20000, now, 0.12);
  }

  private update() {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    this.smooth += (this.intensity - this.smooth) * 0.03;
    this.player?.update(now, this.smooth, this.musicOn);
    const n = this.fading.length;
    this.fading = this.fading.filter((f) => {
      if (now < f.until) return true;
      f.p.dispose();
      return false;
    });
    if (n !== this.fading.length) this.evictBgm();
  }

  // ---------- 设置 ----------

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.musicOut.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    this.persist();
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
    if (this.ctx) this.sfxOut.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    this.persist();
  }

  private persist() {
    writeSettings({ ...loadSettings(), musicOn: this.musicOn, sfxOn: this.sfxOn });
  }
}

export const audio = new AudioManager();
