import Phaser from 'phaser';
import { UPGRADES, price, wudaoPrice, WUDAO_MAX, type UpgradeDef } from '../config/meta';
import { CHARACTERS, type CharacterDef } from '../config/characters';
import { EL_INFO, GEN_ORDER, type El } from '../config/elements';
import { STAR, CENTER, canLight, canUnlight, describe, hehuaEls, type StarNode } from '../config/startree';
import { LEGACIES, LEGACY_LEVELS, type LegacyNode } from '../config/legacy';
import { loadSave, writeSave, type Save } from '../game/save';
import { daoPoints, legacyPoints, litNodes, treeStart } from '../game/talents';
import { label, hex } from '../ui/text';
import { wrap } from '../ui/wrap';
import { isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';

const PANEL = 0x161220;
const LINE = 0x4a3f5c;
const DIM = 0x3a3346;
const NEUTRAL = 0x9d86d6;
const COLS = 2;
const CELL_W = 184;
const CELL_H = 30;

/** 星图视口 */
const VX = 8;
const VY = 64;
const VW = 408;
const VH = 262;
/** 右侧详情栏 */
const PX = 424;
const PW = 208;

const NODES = Object.values(STAR);
const KIND_NAME: Record<StarNode['kind'], string> = { center: '太极', gate: '本命门', small: '星位', notable: '要穴', keystone: '极境印' };
const KIND_R: Record<StarNode['kind'], number> = { center: 9, gate: 7, small: 4.5, notable: 8, keystone: 11 };
const BEAST: Record<El, string> = { metal: '白虎', wood: '青龙', water: '玄武', fire: '朱雀', earth: '黄龙' };

type TabId = 'xiulian' | 'star' | 'legacy';
const TABS: { id: TabId; name: string }[] = [
  { id: 'xiulian', name: '修炼' },
  { id: 'star', name: '星图' },
  { id: 'legacy', name: '传承' },
];

const elColor = (el: El | null) => (el ? EL_INFO[el].color : NEUTRAL);

/** 洞府：灵石买修炼（全账号），道点点星图、传承点点传承（每个角色各一套） */
export class DongfuScene extends Phaser.Scene {
  private save!: Save;
  private tab: TabId = 'xiulian';
  private chars: CharacterDef[] = [];
  private charIdx = 0;
  private sel = 0;
  private refundArmed = false;
  private resetArmed = false;
  private layer!: Phaser.GameObjects.Container;
  private modal: Phaser.GameObjects.Container | null = null;

  // 星图
  private map: Phaser.GameObjects.Container | null = null;
  private gfx!: Phaser.GameObjects.Graphics;
  private glyphs = new Map<string, Phaser.GameObjects.Text>();
  private elLabels: { el: El; t: Phaser.GameObjects.Text }[] = [];
  private camX = 0;
  private camY = 0;
  private zoom = 0.75;
  private node = '';
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private pinch = 0;

  // 传承
  private lgBranch = 0;
  private lgNode = 0;

  constructor() {
    super('dongfu');
  }

  create() {
    this.save = loadSave();
    this.chars = CHARACTERS.filter((c) => c.available);
    this.charIdx = 0;
    this.tab = 'xiulian';
    this.sel = 0;
    this.refundArmed = false;
    this.resetArmed = false;
    this.map = null;
    this.modal = null;
    this.glyphs.clear();
    this.elLabels = [];
    this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0).setAlpha(0.35);
    this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.6).setOrigin(0);
    this.layer = this.add.container(0, 0).setDepth(2);
    this.input.addPointer(1);
    this.render();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => this.onDown(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.tab === 'star' && this.inView(p.x, p.y)) this.zoomAt(p.x, p.y, dy > 0 ? 0.88 : 1.14);
    });
    if (this.save.notice) this.showNotice(this.save.notice);
  }

  private get char() {
    return this.chars[this.charIdx];
  }

  // ---------- 通用框架 ----------

  private render() {
    const L = this.layer;
    L.removeAll(true);
    const save = this.save;

    L.add(label(this, 320, 8, '洞府', '#f4eee0', 24).setOrigin(0.5, 0));
    L.add(label(this, 628, 14, `灵石 ${save.lingshi}`, '#ffd23f').setOrigin(1, 0));
    L.add(this.textButton(12, 14, '‹ 返回', '#b8aec8', () => this.leave()));

    let tx = 16;
    TABS.forEach((t) => {
      const on = t.id === this.tab;
      const tl = this.textButton(tx, 44, t.name, on ? '#ffd23f' : '#b8aec8', () => this.setTab(t.id));
      L.add(tl);
      if (on) L.add(this.add.rectangle(tx, 59, tl.width, 1, 0xffd23f).setOrigin(0));
      tx += tl.width + 22;
    });

    if (this.tab !== 'xiulian') {
      const c = this.char;
      const multi = this.chars.length > 1;
      const s = `${multi ? '‹ ' : ''}${c.title} · ${c.name}${multi ? ' ›' : ''}`;
      const t = label(this, 628, 44, s, hex(EL_INFO[c.el].color)).setOrigin(1, 0);
      if (multi) {
        t.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => this.setChar(p.x < t.x - t.width / 2 ? -1 : 1));
      }
      L.add(t);
    }

    if (this.tab === 'xiulian') this.renderXiulian();
    else if (this.tab === 'star') this.renderStarPanel();
    else this.renderLegacy();
  }

  private textButton(x: number, y: number, s: string, color: string, fn: () => void) {
    const t = label(this, x, y, s, color);
    t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6, -6, t.width + 12, t.height + 12), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    t.on('pointerdown', fn);
    return t;
  }

  private button(x: number, y: number, w: number, h: number, s: string, ok: boolean, fn: () => void, armed = false) {
    const L = this.layer;
    const b = this.add.rectangle(x, y, w, h, ok ? 0x2a2238 : 0x1a1622).setOrigin(0).setStrokeStyle(1, armed ? 0xff6a5a : ok ? 0xffd23f : LINE);
    b.setInteractive({ useHandCursor: true }).on('pointerdown', fn);
    L.add(b);
    L.add(label(this, x + w / 2, y + (h - 12) / 2 - 1, s, armed ? '#ff8a7a' : ok ? '#ffd23f' : '#6a6474').setOrigin(0.5, 0));
  }

  private hint(s: string) {
    this.layer.add(label(this, 320, 334, s, '#8a8494').setOrigin(0.5, 0));
  }

  private setTab(t: TabId) {
    if (t === this.tab) return;
    audio.sfx('tick');
    this.tab = t;
    this.sel = 0;
    this.refundArmed = false;
    this.resetArmed = false;
    this.lgBranch = 0;
    this.lgNode = 0;
    if (t === 'star') this.openMap();
    else this.closeMap();
    this.render();
  }

  private setChar(d: number) {
    if (this.chars.length < 2) return;
    audio.sfx('tick');
    this.charIdx = (this.charIdx + d + this.chars.length) % this.chars.length;
    this.resetArmed = false;
    this.lgBranch = 0;
    this.lgNode = 0;
    if (this.map) this.focusStart();
    this.render();
  }

  private commit(sfx: 'chest' | 'select') {
    writeSave(this.save);
    audio.sfx(sfx);
    this.refundArmed = false;
    this.resetArmed = false;
    if (this.map) this.drawMap();
    this.render();
  }

  private deny() {
    audio.sfx('deny');
    this.cameras.main.shake(100, 0.003);
  }

  private showNotice(s: string) {
    const m = this.add.container(0, 0).setDepth(10);
    const bg = this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.75).setOrigin(0).setInteractive();
    m.add(bg);
    m.add(this.add.rectangle(160, 120, 320, 120, PANEL, 1).setOrigin(0).setStrokeStyle(1, 0xffd23f));
    m.add(label(this, 176, 134, wrap(s, 288), '#f4eee0', 12, false).setLineSpacing(5));
    m.add(label(this, 320, 218, isTouch() ? '点击继续' : '按任意键继续', '#8a8494').setOrigin(0.5, 0));
    bg.on('pointerdown', () => this.closeNotice());
    this.modal = m;
  }

  private closeNotice() {
    this.modal?.destroy();
    this.modal = null;
    this.save.notice = '';
    writeSave(this.save);
  }

  private leave() {
    audio.sfx('tick');
    this.scene.start('menu');
  }

  // ---------- 修炼 ----------

  private renderXiulian() {
    const L = this.layer;
    const save = this.save;
    UPGRADES.forEach((d, i) => {
      const x = 16 + (i % COLS) * CELL_W;
      const y = 70 + Math.floor(i / COLS) * CELL_H;
      const on = i === this.sel;
      const lv = save.meta[d.id] ?? 0;
      const max = lv >= d.maxLv;
      const bg = this.add.rectangle(x, y, CELL_W - 4, CELL_H - 4, on ? 0x2a2238 : PANEL, 0.95).setOrigin(0).setStrokeStyle(1, on ? 0xffd23f : LINE);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.sel === i) this.buy();
        else this.setSel(i);
      });
      L.add(bg);
      L.add(this.add.rectangle(x + 4, y + 4, 18, 18, 0x0e0b14).setOrigin(0).setStrokeStyle(1, NEUTRAL));
      L.add(label(this, x + 13, y + 7, d.glyph, hex(NEUTRAL), 12, false).setOrigin(0.5, 0));
      L.add(label(this, x + 28, y + 7, d.name, lv ? '#f4eee0' : '#b8aec8'));
      for (let k = 0; k < d.maxLv; k++) {
        L.add(this.add.rectangle(x + 80 + k * 8, y + 10, 6, 6, k < lv ? 0xffd23f : 0x2e2638).setOrigin(0));
      }
      const p = price(d, save.meta);
      L.add(label(this, x + CELL_W - 10, y + 7, max ? 'MAX' : String(p), max ? '#ffd23f' : p <= save.lingshi ? '#d8d0e4' : '#6a6474').setOrigin(1, 0));
    });

    const d = UPGRADES[this.sel];
    const x = 404;
    const lv = save.meta[d.id] ?? 0;
    const max = lv >= d.maxLv;
    const p = price(d, save.meta);
    L.add(this.add.rectangle(x, 70, 220, 244, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, x + 12, 80, d.name, '#f4eee0', 24));
    L.add(label(this, x + 208, 88, `Lv ${lv} / ${d.maxLv}`, max ? '#ffd23f' : '#b8aec8').setOrigin(1, 0));
    L.add(label(this, x + 12, 116, wrap(`每级：${d.desc}`, 196), '#d8d0e4', 12, false).setLineSpacing(4));
    L.add(label(this, x + 12, 162, wrap('修炼全账号通用。伤害、暴击、范围、冷却在星图里点。', 196), '#8a8494', 12, false).setLineSpacing(4));
    if (max) L.add(label(this, x + 110, 276, '已满级', '#ffd23f').setOrigin(0.5, 0));
    else this.button(x + 12, 268, 196, 30, `购买　${p} 灵石`, p <= save.lingshi, () => this.buy());

    this.button(16, 292, 180, 22, this.refundArmed ? '再按一次确认退还' : `全部退还（${save.spent}）`, true, () => this.refund(), this.refundArmed);
    this.hint(isTouch() ? '点选项目查看，再点一次或点“购买”' : '方向键选择　Enter 购买　Q / E 切换页签　T 全部退还　Esc 返回');
  }

  private setSel(i: number) {
    if (i !== this.sel) audio.sfx('tick');
    this.sel = i;
    this.refundArmed = false;
    this.render();
  }

  private buy() {
    const d: UpgradeDef = UPGRADES[this.sel];
    const s = this.save;
    const p = price(d, s.meta);
    const lv = s.meta[d.id] ?? 0;
    if (lv >= d.maxLv || p > s.lingshi) return this.deny();
    s.lingshi -= p;
    s.spent += p;
    s.meta[d.id] = lv + 1;
    this.commit('chest');
  }

  /** 按实际花费原数返还，需要连按两次 */
  private refund() {
    const s = this.save;
    if (!s.spent) return audio.sfx('deny');
    if (!this.refundArmed) {
      this.refundArmed = true;
      audio.sfx('tick');
      return this.render();
    }
    s.lingshi += s.spent;
    s.spent = 0;
    s.meta = {};
    this.commit('select');
  }

  // ---------- 星图 ----------

  private lit() {
    return litNodes(this.save, this.char);
  }

  private pointsLeft() {
    return daoPoints(this.save) - (this.save.tree[this.char.id]?.length ?? 0);
  }

  private openMap() {
    const m = this.add.container(0, 0).setDepth(1);
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff).fillRect(VX, VY, VW, VH);
    m.setMask(shape.createGeometryMask());
    this.gfx = this.add.graphics();
    m.add(this.gfx);
    this.glyphs.clear();
    for (const nd of NODES) {
      if (!nd.glyph) continue;
      const t = label(this, 0, 0, nd.glyph, '#f4eee0', 12, false).setOrigin(0.5, 0.5);
      this.glyphs.set(nd.id, t);
      m.add(t);
    }
    this.elLabels = GEN_ORDER.map((el) => {
      const t = label(this, 0, 0, `${EL_INFO[el].name} · ${BEAST[el]}`, hex(EL_INFO[el].color)).setOrigin(0.5, 0.5);
      m.add(t);
      return { el, t };
    });
    this.map = m;
    this.focusStart();
  }

  private closeMap() {
    this.map?.destroy();
    this.map = null;
    this.glyphs.clear();
    this.elLabels = [];
  }

  /** 镜头对准起点往外一点，选中起点 */
  private focusStart() {
    const start = treeStart(this.char);
    const s2 = STAR[`${this.char.el}.s2`] ?? STAR[start];
    this.camX = s2.x * 0.8;
    this.camY = s2.y * 0.8;
    this.zoom = 0.75;
    this.node = start;
    this.drawMap();
  }

  private toScreen(x: number, y: number): [number, number] {
    return [VX + VW / 2 + (x - this.camX) * this.zoom, VY + VH / 2 + (y - this.camY) * this.zoom];
  }

  private inView(x: number, y: number) {
    return x >= VX && x <= VX + VW && y >= VY && y <= VY + VH;
  }

  private nodeR(nd: StarNode) {
    return KIND_R[nd.kind] * Phaser.Math.Clamp(this.zoom / 0.75, 0.6, 1.4);
  }

  private drawMap() {
    if (!this.map) return;
    const g = this.gfx;
    g.clear();
    const lit = this.lit();
    const start = treeStart(this.char);
    const left = this.pointsLeft();

    // 底纹：外圈五边形和五角星
    const R = 352;
    const vs = GEN_ORDER.map((_, i) => {
      const a = ((-90 + 72 * i) * Math.PI) / 180;
      return this.toScreen(R * Math.cos(a), R * Math.sin(a));
    });
    g.lineStyle(1, 0x2a2338, 0.45);
    for (let i = 0; i < 5; i++) {
      const [ax, ay] = vs[i];
      const [bx, by] = vs[(i + 1) % 5];
      const [cx, cy] = vs[(i + 2) % 5];
      g.lineBetween(ax, ay, bx, by);
      g.lineBetween(ax, ay, cx, cy);
    }

    // 连线
    for (const a of NODES) {
      const [ax, ay] = this.toScreen(a.x, a.y);
      for (const id of a.links) {
        if (id < a.id) continue;
        const b = STAR[id];
        const [bx, by] = this.toScreen(b.x, b.y);
        const la = lit.has(a.id);
        const lb = lit.has(b.id);
        const col = elColor(a.el ?? b.el);
        if (la && lb) g.lineStyle(2.5, col, 1);
        else if (la || lb) g.lineStyle(1.5, col, 0.5);
        else g.lineStyle(1, DIM, 1);
        g.lineBetween(ax, ay, bx, by);
      }
    }

    // 节点
    const showGlyph = this.zoom >= 0.55;
    for (const nd of NODES) {
      const [x, y] = this.toScreen(nd.x, nd.y);
      const r = this.nodeR(nd);
      const isLit = lit.has(nd.id);
      const can = canLight(nd.id, start, lit);
      const he = hehuaEls(nd.id);
      const col = he ? EL_INFO[he[0]].color : elColor(nd.el);
      const ring = he ? EL_INFO[he[1]].color : col;
      if (isLit) {
        g.fillStyle(col, 1).fillCircle(x, y, r);
        g.lineStyle(1.5, ring, 1).strokeCircle(x, y, r);
      } else {
        g.fillStyle(0x0e0b14, 1).fillCircle(x, y, r);
        const dark = nd.el ? EL_INFO[nd.el].dark : 0x5a5266;
        if (can) g.lineStyle(1.5, ring, left > 0 ? 1 : 0.5);
        else g.lineStyle(1, he ? EL_INFO[he[1]].dark : dark, 0.8);
        g.strokeCircle(x, y, r);
      }
      if (nd.id === start) g.lineStyle(1, 0xf4eee0, 0.9).strokeCircle(x, y, r + 3);
      if (nd.id === this.node) g.lineStyle(1.5, 0xffd23f, 1).strokeCircle(x, y, r + (nd.id === start ? 6 : 3.5));

      const t = this.glyphs.get(nd.id);
      if (t) {
        t.setPosition(Math.round(x), Math.round(y)).setVisible(showGlyph);
        t.setColor(isLit ? '#120c18' : can ? '#f4eee0' : '#6a6474');
      }
    }

    for (const { el, t } of this.elLabels) {
      const k = STAR[`${el}.k`];
      const [x, y] = this.toScreen(k.x * 1.13, k.y * 1.13);
      t.setPosition(Math.round(x), Math.round(y));
    }
  }

  private renderStarPanel() {
    const L = this.layer;
    const save = this.save;
    const total = daoPoints(save);
    const left = this.pointsLeft();
    L.add(this.add.rectangle(VX, VY, VW, VH).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(this.add.rectangle(PX, VY, PW, VH, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, PX + 10, VY + 8, `道点　${left} / ${total}`, left > 0 ? '#ffd23f' : '#b8aec8'));
    L.add(label(this, PX + PW - 10, VY + 8, '首通每关 +3', '#6a6474').setOrigin(1, 0));

    // 视口内的缩放按钮
    const zb = (x: number, s: string, fn: () => void) => {
      const b = this.add.rectangle(x, VY + VH - 26, 20, 20, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE);
      b.setInteractive({ useHandCursor: true }).on('pointerdown', fn);
      L.add(b);
      L.add(label(this, x + 10, VY + VH - 23, s, '#d8d0e4').setOrigin(0.5, 0));
    };
    const cx = VX + VW / 2;
    const cy = VY + VH / 2;
    zb(VX + VW - 74, '−', () => this.zoomAt(cx, cy, 0.8));
    zb(VX + VW - 50, '+', () => this.zoomAt(cx, cy, 1.25));
    zb(VX + VW - 26, '◎', () => {
      audio.sfx('tick');
      this.focusStart();
      this.render();
    });

    const nd = STAR[this.node];
    if (nd) this.renderNodeDetail(nd, left);

    // 悟道、重置
    const w = save.wudao;
    const by = VY + VH - 30;
    if (w < WUDAO_MAX) {
      const p = wudaoPrice(w);
      this.button(PX + 8, by, 116, 22, `悟道 +1　${p}`, p <= save.lingshi, () => this.wudao());
    } else {
      L.add(label(this, PX + 66, by + 4, '悟道已满', '#6a6474').setOrigin(0.5, 0));
    }
    this.button(PX + 130, by, 70, 22, this.resetArmed ? '确认？' : '重置', (save.tree[this.char.id]?.length ?? 0) > 0, () => this.resetTree(), this.resetArmed);

    this.hint(isTouch() ? '拖动平移，双指缩放；点星位查看，再点一次点亮' : '方向键选星位　Enter 点亮　X 撤回　拖动 / 滚轮　R 重置　Q / E 页签');
  }

  private renderNodeDetail(nd: StarNode, left: number) {
    const L = this.layer;
    const lit = this.lit();
    const start = treeStart(this.char);
    const he = hehuaEls(nd.id);
    const col = he ? EL_INFO[he[0]].color : elColor(nd.el);
    const x = PX + 10;
    const big = nd.name.length <= 7;
    L.add(label(this, x, VY + 30, nd.name, '#f4eee0', big ? 24 : 12));
    const tag = `${KIND_NAME[nd.kind]}${nd.el && nd.kind !== 'gate' ? ` · ${EL_INFO[nd.el].name}` : ''}${he ? ` · ${EL_INFO[he[0]].name}生${EL_INFO[he[1]].name}` : ''}`;
    L.add(label(this, x, VY + (big ? 60 : 48), tag, hex(col)));
    const lines = [...(nd.note ? [nd.note] : []), ...describe(nd.mods)];
    L.add(label(this, x, VY + 80, wrap(lines.join('\n'), PW - 20), '#d8d0e4', 12, false).setLineSpacing(4));

    const ay = VY + 194;
    const isLit = lit.has(nd.id);
    if (nd.id === start) {
      L.add(label(this, PX + PW / 2, ay + 6, '起点（免费）', '#b8aec8').setOrigin(0.5, 0));
    } else if (isLit) {
      const ok = canUnlight(nd.id, start, lit);
      if (ok) this.button(x, ay, PW - 20, 26, '撤回　返还 1 道点', true, () => this.unlight());
      else L.add(label(this, PX + PW / 2, ay + 6, '已点亮（外侧还连着星位）', '#8a8494').setOrigin(0.5, 0));
    } else if (nd.id === CENTER && start !== CENTER) {
      L.add(label(this, PX + PW / 2, ay + 6, '五行散人专属', '#6a6474').setOrigin(0.5, 0));
    } else if (!canLight(nd.id, start, lit)) {
      L.add(label(this, PX + PW / 2, ay + 6, '先点亮相邻的星位', '#6a6474').setOrigin(0.5, 0));
    } else {
      this.button(x, ay, PW - 20, 26, left > 0 ? '点亮　1 道点' : '道点不足', left > 0, () => this.light());
    }
  }

  private selectNode(id: string) {
    if (id !== this.node) audio.sfx('tick');
    this.node = id;
    this.resetArmed = false;
    this.drawMap();
    this.render();
  }

  private light() {
    const lit = this.lit();
    const c = this.char;
    if (!canLight(this.node, treeStart(c), lit) || this.pointsLeft() <= 0) return this.deny();
    (this.save.tree[c.id] ??= []).push(this.node);
    this.commit('chest');
  }

  private unlight() {
    const lit = this.lit();
    const c = this.char;
    if (!canUnlight(this.node, treeStart(c), lit)) return this.deny();
    this.save.tree[c.id] = (this.save.tree[c.id] ?? []).filter((id) => id !== this.node);
    this.commit('select');
  }

  private resetTree() {
    const c = this.char;
    if (!(this.save.tree[c.id]?.length)) return this.deny();
    if (!this.resetArmed) {
      this.resetArmed = true;
      audio.sfx('tick');
      return this.render();
    }
    this.save.tree[c.id] = [];
    this.commit('select');
  }

  private wudao() {
    const s = this.save;
    const p = wudaoPrice(s.wudao);
    if (s.wudao >= WUDAO_MAX || p > s.lingshi) return this.deny();
    s.lingshi -= p;
    s.wudao++;
    this.commit('chest');
  }

  private zoomAt(sx: number, sy: number, k: number) {
    const z = Phaser.Math.Clamp(this.zoom * k, 0.35, 1.5);
    // 保持 (sx, sy) 下的星图坐标不动
    const mx = this.camX + (sx - VX - VW / 2) / this.zoom;
    const my = this.camY + (sy - VY - VH / 2) / this.zoom;
    this.zoom = z;
    this.camX = mx - (sx - VX - VW / 2) / z;
    this.camY = my - (sy - VY - VH / 2) / z;
    this.clampCam();
    this.drawMap();
  }

  private clampCam() {
    this.camX = Phaser.Math.Clamp(this.camX, -380, 380);
    this.camY = Phaser.Math.Clamp(this.camY, -380, 380);
  }

  private hitNode(sx: number, sy: number) {
    let best = '';
    let bd = Infinity;
    for (const nd of NODES) {
      const [x, y] = this.toScreen(nd.x, nd.y);
      const d = Math.hypot(x - sx, y - sy);
      if (d <= this.nodeR(nd) + 6 && d < bd) {
        bd = d;
        best = nd.id;
      }
    }
    return best;
  }

  private onDown(p: Phaser.Input.Pointer, over: unknown[]) {
    if (this.modal || this.tab !== 'star' || over.length || !this.inView(p.x, p.y)) return;
    this.drag = { x: p.x, y: p.y, moved: false };
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (!this.map) return;
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (p1.isDown && p2.isDown) {
      const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      if (this.pinch > 0) this.zoomAt((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, d / this.pinch);
      this.pinch = d;
      if (this.drag) this.drag.moved = true;
      return;
    }
    this.pinch = 0;
    const dr = this.drag;
    if (!dr || !p.isDown) return;
    const dx = p.x - dr.x;
    const dy = p.y - dr.y;
    if (!dr.moved && Math.hypot(dx, dy) < 5) return;
    dr.moved = true;
    this.camX -= dx / this.zoom;
    this.camY -= dy / this.zoom;
    dr.x = p.x;
    dr.y = p.y;
    this.clampCam();
    this.drawMap();
  }

  private onUp(p: Phaser.Input.Pointer) {
    const dr = this.drag;
    this.drag = null;
    this.pinch = 0;
    if (!dr || dr.moved || !this.map) return;
    const id = this.hitNode(p.x, p.y);
    if (!id) return;
    if (id === this.node && !this.lit().has(id)) this.light();
    else this.selectNode(id);
  }

  /** 键盘：往按键方向找最近的星位 */
  private stepNode(dx: number, dy: number) {
    const cur = STAR[this.node];
    let best = '';
    let bs = Infinity;
    for (const nd of NODES) {
      if (nd.id === cur.id) continue;
      const vx = nd.x - cur.x;
      const vy = nd.y - cur.y;
      const d = Math.hypot(vx, vy);
      const cos = (vx * dx + vy * dy) / d;
      if (cos < 0.5) continue;
      const s = d * (1 + 2 * (1 - cos));
      if (s < bs) {
        bs = s;
        best = nd.id;
      }
    }
    if (!best) return;
    const nd = STAR[best];
    const [sx, sy] = this.toScreen(nd.x, nd.y);
    if (sx < VX + 30 || sx > VX + VW - 30 || sy < VY + 30 || sy > VY + VH - 30) {
      this.camX = nd.x;
      this.camY = nd.y;
    }
    this.selectNode(best);
  }

  // ---------- 传承 ----------

  private renderLegacy() {
    const L = this.layer;
    const c = this.char;
    const branches = LEGACIES[c.id];
    const total = legacyPoints(this.save);
    const learned = this.save.legacy[c.id] ?? [];
    const left = total - learned.length;

    L.add(this.add.rectangle(PX, VY, PW, VH, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, PX + 10, VY + 8, `传承点　${left} / ${total}`, left > 0 ? '#ffd23f' : '#b8aec8'));
    L.add(label(this, PX + 10, VY + 26, `首通第 ${LEGACY_LEVELS.join('、')} 关各 +1`, '#6a6474'));
    this.hint(isTouch() ? '点节点查看，再点一次领悟' : '方向键选择　Enter 领悟　X 撤回　Q / E 页签　Esc 返回');

    if (!branches) {
      L.add(label(this, VX + VW / 2, VY + 110, `${c.title}的传承尚未开放`, '#6a6474').setOrigin(0.5, 0));
      return;
    }
    const col = EL_INFO[c.el].color;
    branches.forEach((b, bi) => {
      const x = VX + 8 + bi * 204;
      L.add(label(this, x, VY + 4, b.name, '#ffd23f', 24));
      L.add(label(this, x, VY + 34, wrap(b.desc, 188), '#8a8494', 12, false));
      b.nodes.forEach((nd, ni) => {
        const y = VY + 62 + ni * 64;
        const on = bi === this.lgBranch && ni === this.lgNode;
        const has = learned.includes(nd.id);
        const can = !has && (ni === 0 || learned.includes(b.nodes[ni - 1].id));
        if (ni > 0) L.add(this.add.rectangle(x + 20, y - 18, 2, 18, has ? col : DIM).setOrigin(0.5, 0));
        const bg = this.add.rectangle(x, y, 188, 46, on ? 0x2a2238 : PANEL, 0.95).setOrigin(0).setStrokeStyle(1, on ? 0xffd23f : has ? col : LINE);
        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          if (on && can) this.learn();
          else this.selectLegacy(bi, ni);
        });
        L.add(bg);
        L.add(this.add.circle(x + 20, y + 23, 12, has ? col : 0x0e0b14).setStrokeStyle(1.5, can || has ? col : EL_INFO[c.el].dark));
        L.add(label(this, x + 20, y + 23, nd.glyph, has ? '#120c18' : can ? '#f4eee0' : '#6a6474', 12, false).setOrigin(0.5, 0.5));
        L.add(label(this, x + 40, y + 8, nd.name, has ? '#f4eee0' : '#b8aec8'));
        L.add(label(this, x + 40, y + 26, has ? '已领悟' : can ? '可领悟' : '需先领悟上一层', has ? hex(col) : '#6a6474'));
      });
    });

    const b = branches[this.lgBranch];
    const nd = b.nodes[this.lgNode];
    this.renderLegacyDetail(nd, b.nodes, learned, left);
  }

  private renderLegacyDetail(nd: LegacyNode, chain: LegacyNode[], learned: string[], left: number) {
    const L = this.layer;
    const x = PX + 10;
    L.add(label(this, x, VY + 50, nd.name, '#f4eee0', 24));
    const lines = nd.note ? [nd.note] : describe(nd.mods);
    L.add(label(this, x, VY + 84, wrap(lines.join('\n'), PW - 20), '#d8d0e4', 12, false).setLineSpacing(4));
    const i = chain.indexOf(nd);
    const has = learned.includes(nd.id);
    const ay = VY + 194;
    if (has) {
      const last = !chain.slice(i + 1).some((n) => learned.includes(n.id));
      if (last) this.button(x, ay, PW - 20, 26, '撤回　返还 1 传承点', true, () => this.unlearn());
      else L.add(label(this, PX + PW / 2, ay + 6, '已领悟（先撤回下一层）', '#8a8494').setOrigin(0.5, 0));
    } else if (i > 0 && !learned.includes(chain[i - 1].id)) {
      L.add(label(this, PX + PW / 2, ay + 6, '需先领悟上一层', '#6a6474').setOrigin(0.5, 0));
    } else {
      this.button(x, ay, PW - 20, 26, left > 0 ? '领悟　1 传承点' : '传承点不足', left > 0, () => this.learn());
    }
  }

  private selectLegacy(b: number, n: number) {
    if (b !== this.lgBranch || n !== this.lgNode) audio.sfx('tick');
    this.lgBranch = b;
    this.lgNode = n;
    this.render();
  }

  private learn() {
    const c = this.char;
    const chain = LEGACIES[c.id]?.[this.lgBranch]?.nodes;
    if (!chain) return;
    const learned = this.save.legacy[c.id] ?? [];
    const nd = chain[this.lgNode];
    const ok = !learned.includes(nd.id) && (this.lgNode === 0 || learned.includes(chain[this.lgNode - 1].id)) && learned.length < legacyPoints(this.save);
    if (!ok) return this.deny();
    this.save.legacy[c.id] = [...learned, nd.id];
    this.commit('chest');
  }

  private unlearn() {
    const c = this.char;
    const chain = LEGACIES[c.id]?.[this.lgBranch]?.nodes;
    if (!chain) return;
    const learned = this.save.legacy[c.id] ?? [];
    const nd = chain[this.lgNode];
    if (!learned.includes(nd.id) || chain.slice(this.lgNode + 1).some((n) => learned.includes(n.id))) return this.deny();
    this.save.legacy[c.id] = learned.filter((id) => id !== nd.id);
    this.commit('select');
  }

  // ---------- 键盘 ----------

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.modal) return this.closeNotice();
    if (k === 'Escape') return this.leave();
    const ti = TABS.findIndex((t) => t.id === this.tab);
    if (k === 'q' || k === 'Q') return this.setTab(TABS[(ti + TABS.length - 1) % TABS.length].id);
    if (k === 'e' || k === 'E') return this.setTab(TABS[(ti + 1) % TABS.length].id);
    if (k === '[') return this.setChar(-1);
    if (k === ']') return this.setChar(1);
    const ok = k === 'Enter' || k === ' ' || k === 'z' || k === 'Z';
    const undo = k === 'x' || k === 'X' || k === 'Backspace';
    const dir: [number, number] | null =
      k === 'ArrowLeft' || k === 'a' || k === 'A' ? [-1, 0]
        : k === 'ArrowRight' || k === 'd' || k === 'D' ? [1, 0]
          : k === 'ArrowUp' || k === 'w' || k === 'W' ? [0, -1]
            : k === 'ArrowDown' || k === 's' || k === 'S' ? [0, 1]
              : null;

    if (this.tab === 'xiulian') {
      const n = UPGRADES.length;
      if (ok) return this.buy();
      if (k === 't' || k === 'T') return this.refund();
      if (!dir) return;
      const step = dir[0] ? dir[0] : dir[1] * COLS;
      this.setSel((this.sel + step + n) % n);
    } else if (this.tab === 'star') {
      if (ok) return this.light();
      if (undo) return this.unlight();
      if (k === 'r' || k === 'R') return this.resetTree();
      if (k === '=' || k === '+') return this.zoomAt(VX + VW / 2, VY + VH / 2, 1.25);
      if (k === '-' || k === '_') return this.zoomAt(VX + VW / 2, VY + VH / 2, 0.8);
      if (dir) this.stepNode(dir[0], dir[1]);
    } else {
      const branches = LEGACIES[this.char.id];
      if (!branches) return;
      if (ok) return this.learn();
      if (undo) return this.unlearn();
      if (!dir) return;
      if (dir[0]) this.selectLegacy((this.lgBranch + dir[0] + branches.length) % branches.length, this.lgNode);
      else this.selectLegacy(this.lgBranch, Phaser.Math.Clamp(this.lgNode + dir[1], 0, branches[this.lgBranch].nodes.length - 1));
    }
  }
}
