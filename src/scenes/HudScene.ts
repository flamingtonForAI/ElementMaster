import Phaser from 'phaser';
import { EL_INFO, GEN_ORDER, counters, counteredBy, type El, type Terrain } from '../config/elements';
import { SKILLS, PASSIVES, SKILL_SLOTS, PASSIVE_SLOTS } from '../config/skills';
import { LEVELS, phaseTerrain } from '../config/levels';
import { ENEMIES } from '../config/enemies';
import { optionKey, type Option } from '../game/Build';
import { label, hex } from '../ui/text';
import { MAP_TEXEL } from '../game/World';
import { wrap } from '../ui/wrap';
import type { GameScene, RunResult } from './GameScene';
import { stick, isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';
import { canFullscreen, isFullscreen, isStandalone, toggleFullscreen } from '../ui/fullscreen';

type Mode = 'play' | 'levelup' | 'menu';

interface MenuItem {
  text: string;
  fn: () => void;
}

const PANEL = 0x161220;
const LINE = 0x4a3f5c;
/** 摇杆半径（逻辑像素） */
const STICK_R = 26;
/** 右上角小地图：显示整张地图 */
const MM_X = 558;
const MM_Y = 20;
const MM = 76;
/** 小地图只看玩家周围这么大一块（世界像素，边长），大约上下左右各两屏 */
const MM_SPAN = 1400;
/** 大地图（按住 Tab）的位置和边长 */
const BIG = 220;
const BIG_X = 320 - BIG / 2;
const BIG_Y = 74;

/** 一块地图的三层：底（墙外暗色）、地形缩略图、标记点 */
interface MapLayer {
  bg: Phaser.GameObjects.Graphics;
  img: Phaser.GameObjects.Image;
  dots: Phaser.GameObjects.Graphics;
}

export class HudScene extends Phaser.Scene {
  private g!: GameScene;
  private gfx!: Phaser.GameObjects.Graphics;
  /** 本命印：方印 + 克/畏两行字 */
  private seal!: Phaser.GameObjects.Container;
  private sealBox!: Phaser.GameObjects.Rectangle;
  private sealText!: Phaser.GameObjects.Text;
  private keText!: Phaser.GameObjects.Text;
  private weiText!: Phaser.GameObjects.Text;
  private sealEl: El | null = null;
  /** 弹窗里的五行盘（升级界面随选中项刷新） */
  private pentaG: Phaser.GameObjects.Graphics | null = null;
  private pentaLabels: Phaser.GameObjects.Text[] = [];
  private levelTitle = '';
  private benPreview: Phaser.GameObjects.Text | null = null;
  private lvText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  /** 散人：当前周天元素，显示在本命下面 */
  private ztText!: Phaser.GameObjects.Text;
  /** Boss 远吼层数，如“狼啸 ×2” */
  private roarText!: Phaser.GameObjects.Text;
  private roarShown = -1;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private bigTitle!: Phaser.GameObjects.Text;
  private mini!: MapLayer;
  /** 大地图单独一层，盖住提示文字 */
  private big!: MapLayer;
  private mapKey = '';
  private bossText!: Phaser.GameObjects.Text;
  private skillGlyphs: Phaser.GameObjects.Text[] = [];
  private passiveGlyphs: Phaser.GameObjects.Text[] = [];
  private skillLvs: Phaser.GameObjects.Text[] = [];
  private passiveLvs: Phaser.GameObjects.Text[] = [];
  private toasts: { t: Phaser.GameObjects.Text; life: number }[] = [];
  private version = -1;

  private mode: Mode = 'play';
  private modal: Phaser.GameObjects.Container | null = null;
  private sel = 0;
  private inputLockUntil = 0;
  private options: Option[] = [];
  private cards: Phaser.GameObjects.Container[] = [];
  private menuItems: MenuItem[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private escAction: (() => void) | null = null;
  private stickGfx!: Phaser.GameObjects.Graphics;
  private stickId = -1;
  private stickBase = { x: 0, y: 0 };

  constructor() {
    super('hud');
  }

  /** 左下角的地气说明（潮汐换潮时重画） */
  private terrainLabels: Phaser.GameObjects.Text[] = [];

  /** 画地气说明：「地气 水70 火10 土20」，note 跟在后面（如“涨潮”） */
  showTerrain(terrain: Terrain, note?: string) {
    for (const t of this.terrainLabels) t.destroy();
    this.terrainLabels = [];
    let x = 6;
    const put = (s: string, css: string) => {
      const t = label(this, x, 343, s, css);
      this.terrainLabels.push(t);
      x += t.width + 6;
    };
    put('地气', '#8a8494');
    for (const el of GEN_ORDER) {
      const v = Math.round(terrain[el] * 100);
      if (v) put(`${EL_INFO[el].name}${v}`, hex(EL_INFO[el].color));
    }
    if (note) put(`· ${note}`, '#b8aec8');
  }

  /** 全屏预警：屏幕正中一行大字，放大淡入后停一会儿再淡出（昆仑换相） */
  banner(s: string, css: string) {
    if (!this.gfx) return;
    const t = label(this, 320, 250, s, css, 36).setOrigin(0.5).setAlpha(0).setScale(1.4).setDepth(90);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 350, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1900, duration: 600, onComplete: () => t.destroy() });
  }

  create() {
    this.g = this.scene.get('game') as GameScene;
    this.mode = 'play';
    this.modal = null;
    this.toasts = [];
    this.version = -1;
    this.gfx = this.add.graphics();
    const L = this.g.levelDef;

    this.lvText = label(this, 6, 7, '');
    this.timeText = label(this, 320, 7, '').setOrigin(0.5, 0);
    label(this, 320, 21, `第${L.id}关 · ${L.name}`, '#b8aec8').setOrigin(0.5, 0);
    this.killText = label(this, 634, 7, '').setOrigin(1, 0);
    this.sealBox = this.add.rectangle(0, 0, 18, 18, PANEL, 1).setStrokeStyle(1, LINE);
    this.sealText = label(this, 0, -7, '', '#fff', 12, false).setOrigin(0.5, 0);
    this.seal = this.add.container(MM_X + 11, MM_Y + MM + 15, [this.sealBox, this.sealText]);
    this.keText = label(this, MM_X + 26, MM_Y + MM + 2, '');
    this.weiText = label(this, MM_X + 26, MM_Y + MM + 15, '');
    this.ztText = label(this, MM_X + MM / 2, MM_Y + MM + 28, '').setOrigin(0.5, 0);
    this.roarShown = -1;
    this.roarText = label(this, MM_X + MM / 2, MM_Y + MM + 41, '', hex(EL_INFO[ENEMIES[L.boss]?.el ?? 'metal'].color)).setOrigin(0.5, 0);
    this.bossText = label(this, 320, 44, '').setOrigin(0.5, 0).setVisible(false);

    this.skillGlyphs = [];
    for (let i = 0; i < SKILL_SLOTS; i++) this.skillGlyphs.push(label(this, 6 + i * 23 + 9, 25, '', '#fff', 12, false).setOrigin(0.5, 0));
    this.passiveGlyphs = [];
    for (let i = 0; i < PASSIVE_SLOTS; i++) this.passiveGlyphs.push(label(this, 6 + i * 23 + 9, 59, '', '#fff', 12, false).setOrigin(0.5, 0));
    // 槽位下方的等级
    this.skillLvs = [];
    for (let i = 0; i < SKILL_SLOTS; i++) this.skillLvs.push(label(this, 6 + i * 23 + 9, 41, '').setOrigin(0.5, 0));
    this.passiveLvs = [];
    for (let i = 0; i < PASSIVE_SLOTS; i++) this.passiveLvs.push(label(this, 6 + i * 23 + 9, 75, '').setOrigin(0.5, 0));

    this.terrainLabels = [];
    const phase = L.cycle && this.g.hazards?.phaseEl;
    this.showTerrain(phase ? phaseTerrain(L, phase) : L.terrain, phase ? L.cycle!.note[phase] : undefined);

    // 暂停按钮（触屏和鼠标都能点）
    const pb = this.add.rectangle(358, 5, 20, 18, PANEL, 1).setOrigin(0).setStrokeStyle(1, LINE);
    pb.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-8, -5, 36, 30), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    pb.on('pointerdown', () => this.g.pauseGame());
    this.add.rectangle(364, 9, 2, 10, 0xd8d0e4).setOrigin(0);
    this.add.rectangle(370, 9, 2, 10, 0xd8d0e4).setOrigin(0);

    // 虚拟摇杆：屏幕任意空白处按下即出现
    this.stickGfx = this.add.graphics().setDepth(50);
    this.stickId = -1;
    this.releaseStick();
    this.input.addPointer(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.mode !== 'play' || over.length || this.stickId !== -1) return;
      this.stickId = p.id;
      this.stickBase = { x: p.x, y: p.y };
      stick.active = true;
      stick.x = stick.y = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.stickId) return;
      let dx = p.x - this.stickBase.x;
      let dy = p.y - this.stickBase.y;
      const d = Math.hypot(dx, dy);
      // 手指拖出范围时底座跟着走
      if (d > STICK_R) {
        this.stickBase.x = p.x - (dx / d) * STICK_R;
        this.stickBase.y = p.y - (dy / d) * STICK_R;
        dx = p.x - this.stickBase.x;
        dy = p.y - this.stickBase.y;
      }
      const dd = Math.hypot(dx, dy);
      const mag = dd < 4 ? 0 : Math.min(1, (dd - 4) / (STICK_R * 0.6));
      stick.x = dd ? (dx / dd) * mag : 0;
      stick.y = dd ? (dy / dd) * mag : 0;
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (p.id === this.stickId) this.releaseStick();
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', () => this.releaseStick());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.releaseStick());

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // 电脑上按住 Tab 看大地图，游戏不暂停
    this.tabKey = this.input.keyboard!.addKey('TAB', true);
    this.mapKey = this.g.world.buildMapTexture();
    this.mini = { bg: this.gfx, img: this.add.image(0, 0, this.mapKey).setOrigin(0), dots: this.add.graphics() };
    this.big = this.mapLayer(9);
    this.bigTitle = label(this, 320, BIG_Y - 16, `地图 · ${L.name}`, '#d8d0e4').setOrigin(0.5, 0).setVisible(false).setDepth(10);
  }

  private releaseStick() {
    this.stickId = -1;
    stick.active = false;
    stick.x = stick.y = 0;
    this.stickGfx?.clear();
  }

  private drawStick() {
    const g = this.stickGfx;
    g.clear();
    if (this.stickId === -1) return;
    const b = this.stickBase;
    g.fillStyle(0xffffff, 0.08).fillCircle(b.x, b.y, STICK_R);
    g.lineStyle(1, 0xffffff, 0.35).strokeCircle(b.x, b.y, STICK_R);
    const kx = b.x + stick.x * STICK_R;
    const ky = b.y + stick.y * STICK_R;
    g.fillStyle(0xffd23f, 0.55).fillCircle(kx, ky, 10);
    g.lineStyle(1, 0xffffff, 0.7).strokeCircle(kx, ky, 10);
  }

  // ---------- 每帧刷新 ----------

  update(_t: number, dms: number) {
    const g = this.g;
    if (!g.build) return;
    this.drawStick();
    const b = g.build;
    const gfx = this.gfx;
    gfx.clear();

    // 经验条
    gfx.fillStyle(0x0e0b14, 1).fillRect(0, 0, 640, 5);
    gfx.fillStyle(0x6fd6c4, 1).fillRect(0, 0, Math.round(640 * Math.min(1, b.xp / b.xpNeeded())), 4);
    gfx.fillStyle(0xb8fff0, 1).fillRect(0, 0, Math.round(640 * Math.min(1, b.xp / b.xpNeeded())), 1);

    this.lvText.setText(`Lv ${b.level}`);
    const m = Math.floor(g.elapsed / 60);
    const s = Math.floor(g.elapsed % 60);
    this.timeText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    this.killText.setText(`击杀 ${g.kills}`);

    // 技能槽
    const skills = [...b.skills];
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const x = 6 + i * 23;
      const y = 22;
      const it = skills[i];
      const col = it ? EL_INFO[SKILLS[it[0]].el].color : LINE;
      gfx.fillStyle(PANEL, 1).fillRect(x, y, 18, 18);
      gfx.lineStyle(1, col, 1).strokeRect(x + 0.5, y + 0.5, 17, 17);
    }
    const passives = [...b.passives];
    for (let i = 0; i < PASSIVE_SLOTS; i++) {
      const x = 6 + i * 23;
      const y = 56;
      const it = passives[i];
      const el = it ? PASSIVES[it[0]].el : null;
      const col = it ? (el ? EL_INFO[el].color : 0xb8aec8) : LINE;
      gfx.fillStyle(PANEL, 1).fillRect(x, y, 18, 18);
      gfx.lineStyle(1, col, 0.8).strokeRect(x + 0.5, y + 0.5, 17, 17);
    }

    if (this.version !== b.version) {
      this.version = b.version;
      for (let i = 0; i < SKILL_SLOTS; i++) {
        const it = skills[i];
        this.skillGlyphs[i].setText(it ? SKILLS[it[0]].glyph : '').setColor(it ? hex(EL_INFO[SKILLS[it[0]].el].color) : '#fff');
        this.setLv(this.skillLvs[i], it ? it[1] : 0, it ? SKILLS[it[0]].maxLv : 0);
      }
      for (let i = 0; i < PASSIVE_SLOTS; i++) {
        const it = passives[i];
        const el = it ? PASSIVES[it[0]].el : null;
        this.passiveGlyphs[i].setText(it ? PASSIVES[it[0]].glyph : '').setColor(el ? hex(EL_INFO[el].color) : '#d8d0e4');
        this.setLv(this.passiveLvs[i], it ? it[1] : 0, it ? PASSIVES[it[0]].maxLv : 0);
      }
      this.drawSeal(b.benming);
      const zt = this.g.zhoutian;
      this.ztText.setText(zt ? `周天 ${EL_INFO[zt].name}` : '').setColor(zt ? hex(EL_INFO[zt].color) : '#fff');
    }

    if (g.roarStacks !== this.roarShown) {
      this.roarShown = g.roarStacks;
      this.roarText.setText(g.roarStacks && g.levelDef.roar ? `${g.levelDef.roar.name} ×${g.roarStacks}` : '');
      if (g.roarStacks) {
        this.roarText.setScale(1.6);
        this.tweens.add({ targets: this.roarText, scale: 1, duration: 260, ease: 'Back.out' });
      }
    }

    const p = g.player;
    this.drawMap(this.mini, MM_X, MM_Y, MM, p.x, p.y, MM_SPAN, true);
    const big = this.mode === 'play' && this.tabKey.isDown;
    this.bigTitle.setVisible(big);
    this.big.bg.clear();
    this.big.dots.clear();
    this.big.img.setVisible(big);
    if (big) {
      this.big.bg.fillStyle(0x07050b, 0.5).fillRect(BIG_X - 6, BIG_Y - 20, BIG + 12, BIG + 26);
      this.drawMap(this.big, BIG_X, BIG_Y, BIG, 0, 0, g.world.half * 2, false);
    }

    // Boss 血条
    const boss = g.boss;
    if (boss && boss.alive) {
      this.bossText.setVisible(true).setText(boss.def.name);
      const k = Math.max(0, boss.hp / boss.maxHp);
      gfx.fillStyle(0x0e0b14, 1).fillRect(199, 37, 242, 6);
      gfx.fillStyle(0xc0392b, 1).fillRect(200, 38, Math.round(240 * k), 4);
      gfx.fillStyle(0xff7a6a, 1).fillRect(200, 38, Math.round(240 * k), 1);
    } else {
      this.bossText.setVisible(false);
    }

    // 提示
    const dt = dms / 1000;
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.life -= dt;
      t.t.setAlpha(Math.min(1, t.life / 0.4));
      if (t.life <= 0) {
        t.t.destroy();
        this.toasts.splice(i, 1);
      }
    }
    this.toasts.forEach((t, i) => (t.t.y = 72 + i * 16));
  }

  private setLv(t: Phaser.GameObjects.Text, lv: number, max: number) {
    if (!lv) t.setText('');
    else if (lv >= max) t.setText('MAX').setColor('#ffd23f');
    else t.setText(`Lv${lv}`).setColor('#d8d0e4');
  }

  /** 本命印：本命变了翻一下 */
  private drawSeal(el: El) {
    const info = EL_INFO[el];
    this.sealBox.setStrokeStyle(1, info.color, 1);
    this.sealText.setText(info.name).setColor(hex(info.color));
    const ke = counters(el);
    const wei = counteredBy(el);
    this.keText.setText(`克 ${EL_INFO[ke].name}`).setColor(hex(EL_INFO[ke].color));
    this.weiText.setText(`畏 ${EL_INFO[wei].name}`).setColor(hex(EL_INFO[wei].color));
    if (this.sealEl && this.sealEl !== el) {
      this.seal.scaleX = 0;
      this.tweens.add({ targets: this.seal, scaleX: 1, duration: 220, ease: 'Back.out' });
    }
    this.sealEl = el;
  }

  /**
   * 画一块方形地图：屏幕框 (X, Y, S)，以世界坐标 (cx, cy) 为中心、跨度 span。
   * edge：框外的宝箱和 Boss 贴着框边显示，告诉玩家往哪走
   */
  /** 新建一套地图层；parent 给了就放进弹窗容器 */
  private mapLayer(depth = 0, parent?: Phaser.GameObjects.Container): MapLayer {
    const l = { bg: this.add.graphics(), img: this.add.image(0, 0, this.mapKey).setOrigin(0), dots: this.add.graphics() };
    for (const o of [l.bg, l.img, l.dots]) {
      o.setDepth(depth);
      parent?.add(o);
    }
    return l;
  }

  private drawMap(layer: MapLayer, X: number, Y: number, S: number, cx: number, cy: number, span: number, edge: boolean) {
    const g = this.g;
    const gfx = layer.dots;
    gfx.clear();
    const half = g.world.half;
    const k = S / span;
    const sx = (x: number) => X + S / 2 + (x - cx) * k;
    const sy = (y: number) => Y + S / 2 + (y - cy) * k;
    const inFrame = (x: number, y: number) => x >= X + 1 && x <= X + S - 1 && y >= Y + 1 && y <= Y + S - 1;
    const dot = (wx: number, wy: number, s: number, col: number, a = 1, pin = false) => {
      let x = sx(wx);
      let y = sy(wy);
      if (!inFrame(x, y)) {
        if (!pin) return;
        x = Math.max(X + 2, Math.min(X + S - 2, x));
        y = Math.max(Y + 2, Math.min(Y + S - 2, y));
      }
      gfx.fillStyle(col, a).fillRect(Math.round(x) - (s >> 1), Math.round(y) - (s >> 1), s, s);
    };
    // 框底是墙外；地图内铺地形缩略图，只裁出框里那一块
    layer.bg.fillStyle(0x0a0810, 0.94).fillRect(X, Y, S, S);
    const T = MAP_TEXEL;
    const wl = cx - span / 2;
    const wt = cy - span / 2;
    const x0 = Math.max(-half, wl);
    const x1 = Math.min(half, wl + span);
    const y0 = Math.max(-half, wt);
    const y1 = Math.min(half, wt + span);
    if (x1 > x0 && y1 > y0) {
      layer.img
        .setVisible(true)
        .setScale(k * T)
        .setPosition(X + (-half - wl) * k, Y + (-half - wt) * k)
        .setCrop((x0 + half) / T, (y0 + half) / T, (x1 - x0) / T, (y1 - y0) / T);
    } else layer.img.setVisible(false);
    gfx.lineStyle(1, LINE, 1).strokeRect(X + 0.5, Y + 0.5, S - 1, S - 1);
    const v = g.cameras.main.worldView;
    gfx.lineStyle(1, 0x8a8494, 0.45).strokeRect(Math.round(sx(v.x)) + 0.5, Math.round(sy(v.y)) + 0.5, Math.max(2, Math.round(v.width * k)), Math.max(2, Math.round(v.height * k)));
    const size = S >= 120 ? 2 : 1;
    for (const it of g.pickups.items) {
      // 刚刷出来的先闪两下
      const a = g.now - it.born < 1.6 && Math.sin(g.now * 14) < 0 ? 0.25 : 1;
      dot(it.img.x, it.img.y, 2 * size, it.kind === 'crate' ? 0xc0904a : 0x8ff0e0, a);
    }
    for (const c of g.pickups.chests) dot(c.img.x, c.img.y, 2 + size, c.kind === 'gold' ? 0xffd23f : 0xd89a5a, 1, edge);
    const blink = 0.55 + 0.45 * Math.sin(g.now * 8);
    for (const e of g.enemies.list) if (e.alive && e.elite) dot(e.x, e.y, 2 + size, 0xff5a4a, blink);
    const boss = g.boss;
    if (boss && boss.alive) {
      dot(boss.x, boss.y, 3 + 2 * size, 0x0e0b14, 1, edge);
      dot(boss.x, boss.y, 1 + 2 * size, 0xff3030, 1, edge);
    }
    dot(g.player.x, g.player.y, 3, 0xffffff);
  }

  /** 五行盘：灵根分布；preview 时叠一层选完之后的形状 */
  private drawPenta(parent: Phaser.GameObjects.Container, cx: number, cy: number, R: number, lingen: Record<El, number>, benming: El, preview?: { lingen: Record<El, number>; benming: El }) {
    if (!this.pentaG) {
      this.pentaG = this.add.graphics();
      parent.add(this.pentaG);
    }
    const g = this.pentaG;
    g.clear();
    this.pentaLabels.forEach((t) => t.destroy());
    this.pentaLabels = [];
    const max = Math.max(8, ...GEN_ORDER.map((e) => Math.max(lingen[e], preview?.lingen[e] ?? 0)));
    const pt = (i: number, r: number) => {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    };
    const shape = (l: Record<El, number>) => GEN_ORDER.map((e, i) => pt(i, Math.max(2, (l[e] / max) * R)));
    g.fillStyle(PANEL, 0.92).fillPoints([0, 1, 2, 3, 4].map((i) => pt(i, R + 3)), true);
    g.lineStyle(1, LINE, 1).strokePoints([0, 1, 2, 3, 4].map((i) => pt(i, R)), true);
    g.lineStyle(1, 0x2e2638, 1).strokePoints([0, 1, 2, 3, 4].map((i) => pt(i, R / 2)), true);
    const pts = shape(lingen);
    g.fillStyle(EL_INFO[benming].color, 0.35).fillPoints(pts, true);
    g.lineStyle(1, EL_INFO[benming].color, 1).strokePoints(pts, true);
    if (preview) g.lineStyle(1, 0xffd23f, 0.9).strokePoints(shape(preview.lingen), true);
    const shown = preview?.benming ?? benming;
    GEN_ORDER.forEach((e, i) => {
      const p = pt(i, R + 9);
      const t = label(this, p.x, p.y - 6, EL_INFO[e].name, hex(e === shown ? EL_INFO[e].color : EL_INFO[e].dark), 12).setOrigin(0.5, 0);
      parent.add(t);
      this.pentaLabels.push(t);
    });
  }

  toast(s: string, color = '#f4eee0') {
    if (!this.gfx) return;
    const t = label(this, 320, 100, s, color).setOrigin(0.5, 0);
    this.toasts.push({ t, life: 2.6 });
    if (this.toasts.length > 4) {
      this.toasts[0].t.destroy();
      this.toasts.shift();
    }
  }

  // ---------- 升级三选一 ----------

  /** keepSel：换签/斩缘后重画，保持光标且不加输入锁 */
  /** title：铜匣也走这个界面，换个标题 */
  showLevelUp(opts: Option[], keepSel = false, title?: string) {
    const sel = this.sel;
    if (!keepSel) this.levelTitle = title ?? '境界提升 · 选择一项';
    this.closeModal();
    this.releaseStick();
    this.mode = 'levelup';
    this.options = opts;
    this.sel = keepSel ? Math.min(sel, opts.length - 1) : 0;
    if (!keepSel) this.inputLockUntil = this.time.now + 350;
    const c = this.add.container(0, 0).setDepth(100);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.72).setOrigin(0));
    c.add(label(this, 320, 58, this.levelTitle, '#ffd23f').setOrigin(0.5, 0));
    c.add(label(this, 602, 150, '灵根', '#8a8494').setOrigin(0.5, 0));
    this.benPreview = label(this, 602, 240, '').setOrigin(0.5, 0).setAlign('center').setLineSpacing(3);
    c.add(this.benPreview);
    c.add(label(this, 320, 318, isTouch() ? '点击卡片选择' : '← → 选择　Enter / 空格 确认', '#8a8494').setOrigin(0.5, 0));
    this.cards = opts.map((o, i) => {
      const card = this.makeCard(o, 320 + (i - 1) * 168, 84);
      c.add(card);
      return card;
    });
    // 洞府买了换签/斩缘才显示按钮
    const btns: [string, () => void][] = [];
    if (this.g.rerolls > 0) btns.push([`换签 ×${this.g.rerolls}${isTouch() ? '' : '　R'}`, () => this.reroll()]);
    if (this.g.banishes > 0) btns.push([`斩缘选中项 ×${this.g.banishes}${isTouch() ? '' : '　X'}`, () => this.banish()]);
    btns.forEach(([text, fn], i) => {
      const x = 320 + (i - (btns.length - 1) / 2) * 150;
      const b = this.add.rectangle(x, 288, 136, 22, PANEL, 1).setOrigin(0.5, 0).setStrokeStyle(1, LINE);
      b.setInteractive({ useHandCursor: true }).on('pointerdown', fn);
      c.add(b);
      c.add(label(this, x, 293, text, '#d8d0e4').setOrigin(0.5, 0));
    });
    this.refreshCards();
  }

  private reroll() {
    if (this.g.rerolls <= 0 || this.time.now < this.inputLockUntil) return;
    this.g.rerolls--;
    audio.sfx('tick');
    this.showLevelUp(this.g.build.options(3), true);
  }

  /** 封禁当前选中的卡，并补一张新的 */
  private banish() {
    if (this.time.now < this.inputLockUntil) return;
    const o = this.options[this.sel];
    if (this.g.banishes <= 0 || !o || o.kind === 'heal' || o.kind === 'lingshi') {
      audio.sfx('deny');
      return;
    }
    this.g.banishes--;
    this.g.build.banned.add(optionKey(o));
    const others = this.options.filter((x) => x !== o).map(optionKey);
    const opts = [...this.options];
    const fill = this.g.build.options(1, others)[0];
    if (fill) opts[this.sel] = fill;
    else opts.splice(this.sel, 1);
    audio.sfx('deny');
    this.showLevelUp(opts, true);
  }

  private makeCard(o: Option, cx: number, y: number): Phaser.GameObjects.Container {
    const W = 152;
    const H = 192;
    const card = this.add.container(cx, y);
    let name = '';
    let glyph = '';
    let el: El | null = null;
    let tag = '';
    let desc = '';
    if (o.kind === 'skill') {
      const d = SKILLS[o.id];
      name = d.name;
      glyph = d.glyph;
      el = d.el;
      tag = o.lv === 1 ? '新 · 术' : `Lv ${o.lv - 1} → ${o.lv}`;
      desc = d.desc[o.lv - 1];
    } else if (o.kind === 'passive') {
      const d = PASSIVES[o.id];
      name = d.name;
      glyph = d.glyph;
      el = d.el;
      tag = o.lv === 1 ? '新 · 心法' : `Lv ${o.lv - 1} → ${o.lv}`;
      desc = d.desc;
    } else if (o.kind === 'heal') {
      name = '回气丹';
      glyph = '丹';
      tag = '消耗品';
      desc = '回复 30% 生命';
    } else {
      name = '灵石';
      glyph = '石';
      tag = '消耗品';
      desc = `局外货币 +${this.g.lingshiCard()}，结算时发放，可在洞府购买修炼`;
    }
    const col = el ? EL_INFO[el].color : 0xb8aec8;
    const bg = this.add.rectangle(0, 0, W, H, PANEL, 0.96).setOrigin(0.5, 0).setStrokeStyle(1, col, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.setSel(this.cards.indexOf(card));
      this.refreshCards();
    });
    bg.on('pointerdown', () => {
      this.sel = this.cards.indexOf(card);
      this.confirm();
    });
    card.add(bg);
    card.add(this.add.rectangle(0, 14, 40, 40, 0x0e0b14, 1).setOrigin(0.5, 0).setStrokeStyle(1, col, 1));
    card.add(label(this, 0, 22, glyph, hex(col), 24).setOrigin(0.5, 0));
    card.add(label(this, 0, 62, name, '#f4eee0').setOrigin(0.5, 0));
    card.add(label(this, 0, 78, tag, o.kind !== 'heal' && o.kind !== 'lingshi' && o.lv === 1 ? '#ffd23f' : '#b8aec8').setOrigin(0.5, 0));
    card.add(label(this, -W / 2 + 10, 100, wrap(desc, W - 20), '#d8d0e4', 12, false).setLineSpacing(4));
    if (el) {
      const tm = Math.round((this.g.terrainMods[el] - 1) * 100);
      const tmTxt = tm === 0 ? '地气 ±0%' : `地气 ${tm > 0 ? '+' : ''}${tm}%`;
      card.add(label(this, -W / 2 + 10, H - 36, `${EL_INFO[el].name}系 · 克${EL_INFO[counters(el)].name}`, hex(col)));
      card.add(label(this, -W / 2 + 10, H - 20, tmTxt, tm > 0 ? '#8fe08a' : tm < 0 ? '#ff8a7a' : '#8a8494'));
    }
    card.setData('bg', bg);
    card.setData('col', col);
    return card;
  }

  private refreshCards() {
    this.cards.forEach((c, i) => {
      const bg = c.getData('bg') as Phaser.GameObjects.Rectangle;
      const on = i === this.sel;
      bg.setStrokeStyle(on ? 2 : 1, on ? 0xffd23f : c.getData('col'), on ? 1 : 0.6);
      c.y = on ? 80 : 84;
    });
    // 五行盘预览：选了这一项灵根会怎么变、本命会不会换
    const b = this.g.build;
    const o = this.options[this.sel];
    if (!this.modal || !o) return;
    const pv = b.preview(o);
    this.drawPenta(this.modal, 602, 200, 22, b.lingen, b.benming, pv);
    const from = EL_INFO[b.benming];
    const to = EL_INFO[pv.benming];
    const el = o.kind === 'skill' ? SKILLS[o.id].el : o.kind === 'passive' ? PASSIVES[o.id].el : null;
    const gain = el ? `${EL_INFO[el].name} +1\n` : '';
    this.benPreview?.setText(`${gain}${pv.benming === b.benming ? `本命 ${from.name}` : `本命 ${from.name}→${to.name}`}`).setColor(hex(to.color));
  }

  /** 改选中项，变了才响 */
  private setSel(i: number) {
    if (i !== this.sel) audio.sfx('tick');
    this.sel = i;
  }

  private confirm() {
    if (this.time.now < this.inputLockUntil) return;
    audio.sfx('select');
    if (this.mode === 'levelup') {
      const o = this.options[this.sel];
      this.closeModal();
      this.g.applyOption(o);
      this.scene.resume('game');
    } else if (this.mode === 'menu') {
      const it = this.menuItems[this.sel];
      it?.fn();
    }
  }

  // ---------- 菜单类弹窗 ----------

  private showMenu(title: string, titleColor: string, lines: string[], items: MenuItem[], onEsc: (() => void) | null) {
    this.closeModal();
    this.releaseStick();
    this.mode = 'menu';
    this.sel = 0;
    this.menuItems = items;
    this.escAction = onEsc;
    this.inputLockUntil = this.time.now + 300;
    const c = this.add.container(0, 0).setDepth(100);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.75).setOrigin(0));
    const h = 70 + lines.length * 16 + items.length * 26;
    const top = 180 - h / 2;
    c.add(this.add.rectangle(320, top, 240, h, PANEL, 0.96).setOrigin(0.5, 0).setStrokeStyle(1, LINE, 1));
    c.add(label(this, 320, top + 12, title, titleColor, 24).setOrigin(0.5, 0));
    lines.forEach((l, i) => c.add(label(this, 320, top + 46 + i * 16, l, '#d8d0e4').setOrigin(0.5, 0)));
    const iy = top + 52 + lines.length * 16;
    this.menuTexts = items.map((it, i) => {
      const t = label(this, 320, iy + i * 26, it.text, '#f4eee0').setOrigin(0.5, 0);
      t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-60, -7, t.width + 120, t.height + 14), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      t.on('pointerover', () => {
        this.setSel(i);
        this.refreshMenu();
      });
      // 松手时触发：浏览器只允许在触摸抬起时进入全屏
      t.on('pointerup', () => {
        this.sel = i;
        this.confirm();
      });
      c.add(t);
      return t;
    });
    this.refreshMenu();
  }

  private refreshMenu() {
    this.menuTexts.forEach((t, i) => {
      const it = this.menuItems[i];
      t.setText(i === this.sel ? `▶ ${it.text} ◀` : it.text).setColor(i === this.sel ? '#ffd23f' : '#f4eee0');
    });
  }

  /** focus：切换音乐/音效后重开菜单时，保持光标在原项上 */
  showPause(focus?: 'music' | 'sfx') {
    const resume = () => {
      this.closeModal();
      this.scene.resume('game');
    };
    const music: MenuItem = {
      text: `音乐：${audio.musicOn ? '开' : '关'}`,
      fn: () => {
        audio.setMusic(!audio.musicOn);
        this.showPause('music');
      },
    };
    const sfx: MenuItem = {
      text: `音效：${audio.sfxOn ? '开' : '关'}`,
      fn: () => {
        audio.setSfx(!audio.sfxOn);
        this.showPause('sfx');
      },
    };
    const items: MenuItem[] = [
      { text: '继续', fn: resume },
      music,
      sfx,
      { text: '重新开始', fn: () => this.restart(this.g.levelDef.id) },
      { text: '返回选角', fn: () => this.toMenu() },
    ];
    if (isTouch() && canFullscreen() && !isStandalone()) {
      items.splice(1, 0, {
        text: isFullscreen() ? '退出全屏' : '全屏',
        fn: () => {
          toggleFullscreen();
          resume();
        },
      });
    }
    this.showMenu('暂停', '#f4eee0', [], items, resume);
    const b = this.g.build;
    const el = b.benming;
    this.modal!.add(label(this, 110, 120, '灵根', '#8a8494').setOrigin(0.5, 0));
    this.drawPenta(this.modal!, 110, 180, 30, b.lingen, el);
    this.modal!.add(label(this, 110, 226, `本命 ${EL_INFO[el].name}`, hex(EL_INFO[el].color)).setOrigin(0.5, 0));
    this.modal!.add(label(this, 110, 242, `克 ${EL_INFO[counters(el)].name}　畏 ${EL_INFO[counteredBy(el)].name}`, '#b8aec8').setOrigin(0.5, 0));
    // 右侧大地图，游戏已暂停，画一次就行
    const S = 156;
    const mx = 540 - S / 2;
    const my = 102;
    this.modal!.add(label(this, 540, my - 16, '地图', '#8a8494').setOrigin(0.5, 0));
    this.drawMap(this.mapLayer(0, this.modal!), mx, my, S, 0, 0, this.g.world.half * 2, false);
    const legend: [string, string][] = [['宝箱', '#ffd23f'], ['木匣', '#c0904a'], ['符箓', '#8ff0e0'], ['精英', '#ff5a4a']];
    let lx = mx;
    for (const [t, c] of legend) {
      const tx = label(this, lx, my + S + 4, `■${t}`, c);
      this.modal!.add(tx);
      lx += tx.width + 4;
    }
    if (!isTouch()) this.modal!.add(label(this, 540, my + S + 20, '对局中按住 Tab 也能看', '#8a8494').setOrigin(0.5, 0));
    if (focus) {
      this.sel = items.indexOf(focus === 'music' ? music : sfx);
      this.inputLockUntil = 0;
      this.refreshMenu();
    }
  }

  showResult(r: RunResult) {
    const m = Math.floor(r.time / 60);
    const s = Math.floor(r.time % 60);
    const lines = [
      `用时 ${m}分${String(s).padStart(2, '0')}秒`,
      `击杀 ${r.kills}　等级 ${r.level}`,
      `获得灵石 ${r.lingshi}`,
    ];
    // 灵石明细两项一行
    for (let i = 0; i < r.lingshiLines.length; i += 2) lines.push(r.lingshiLines.slice(i, i + 2).join('　'));
    if (r.growth) lines.push(r.growth);
    const items: MenuItem[] = [];
    const next = LEVELS.find((l) => l.id === this.g.levelDef.id + 1);
    if (r.win && next?.available) items.push({ text: `下一关 · ${next.name}`, fn: () => this.restart(next.id) });
    items.push({ text: '再来一次', fn: () => this.restart(this.g.levelDef.id) });
    items.push({ text: '返回选角', fn: () => this.toMenu() });
    this.showMenu(r.win ? '通关！' : '陨落', r.win ? '#ffd23f' : '#ff6a5a', lines, items, null);
  }

  private restart(level: number) {
    this.closeModal();
    const char = this.g.char.id;
    this.scene.stop('game');
    this.scene.start('game', { level, char });
  }

  private toMenu() {
    this.closeModal();
    this.scene.stop('game');
    this.scene.start('menu', { char: this.g.char.id });
  }

  private closeModal() {
    this.modal?.destroy();
    this.modal = null;
    this.pentaG = null;
    this.pentaLabels = [];
    this.benPreview = null;
    this.cards = [];
    this.menuTexts = [];
    this.mode = 'play';
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.mode === 'levelup') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.setSel((this.sel + this.cards.length - 1) % this.cards.length);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.setSel((this.sel + 1) % this.cards.length);
      else if (k === '1' || k === '2' || k === '3') {
        const i = Number(k) - 1;
        if (i < this.cards.length) {
          this.sel = i;
          this.confirm();
          return;
        }
      } else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') {
        this.confirm();
        return;
      } else if (k === 'r' || k === 'R') return this.reroll();
      else if (k === 'x' || k === 'X') return this.banish();
      this.refreshCards();
    } else if (this.mode === 'menu') {
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.setSel((this.sel + this.menuItems.length - 1) % this.menuItems.length);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.setSel((this.sel + 1) % this.menuItems.length);
      else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') {
        this.confirm();
        return;
      } else if ((k === 'Escape' || k === 'p' || k === 'P') && this.escAction && this.time.now >= this.inputLockUntil) {
        this.escAction();
        return;
      }
      this.refreshMenu();
    }
  }
}
