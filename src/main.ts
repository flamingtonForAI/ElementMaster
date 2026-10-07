import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { ArtScene } from './scenes/ArtScene';
import { VIEW_W, VIEW_H } from './config/view';
import { isTouch } from './ui/touch';


const viewSize = () => ({ w: window.visualViewport?.width ?? innerWidth, h: window.visualViewport?.height ?? innerHeight });

/** 大屏按整数倍放大保持像素清晰；手机等小屏按比例铺满 */
const zoomFor = () => {
  const { w, h } = viewSize();
  const r = Math.min(w / VIEW_W, h / VIEW_H);
  return r >= 2 ? Math.floor(r) : Math.max(0.3, r);
};

let allowPortrait = false;
const portraitTouch = () => {
  const { w, h } = viewSize();
  return !allowPortrait && isTouch() && h > w;
};

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
  const onResize = () => {
    game.scale.setZoom(zoomFor());
    // 竖屏时自动暂停，横过来后从暂停菜单继续
    if (portraitTouch()) {
      const gs = game.scene.getScene('game') as GameScene;
      if (gs?.scene.isActive()) gs.pauseGame();
    }
  };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 200));
  window.visualViewport?.addEventListener('resize', onResize);
  document.getElementById('rotate-skip')?.addEventListener('click', () => {
    allowPortrait = true;
    document.body.classList.add('allow-portrait');
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  (window as unknown as { game: Phaser.Game }).game = game;
}

start();
