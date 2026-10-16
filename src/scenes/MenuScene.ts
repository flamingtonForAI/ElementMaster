import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters';
import { LEVELS } from '../config/levels';
import { EL_INFO, GEN_ORDER } from '../config/elements';
import { activeSlot, loadSave } from '../game/save';
import { daoPoints, legacyPoints } from '../game/talents';
import { label, hex } from '../ui/text';
import { wrap } from '../ui/wrap';
import { isTouch } from '../ui/touch';
import { audio } from '../audio/Audio';

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

  /** 从洞府、结算页回来时带着角色，保持选中 */
  init(data: { char?: string }) {
    this.step = 'char';
    this.charSel = Math.max(0, CHARACTERS.findIndex((c) => c.id === data?.char));
  }

  create() {
    const save = loadSave();
    this.levelSel = LEVELS.reduce((selected, lv, i) => lv.available && lv.id <= save.unlocked ? i : selected, 0);
    this.bg = this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0).setAlpha(0.55);
    this.add.rectangle(0, 0, 640, 360, 0x07050b, 0.45).setOrigin(0);

    // 标题：五个元素字环绕
    label(this, 320, 18, '五行师', '#f4eee0', 48).setOrigin(0.5, 0);
    GEN_ORDER.forEach((e, i) => {
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

  update(_t: number, dms: number) {
    this.bg.tilePositionX += dms * 0.01;
    this.bg.tilePositionY += dms * 0.005;
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
    const TW = 58;
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
        const sp = this.add.sprite(x + TW / 2, 110 + TW / 2 + 2, `hero_${c.id}`, 0).setScale(1.5);
        sp.play(`${c.id}_s_idle`);
        L.add(sp);
      } else {
        L.add(label(this, x + TW / 2, 110 + TW / 2, c.balanced ? '五' : EL_INFO[c.el].name, hex(c.balanced ? 0x5a5266 : EL_INFO[c.el].dark), 24).setOrigin(0.5));
      }
    });

    // 详情
    const c = CHARACTERS[this.charSel];
    const save = loadSave();
    const py = 174;
    const ph = 146;
    L.add(this.add.rectangle(X0, py, W, ph, PANEL, 0.95).setOrigin(0).setStrokeStyle(1, LINE));
    const col = c.balanced ? 0xd8d0e4 : EL_INFO[c.el].color;
    if (c.available) {
      const big = this.add.sprite(X0 + 52, py + ph / 2 + 4, `hero_${c.id}`, 0).setScale(3);
      big.play(`${c.id}_s_idle`);
      L.add(big);
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
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') return this.confirm();
    if (this.step === 'char') {
      if (k === 'q' || k === 'Q') return this.toDongfu();
      if (k === 'Escape') return this.toTitle();
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.charSel = (this.charSel + CHARACTERS.length - 1) % CHARACTERS.length;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.charSel = (this.charSel + 1) % CHARACTERS.length;
      else return;
    } else {
      if (k === 'ArrowUp' || k === 'w' || k === 'W') this.levelSel = (this.levelSel + LEVELS.length - 1) % LEVELS.length;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this.levelSel = (this.levelSel + 1) % LEVELS.length;
      else if (k === 'Escape') this.step = 'char';
      else return;
    }
    audio.sfx('tick');
    this.render();
  }
}
