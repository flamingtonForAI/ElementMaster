import Phaser from 'phaser';
import { coverView, viewBounds, configureView } from '../config/view';
import { CHARACTERS } from '../config/characters';
import { LEVELS } from '../config/levels';
import { LEVEL_STORY, STORY_SCROLLS } from '../config/story';
import { EL_INFO, GEN_ORDER, SAY_ORDER } from '../config/elements';
import { activeSlot, loadSave } from '../game/save';
import { daoPoints, legacyPoints } from '../game/talents';
import { PORTRAIT_W, PORTRAIT_H } from '../art/portraits';
import { label, hex } from '../ui/text';
import { buildStoryScrollModal } from '../ui/storyScroll';
import { wrap } from '../ui/wrap';
import { isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';
import { getTodPreset, getVistaCloudKey, getVistaFgKey, getVistaTextureKey } from '../art/vistaArt';

const PANEL = 0x161220;
const LINE = 0x4a3f5c;

export class MenuScene extends Phaser.Scene {
  private step: 'char' | 'level' = 'char';
  private charSel = 0;
  private levelSel = 0;
  private layer!: Phaser.GameObjects.Container;
  private scrollModal: Phaser.GameObjects.Container | null = null;
  private clouds!: Phaser.GameObjects.TileSprite;
  private fg!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('menu');
  }

  /** 从洞府、结算页回来时带着角色，保持选中 */
  init(data: { char?: string }) {
    this.step = 'char';
    this.charSel = Math.max(0, CHARACTERS.findIndex((c) => c.id === data?.char));
  }

  create() {
    configureView(this);
    const save = loadSave();
    this.levelSel = LEVELS.reduce((selected, lv, i) => lv.available && lv.id <= save.unlocked ? i : selected, 0);
    coverView(this, this.add.tileSprite(0, 0, 640, 360, getVistaTextureKey()).setOrigin(0), true);
    this.clouds = coverView(this, this.add.tileSprite(0, 0, 640, 360, getVistaCloudKey()).setOrigin(0), true).setAlpha(0.28);
    this.fg = coverView(this, this.add.tileSprite(0, 0, 640, 360, getVistaFgKey()).setOrigin(0), true).setAlpha(0.65);
    coverView(this, this.add.rectangle(0, 0, 640, 360, 0x07050b, getTodPreset().veilAlpha + 0.16).setOrigin(0));

    // 标题：五个元素字环绕
    label(this, 320, 18, '五行师', '#f4eee0', 48).setOrigin(0.5, 0);
    SAY_ORDER.forEach((e, i) => {
      label(this, 320 + (i - 2) * 26, 72, EL_INFO[e].name, hex(EL_INFO[e].color)).setOrigin(0.5, 0);
    });
    label(this, 634, 344, `存档 ${activeSlot()} · 灵石 ${save.lingshi}`, '#6a6474').setOrigin(1, 0);

    const home = label(this, 8, 8, '‹ 首页', '#b8aec8');
    home.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-8, -8, home.width + 16, home.height + 16), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    home.on('pointerup', () => this.toTitle());
    audio.music('menu');

    this.layer = this.add.container(0, 0);
    this.render();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(t: number, dms: number) {
    this.clouds.tilePositionX += dms * 0.004;
    this.fg.x = viewBounds().x - 2 + Math.round(Math.sin(t * 0.0012) * 1.5);
  }

  private render() {
    this.layer.removeAll(true);
    if (this.step === 'char') this.renderChars();
    else this.renderLevels();
  }

  /** 选角：上面一排角色头像（含未开放的占位），下面是选中角色的详情 */
  private renderChars() {
    const L = this.layer;
    const n = CHARACTERS.length;
    // 格子 64：小人按 2 倍整数放大正好放下；非整数缩放会让呼吸起伏时五官的像素宽窄跳动
    const TW = 64;
    const GAP = 6;
    const W = n * TW + (n - 1) * GAP;
    const X0 = 320 - W / 2;
    L.add(label(this, X0, 92, '选择角色', '#ffd23f'));
    L.add(label(this, X0 + W, 92, `${CHARACTERS.filter((c) => c.available).length} / ${n}`, '#6a6474').setOrigin(1, 0));

    CHARACTERS.forEach((c, i) => {
      const x = X0 + i * (TW + GAP);
      const on = i === this.charSel;
      const col = c.balanced ? 0xd8d0e4 : EL_INFO[c.el].color;
      const bg = this.add.rectangle(x, 110, TW, TW, on ? 0x2a2238 : PANEL, 0.95).setOrigin(0).setStrokeStyle(on ? 2 : 1, on ? 0xffd23f : c.available ? col : LINE, on ? 1 : 0.6);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.charSel === i) return this.confirm();
        audio.sfx('tick');
        this.charSel = i;
        this.render();
      });
      L.add(bg);
      if (c.available) {
        const sp = this.add.sprite(x + TW / 2, 110 + TW / 2, `hero_${c.id}`, 0).setDisplaySize(64, 64);
        sp.play(`${c.id}_s_idle`);
        L.add(sp);
      } else {
        L.add(label(this, x + TW / 2, 110 + TW / 2, c.balanced ? '五' : EL_INFO[c.el].name, hex(c.balanced ? 0x5a5266 : EL_INFO[c.el].dark), 24).setOrigin(0.5));
      }
    });

    // 详情
    const c = CHARACTERS[this.charSel];
    const save = loadSave();
    const py = 178;
    const ph = 142;
    L.add(this.add.rectangle(X0, py, W, ph, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    const col = c.balanced ? 0xd8d0e4 : EL_INFO[c.el].color;
    if (c.available) {
      // 生图像素肖像与程序画后备共用同一显示尺寸。
      const pw = PORTRAIT_W * 2;
      const pht = PORTRAIT_H * 2;
      const px = X0 + 52 - pw / 2;
      const pty = py + (ph - pht) / 2;
      L.add(this.add.image(px, pty, `portrait_${c.id}`).setOrigin(0).setDisplaySize(pw, pht));
      L.add(this.add.rectangle(px - 1, pty - 1, pw + 2, pht + 2).setOrigin(0).setStrokeStyle(1, col, 0.7));
    } else {
      L.add(label(this, X0 + 52, py + ph / 2, '?', '#5a5266', 48).setOrigin(0.5));
    }
    const tx = X0 + 104;
    const tw = W - 116;
    // 名号长的（五行散人）去掉间隔里的空格，免得顶到出发按钮
    const sep = c.title.length + c.name.length > 5 ? '·' : ' · ';
    L.add(label(this, tx, py + 8, `${c.title}${sep}${c.name}`, c.available ? '#f4eee0' : '#8a8494', 24));
    L.add(label(this, tx, py + 38, `${c.balanced ? '五行均衡' : `${EL_INFO[c.el].name}亲和`} · ${c.role}`, hex(col)));
    if (c.available) L.add(label(this, tx, py + 56, `生命 ${c.hp}　移速 ${c.speed}　护甲 ${c.armor}`, '#6a6474'));
    const bio = label(this, tx, py + (c.available ? 76 : 58), wrap(c.bio, tw), '#8a8494', 12, false).setLineSpacing(3);
    L.add(bio);
    L.add(label(this, tx, bio.y + bio.height + 6, wrap(c.trait, tw), c.available ? '#d8d0e4' : '#6a6474', 12, false).setLineSpacing(3));
    const by = py + ph - 26;
    if (c.available) {
      const btn = this.add.rectangle(X0 + W - 80, py + 12, 72, 22, 0x2a2238).setOrigin(0).setStrokeStyle(1, 0xffd23f);
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
      L.add(btn);
      L.add(label(this, X0 + W - 44, py + 17, '出发', '#ffd23f').setOrigin(0.5, 0));
      // 洞府按这个角色进；有没用的道点、传承点就标出来
      const unused = daoPoints(save, c) - (save.tree[c.id]?.length ?? 0) + legacyPoints(save, c) - (save.legacy[c.id]?.length ?? 0);
      const df = this.add.rectangle(X0 + W - 80, py + 40, 72, 22, PANEL).setOrigin(0).setStrokeStyle(1, unused > 0 ? 0xffd23f : LINE);
      df.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toDongfu());
      L.add(df);
      L.add(label(this, X0 + W - 44, py + 45, unused > 0 ? `洞府 +${unused}` : '洞府', unused > 0 ? '#ffd23f' : '#b8aec8').setOrigin(0.5, 0));
    } else {
      // 散人：其余角色各自通关最终关
      const last = LEVELS[LEVELS.length - 1].id;
      const done = CHARACTERS.filter((o) => !o.balanced && (save.clears[o.id] ?? []).includes(last)).length;
      L.add(label(this, tx, by + 4, `${c.unlock ?? '后续阶段开放'}${c.balanced ? `（${done} / ${n - 1}）` : ''}`, '#8a8494'));
    }

    L.add(label(this, 320, 326, isTouch() ? '点角色查看，再点一次或点“出发”' : '← → 选择　Enter 出发　Q 洞府　Esc 首页', '#8a8494').setOrigin(0.5, 0));
  }

  private toDongfu() {
    const c = CHARACTERS[this.charSel];
    if (!c.available) return audio.sfx('deny');
    audio.sfx('select');
    this.scene.start('dongfu', { char: c.id });
  }

  private toTitle() {
    audio.sfx('tick');
    this.scene.start('title');
  }

  private renderLevels() {
    const L = this.layer;
    const save = loadSave();
    const c = CHARACTERS[this.charSel];
    L.add(label(this, 320, 96, `选择关卡 · ${c.title} ${c.name}`, '#ffd23f').setOrigin(0.5, 0));
    const back = label(this, 36, 96, '‹ 返回', '#b8aec8');
    back.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-12, -8, back.width + 30, back.height + 14), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    back.on('pointerdown', () => {
      audio.sfx('tick');
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
          audio.sfx('tick');
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
    const story = LEVEL_STORY[lv.id];
    const x = 302;
    L.add(this.add.rectangle(x, 116, 302, 204, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    L.add(label(this, x + 12, 124, `第${lv.id}关 · ${lv.name}`, '#f4eee0', 24));
    if (story) L.add(label(this, x + 290, 130, story.chapter, '#b8aec8').setOrigin(1, 0));
    let tx = x + 12;
    const t0 = label(this, tx, 156, '地气', '#8a8494');
    L.add(t0);
    tx += t0.width + 6;
    for (const el of GEN_ORDER) {
      const v = Math.round(lv.terrain[el] * 100);
      if (!v) continue;
      const t = label(this, tx, 156, `${EL_INFO[el].name}${v}`, hex(EL_INFO[el].color));
      L.add(t);
      tx += t.width + 6;
    }
    const enemyEls = lv.enemies.length
      ? lv.enemies.map((e) => e.id)
      : [];
    L.add(label(this, x + 12, 174, `首领　${lv.bossName}`, '#ff8a7a'));
    L.add(label(this, x + 152, 174, `时长　${lv.duration / 60} 分钟`, '#b8aec8'));
    let py = 194;
    if (story) {
      const introText = label(this, x + 12, py, wrap(story.intro, 278), '#e8dec8', 12, false).setLineSpacing(3);
      L.add(introText);
      py += introText.height + 6;
    }
    L.add(label(this, x + 12, py, wrap(`要点　${lv.lesson}`, 278), '#b8aec8', 12, false).setLineSpacing(3));
    const hasScroll = !!STORY_SCROLLS[lv.id] && (save.unlocked > lv.id || Object.values(save.clears).some((c) => c.includes(lv.id)));
    if (!lv.available) L.add(label(this, x + 12, 290, '后续阶段开放', '#6a6474'));
    else if (lv.id > save.unlocked) L.add(label(this, x + 12, 290, '通关上一关后解锁', '#6a6474'));
    else if (enemyEls.length) {
      const btn = this.add.rectangle(x + 12, 284, 88, 24, 0x2a2238).setOrigin(0).setStrokeStyle(1, 0xffd23f);
      btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirm());
      L.add(btn);
      L.add(label(this, x + 56, 290, '开始', '#ffd23f').setOrigin(0.5, 0));
      if (hasScroll) {
        const sBtn = this.add.rectangle(x + 108, 284, 96, 24, 0x1d172a).setOrigin(0).setStrokeStyle(1, 0x7a623c);
        sBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openScroll());
        L.add(sBtn);
        L.add(label(this, x + 156, 290, isTouch() ? '定脉绘卷' : '绘卷 (V)', '#e8dec8').setOrigin(0.5, 0));
      } else if (!isTouch()) {
        L.add(label(this, x + 110, 290, '或按 Enter', '#6a6474'));
      }
    }
    L.add(label(this, 320, 330, isTouch() ? '点选关卡查看，再点一次或点“开始”进入' : '↑ ↓ 选择　Enter 开始　Esc 返回', '#8a8494').setOrigin(0.5, 0));
  }

  private openScroll() {
    const lv = LEVELS[this.levelSel];
    const save = loadSave();
    if (!STORY_SCROLLS[lv.id] || (save.unlocked <= lv.id && !Object.values(save.clears).some((c) => c.includes(lv.id)))) return;
    audio.sfx('select');
    this.closeScroll();
    this.scrollModal = buildStoryScrollModal(
      this,
      lv.id,
      CHARACTERS[this.charSel].id,
      '收起绘卷',
      () => {
        audio.sfx('tick');
        this.closeScroll();
      },
    );
  }

  private closeScroll() {
    this.scrollModal?.destroy();
    this.scrollModal = null;
  }

  private confirm() {
    if (this.step === 'char') {
      if (!CHARACTERS[this.charSel].available) {
        audio.sfx('deny');
        this.cameras.main.shake(120, 0.004);
        return;
      }
      audio.sfx('select');
      this.step = 'level';
      this.render();
      return;
    }
    const lv = LEVELS[this.levelSel];
    if (!lv.available || lv.id > loadSave().unlocked) {
      audio.sfx('deny');
      this.cameras.main.shake(120, 0.004);
      return;
    }
    audio.sfx('select');
    this.scene.start('game', { level: lv.id, char: CHARACTERS[this.charSel].id });
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.scrollModal) {
      if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z' || k === 'Escape' || k === 'v' || k === 'V') {
        audio.sfx('tick');
        this.closeScroll();
      }
      return;
    }
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') return this.confirm();
    if (this.step === 'char') {
      if (k === 'q' || k === 'Q') return this.toDongfu();
      if (k === 'Escape') return this.toTitle();
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.charSel = (this.charSel + CHARACTERS.length - 1) % CHARACTERS.length;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.charSel = (this.charSel + 1) % CHARACTERS.length;
      else return;
    } else {
      if (k === 'v' || k === 'V') return this.openScroll();
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.levelSel = (this.levelSel + LEVELS.length - 1) % LEVELS.length;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.levelSel = (this.levelSel + 1) % LEVELS.length;
      else if (k === 'Escape') this.step = 'char';
      else return;
    }
    audio.sfx('tick');
    this.render();
  }
}
