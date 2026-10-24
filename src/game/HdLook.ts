import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { VIEW_W, VIEW_H } from '../config/view';
import { EL_INFO, type El } from '../config/elements';

/**
 * HD-2D 风格光影原型（第 1–10 关，每关一套氛围预设）：
 * - 光照图：只盖在地砖上（熔岩口贴图、影子、角色、敌人、装饰都不受影响）——环境光略压暗 + 上暗下亮的景深渐变 + 暗角，熔岩口、火焰、法术、火精、宝石把脚下一小圈地面照亮，光色取自贴图本身
 * - 泛光：只给火焰和法术叠一层加色光晕，敌人、宝石不加
 * - 脚下软影子、飘升的火星、镜头移轴模糊（上下边缘）和轻微调色
 * - 法术小特效：飞叶、弩箭、飞剑、火球、符拖一串短命的小光点；毒雾光环里飘几团缓慢转动的淡绿雾气；地刺照亮脚下
 * 不改战斗逻辑，只按贴图 key 扫一遍显示列表决定谁发光、谁有影子。局内按 H 开关对比。
 */

interface Light {
  /** 半径（世界像素） */
  r: number;
  /** 打亮强度（加进光照图） */
  a: number;
  /** 泛光强度（叠加色） */
  g: number;
  /** 光色；不写就取贴图本身的主色，和原画色调对上 */
  c?: number;
  flicker?: boolean;
  /** 半径跟着贴图缩放走 */
  scaled?: boolean;
}

/** 按贴图 key 前缀匹配，长的优先。玩家法术用五行标准色（和 HUD 一致），符按 pj_fu_<五行> 取色 */
const LIGHTS: Record<string, Light> = {
  dc_lava: { r: 50, c: 0xff6a2a, a: 0.8, g: 0.08, flicker: true, scaled: true },
  fx_flame: { r: 24, a: 0.7, g: 0.08, flicker: true, scaled: true },
  fx_explosion: { r: 34, a: 0.9, g: 0.1, scaled: true },
  fx_seal_burst: { r: 24, a: 0.45, g: 0.05, scaled: true },
  fx_ice_burst: { r: 26, c: 0x9fd8ff, a: 0.3, g: 0.04, scaled: true },
  fx_orbit_flame: { r: 18, c: 0xff9a40, a: 0.45, g: 0.06 },
  pj_fireball: { r: 26, a: 0.6, g: 0.1 },
  pj_fu_: { r: 20, a: 0.5, g: 0.08 },
  ep_fire: { r: 22, a: 0.5, g: 0.1 },
  pj_bolt: { r: 18, c: EL_INFO.water.color, a: 0.4, g: 0.08 },
  pj_water: { r: 22, c: EL_INFO.water.color, a: 0.4, g: 0.08 },
  pj_sword: { r: 16, c: EL_INFO.metal.color, a: 0.35, g: 0.06 },
  pj_wave: { r: 22, c: EL_INFO.metal.color, a: 0.4, g: 0.08 },
  pj_leaf: { r: 14, c: EL_INFO.wood.color, a: 0.3, g: 0.05 },
  fx_slash: { r: 24, c: EL_INFO.metal.color, a: 0.3, g: 0.05 },
  en_huojing: { r: 20, a: 0.3, g: 0, flicker: true },
  boss_bifang: { r: 80, c: 0xff9a50, a: 0.6, g: 0, flicker: true },
  gem_: { r: 9, a: 0.35, g: 0 },
  fx_spike: { r: 16, c: EL_INFO.earth.color, a: 0.3, g: 0 },
  // 煞气剑阵：阵里的地面泛一层暗红
  fx_zone: { r: 60, c: 0xc04a3a, a: 0.3, g: 0, scaled: true },
  // 瘴雾：雾下的地面泛一层病黄绿；水弹带一点水光
  fx_fog: { r: 26, c: 0x9ac860, a: 0.18, g: 0, scaled: true },
  ep_water: { r: 16, c: EL_INFO.water.color, a: 0.3, g: 0.05 },
  ep_ice: { r: 16, c: 0x9fd8ff, a: 0.35, g: 0.05 },
};

/** 拖尾小光点：贴图 key 前缀 → 颜色（不写取五行色）和每帧冒点的概率 */
const TRAILS: Record<string, { c?: number; p: number }> = {
  pj_leaf: { c: 0x9fe08a, p: 0.5 },
  pj_bolt: { c: 0x8fc0ff, p: 0.6 },
  pj_sword: { c: 0xe6f0ff, p: 0.5 },
  pj_fireball: { c: 0xffa040, p: 0.7 },
  pj_fu_: { p: 0.4 },
};

/** 毒雾里的雾团数 */
const MIST_N = 6;

/** 站在地上、要画影子的东西 */
const SHADOW_PREFIX = ['en_', 'boss_', 'hero_', 'pp_', 'dc_basalt', 'dc_reed', 'dc_icecliff', 'dc_snowpine', 'dc_yardang', 'dc_poplar', 'dc_coral', 'dc_kunlun', 'dc_deadtree', 'dc_scorch', 'dc_rock', 'chest', 'crate'];

interface Preset {
  /** 环境光：画面中下部的亮度 */
  ambient: number;
  /** 画面顶部再压暗到多少（0–1，乘在环境光上） */
  top: number;
  /** 暗角四角亮度（0–1） */
  corner: number;
  /** 空气里飘的东西：火星往上升，尘土、落叶、灰烬横飘或往下落 */
  motes: Motes;
}

interface Motes {
  tint: number[];
  speedX: [number, number];
  speedY: [number, number];
  alpha: number;
  /** 每隔多少毫秒冒一颗 */
  every: number;
  /** 加色发光（火星）还是普通（尘、叶、灰） */
  glow: boolean;
}

/** 每关的氛围：环境光色调、景深压暗、暗角和空中飘的东西。飘的东西都很小、很淡，颜色避开三种宝石 */
const PRESETS: Record<number, Preset> = {
  // 荒郊古道：暖黄的午后，扬起的浮尘往一边飘
  1: { ambient: 0xdcd2bc, top: 0.9, corner: 0.8, motes: { tint: [0xe8d8b0, 0xd8c498], speedX: [6, 18], speedY: [-4, 4], alpha: 0.45, every: 160, glow: false } },
  // 竹林：竹荫下偏青的暗绿，几片暗色竹叶慢慢落下
  2: { ambient: 0xb8c8b6, top: 0.86, corner: 0.76, motes: { tint: [0x6a7a48, 0x7a8a50, 0x5a6a40], speedX: [-6, 8], speedY: [8, 18], alpha: 0.6, every: 220, glow: false } },
  // 山林：冷灰的山间，少量浅灰的雾尘
  3: { ambient: 0xc8c8d0, top: 0.88, corner: 0.78, motes: { tint: [0xc8c8d0, 0xb0b4bc], speedX: [-10, 10], speedY: [-3, 3], alpha: 0.35, every: 200, glow: false } },
  // 赤焰谷：火山灰里的暖红，火星往上升
  4: { ambient: 0xb8a09a, top: 0.9, corner: 0.8, motes: { tint: [0xffb050, 0xff7a2a, 0xffd890], speedX: [-10, 10], speedY: [-34, -12], alpha: 0.85, every: 70, glow: true } },
  // 兵冢古战场：昏黄的沙尘天，灰烬慢慢飘落
  5: { ambient: 0xc8bcac, top: 0.88, corner: 0.76, motes: { tint: [0xa8a098, 0x8c867e, 0xc0b8a8], speedX: [4, 14], speedY: [6, 14], alpha: 0.55, every: 120, glow: false } },
  // 云梦泽：雾气压着的冷青色水泽，淡白的水雾贴地慢慢横飘
  6: { ambient: 0xaebcb8, top: 0.84, corner: 0.74, motes: { tint: [0xc8d4cc, 0xb4c4bc, 0xd4dcd0], speedX: [3, 10], speedY: [-2, 2], alpha: 0.4, every: 180, glow: false } },
  // 寒江：冷蓝的雪夜，斜飘的细雪
  7: { ambient: 0xb0bcd0, top: 0.84, corner: 0.72, motes: { tint: [0xe8f0f8, 0xd0dce8, 0xffffff], speedX: [8, 22], speedY: [10, 26], alpha: 0.6, every: 110, glow: false } },
  // 大漠：昏黄燥热的午后，细沙贴地横着刮
  8: { ambient: 0xd4c0a0, top: 0.88, corner: 0.76, motes: { tint: [0xd8c090, 0xc8a870, 0xe8d4a8], speedX: [18, 40], speedY: [-2, 3], alpha: 0.5, every: 90, glow: false } },
  // 东海归墟：幽暗的海底蓝，细小的气泡慢慢往上浮
  9: { ambient: 0x9ab0c4, top: 0.8, corner: 0.7, motes: { tint: [0xc8e0f0, 0xa8c8e0, 0xe0f0f8], speedX: [-3, 3], speedY: [-18, -6], alpha: 0.45, every: 150, glow: false } },
  // 昆仑：清冷的高山晨光，几点淡金的灵气慢慢往上飘
  10: { ambient: 0xc8c4d8, top: 0.86, corner: 0.74, motes: { tint: [0xffe8a0, 0xf0f0ff, 0xffd890], speedX: [-4, 4], speedY: [-14, -4], alpha: 0.55, every: 140, glow: true } },
};

/** 光照图比画面四周多出的边，镜头跟随晚一帧时不露边 */
const M = 32;
const FX_DEPTH = 1e6;
/** 泛光层最高亮度 */
const GLOW_CAP = 0.22;

/** 移轴：以人物所在高度为中心，离人物上下超过约 1/3 屏开始轻微虚化，越往边缘越虚，上下对称 */
const TILT_FRAG = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uRes;
uniform float uCenter;
varying vec2 outTexCoord;
void main() {
  vec2 uv = outTexCoord;
  float k = 0.55 * smoothstep(0.3, 0.5, abs(uv.y - uCenter));
  if (k < 0.01) { gl_FragColor = texture2D(uMainSampler, uv); return; }
  vec2 px = k * 1.4 / uRes;
  vec4 c = vec4(0.0);
  float w = 0.0;
  for (int i = -3; i <= 3; i++)
    for (int j = -3; j <= 3; j++) {
      float g = exp(-float(i * i + j * j) / 6.0);
      c += texture2D(uMainSampler, uv + vec2(float(i), float(j)) * px) * g;
      w += g;
    }
  gl_FragColor = c / w;
}`;

/** 用到时才定义：模块加载时不碰 WebGL 类（测试里的 Phaser 是桩） */
function tiltPipeline() {
  return class TiltPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game: Phaser.Game) {
      super({ game, name: 'HdTilt', fragShader: TILT_FRAG });
    }

    /** 人物在画面里的高度（0 底 1 顶） */
    center = 0.5;

    onPreRender() {
      this.set2f('uRes', this.renderer.width, this.renderer.height);
      this.set1f('uCenter', this.center);
    }
  };
}

export function hdLookAvailable(levelId: number): boolean {
  return !!PRESETS[levelId] && new URLSearchParams(location.search).get('hd') !== '0';
}

/** 生成软边贴图（线性过滤，不走像素风的最近邻） */
function softTextures(scene: Phaser.Scene) {
  const tm = scene.textures;
  const make = (key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    if (tm.exists(key)) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d')!);
    tm.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  // 点光：白色，透明度从中心往外平方衰减（普通混合叠上去，相当于往光色插值）
  make('hd_light', 128, 128, (ctx) => {
    const img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 128; x++) {
        const d = Math.min(1, Math.hypot(x - 63.5, y - 63.5) / 64);
        const i = (y * 128 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * (1 - d) ** 2);
      }
    ctx.putImageData(img, 0, 0);
  });
  // 影子：黑色软椭圆
  make('hd_shadow', 32, 16, (ctx) => {
    const g = ctx.createRadialGradient(16, 8, 0, 16, 8, 16);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.setTransform(1, 0, 0, 0.5, 0, 4);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
}

/** 贴图主色：按饱和度（平方）和亮度加权平均第 0 帧的像素，再拉到最亮通道为 255；白色高光不会把颜色冲淡 */
function textureColor(scene: Phaser.Scene, key: string): number {
  const tex = scene.textures.get(key);
  const fr = tex.get(0) ?? tex.get();
  const src = fr.source.image as HTMLCanvasElement;
  const ctx = src.getContext?.('2d');
  if (!ctx) return 0xffffff;
  const d = ctx.getImageData(fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const sat = mx ? (mx - mn) / mx : 0;
    const k = (mx / 255) * (0.02 + sat * sat);
    r += d[i] * k;
    g += d[i + 1] * k;
    b += d[i + 2] * k;
    w += k;
  }
  if (!w) return 0xffffff;
  const m = Math.max(r, g, b) / w || 1;
  const f = 255 / m;
  return Phaser.Display.Color.GetColor((r / w) * f, (g / w) * f, (b / w) * f);
}

/** 画面底图：上暗下亮 + 暗角，灰度，用环境光染色 */
function baseTexture(scene: Phaser.Scene, key: string, p: Preset) {
  const tm = scene.textures;
  if (tm.exists(key)) return;
  const w = 64;
  const h = 36;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = y / (h - 1);
      const depth = p.top + (1 - p.top) * Math.min(1, v / 0.6);
      const dx = (x / (w - 1) - 0.5) * 2;
      const dy = (v - 0.5) * 2;
      const d = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
      const vig = 1 - (1 - p.corner) * Math.max(0, (d - 0.45) / 0.55) ** 1.6;
      const k = Math.round(255 * depth * vig);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  tm.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

export class HdLook {
  private on = true;
  private preset: Preset;
  private baseKey: string;
  private lightmap: Phaser.GameObjects.RenderTexture;
  private glow: Phaser.GameObjects.RenderTexture;
  private shadows: Phaser.GameObjects.RenderTexture;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private mist: Phaser.GameObjects.Image[] = [];
  private trailCache = new Map<string, { c: number; p: number } | null>();
  private fx: { active: boolean }[] = [];
  private tilt = false;
  private cache = new Map<string, Light | null>();
  private shadowCache = new Map<string, boolean>();
  private t = 0;
  /** 光照图出了画面的边用暗角颜色 */
  private edge: number;

  constructor(private g: GameScene) {
    this.preset = PRESETS[g.levelDef.id];
    this.baseKey = `hd_base_${g.levelDef.id}`;
    const amb = Phaser.Display.Color.IntegerToColor(this.preset.ambient);
    const k = this.preset.corner;
    this.edge = Phaser.Display.Color.GetColor(amb.red * k, amb.green * k, amb.blue * k);
    softTextures(g);
    baseTexture(g, this.baseKey, this.preset);
    const W = VIEW_W + M * 2;
    const H = VIEW_H + M * 2;
    this.shadows = g.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(-9e4).setAlpha(0.42);
    this.lightmap = g.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(-2e5).setBlendMode(Phaser.BlendModes.MULTIPLY);
    // 泛光层整体限到 GLOW_CAP：法术扎堆时光晕再多也只叠到这么亮，不会把怪群染成一片
    this.glow = g.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(FX_DEPTH - 4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(GLOW_CAP);
    const mo = this.preset.motes;
    // 往上升的从画面下半冒，往下落的从上方冒，横飘的铺满整屏
    const rising = mo.speedY[1] < 0;
    const falling = mo.speedY[0] > 0;
    this.embers = g.add.particles(0, 0, 'px', {
      x: { min: -40, max: VIEW_W + 40 },
      y: rising ? { min: VIEW_H * 0.2, max: VIEW_H + 30 } : falling ? { min: -30, max: VIEW_H * 0.8 } : { min: 0, max: VIEW_H },
      lifespan: { min: 2200, max: 4200 },
      speedX: { min: mo.speedX[0], max: mo.speedX[1] },
      speedY: { min: mo.speedY[0], max: mo.speedY[1] },
      scale: { start: 0.5, end: 0.25 },
      alpha: { start: mo.alpha, end: 0 },
      tint: mo.tint,
      frequency: mo.every,
      blendMode: mo.glow ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
    }).setDepth(FX_DEPTH - 3);

    this.trail = g.add.particles(0, 0, 'px', {
      lifespan: { min: 200, max: 340 },
      speed: { min: 0, max: 8 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.7, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    }).setDepth(FX_DEPTH - 3);
    for (let i = 0; i < MIST_N; i++) this.mist.push(g.add.image(0, 0, 'hd_light').setTint(0x9fd870).setVisible(false));

    const cam = g.cameras.main;
    if (g.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      // 上下边缘虚化，中间保持清晰（Phaser 自带的 TiltShift 输出透明，会整屏变黑，这里自己写）
      g.renderer.pipelines.addPostPipeline('HdTilt', tiltPipeline());
      cam.setPostPipeline('HdTilt');
      this.tilt = true;
      const cm = cam.postFX.addColorMatrix();
      cm.saturate(0.08, true);
      cm.contrast(0.05, true);
      this.fx.push(cm);
    }
    g.input.keyboard?.on('keydown-H', () => this.toggle());
    g.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cam.postFX?.clear();
      cam.removePostPipeline('HdTilt');
    });
  }

  private toggle() {
    this.on = !this.on;
    for (const o of [this.lightmap, this.glow, this.shadows]) o.setVisible(this.on);
    this.embers.setVisible(this.on);
    this.embers.emitting = this.on;
    this.trail.setVisible(this.on);
    if (!this.on) for (const m of this.mist) m.setVisible(false);
    for (const f of this.fx) f.active = this.on;
    const cam = this.g.cameras.main;
    if (this.tilt) {
      if (this.on) cam.setPostPipeline('HdTilt');
      else cam.removePostPipeline('HdTilt');
    }
    this.g.hud.toast(this.on ? 'HD 光影：开（H 关闭）' : 'HD 光影：关（H 打开）', '#ffd890');
  }

  private lightFor(key: string): Light | null {
    let l = this.cache.get(key);
    if (l !== undefined) return l;
    l = null;
    let best = 0;
    for (const k in LIGHTS) if (key.startsWith(k) && k.length > best) (l = LIGHTS[k]), (best = k.length);
    if (l && l.c === undefined) {
      const el = key.startsWith('pj_fu_') ? (key.slice(6) as El) : undefined;
      l = { ...l, c: el && EL_INFO[el] ? EL_INFO[el].color : textureColor(this.g, key) };
    }
    this.cache.set(key, l);
    return l;
  }

  private trailFor(key: string): { c: number; p: number } | null {
    let t = this.trailCache.get(key);
    if (t !== undefined) return t;
    t = null;
    for (const k in TRAILS)
      if (key.startsWith(k)) {
        const el = key.startsWith('pj_fu_') ? (key.slice(6) as El) : undefined;
        t = { c: TRAILS[k].c ?? (el && EL_INFO[el] ? EL_INFO[el].color : 0xffffff), p: TRAILS[k].p };
        break;
      }
    this.trailCache.set(key, t);
    return t;
  }

  /** 毒雾光环里的雾团：贴地，绕着人物慢慢转、一胀一缩，比光环本身更淡 */
  private updateMist() {
    const aura = this.g.skills.aura;
    const show = !!aura?.visible;
    for (let i = 0; i < MIST_N; i++) {
      const m = this.mist[i];
      m.setVisible(show);
      if (!show) continue;
      const rx = aura!.displayWidth / 2;
      const ry = aura!.displayHeight / 2;
      const a = this.t * (0.25 + 0.05 * i) + (i / MIST_N) * Math.PI * 2;
      const d = 0.35 + 0.2 * Math.sin(this.t * 0.7 + i * 1.7);
      const s = (rx * (0.42 + 0.08 * Math.sin(this.t * 1.1 + i))) / 64;
      m.setPosition(aura!.x + Math.cos(a) * rx * d, aura!.y + Math.sin(a) * ry * d)
        .setScale(s, s * (ry / rx))
        .setDepth(aura!.depth + 1)
        .setAlpha(0.16 + 0.05 * Math.sin(this.t * 1.3 + i * 2.1));
    }
  }

  private hasShadow(key: string): boolean {
    let v = this.shadowCache.get(key);
    if (v === undefined) {
      v = SHADOW_PREFIX.some((p) => key.startsWith(p)) && !/dead|corpse/.test(key);
      this.shadowCache.set(key, v);
    }
    return v;
  }

  update(dt: number) {
    if (!this.on) return;
    this.t += dt;
    const cam = this.g.cameras.main;
    const ox = Math.floor(cam.scrollX) - M;
    const oy = Math.floor(cam.scrollY) - M;
    const W = VIEW_W + M * 2;
    const H = VIEW_H + M * 2;
    this.embers.setPosition(cam.scrollX, cam.scrollY);
    this.updateMist();
    if (this.tilt) {
      const r = cam.getPostPipeline('HdTilt') as unknown;
      const pp = (Array.isArray(r) ? r[0] : r) as { center: number } | undefined;
      // 地图边上镜头停住时人物不在正中，焦点跟着人物走
      if (pp) pp.center = Phaser.Math.Clamp(1 - (this.g.player.y - cam.worldView.y) / VIEW_H, 0, 1);
    }

    const lm = this.lightmap.setPosition(ox, oy);
    const gl = this.glow.setPosition(ox, oy);
    const sh = this.shadows.setPosition(ox, oy);
    const p = this.preset;
    lm.fill(this.edge, 1);
    // 底图单独画（放进批量里画不出来）
    lm.stamp(this.baseKey, undefined, M, M, { originX: 0, originY: 0, scaleX: VIEW_W / 64, scaleY: VIEW_H / 36, tint: p.ambient });
    lm.beginDraw();
    gl.clear();
    gl.beginDraw();
    sh.clear();
    sh.beginDraw();

    const stampLight = (x: number, y: number, r: number, c: number, a: number, glowA: number) => {
      const s = r / 64;
      lm.stamp('hd_light', undefined, x - ox, y - oy, { scale: s, tint: c, alpha: Math.min(1, a), skipBatch: true });
      if (glowA > 0) gl.stamp('hd_light', undefined, x - ox, y - oy, { scale: s * 0.32, tint: c, alpha: Math.min(1, glowA / GLOW_CAP), skipBatch: true });
    };

    const x0 = ox - 120;
    const y0 = oy - 120;
    const x1 = ox + W + 120;
    const y1 = oy + H + 120;
    const list = this.g.children.list;
    for (let i = 0; i < list.length; i++) {
      const o = list[i] as Phaser.GameObjects.Sprite;
      if (!o.visible || !o.texture || o.alpha <= 0.02) continue;
      if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1) continue;
      const key = o.texture.key;
      if (this.hasShadow(key)) {
        const w = Math.abs(o.displayWidth) * 0.72;
        sh.stamp('hd_shadow', undefined, o.x - ox, o.y - oy - 1, { scaleX: w / 32, scaleY: (w * 0.34) / 16, skipBatch: true });
      }
      const tr = this.trailFor(key);
      if (tr && Math.random() < tr.p) {
        this.trail.setParticleTint(tr.c);
        this.trail.emitParticleAt(o.x + (Math.random() - 0.5) * 3, o.y + (Math.random() - 0.5) * 3, 1);
      }
      const l = this.lightFor(key);
      if (!l) continue;
      // 光心放在贴图中部（多数贴图原点在脚下）
      const cy = o.y - o.displayHeight * ((o.originY ?? 0.5) - 0.5);
      let k = l.scaled ? Math.abs(o.scaleX) : 1;
      if (key === 'fx_explosion') k *= 1 - (o.anims?.currentFrame?.index ?? 1) / 5;
      const fl = l.flicker ? 0.88 + 0.12 * Math.sin(this.t * 9 + o.x * 0.37 + o.y * 0.11) * Math.sin(this.t * 5.3 + o.x) : 1;
      const a = o.alpha * fl;
      stampLight(o.x, cy, l.r * k * (0.95 + 0.05 * fl), l.c!, l.a * a, l.g * a);
    }
    lm.endDraw();
    gl.endDraw();
    sh.endDraw();
  }
}
