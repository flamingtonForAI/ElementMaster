import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { ArtScene } from './scenes/ArtScene';
import { VIEW_W, VIEW_H } from './config/view';


const zoomFor = () => Math.max(1, Math.floor(Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H)));

async function start() {
  try {
    await document.fonts.load(`12px FusionPixel`, '五行师');
  } catch {
    // 字体加载失败时退回系统字体
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: '#0b0910',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: zoomFor(), autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, GameScene, HudScene, ArtScene],
  });
  addEventListener('resize', () => game.scale.setZoom(zoomFor()));
  (window as unknown as { game: Phaser.Game }).game = game;
}

start();
