import Phaser from 'phaser';
import { coverView } from '../config/view';
import { EL_INFO } from '../config/elements';
import { LEVELS } from '../config/levels';
import { ENEMIES } from '../config/enemies';
import { CHARACTERS } from '../config/characters';
import { LEVEL_STORY, STORY_SCROLLS } from '../config/story';
import { label, hex } from './text';
import { wrap } from './wrap';
import { isTouch } from './touch';

const PANEL = 0x161220;
const GOLD_LINE = 0x7a623c;

/**
 * 构建关键关卡（1、3、6、9）与终章（10）的图文绘卷弹窗容器。
 * 左栏：224×136 像素山水/神话插画 + 朱砂印章 + 首领/角色剪影铭牌；
 * 右栏：绘卷题名 + 叙事正文 + 破境纪事 / 角色专属证道结局。
 */
export function buildStoryScrollModal(
  scene: Phaser.Scene,
  levelId: number,
  charId: string,
  actionText: string,
  onClose: () => void,
): Phaser.GameObjects.Container | null {
  const scroll = STORY_SCROLLS[levelId];
  if (!scroll) return null;
  const lv = LEVELS.find((l) => l.id === levelId);
  const nextLv = LEVELS.find((l) => l.id === levelId + 1);
  const char = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
  const story = LEVEL_STORY[levelId];
  const accentCol = EL_INFO[scroll.accent].color;

  const c = scene.add.container(0, 0).setDepth(120);
  c.add(coverView(scene, scene.add.rectangle(0, 0, 640, 360, 0x07050b, 0.84).setOrigin(0)));

  // 左右画轴轴杆与金轴头
  for (const rx of [50, 584]) {
    c.add(scene.add.rectangle(rx, 18, 6, 324, 0x382822).setOrigin(0).setStrokeStyle(1, 0x5c4438));
    c.add(scene.add.rectangle(rx - 1, 14, 8, 6, 0xd4a84a).setOrigin(0));
    c.add(scene.add.rectangle(rx - 1, 340, 8, 6, 0xd4a84a).setOrigin(0));
  }

  // 卷轴主体底板与内衬金线
  c.add(scene.add.rectangle(56, 22, 528, 316, PANEL, 0.98).setOrigin(0).setStrokeStyle(1, GOLD_LINE));
  c.add(scene.add.rectangle(60, 26, 520, 308, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0x382e46));

  // ---------- 左栏：图画与铭牌 (x: 70..294, w: 224) ----------
  c.add(label(scene, 70, 36, scroll.subtitle, '#b8aec8'));
  // 朱砂印章
  c.add(scene.add.rectangle(276, 33, 18, 18, 0x9e2424).setOrigin(0).setStrokeStyle(1, 0xe86a5a));
  c.add(label(scene, 285, 36, scroll.seal, '#fff4e0', 12, false).setOrigin(0.5, 0));

  // 224×136 像素画卷（112×68 放大 2 倍）
  c.add(scene.add.rectangle(69, 57, 226, 138, 0x0c0a12).setOrigin(0).setStrokeStyle(1, GOLD_LINE));
  if (scene.textures.exists(scroll.tex)) {
    c.add(scene.add.image(182, 126, scroll.tex).setScale(2));
  }

  // 左下角铭牌区 (y: 202..294)
  c.add(scene.add.rectangle(70, 202, 224, 92, 0x1d172a, 0.95).setOrigin(0).setStrokeStyle(1, 0x3e3450));
  if (levelId === 10) {
    // 终章：展示通关角色半身像与证道铭牌
    const pKey = `portrait_${char.id}`;
    if (scene.textures.exists(pKey)) {
      c.add(scene.add.rectangle(80, 212, 48, 60, 0x120e1a).setOrigin(0).setStrokeStyle(1, accentCol));
      c.add(scene.add.image(104, 271, pKey).setOrigin(0.5, 1));
    }
    c.add(label(scene, 138, 214, `${char.name} · ${char.title}`, '#ffd23f'));
    c.add(label(scene, 138, 232, `${EL_INFO[char.el].name}灵根 · 昆仑定脉人`, hex(EL_INFO[char.el].color)));
    c.add(label(scene, 138, 252, wrap('十关妖氛尽涤，九州五气归元。', 148), '#b8aec8', 12, false).setLineSpacing(3));
  } else if (lv) {
    // 关键章节节点：展示已斩首领形象与下一关去向
    const bossDef = ENEMIES[lv.boss];
    if (bossDef && scene.textures.exists(bossDef.tex)) {
      c.add(scene.add.rectangle(78, 210, 56, 56, 0x120e1a).setOrigin(0).setStrokeStyle(1, 0x5a3840));
      const sp = scene.add.sprite(106, 262, bossDef.tex, 0).setOrigin(0.5, 1);
      const fit = Math.min(48 / sp.width, 48 / sp.height);
      sp.setScale(fit >= 1 ? Math.floor(fit) : fit);
      c.add(sp);
    }
    c.add(label(scene, 142, 212, `已斩首领 · ${lv.bossName}`, '#ff8a7a'));
    if (nextLv) {
      c.add(label(scene, 142, 232, `前路 · 第${nextLv.id}关「${nextLv.name}」`, '#ffd23f'));
      const nextStory = LEVEL_STORY[nextLv.id];
      if (nextStory) {
        c.add(label(scene, 142, 250, wrap(nextStory.intro, 144), '#b8aec8', 12, false).setLineSpacing(2));
      }
    }
  }

  // ---------- 右栏：绘卷题名与叙事正文 (x: 308..570, w: 262) ----------
  c.add(label(scene, 308, 34, scroll.title, '#ffd23f', 24));
  c.add(scene.add.rectangle(308, 64, 262, 1, accentCol, 0.7).setOrigin(0));

  let py = 74;
  for (const para of scroll.paragraphs) {
    const t = label(scene, 308, py, wrap(para, 260), '#f4eee0', 12, false).setLineSpacing(4);
    c.add(t);
    py += t.height + 8;
  }

  // 右下：终章角色专属证道辞 或 章节破境纪事
  c.add(scene.add.rectangle(308, 202, 262, 92, 0x1d172a, 0.95).setOrigin(0).setStrokeStyle(1, accentCol, 0.6));
  if (levelId === 10 && scroll.charEndings?.[char.id]) {
    c.add(label(scene, 318, 210, '【证道终章】', '#ffd23f'));
    c.add(label(scene, 318, 228, wrap(scroll.charEndings[char.id], 242), '#e8dec8', 12, false).setLineSpacing(4));
  } else if (story) {
    c.add(label(scene, 318, 210, '【破境纪事】', hex(accentCol)));
    c.add(label(scene, 318, 228, wrap(story.outro, 242), '#e8dec8', 12, false).setLineSpacing(4));
  }

  // ---------- 底部交互按钮 ----------
  const btn = label(scene, 320, 306, `▶ ${actionText} ◀`, '#ffd23f').setOrigin(0.5, 0);
  btn.setInteractive({
    useHandCursor: true,
    hitArea: new Phaser.Geom.Rectangle(-40, -6, btn.width + 80, btn.height + 12),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
  });
  btn.on('pointerup', () => onClose());
  c.add(btn);

  if (!isTouch()) {
    c.add(label(scene, 570, 308, 'Enter / Space 继续', '#6a6474').setOrigin(1, 0));
  }

  return c;
}
