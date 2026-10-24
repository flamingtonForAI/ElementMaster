/** 玩家与傀儡的护甲：每点增加 8% 有效生命，减伤最多 60%，最后取整。
 * 敌人仍用固定扣甲，保留小额多段、破甲与持续伤害之间的区别。
 */
export function armoredDamage(incoming: number, armor: number): number {
  const taken = Math.max(0.4, 1 / (1 + Math.max(0, armor) * 0.08));
  return Math.max(1, Math.round(incoming * taken));
}
