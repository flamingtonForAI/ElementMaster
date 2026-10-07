/** 虚拟摇杆的当前输入，HUD 写入、玩家读取。x/y 的长度在 0..1 之间 */
export const stick = { active: false, x: 0, y: 0 };

export function isTouch() {
  return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
}
