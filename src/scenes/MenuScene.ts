import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters';
import { LEVELS } from '../config/levels';
import { EL_INFO, GEN_ORDER } from '../config/elements';
import { loadSave } from '../game/save';
import { label, hex } from '../ui/text';
import { wrap } from '../ui/wrap';
import { isTouch } from '../ui/touch';

const PANEL = 0x161220;
const LINE = 0x4a3f5c;

export class MenuScene extends Phaser.Scene {
  private step: 'char' | 'level' = 'char';
  private charSel = 0;
  private levelSel = 0;
  private layer!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('menu');
  }

  create() {
    this.step = 'char';
    this.charSel = 0;
    const save = loadSave();
    this.levelSel = Math.max(0, Math.min(save.unlocked, 2) - 1);
    this.bg = this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0).setAlpha(0.55);
    this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.45).setOrigin(0);

    // 标题：五个元素字环绕
    label(this, 320, 18, '五行师', '#f4eee0', 48).setOrigin(0.5, 0);
    GEN_ORDER.forEach((e, i) => {
      label(this, 320 + (i - 2) * 26, 72, EL_INFO[e].name, hex(EL_INFO[e].color)).setOrigin(0.5, 0);
    });
    label(this, 634, 344, `Demo M1 · 灵石 ${save.lingshi}`, '#6a6474').setOrigin(1, 0);

    // 手机上提供全屏（iPhone Safari 不支持网页全屏，按钮不显示）
    if (isTouch() && this.scale.fullscreen.available) {
      const fs = label(this, 634, 6, '⛶ 全屏', '#b8aec8').setOrigin(1, 0);
      fs.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-10, -6, fs.width + 16, fs.height + 12), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      fs.on('pointerup', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else {
          this.scale.startFullscreen();
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          o.lock?.('landscape').catch(() => {});
        }
      });
    }

    this.layer = this.add.container(0, 0);
    this.render();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(_t: number, dms: number) {
    this.bg.tilePositionX += dms * 0.01;
    this.bg.tilePositionY += dms * 0.005;
  }

  private render() {
    this.layer.removeAll(true);
    if (this.step === 'char') this.renderChars();
    else this.renderLevels();
  }

  private renderChars() {
    const L = this.layer;
    L.add(label(this, 320, 96, '选择角色', '#ffd23f').setOrigin(0.5, 0));
    CHARACTERS.forEach((c, i) => {
      const x = 320 + (i - 1) * 176;
      const on = i === this.charSel;
      const col = EL_INFO[c.el].color;
      const bg = this.add.rectangle(x, 118, 164, 196, PANEL, 0.95).setOrigin(0.5, 0).setStrokeStyle(on ? 2 : 1, on ? 0xffd23f : col, on ? 1 : 0.5);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.charSel = i;
        this.confirm();
      });
      L.add(bg);
      if (c.available) {
        const s = this.add.sprite(x, 158, 'hero_xiao', 0).setScale(2);
        s.play('xiao_s_idle');
        L.add(s);
      } else {
        L.add(this.add.rectangle(x, 140, 40, 40, 0x0e0b14).setOrigin(0.5, 0).setStrokeStyle(1, LINE));
        L.add(label(this, x, 148, '?', '#6a6474', 24).setOrigin(0.5, 0));
      }
      L.add(label(this, x, 196, `${c.title} · ${c.name}`, c.available ? '#f4eee0' : '#8a8494').setOrigin(0.5, 0));
      L.add(label(this, x, 212, `${EL_INFO[c.el].name}亲和`, hex(col)).setOrigin(0.5, 0));
      L.add(label(this, x - 72, 232, wrap(c.bio, 144), '#b8aec8', 12, false).setLineSpacing(3));
      L.add(label(this, x - 72, 264, wrap(c.trait, 144), c.available ? '#d8d0e4' : '#6a6474', 12, false).setLineSpacing(3));
    });
    L.add(label(this, 320, 322, isTouch() ? '点击角色开始' : '← → 选择　Enter 确认', '#8a8494').setOrigin(0.5, 0));
  }

  private renderLevels() {
    const L = this.layer;
    const save = loadSave();
    const c = CHARACTERS[this.charSel];
    L.add(label(this, 320, 96, `选择关卡 · ${c.title} ${c.name}`, '#ffd23f').setOrigin(0.5, 0));
    const back = label(this, 36, 96, '‹ 返回', '#b8aec8');
    back.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-12, -8, back.width + 30, back.height + 14), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    back.on('pointerdown', () => {
      this.step = 'char';
      this.render();
    });
    L.add(back);
    L.add(this.add.rectangle(36, 116, 250, 204, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    LEVELS.forEach((lv, i) => {
      const open = lv.available && lv.id <= save.unlocked;
      const on = i === this.levelSel;
      const y = 122 + i * 19;
      // 整行可点：第一次点选中查看详情，再点一次开始
      const row = this.add.rectangle(38, y - 2, 246, 18, on ? 0x2a2238 : 0x000000, on ? 1 : 0.001).setOrigin(0);
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.levelSel === i) this.confirm();
        else {
          this.levelSel = i;
          this.render();
        }
      });
      L.add(row);
      L.add(label(this, 46, y, `${on ? '▶' : '　'}第${lv.id}关　${lv.name}`, open ? (on ? '#ffd23f' : '#f4eee0') : '#5a5464'));
      L.add(label(this, 276, y, open ? `${lv.duration / 60}分` : lv.available ? '未解锁' : '未开放', open ? '#8a8494' : '#5a5464').setOrigin(1, 0));
    });

    // 详情
    const lv = LEVELS[this.levelSel];
    const x = 302;
    L.add(this.add.rectangle(x, 116, 302, 204, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, x + 12, 126, `第${lv.id}关 · ${lv.name}`, '#f4eee0', 24));
    let tx = x + 12;
    const t0 = label(this, tx, 162, '地气', '#8a8494');
    L.add(t0);
    tx += t0.width + 6;
    for (const el of GEN_ORDER) {
      const v = Math.round(lv.terrain[el] * 100);
      if (!v) continue;
      const t = label(this, tx, 162, `${EL_INFO[el].name}${v}`, hex(EL_INFO[el].color));
      L.add(t);
      tx += t.width + 6;
    }
    const enemyEls = lv.enemies.length
      ? lv.enemies.map((e) => e.id)
      : [];
    L.add(label(this, x + 12, 182, `Boss　${lv.bossName}`, '#ff8a7a'));
    L.add(label(this, x + 12, 202, `时长　${lv.duration / 60} 分钟`, '#b8aec8'));
    L.add(label(this, x + 12, 222, wrap(`要点　${lv.lesson}`, 278), '#d8d0e4', 12, false).setLineSpacing(3));
    if (!lv.available) L.add(label(this, x + 12, 290, '后续阶段开放', '#6a6474'));
    else if (lv.id > save.unlocked) L.add(label(this, x + 12, 290, '通关上一关后解锁', '#6a6474'));
    else if (enemyEls.length) {
      const btn = this.add.rectangle(x + 12, 284, 96, 24, 0x2a2238).setOrigin(0).setStrokeStyle(1, 0xffd23f);
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
      L.add(btn);
      L.add(label(this, x + 60, 290, '开始', '#ffd23f').setOrigin(0.5, 0));
      if (!isTouch()) L.add(label(this, x + 118, 290, '或按 Enter', '#6a6474'));
    }
    L.add(label(this, 320, 330, isTouch() ? '点选关卡查看，再点一次或点“开始”进入' : '↑ ↓ 选择　Enter 开始　Esc 返回', '#8a8494').setOrigin(0.5, 0));
  }

  private confirm() {
    if (this.step === 'char') {
      if (!CHARACTERS[this.charSel].available) {
        this.cameras.main.shake(120, 0.004);
        return;
      }
      this.step = 'level';
      this.render();
      return;
    }
    const lv = LEVELS[this.levelSel];
    if (!lv.available || lv.id > loadSave().unlocked) {
      this.cameras.main.shake(120, 0.004);
      return;
    }
    this.scene.start('game', { level: lv.id, char: CHARACTERS[this.charSel].id });
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') return this.confirm();
    if (this.step === 'char') {
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.charSel = (this.charSel + CHARACTERS.length - 1) % CHARACTERS.length;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.charSel = (this.charSel + 1) % CHARACTERS.length;
      else return;
    } else {
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.levelSel = (this.levelSel + LEVELS.length - 1) % LEVELS.length;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.levelSel = (this.levelSel + 1) % LEVELS.length;
      else if (k === 'Escape') this.step = 'char';
      else return;
    }
    this.render();
  }
}
