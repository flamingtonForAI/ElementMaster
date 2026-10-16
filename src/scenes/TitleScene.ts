import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters';
import { EL_INFO, SAY_ORDER } from '../config/elements';
import { SLOTS, activeSlot, deleteSlot, exportSlot, importSlot, listSlots, newSlot, useSlot, type Save } from '../game/save';
import { label, hex } from '../ui/text';
import { isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';
import { canFullscreen, isFullscreen, isIOS, isStandalone, toggleFullscreen, IOS_TIP } from '../ui/fullscreen';
import { wrap } from '../ui/wrap';
import { TOD_LIST, getTod, getTodPreset, getVistaCloudKey, getVistaFgKey, getVistaTextureKey, isVistaPainted, setTod, type TodId } from '../art/vistaArt';

const PANEL = 0x161220;
const LINE = 0x4a3f5c;
const GOLD = '#ffd23f';
const MUTED = '#b8aec8';
const DIMTXT = '#5a5464';

type View = 'main' | 'slots' | 'settings';
type MainId = 'continue' | 'new' | 'slots' | 'settings';
type Armed = '' | 'overwrite' | 'delete';

const pad2 = (n: number) => String(n).padStart(2, '0');
const when = (t: number) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const duration = (sec: number) => {
  const m = Math.floor(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}小时${m % 60}分` : `${m}分`;
};
const farthest = (s: Save) => Math.max(0, ...Object.values(s.clears).flat());

/** 首页背景按清晨→白天→傍晚→夜里循环：每个时辰停 HOLD 毫秒，再用 FADE 毫秒淡入下一个 */
const HOLD = 14000;
const FADE = 4000;

/** 一个时辰的远景三层 */
interface Vista {
  bg: Phaser.GameObjects.TileSprite;
  clouds: Phaser.GameObjects.TileSprite;
  fg: Phaser.GameObjects.TileSprite;
}

/** 首页：继续游戏、新游戏、存档（五个槽位）、设置 */
export class TitleScene extends Phaser.Scene {
  private view: View = 'main';
  private sel = 0;
  private slotSel = 0;
  private armed: Armed = '';
  /** 从“新游戏”进来且槽位已满：提示选一个覆盖 */
  private full = false;
  private slots: (Save | null)[] = [];
  private layer!: Phaser.GameObjects.Container;
  /** cur 是当前时辰，under 在下面垫着下一个时辰 */
  private cur!: Vista;
  private under!: Vista;
  private veil!: Phaser.GameObjects.Rectangle;
  private nextTodAt = 0;
  private toast: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('title');
  }

  create() {
    this.view = 'main';
    this.armed = '';
    this.full = false;
    this.slots = listSlots();
    this.slotSel = activeSlot() - 1;
    this.sel = 0;
    this.under = this.vista(getTod(), 0);
    this.cur = this.vista(getTod(), 1);
    this.veil = this.add.rectangle(0, 0, 640, 360, 0x07050b, getTodPreset().veilAlpha).setOrigin(0).setDepth(2);
    this.nextTodAt = this.time.now + HOLD;
    this.layer = this.add.container(0, 0).setDepth(3);
    audio.music('menu');
    this.render();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(t: number, dms: number) {
    // 远景云层极慢速横移，前景松竹随风微摆
    for (const v of [this.cur, this.under]) {
      v.clouds.tilePositionX += dms * 0.004;
      v.fg.x = Math.round(Math.sin(t * 0.0012) * 1.5);
    }
    if (t >= this.nextTodAt) {
      this.nextTodAt = t + HOLD + FADE;
      this.advanceTod();
    }
  }

  private vista(id: TodId, depth: number): Vista {
    const v = {
      bg: this.add.tileSprite(0, 0, 640, 360, getVistaTextureKey(id)).setOrigin(0),
      clouds: this.add.tileSprite(0, 0, 640, 360, getVistaCloudKey(id)).setOrigin(0),
      fg: this.add.tileSprite(0, 0, 640, 360, getVistaFgKey(id)).setOrigin(0),
    };
    this.setVista(v, id, 1);
    for (const o of [v.bg, v.clouds, v.fg]) o.setDepth(depth);
    return v;
  }

  /** 换贴图并按整体透明度 a 设三层的透明度；生图远景自带云和前景，不叠程序画的 */
  private setVista(v: Vista, id: TodId, a: number) {
    const painted = isVistaPainted(id);
    v.bg.setTexture(getVistaTextureKey(id)).setAlpha(a);
    v.clouds.setTexture(getVistaCloudKey(id)).setAlpha(0.32 * a).setVisible(!painted);
    v.fg.setTexture(getVistaFgKey(id)).setAlpha(0.75 * a).setVisible(!painted);
  }

  /** 下一个时辰垫到下面，上面的淡出后两层对调；记下当前时辰，菜单和洞府沿用 */
  private advanceTod() {
    const i = TOD_LIST.findIndex((t) => t.id === getTod());
    const next = TOD_LIST[(i + 1) % TOD_LIST.length].id;
    const front = this.cur;
    const back = this.under;
    this.setVista(back, next, 1);
    const k = { a: 1 };
    this.tweens.add({
      targets: k,
      a: 0,
      duration: FADE,
      ease: 'Sine.inOut',
      onUpdate: () => {
        front.bg.setAlpha(k.a);
        front.clouds.setAlpha(0.32 * k.a);
        front.fg.setAlpha(0.75 * k.a);
      },
      onComplete: () => {
        for (const o of [front.bg, front.clouds, front.fg]) o.setDepth(0);
        for (const o of [back.bg, back.clouds, back.fg]) o.setDepth(1);
        this.cur = back;
        this.under = front;
      },
    });
    this.tweens.add({ targets: this.veil, fillAlpha: getTodPreset(next).veilAlpha, duration: FADE, ease: 'Sine.inOut' });
    setTod(next);
  }

  private current() {
    return this.slots[activeSlot() - 1];
  }

  private mainItems(): { id: MainId; name: string }[] {
    const items: { id: MainId; name: string }[] = [];
    if (this.current()) items.push({ id: 'continue', name: '继续游戏' });
    items.push({ id: 'new', name: '新游戏' }, { id: 'slots', name: '存档' }, { id: 'settings', name: '设置' });
    return items;
  }

  private render() {
    this.layer.removeAll(true);
    if (this.view === 'main') this.renderMain();
    else if (this.view === 'slots') this.renderSlots();
    else this.renderSettings();
  }

  private hit(t: Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle, fn: () => void, padX = 8, padY = 6) {
    if (t instanceof Phaser.GameObjects.Text) {
      t.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-padX, -padY, t.width + padX * 2, t.height + padY * 2), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    } else t.setInteractive({ useHandCursor: true });
    t.on('pointerdown', fn);
    return t;
  }

  /** primary 用金色描边；次要操作用中性色，确认态变红 */
  private button(x: number, y: number, w: number, s: string, primary: boolean, fn: () => void, danger = false) {
    const L = this.layer;
    const b = this.add.rectangle(x, y, w, 22, primary ? 0x2a2238 : PANEL).setOrigin(0).setStrokeStyle(1, danger ? 0xff6a5a : primary ? 0xffd23f : LINE);
    L.add(this.hit(b, fn));
    L.add(label(this, x + w / 2, y + 4, s, danger ? '#ff8a7a' : primary ? GOLD : '#d8d0e4').setOrigin(0.5, 0));
  }

  private back(fn: () => void) {
    this.layer.add(this.hit(label(this, 48, 24, '‹ 返回', MUTED), fn));
  }

  private hint(s: string) {
    this.layer.add(label(this, 48, 334, s, '#8a8494'));
  }

  // ---------- 主菜单 ----------

  private renderMain() {
    const L = this.layer;
    L.add(label(this, 48, 52, '五行师', '#f4eee0', 48));
    SAY_ORDER.forEach((e, i) => L.add(label(this, 50 + i * 26, 106, EL_INFO[e].name, hex(EL_INFO[e].color))));

    const items = this.mainItems();
    this.sel = Math.min(this.sel, items.length - 1);
    items.forEach((it, i) => {
      const y = 158 + i * 34;
      const on = i === this.sel;
      if (on) L.add(this.add.rectangle(40, y + 4, 3, 16, 0xffd23f).setOrigin(0));
      const t = label(this, 50, y, it.name, on ? GOLD : '#e8e0f0', 24);
      L.add(this.hit(t, () => {
        this.sel = i;
        this.pick();
      }));
    });

    this.renderCard(this.current(), activeSlot(), 340, 158);

    // 手机上提供全屏；iPhone 网页不支持，点了显示“添加到主屏幕”的说明
    if (isTouch() && !isStandalone() && (canFullscreen() || isIOS())) {
      L.add(this.hit(label(this, 634, 6, '⛶ 全屏', MUTED).setOrigin(1, 0), () => (canFullscreen() ? toggleFullscreen() : this.showTip(IOS_TIP))));
    }
    L.add(label(this, 634, 344, 'Demo M1', '#6a6474').setOrigin(1, 0));
    if (!isTouch()) this.hint('↑ ↓ 选择　Enter 确认');
  }

  /** 存档卡片：最近用的角色 + 进度摘要 */
  private renderCard(s: Save | null, n: number, x: number, y: number) {
    const L = this.layer;
    const W = 260;
    const H = 134;
    L.add(this.add.rectangle(x, y, W, H, PANEL, 0.92).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, x + 12, y + 10, `存档 ${n}`, GOLD));
    if (!s) {
      L.add(label(this, x + 12, y + 40, '空', DIMTXT, 24));
      L.add(label(this, x + 12, y + 76, '选“新游戏”开始修行', '#8a8494'));
      return;
    }
    L.add(label(this, x + W - 12, y + 10, when(s.updatedAt), '#6a6474').setOrigin(1, 0));
    const c = CHARACTERS.find((o) => o.id === s.lastChar && o.available);
    const tx = c ? x + 88 : x + 12;
    if (c) {
      const sp = this.add.sprite(x + 44, y + 72, `hero_${c.id}`, 0).setScale(2);
      sp.play(`${c.id}_s_idle`);
      L.add(sp);
      L.add(label(this, x + 44, y + 108, c.name, hex(c.balanced ? 0xd8d0e4 : EL_INFO[c.el].color)).setOrigin(0.5, 0));
    }
    const far = farthest(s);
    const lines: [string, string][] = [
      ['灵石', String(s.lingshi)],
      ['进度', far ? `最远通关第 ${far} 关` : '尚未通关'],
      ['局数', String(s.runs)],
      ['时长', duration(s.playTime)],
    ];
    lines.forEach(([k, v], i) => {
      L.add(label(this, tx, y + 36 + i * 22, k, '#6a6474'));
      L.add(label(this, tx + 36, y + 36 + i * 22, v, k === '灵石' ? GOLD : '#d8d0e4'));
    });
  }

  private pick() {
    const it = this.mainItems()[this.sel];
    if (!it) return;
    audio.sfx('select');
    if (it.id === 'continue') return this.scene.start('menu');
    if (it.id === 'new') {
      const empty = this.slots.findIndex((s) => !s);
      if (empty >= 0) {
        newSlot(empty + 1);
        return this.scene.start('menu');
      }
      this.full = true;
      this.openSlots();
      return;
    }
    if (it.id === 'slots') {
      this.full = false;
      return this.openSlots();
    }
    this.view = 'settings';
    this.sel = 0;
    this.render();
  }

  // ---------- 存档 ----------

  private openSlots() {
    this.view = 'slots';
    this.armed = '';
    this.slots = listSlots();
    this.slotSel = this.full ? 0 : activeSlot() - 1;
    this.render();
  }

  private toMain() {
    audio.sfx('tick');
    this.view = 'main';
    this.armed = '';
    this.slots = listSlots();
    this.sel = 0;
    this.render();
  }

  private renderSlots() {
    const L = this.layer;
    this.back(() => this.toMain());
    L.add(label(this, 48, 44, '存档', '#f4eee0', 24));
    if (this.full) L.add(label(this, 104, 54, '五个槽位都满了，选一个覆盖', '#ff8a7a'));
    const cur = activeSlot() - 1;
    this.slots.forEach((s, i) => {
      const y = 80 + i * 46;
      const on = i === this.slotSel;
      const row = this.add.rectangle(48, y, 260, 40, on ? 0x2a2238 : PANEL, 0.92).setOrigin(0).setStrokeStyle(1, on ? 0xffd23f : LINE);
      L.add(this.hit(row, () => this.selectSlot(i)));
      L.add(label(this, 58, y + 6, `存档 ${i + 1}`, on ? GOLD : '#f4eee0'));
      if (i === cur && s) L.add(label(this, 112, y + 6, '当前', '#8a8494'));
      if (s) {
        const far = farthest(s);
        L.add(label(this, 58, y + 22, `灵石 ${s.lingshi}　${far ? `第 ${far} 关` : '未通关'}　${duration(s.playTime)}`, '#8a8494'));
        L.add(label(this, 298, y + 6, when(s.updatedAt), '#6a6474').setOrigin(1, 0));
      } else {
        L.add(label(this, 58, y + 22, '空', DIMTXT));
      }
    });

    const n = this.slotSel + 1;
    const s = this.slots[this.slotSel];
    const x = 330;
    this.renderCard(s, n, x, 80);
    const bx = x;
    const by = 226;
    const w = 260;
    if (s) {
      this.button(bx, by, w, this.full ? '覆盖为新存档' : '读取', true, () => (this.full ? this.overwrite() : this.loadSlot()), this.full && this.armed === 'overwrite');
      if (!this.full) this.button(bx, by + 28, 126, this.armed === 'overwrite' ? '再按一次确认' : '覆盖为新存档', false, () => this.overwrite(), this.armed === 'overwrite');
      this.button(bx + 134, by + 28, 126, this.armed === 'delete' ? '再按一次确认' : '删除', false, () => this.remove(), this.armed === 'delete');
      this.button(bx, by + 56, 126, '导出存档码', false, () => this.exportCode());
      this.button(bx + 134, by + 56, 126, '导入存档码', false, () => this.importCode());
    } else {
      this.button(bx, by, w, '在这里新建', true, () => this.createSlot());
      this.button(bx, by + 28, w, '导入存档码', false, () => this.importCode());
    }
    if (this.full && s && this.armed === 'overwrite') L.add(label(this, bx, by - 14, '原有进度会清空，再按一次确认', '#ff8a7a'));
    if (!isTouch()) this.hint('↑ ↓ 选择　Enter 读取 / 新建　N 覆盖　X 删除　C 导出　V 导入　Esc 返回');
  }

  private selectSlot(i: number) {
    if (i === this.slotSel) {
      // 再点一次直接读取或新建
      if (!this.full) return this.slots[i] ? this.loadSlot() : this.createSlot();
      return this.slots[i] ? this.overwrite() : this.createSlot();
    }
    audio.sfx('tick');
    this.slotSel = i;
    this.armed = '';
    this.render();
  }

  private loadSlot() {
    if (!this.slots[this.slotSel]) return this.createSlot();
    audio.sfx('select');
    useSlot(this.slotSel + 1);
    this.scene.start('menu');
  }

  private createSlot() {
    if (this.slots[this.slotSel]) return this.deny();
    audio.sfx('select');
    newSlot(this.slotSel + 1);
    this.scene.start('menu');
  }

  private overwrite() {
    if (!this.slots[this.slotSel]) return this.createSlot();
    if (this.armed !== 'overwrite') {
      audio.sfx('tick');
      this.armed = 'overwrite';
      return this.render();
    }
    audio.sfx('select');
    newSlot(this.slotSel + 1);
    this.scene.start('menu');
  }

  private remove() {
    if (!this.slots[this.slotSel]) return this.deny();
    if (this.armed !== 'delete') {
      audio.sfx('tick');
      this.armed = 'delete';
      return this.render();
    }
    deleteSlot(this.slotSel + 1);
    audio.sfx('select');
    this.armed = '';
    this.slots = listSlots();
    this.flash(`存档 ${this.slotSel + 1} 已删除`);
    this.render();
  }

  private exportCode() {
    const code = exportSlot(this.slotSel + 1);
    if (!code) return this.deny();
    audio.sfx('tick');
    const fallback = () => window.prompt('复制下面的存档码保存好：', code);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => this.flash('存档码已复制到剪贴板'), fallback);
    } else fallback();
  }

  private importCode() {
    const n = this.slotSel + 1;
    const code = window.prompt(this.slots[this.slotSel] ? `粘贴存档码（会覆盖存档 ${n}）：` : `粘贴存档码，导入到存档 ${n}：`);
    if (!code) return;
    if (!importSlot(n, code)) {
      this.deny();
      return this.flash('存档码无效');
    }
    audio.sfx('select');
    this.slots = listSlots();
    this.armed = '';
    this.flash(`已导入到存档 ${n}`);
    this.render();
  }

  // ---------- 设置 ----------

  private settingItems() {
    const items: { name: string; value: string; fn: () => void }[] = [
      { name: '音乐', value: audio.musicOn ? '开' : '关', fn: () => audio.setMusic(!audio.musicOn) },
      { name: '音效', value: audio.sfxOn ? '开' : '关', fn: () => audio.setSfx(!audio.sfxOn) },
    ];
    if (isTouch() && !isStandalone() && canFullscreen()) items.push({ name: '全屏', value: isFullscreen() ? '开' : '关', fn: () => toggleFullscreen() });
    return items;
  }

  private renderSettings() {
    const L = this.layer;
    this.back(() => this.toMain());
    L.add(label(this, 48, 44, '设置', '#f4eee0', 24));
    const items = this.settingItems();
    this.sel = Math.min(this.sel, items.length - 1);
    items.forEach((it, i) => {
      const y = 88 + i * 34;
      const on = i === this.sel;
      if (on) L.add(this.add.rectangle(40, y + 4, 3, 16, 0xffd23f).setOrigin(0));
      L.add(label(this, 50, y, it.name, on ? GOLD : MUTED, 24));
      const v = label(this, 200, y, it.value, it.value === '开' ? '#f4eee0' : DIMTXT, 24);
      L.add(v);
      const row = this.add.rectangle(36, y - 4, 220, 32, 0x000000, 0.001).setOrigin(0);
      L.add(this.hit(row, () => {
        this.sel = i;
        this.toggleSetting();
      }));
    });
    if (!isTouch()) this.hint('↑ ↓ 选择　Enter 切换　Esc 返回');
  }

  private toggleSetting() {
    const it = this.settingItems()[this.sel];
    if (!it) return;
    it.fn();
    audio.sfx('tick');
    // 全屏切换是异步的，稍等再刷新
    this.time.delayedCall(120, () => this.view === 'settings' && this.render());
    this.render();
  }

  // ---------- 通用 ----------

  private deny() {
    audio.sfx('deny');
    this.cameras.main.shake(100, 0.003);
  }

  private flash(s: string) {
    this.toast?.destroy();
    const t = label(this, 320, 18, s, '#f4eee0').setOrigin(0.5, 0).setDepth(50);
    this.toast = t;
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 200, onComplete: () => t.destroy() });
  }

  private showTip(text: string) {
    const c = this.add.container(0, 0).setDepth(100);
    const bg = this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.8).setOrigin(0).setInteractive();
    c.add(bg);
    c.add(this.add.rectangle(320, 130, 400, 100, PANEL, 1).setOrigin(0.5, 0).setStrokeStyle(1, LINE));
    c.add(label(this, 140, 146, wrap(text, 360), '#f4eee0', 12, false).setLineSpacing(6));
    c.add(label(this, 320, 208, '点任意处关闭', '#8a8494').setOrigin(0.5, 0));
    bg.once('pointerdown', () => c.destroy());
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    const ok = k === 'Enter' || k === ' ' || k === 'z' || k === 'Z';
    const up = k === 'ArrowUp' || k === 'w' || k === 'W';
    const down = k === 'ArrowDown' || k === 's' || k === 'S';
    if (this.view === 'main') {
      const n = this.mainItems().length;
      if (ok) return this.pick();
      if (!up && !down) return;
      this.sel = (this.sel + (up ? n - 1 : 1)) % n;
    } else if (this.view === 'slots') {
      if (k === 'Escape') return this.toMain();
      if (ok) return this.full ? this.overwrite() : this.slots[this.slotSel] ? this.loadSlot() : this.createSlot();
      if (k === 'n' || k === 'N') return this.overwrite();
      if (k === 'x' || k === 'X' || k === 'Delete' || k === 'Backspace') return this.remove();
      if (k === 'c' || k === 'C') return this.exportCode();
      if (k === 'v' || k === 'V') return this.importCode();
      if (!up && !down) return;
      this.slotSel = (this.slotSel + (up ? SLOTS - 1 : 1)) % SLOTS;
      this.armed = '';
    } else {
      if (k === 'Escape') return this.toMain();
      if (ok) return this.toggleSetting();
      const n = this.settingItems().length;
      if (!up && !down) return;
      this.sel = (this.sel + (up ? n - 1 : 1)) % n;
    }
    audio.sfx('tick');
    this.render();
  }
}
