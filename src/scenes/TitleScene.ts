import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters';
import { EL_INFO, SAY_ORDER } from '../config/elements';
import { ENEMIES, type Behavior, type EnemyDef, type Trick } from '../config/enemies';
import { LEVELS } from '../config/levels';
import { STATUS_INFO } from '../config/status';
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

type View = 'main' | 'slots' | 'bestiary' | 'settings';
type MainId = 'continue' | 'new' | 'slots' | 'bestiary' | 'settings';
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

/** 首次出场的关卡；同关先小怪后 Boss，图鉴按这个顺序排 */
const firstLevel = (id: string) => LEVELS.find((l) => l.boss === id || l.enemies.some((e) => e.id === id))?.id;
const BESTIARY_ORDER = Object.keys(ENEMIES).sort((a, b) => (firstLevel(a) ?? 99) - (firstLevel(b) ?? 99) || +!!ENEMIES[a].boss - +!!ENEMIES[b].boss);
const BEHAVIOR: Record<Behavior, string> = {
  walk: '贴身围攻',
  regen: '受伤后慢慢回血',
  explode: '死后原地自爆',
  charge: '停顿预警后直线冲锋',
  spit: '隔着距离吐毒涎',
  burrow: '钻进土里追到脚下，冒头预警后破土',
  boss_wolf: '冲锋撕咬，环射风刃',
  boss_tree: '召唤藤怪，半血后放毒刺',
  boss_ape: '跳砸、碎石环、投巨石，半血召落石雨',
  boss_bird: '扇形火球，俯冲留下火线，半血降火柱',
  boss_xingtian: '举斧劈砍、盾冲、舞干戚飞刃环',
  boss_snake: '九首扇形齐吐水弹和毒涎，吐毒泽化成瘴雾，潜进泥水从脚下冒出',
  sidestep: '横着错步逼近，贴近了直扑',
  boss_xuanming: '扇形冰羽，冰锥落地结冰，吸寒把人往身边拉后冰爆，狂暴时刮起暴风雪',
  sting: '贴近后停下预警，尾针直刺身前一条线',
  boss_hanba: '土相裂地、陷流沙、跺地；半血焚身化为火系，走过留火、火环、焚风火柱',
  leap: '预警后跳到你脚下砸地',
  boss_jiuying: '随潮汐在水火两系间切换；九首旋喷水火弹，涨潮招水柱、退潮引火山，婴啼唤来同系小怪',
  boss_dijiang: '按相生轮转五系，每系一套招（毒刺、火环、落石、飞刃、冰锥），歌舞时边转边喷五色弹',
};
const SHOT: Record<string, string> = { ep_rock: '隔着距离投石', ep_fire: '隔着距离吐火球', ep_blade: '隔着距离甩飞刃', ep_water: '隔着距离吐水弹', ep_sandball: '隔着距离滚金丸' };
/** 后期关卡开的手段；抛射按元素说落地留下什么 */
const TRICK_TEXT: Record<Trick, (d: EnemyDef) => string> = {
  lob: (d) => `弹改为抛射，落地${d.el === 'fire' ? '留余火' : d.el === 'water' ? '留水洼' : '冒毒气'}`,
  quake: () => '贴近时停下震地，攒震慑',
  formation: () => '列阵：周围的妖物护甲 +2',
  roots: () => '在你脚下催生缠根，踩上去迟缓',
  boomerang: () => '甩出的飞刃会折回来',
  sinkhole: () => '破土处陷出一片流沙',
};
/** 这种敌人的每种手段从第几关开始有 */
function trickLevels(id: string) {
  const out = new Map<Trick, number>();
  for (const l of LEVELS) for (const t of l.tricks?.[id] ?? []) if (!out.has(t)) out.set(t, l.id);
  return out;
}
function traits(d: EnemyDef) {
  const t = [d.behavior === 'spit' && d.shot ? SHOT[d.shot] ?? BEHAVIOR.spit : d.behavior === 'explode' && d.el === 'water' ? '死后原地冰爆，圈里迟缓' : BEHAVIOR[d.behavior]];
  if (d.trail) t.push('冲刺时身后留火');
  if (d.puddle) t.push('冲刺时身后留下水洼');
  if (d.spread) t.push(`一次扇形吐 ${d.spread} 道`);
  if (d.revive) t.push(`死后 ${d.revive} 秒原地复活一次，火系击杀则不会`);
  if (d.rise) t.push('第一次被打倒会复起，火系击杀则不会');
  for (const [k, lv] of trickLevels(d.id)) t.push(`第 ${lv} 关起${TRICK_TEXT[k](d)}`);
  if (d.inflict) t.push(`攻击 ${Math.round(d.inflict.chance * 100)}% 附带${STATUS_INFO[d.inflict.kind].name}`);
  return t.join('；');
}

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
  private beastSel = 0;
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
    items.push({ id: 'new', name: '新游戏' }, { id: 'slots', name: '存档' });
    if (this.current()) items.push({ id: 'bestiary', name: '图鉴' });
    items.push({ id: 'settings', name: '设置' });
    return items;
  }

  private render() {
    this.layer.removeAll(true);
    if (this.view === 'main') this.renderMain();
    else if (this.view === 'slots') this.renderSlots();
    else if (this.view === 'bestiary') this.renderBestiary();
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
    if (it.id === 'bestiary') {
      this.view = 'bestiary';
      this.beastSel = 0;
      return this.render();
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

  // ---------- 图鉴 ----------

  /** 当前存档杀过的敌人，没杀过的不显示 */
  private known() {
    const b = this.current()?.bestiary ?? {};
    return BESTIARY_ORDER.filter((id) => b[id] > 0);
  }

  private renderBestiary() {
    const L = this.layer;
    this.back(() => this.toMain());
    L.add(label(this, 48, 44, '图鉴', '#f4eee0', 24));
    const ids = this.known();
    L.add(label(this, 600, 54, `已收录 ${ids.length} / ${BESTIARY_ORDER.length}`, '#8a8494').setOrigin(1, 0));
    if (!ids.length) {
      L.add(label(this, 48, 96, '还没有打倒过妖物，出去历练一番再来看', '#8a8494'));
      if (!isTouch()) this.hint('Esc 返回');
      return;
    }
    this.beastSel = Math.min(this.beastSel, ids.length - 1);
    const COLS = 7;
    const C = 44;
    const GAP = 4;
    ids.forEach((id, i) => {
      const d = ENEMIES[id];
      const x = 40 + (i % COLS) * (C + GAP);
      const y = 84 + Math.floor(i / COLS) * (C + GAP);
      const on = i === this.beastSel;
      const cell = this.add.rectangle(x, y, C, C, on ? 0x2a2238 : PANEL, 0.92).setOrigin(0).setStrokeStyle(on ? 2 : 1, on ? 0xffd23f : d.boss ? 0x8a4a4a : LINE);
      L.add(this.hit(cell, () => {
        if (this.beastSel === i) return;
        audio.sfx('tick');
        this.beastSel = i;
        this.render();
      }));
      // 小怪原尺寸，Boss 缩到格子里
      const sp = this.monster(d, x + C / 2, y + C - 4, C - 8, C - 8, false);
      L.add(sp);
    });

    // 详情
    const d = ENEMIES[ids[this.beastSel]];
    const px = 392;
    const pw = 208;
    L.add(this.add.rectangle(px, 84, pw, 236, PANEL, 0.92).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(this.monster(d, px + pw / 2, 172, pw - 24, 80, true));
    const col = EL_INFO[d.el].color;
    L.add(label(this, px + 12, 180, d.name, d.boss ? '#ff8a7a' : '#f4eee0', 24));
    const lv = firstLevel(d.id);
    L.add(label(this, px + 12, 208, `${EL_INFO[d.el].name}系${d.boss ? ' · Boss' : ''}${lv ? ` · 第${lv}关` : ''}`, hex(col)));
    L.add(label(this, px + pw - 12, 208, `击杀 ${this.current()!.bestiary[d.id]}`, GOLD).setOrigin(1, 0));
    L.add(label(this, px + 12, 226, `生命 ${d.hp}　移速 ${d.speed}　护甲 ${d.armor}`, '#6a6474'));
    L.add(label(this, px + 12, 246, wrap(traits(d), pw - 24), '#d8d0e4', 12, false).setLineSpacing(3));
    if (!isTouch()) this.hint('← → ↑ ↓ 选择　Esc 返回');
  }

  /** 敌人播走路动画，底边对齐 (x, y)；big 时按整数倍放大填满，否则只缩不放 */
  private monster(d: EnemyDef, x: number, y: number, w: number, h: number, big: boolean) {
    const sp = this.add.sprite(x, y, d.tex, 0).setOrigin(0.5, 1);
    const fit = Math.min(w / sp.width, h / sp.height);
    sp.setScale(big && fit >= 1 ? Math.floor(fit) : Math.min(1, fit));
    if (this.anims.exists(`${d.tex}_move`)) sp.play(`${d.tex}_move`);
    return sp;
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
    } else if (this.view === 'bestiary') {
      if (k === 'Escape') return this.toMain();
      const n = this.known().length;
      const step = k === 'ArrowLeft' || k === 'a' || k === 'A' ? -1 : k === 'ArrowRight' || k === 'd' || k === 'D' ? 1 : up ? -7 : down ? 7 : 0;
      const next = this.beastSel + step;
      if (!step || next < 0 || next >= n) return;
      this.beastSel = next;
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
