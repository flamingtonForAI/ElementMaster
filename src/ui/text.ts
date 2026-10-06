import Phaser from 'phaser';

export const FONT = 'FusionPixel';

/** 像素字体文字。size 用 12 的整数倍才能保持清晰 */
export function label(scene: Phaser.Scene, x: number, y: number, s: string, color = '#f4eee0', size = 12, shadow = true) {
  const t = scene.add.text(Math.round(x), Math.round(y), s, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    resolution: 1,
  });
  if (shadow) t.setShadow(1, 1, '#120c18', 0, true, true);
  return t;
}

export function hex(n: number) {
  return '#' + n.toString(16).padStart(6, '0');
}
