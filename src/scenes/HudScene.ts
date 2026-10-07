import Phaser from 'phaser';
import { EL_INFO, GEN_ORDER, counters, type El } from '../config/elements';
import { SKILLS, PASSIVES, SKILL_SLOTS, PASSIVE_SLOTS } from '../config/skills';
import { LEVELS } from '../config/levels';
import type { Option } from '../game/Build';
import { label, hex } from '../ui/text';
import { wrap } from '../ui/wrap';
import type { GameScene, RunResult } from './GameScene';
import { stick, isTouch } from '../ui/touch';
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

export class HudScene extends Phaser.Scene {
  private g!: GameScene;
  private gfx!: Phaser.GameObjects.Graphics;
  private penta!: Phaser.GameObjects.Graphics;
  private lvText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;
  private benText!: Phaser.GameObjects.Text;
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

  create() {
    this.g = this.scene.get('game') as GameScene;
    this.mode = 'play';
    this.modal = null;
    this.toasts = [];
    this.version = -1;
    this.gfx = this.add.graphics();
    this.penta = this.add.graphics();
    const L = this.g.levelDef;

    this.lvText = label(this, 6, 7, '');
    this.timeText = label(this, 320, 7, '').setOrigin(0.5, 0);
    label(this, 320, 21, `第${L.id}关 · ${L.name}`, '#b8aec8').setOrigin(0.5, 0);
    this.killText = label(this, 634, 7, '').setOrigin(1, 0);
    this.benText = label(this, 598, 98, '').setOrigin(0.5, 0);
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

    // 地气说明
    let x = 6;
    const t0 = label(this, x, 343, '地气', '#8a8494');
    x += t0.width + 6;
    for (const el of GEN_ORDER) {
      const v = Math.round(L.terrain[el] * 100);
      if (!v) continue;
      const t = label(this, x, 343, `${EL_INFO[el].name}${v}`, hex(EL_INFO[el].color));
      x += t.width + 6;
    }

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
      this.drawPentagon(b.lingen, b.benming);
      this.benText.setText(`本命 ${EL_INFO[b.benming].name}`).setColor(hex(EL_INFO[b.benming].color));
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

  private drawPentagon(lingen: Record<El, number>, benming: El) {
    const g = this.penta;
    g.clear();
    const cx = 598;
    const cy = 60;
    const R = 22;
    const max = Math.max(8, ...GEN_ORDER.map((e) => lingen[e]));
    const pt = (i: number, r: number) => {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      return new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    };
    g.fillStyle(PANEL, 0.92).fillPoints([0, 1, 2, 3, 4].map((i) => pt(i, R + 3)), true);
    g.lineStyle(1, LINE, 1).strokePoints([0, 1, 2, 3, 4].map((i) => pt(i, R)), true);
    g.lineStyle(1, 0x2e2638, 1).strokePoints([0, 1, 2, 3, 4].map((i) => pt(i, R / 2)), true);
    const pts = GEN_ORDER.map((e, i) => pt(i, Math.max(2, (lingen[e] / max) * R)));
    g.fillStyle(EL_INFO[benming].color, 0.35).fillPoints(pts, true);
    g.lineStyle(1, EL_INFO[benming].color, 1).strokePoints(pts, true);
    // 顶点字
    this.children.list.filter((c) => c.getData && c.getData('penta')).forEach((c) => c.destroy());
    GEN_ORDER.forEach((e, i) => {
      const p = pt(i, R + 9);
      const t = label(this, p.x, p.y - 6, EL_INFO[e].name, hex(e === benming ? EL_INFO[e].color : EL_INFO[e].dark), 12).setOrigin(0.5, 0);
      t.setData('penta', true);
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

  showLevelUp(opts: Option[]) {
    this.closeModal();
    this.releaseStick();
    this.mode = 'levelup';
    this.options = opts;
    this.sel = 0;
    this.inputLockUntil = this.time.now + 350;
    const c = this.add.container(0, 0).setDepth(100);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.72).setOrigin(0));
    c.add(label(this, 320, 58, '境界提升 · 选择一项', '#ffd23f').setOrigin(0.5, 0));
    c.add(label(this, 320, 290, isTouch() ? '点击卡片选择' : '← → 选择　Enter / 空格 确认', '#8a8494').setOrigin(0.5, 0));
    this.cards = opts.map((o, i) => {
      const card = this.makeCard(o, 320 + (i - 1) * 168, 84);
      c.add(card);
      return card;
    });
    this.refreshCards();
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
      desc = '局外货币 +10（暂未开放用途）';
    }
    const col = el ? EL_INFO[el].color : 0xb8aec8;
    const bg = this.add.rectangle(0, 0, W, H, PANEL, 0.96).setOrigin(0.5, 0).setStrokeStyle(1, col, 0.6);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      this.sel = this.cards.indexOf(card);
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
  }

  private confirm() {
    if (this.time.now < this.inputLockUntil) return;
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
        this.sel = i;
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

  showPause() {
    const resume = () => {
      this.closeModal();
      this.scene.resume('game');
    };
    const items: MenuItem[] = [
      { text: '继续', fn: resume },
      { text: '重新开始', fn: () => this.restart(this.g.levelDef.id) },
      { text: '返回标题', fn: () => this.toMenu() },
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
  }

  showResult(r: RunResult) {
    const m = Math.floor(r.time / 60);
    const s = Math.floor(r.time % 60);
    const lines = [
      `用时 ${m}分${String(s).padStart(2, '0')}秒`,
      `击杀 ${r.kills}　等级 ${r.level}`,
      `获得灵石 ${r.lingshi}`,
    ];
    const items: MenuItem[] = [];
    const next = LEVELS.find((l) => l.id === this.g.levelDef.id + 1);
    if (r.win && next?.available) items.push({ text: `下一关 · ${next.name}`, fn: () => this.restart(next.id) });
    items.push({ text: '再来一次', fn: () => this.restart(this.g.levelDef.id) });
    items.push({ text: '返回标题', fn: () => this.toMenu() });
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
    this.scene.start('menu');
  }

  private closeModal() {
    this.modal?.destroy();
    this.modal = null;
    this.cards = [];
    this.menuTexts = [];
    this.mode = 'play';
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.mode === 'levelup') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.sel = (this.sel + this.cards.length - 1) % this.cards.length;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.sel = (this.sel + 1) % this.cards.length;
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
      }
      this.refreshCards();
    } else if (this.mode === 'menu') {
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.sel = (this.sel + this.menuItems.length - 1) % this.menuItems.length;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.sel = (this.sel + 1) % this.menuItems.length;
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
