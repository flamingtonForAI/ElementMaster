import type Phaser from 'phaser';
import { HERO_PIXELS } from '../config/view';
import animations from './heroAnimations.json' with { type: 'json' };
import { buildHeroXiao } from './heroXiao';
import { buildHeroZhu } from './heroZhu';
import { buildHeroRuan } from './heroRuan';
import { buildHeroQingdai } from './heroQingdai';
import { buildHeroMoheng } from './heroMoheng';
import { buildHeroXuanyi } from './heroXuanyi';

const builders = { xiao: buildHeroXiao, zhu: buildHeroZhu, ruan: buildHeroRuan, qingdai: buildHeroQingdai, moheng: buildHeroMoheng, xuanyi: buildHeroXuanyi };

export function preloadHeroes(scene: Phaser.Scene) {
  if (HERO_PIXELS === 32) return;
  for (const id of Object.keys(builders)) {
    scene.load.spritesheet(`hero_${id}`, `assets/heroes/${id}-48.png`, { frameWidth: 48, frameHeight: 48 });
  }
}

export function buildHeroes(scene: Phaser.Scene) {
  for (const [id, build] of Object.entries(builders)) {
    const key = `hero_${id}`;
    if (HERO_PIXELS === 48 && scene.textures.exists(key)) {
      for (const animation of animations) if (animation.key.startsWith(`${id}_`)) scene.anims.create(animation);
    } else build(scene);
  }
}
