import Phaser from 'phaser';
import { UPGRADES, TREES, price, affinity, type UpgradeDef } from '../config/meta';
import { CHARACTERS } from '../config/characters';
import { EL_INFO } from '../config/elements';
import { loadSave, writeSave, type Save } from '../game/save';
import { label, hex } from '../ui/text';
import { wrap } from '../ui/wrap';
import { isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';

const PANEL = 0x161220;
const LINE = 0x4a3f5c;
const COLS = 2;
const CELL_W = 184;
const CELL_H = 30;

interface Tab {
  name: string;
  color: number;
  items: UpgradeDef[];
  el?: (typeof TREES)[number]['el'];
}

/** 洞府：用灵石购买局外成长（修炼 + 五行天赋），可全部退还 */
export class DongfuScene extends Phaser.Scene {
  private save!: Save;
  private tabs: Tab[] = [];
  private tab = 0;
  private sel = 0;
  private refundArmed = false;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('dongfu');
  }

  create() {
    this.save = loadSave();
    this.tabs = [
      { name: '修炼', color: 0xb8aec8, items: UPGRADES },
      ...TREES.map((t) => ({ name: t.name, color: EL_INFO[t.el].color, items: t.nodes, el: t.el })),
    ];
    this.tab = 0;
    this.sel = 0;
    this.refundArmed = false;
    this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0).setAlpha(0.35);
    this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.6).setOrigin(0);
    this.layer = this.add.container(0, 0);
    this.render();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  private get items() {
    return this.tabs[this.tab].items;
  }

  private lv(d: UpgradeDef) {
    return this.save.meta[d.id] ?? 0;
  }

  private render() {
    const L = this.layer;
    L.removeAll(true);
    const save = this.save;

    L.add(label(this, 320, 8, '洞府', '#f4eee0', 24).setOrigin(0.5, 0));
    L.add(label(this, 628, 14, `灵石 ${save.lingshi}`, '#ffd23f').setOrigin(1, 0));
    const back = label(this, 12, 14, '‹ 返回', '#b8aec8');
    back.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-8, -8, back.width + 24, back.height + 16), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    back.on('pointerdown', () => this.leave());
    L.add(back);

    // 页签
    let tx = 16;
    this.tabs.forEach((t, i) => {
      const on = i === this.tab;
      const tl = label(this, tx, 44, t.name, on ? '#ffd23f' : hex(t.color));
      tl.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6, -6, tl.width + 12, tl.height + 12), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      tl.on('pointerdown', () => this.setTab(i));
      L.add(tl);
      if (on) L.add(this.add.rectangle(tx, 59, tl.width, 1, 0xffd23f).setOrigin(0));
      tx += tl.width + 22;
    });

    // 列表
    this.items.forEach((d, i) => {
      const x = 16 + (i % COLS) * CELL_W;
      const y = 70 + Math.floor(i / COLS) * CELL_H;
      const on = i === this.sel;
      const lv = this.lv(d);
      const max = lv >= d.maxLv;
      const col = this.tabs[this.tab].color;
      const bg = this.add.rectangle(x, y, CELL_W - 4, CELL_H - 4, on ? 0x2a2238 : PANEL, 0.95).setOrigin(0).setStrokeStyle(1, on ? 0xffd23f : LINE);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.sel === i) this.buy();
        else this.setSel(i);
      });
      L.add(bg);
      L.add(this.add.rectangle(x + 4, y + 4, 18, 18, 0x0e0b14).setOrigin(0).setStrokeStyle(1, col));
      L.add(label(this, x + 13, y + 7, d.glyph, hex(col), 12, false).setOrigin(0.5, 0));
      L.add(label(this, x + 28, y + 7, d.name, lv ? '#f4eee0' : '#b8aec8'));
      for (let k = 0; k < d.maxLv; k++) {
        L.add(this.add.rectangle(x + 80 + k * 8, y + 10, 6, 6, k < lv ? 0xffd23f : 0x2e2638).setOrigin(0));
      }
      const p = price(d, save.meta);
      L.add(label(this, x + CELL_W - 10, y + 7, max ? 'MAX' : String(p), max ? '#ffd23f' : p <= save.lingshi ? '#d8d0e4' : '#6a6474').setOrigin(1, 0));
    });

    this.renderDetail();

    // 全部退还
    const rb = this.add.rectangle(16, 292, 180, 22, PANEL, 1).setOrigin(0).setStrokeStyle(1, this.refundArmed ? 0xff6a5a : LINE);
    rb.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.refund());
    L.add(rb);
    L.add(label(this, 106, 297, this.refundArmed ? '再按一次确认退还' : `全部退还（${save.spent}）`, this.refundArmed ? '#ff8a7a' : '#b8aec8').setOrigin(0.5, 0));

    const hint = isTouch()
      ? '点选项目查看，再点一次或点“购买”'
      : '方向键选择　Enter 购买　Q / E 切换页签　T 全部退还　Esc 返回';
    L.add(label(this, 320, 334, hint, '#8a8494').setOrigin(0.5, 0));
  }

  private renderDetail() {
    const L = this.layer;
    const d = this.items[this.sel];
    if (!d) return;
    const x = 404;
    const lv = this.lv(d);
    const max = lv >= d.maxLv;
    const p = price(d, this.save.meta);
    L.add(this.add.rectangle(x, 70, 220, 244, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, x + 12, 80, d.name, '#f4eee0', 24));
    L.add(label(this, x + 208, 88, `Lv ${lv} / ${d.maxLv}`, max ? '#ffd23f' : '#b8aec8').setOrigin(1, 0));
    L.add(label(this, x + 12, 116, wrap(`每级：${d.desc}`, 196), '#d8d0e4', 12, false).setLineSpacing(4));

    // 天赋树：列出各角色的亲和系数
    const el = this.tabs[this.tab].el;
    if (el && !d.id.endsWith('.lingen')) {
      L.add(label(this, x + 12, 162, '亲和系数', '#8a8494'));
      CHARACTERS.forEach((c, i) => {
        const k = affinity(c.el, el, 0);
        const txt = k < 1 ? '×0.85 起，Lv15 恢复' : `×${k}`;
        L.add(label(this, x + 12, 180 + i * 16, `${c.title}（${EL_INFO[c.el].name}）${txt}`, c.available ? hex(EL_INFO[c.el].color) : '#6a6474'));
      });
    }

    if (max) {
      L.add(label(this, x + 110, 276, '已满级', '#ffd23f').setOrigin(0.5, 0));
      return;
    }
    const ok = p <= this.save.lingshi;
    const btn = this.add.rectangle(x + 12, 268, 196, 30, ok ? 0x2a2238 : 0x1a1622).setOrigin(0).setStrokeStyle(1, ok ? 0xffd23f : LINE);
    btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.buy());
    L.add(btn);
    L.add(label(this, x + 110, 277, `购买　${p} 灵石`, ok ? '#ffd23f' : '#6a6474').setOrigin(0.5, 0));
  }

  private setSel(i: number) {
    if (i !== this.sel) audio.sfx('tick');
    this.sel = i;
    this.refundArmed = false;
    this.render();
  }

  private setTab(i: number) {
    if (i !== this.tab) audio.sfx('tick');
    this.tab = i;
    this.sel = Math.min(this.sel, this.items.length - 1);
    this.refundArmed = false;
    this.render();
  }

  private buy() {
    const d = this.items[this.sel];
    const s = this.save;
    const p = price(d, s.meta);
    if (this.lv(d) >= d.maxLv || p > s.lingshi) {
      audio.sfx('deny');
      this.cameras.main.shake(100, 0.003);
      return;
    }
    s.lingshi -= p;
    s.spent += p;
    s.meta[d.id] = this.lv(d) + 1;
    writeSave(s);
    audio.sfx('chest');
    this.refundArmed = false;
    this.render();
  }

  /** 按实际花费原数返还，需要连按两次 */
  private refund() {
    const s = this.save;
    if (!s.spent) {
      audio.sfx('deny');
      return;
    }
    if (!this.refundArmed) {
      this.refundArmed = true;
      audio.sfx('tick');
      this.render();
      return;
    }
    s.lingshi += s.spent;
    s.spent = 0;
    s.meta = {};
    writeSave(s);
    audio.sfx('select');
    this.refundArmed = false;
    this.render();
  }

  private leave() {
    audio.sfx('tick');
    this.scene.start('menu');
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    const n = this.items.length;
    if (k === 'Escape') return this.leave();
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') return this.buy();
    if (k === 't' || k === 'T') return this.refund();
    if (k === 'q' || k === 'Q') return this.setTab((this.tab + this.tabs.length - 1) % this.tabs.length);
    if (k === 'e' || k === 'E') return this.setTab((this.tab + 1) % this.tabs.length);
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.setSel((this.sel + n - 1) % n);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.setSel((this.sel + 1) % n);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') this.setSel((this.sel + n - COLS) % n);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.setSel((this.sel + COLS) % n);
  }
}
