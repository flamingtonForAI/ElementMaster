import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { HudScene } from './scenes/HudScene';
import { ArtScene } from './scenes/ArtScene';
import { DongfuScene } from './scenes/DongfuScene';
import { fitView, setViewLayout } from './config/view';
import { isTouch } from './ui/touch';


const viewSize = () => ({ w: window.visualViewport?.width ?? innerWidth, h: window.visualViewport?.height ?? innerHeight });

const layoutFor = () => {
  const { w, h } = viewSize();
  const css = getComputedStyle(document.getElementById('safe-area')!);
  return fitView(w, h, isTouch(), {
    left: parseFloat(css.paddingLeft) || 0, right: parseFloat(css.paddingRight) || 0,
    top: parseFloat(css.paddingTop) || 0, bottom: parseFloat(css.paddingBottom) || 0,
  });
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
  const initial = layoutFor();
  setViewLayout(initial);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: initial.width,
    height: initial.height,
    backgroundColor: '#0b0910',
    pixelArt: true,
    roundPixels: true,
    // CSS 保留小数居中；Phaser 的整数 margin 会在手机右 / 下边缘留下 1px 黑线。
    scale: { mode: Phaser.Scale.NONE, zoom: initial.zoom, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [BootScene, TitleScene, MenuScene, GameScene, HudScene, ArtScene, DongfuScene],
  });
  const onResize = () => {
    const next = layoutFor();
    setViewLayout(next);
    game.scale.setZoom(next.zoom);
    game.scale.resize(next.width, next.height);
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
