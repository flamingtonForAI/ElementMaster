/** 地图上的东西：刷新型的木匣、符箓（第二期加开局固定的五行祭坛） */

/** 固定兴趣点周围不放装饰物、岩壁的半径 */
export const POI_CLEAR_R = 36;

/**
 * 木匣和符箓是刷新的：开局没有，first 秒刷第一个，之后每 every 秒在玩家周围 dist 的环上刷一个；
 * 同时在场的数量有上限，存在 life 秒后消失（最后 10 秒闪烁）
 */
export const ITEM_SPAWN = {
  first: 25,
  every: 30,
  life: 120,
  max: { crate: 2, talisman: 1 },
  /** 有空位时刷符箓的几率 */
  talismanChance: 0.3,
  dist: [420, 700] as [number, number],
};

/** 在 (px, py) 周围的环上找一个能放东西的点：地图内、离边缘够远、不在岩壁上；找不到返回 null */
export function itemSpot(px: number, py: number, half: number, blocked: (x: number, y: number) => boolean, R: () => number = Math.random): [number, number] | null {
  const [d0, d1] = ITEM_SPAWN.dist;
  const m = 80;
  for (let i = 0; i < 24; i++) {
    const a = R() * Math.PI * 2;
    const d = d0 + R() * (d1 - d0);
    const x = Math.round(px + Math.cos(a) * d);
    const y = Math.round(py + Math.sin(a) * d);
    if (Math.abs(x) > half - m || Math.abs(y) > half - m || blocked(x, y)) continue;
    return [x, y];
  }
  return null;
}

export type CrateLoot = 'xp' | 'pill' | 'lingshi' | 'magnet';

/** 木匣：碰到就开，随机一项 */
export const CRATE_LOOT: { id: CrateLoot; w: number }[] = [
  { id: 'xp', w: 35 },
  { id: 'pill', w: 25 },
  { id: 'lingshi', w: 20 },
  { id: 'magnet', w: 20 },
];

export type TalismanId = 'bao' | 'ding' | 'dun';

/** 符箓：拾取即用 */
export const TALISMANS: Record<TalismanId, { name: string; color: number; css: string; w: number }> = {
  bao: { name: '爆符', color: 0xe8503f, css: '#ef5a48', w: 1 },
  ding: { name: '定身符', color: 0x5a8cf0, css: '#5a8cf0', w: 1 },
  dun: { name: '遁符', color: 0xe0b04a, css: '#ffd23f', w: 1 },
};

/** 幸运加成为相对增幅；五级 +100%。基础符箓也有足够长的救场窗口。 */
export function talismanEffects(luck = 0, level = 1) {
  const bonus = Math.max(0, Math.min(1, luck));
  const power = 1 + bonus;
  return {
    chance: ITEM_SPAWN.talismanChance * power,
    maxOnMap: ITEM_SPAWN.max.talisman + Math.floor(bonus * 2),
    duration: 6 * power,
    damage: (100 + level * 10) * power,
    eliteDamage: 0.5,
    speed: 1 + 0.5 * power,
  };
}

export function pickWeighted<T extends string>(list: { id: T; w: number }[], R: () => number = Math.random): T {
  const total = list.reduce((s, e) => s + e.w, 0);
  let r = R() * total;
  for (const e of list) if ((r -= e.w) <= 0) return e.id;
  return list[0].id;
}
