import type Phaser from 'phaser';
import sheets from './enemySheets.json' with { type: 'json' };
import { PC } from './painter';

/** PNG 来自已确认的原画；source key 与正式动画 key 分开，便于沿用升阶着色。 */
export const ENEMY_SHEETS = sheets;
export const enemySourceKey = (key: string) => `source_${key}`;

export function preloadEnemySheets(scene: Phaser.Scene) {
  for (const key of Object.keys(sheets)) {
    scene.load.image(enemySourceKey(key), `assets/enemies/${key}.png`);
  }
}

/** 将加载好的位图拆成帧；缺图时由调用方沿用原来的程序画。 */
export function readEnemySheet(scene: Phaser.Scene, key: string): PC[] | undefined {
  const spec = sheets[key as keyof typeof sheets];
  const sourceKey = enemySourceKey(key);
  if (!spec || !scene.textures.exists(sourceKey)) return;
  const image = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  if (image.width !== spec.width * spec.frames || image.height !== spec.height) return;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return Array.from({ length: spec.frames }, (_, i) => {
    const frame = new PC(spec.width, spec.height);
    const rgba = ctx.getImageData(i * spec.width, 0, spec.width, spec.height).data;
    for (let p = 0; p < frame.c.length; p++) {
      if (!rgba[p * 4 + 3]) continue;
      frame.c[p] = (rgba[p * 4] << 16) | (rgba[p * 4 + 1] << 8) | rgba[p * 4 + 2];
      frame.a[p] = rgba[p * 4 + 3];
    }
    return frame;
  });
}
