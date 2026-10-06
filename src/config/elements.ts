export type El = 'metal' | 'wood' | 'water' | 'fire' | 'earth';

/** 相生顺序，五行盘按这个顺序排布 */
export const GEN_ORDER: El[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export const EL_INFO: Record<El, { name: string; color: number; css: string; dark: number }> = {
  metal: { name: '金', color: 0xe9e4d4, css: '#e9e4d4', dark: 0x8f8a7e },
  wood: { name: '木', color: 0x4fbf7a, css: '#4fbf7a', dark: 0x2e7a4a },
  water: { name: '水', color: 0x4a7fe8, css: '#5a8cf0', dark: 0x2a4a90 },
  fire: { name: '火', color: 0xe8503f, css: '#ef5a48', dark: 0x8e2a20 },
  earth: { name: '土', color: 0xdaa53e, css: '#e0ad48', dark: 0x8a6220 },
};

const GEN: Record<El, El> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const CTRL: Record<El, El> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

/** counter: 我克它；fed: 它生我（借势）；drain: 我生它（泄气）；same: 同类；countered: 它克我 */
export type Rel = 'counter' | 'fed' | 'drain' | 'same' | 'countered';

export const REL_MULT: Record<Rel, number> = {
  counter: 1.5,
  fed: 1.2,
  drain: 0.8,
  same: 0.8,
  countered: 0.6,
};

export function relation(attacker: El, defender: El): Rel {
  if (attacker === defender) return 'same';
  if (CTRL[attacker] === defender) return 'counter';
  if (CTRL[defender] === attacker) return 'countered';
  if (GEN[defender] === attacker) return 'fed';
  return 'drain';
}

export function counters(el: El): El {
  return CTRL[el];
}

export type Terrain = Record<El, number>;

/** 地气修正 = 1 + 0.3×生我占比 + 0.15×同我占比 − 0.3×克我占比，限制在 ±25% */
export function terrainMod(el: El, terrain: Terrain): number {
  const genMe = (Object.keys(GEN) as El[]).find((k) => GEN[k] === el)!;
  const ctrlMe = (Object.keys(CTRL) as El[]).find((k) => CTRL[k] === el)!;
  const v = 1 + 0.3 * terrain[genMe] + 0.15 * terrain[el] - 0.3 * terrain[ctrlMe];
  return Math.max(0.75, Math.min(1.25, v));
}
