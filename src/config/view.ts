import type Phaser from 'phaser';

export const VIEW_W = 640;
export const VIEW_H = 360;

/** ?heroPixels=32 恢复原生主角与原画布，便于实战对照。 */
export const HERO_PIXELS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('heroPixels') === '32' ? 32 : 48;
/** 3 倍输出同时容纳原素材的 1 世界像素和新主角的 2/3 世界像素。 */
export const RENDER_SCALE = HERO_PIXELS === 48 ? 3 : 1;
const configuredCameras = new WeakSet<Phaser.Cameras.Scene2D.Camera>();

export interface SafeInsets { left: number; right: number; top: number; bottom: number }
const NO_INSETS: SafeInsets = { left: 0, right: 0, top: 0, bottom: 0 };

/** 手机横屏扩展视野；640×360 的菜单 / HUD 完整放在安全区中。 */
export function fitView(w: number, h: number, touch: boolean, safe = NO_INSETS) {
  const fill = touch && w >= h;
  const ratio = fill
    ? Math.min(Math.max(1, w - safe.left - safe.right) / VIEW_W, Math.max(1, h - safe.top - safe.bottom) / VIEW_H)
    : Math.min(w / VIEW_W, h / VIEW_H);
  const scale = fill ? ratio : ratio >= 2 ? Math.floor(ratio) : Math.max(0.3, ratio);
  // 向上取整覆盖最后半个像素，避免部分机型边缘出现细黑线。
  const width = fill ? Math.ceil(w / scale * RENDER_SCALE) : VIEW_W * RENDER_SCALE;
  const height = fill ? Math.ceil(h / scale * RENDER_SCALE) : VIEW_H * RENDER_SCALE;
  return {
    width, height, zoom: scale / RENDER_SCALE,
    x: (VIEW_W - width / RENDER_SCALE) / 2 + (fill ? (safe.right - safe.left) / (2 * scale) : 0),
    y: (VIEW_H - height / RENDER_SCALE) / 2 + (fill ? (safe.bottom - safe.top) / (2 * scale) : 0),
  };
}

let layout = fitView(VIEW_W, VIEW_H, false);
export function setViewLayout(next: ReturnType<typeof fitView>) { layout = next; }
export function viewBounds() {
  return { x: layout.x, y: layout.y, width: layout.width / RENDER_SCALE, height: layout.height / RENDER_SCALE };
}
export function cameraView(camera: { width: number; height: number }) {
  return { width: camera.width / RENDER_SCALE, height: camera.height / RENDER_SCALE };
}

/** UI 保留原坐标；战斗相机扩展可见世界并继续跟随玩家。 */
export function configureView(scene: Phaser.Scene, follow = false) {
  const camera = scene.cameras.main;
  const resize = () => {
    camera.setZoom(RENDER_SCALE);
    if (!follow) camera.setScroll(
      layout.x + (camera.width / RENDER_SCALE - camera.width) / 2,
      layout.y + (camera.height / RENDER_SCALE - camera.height) / 2,
    );
  };
  resize();
  if (!configuredCameras.has(camera)) {
    // Phaser 的震屏位移同时乘 viewport 尺寸和 zoom，抵消两次倍率以保留原手感。
    camera.on('camerashakestart', (_camera: Phaser.Cameras.Scene2D.Camera, effect: Phaser.Cameras.Scene2D.Effects.Shake) => {
      effect.intensity.scale(1 / (RENDER_SCALE * RENDER_SCALE));
    });
    scene.scale.on('resize', resize);
    scene.events.once('shutdown', () => {
      scene.scale.off('resize', resize);
      configuredCameras.delete(camera);
    });
    configuredCameras.add(camera);
  }
}

/** 远景、地砖和弹层遮罩延伸到整个屏幕；额外两像素供前景轻摆。 */
export function coverView<T extends Phaser.GameObjects.TileSprite | Phaser.GameObjects.Rectangle>(scene: Phaser.Scene, object: T, scenery = false): T {
  const resize = () => {
    const b = viewBounds();
    object.setPosition(b.x - 2, b.y - 2).setSize(b.width + 4, b.height + 4);
    if (scenery) {
      // 640×360 的整幅远景按比例覆盖，避免加宽后重复山景或在底部露出接缝。
      const scale = Math.max((b.width + 4) / VIEW_W, (b.height + 4) / VIEW_H);
      (object as Phaser.GameObjects.TileSprite).setTileScale(scale).setTilePosition(
        (VIEW_W - (b.width + 4) / scale) / 2,
        (VIEW_H - (b.height + 4) / scale) / 2,
      );
    }
  };
  resize();
  scene.scale.on('resize', resize);
  object.once('destroy', () => scene.scale.off('resize', resize));
  return object;
}

/** 指针 x/y 属于渲染画布；HUD / 洞府手势用逻辑屏幕坐标。 */
export function viewPoint(p: { x: number; y: number }) {
  return { x: p.x / RENDER_SCALE + layout.x, y: p.y / RENDER_SCALE + layout.y };
}
