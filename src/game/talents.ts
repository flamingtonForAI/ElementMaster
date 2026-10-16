import type { CharacterDef } from '../config/characters';
import { STAR, CENTER, addMods, litSet, startNode, type Mods } from '../config/startree';
import { LEGACIES, LEGACY_LEVELS } from '../config/legacy';
import type { Save } from './save';

/** 每个角色开局的道点 */
export const DAO_START = 2;

/** 这个角色通关过的最高关卡号 */
const cleared = (s: Save, c: CharacterDef) => s.clears[c.id] ?? 0;

/** 道点 = 开局 2 + 这个角色每首通一关 3 + 这个角色的悟道（劫数上线后每劫首通 +1） */
export function daoPoints(s: Save, c: CharacterDef) {
  return DAO_START + 3 * cleared(s, c) + (s.wudao[c.id] ?? 0);
}

/** 传承点：这个角色首通里程碑关卡各 +1 */
export function legacyPoints(s: Save, c: CharacterDef) {
  return LEGACY_LEVELS.filter((n) => cleared(s, c) >= n).length;
}

export function treeStart(c: CharacterDef) {
  return c.balanced ? CENTER : startNode(c.el);
}

export function litNodes(s: Save, c: CharacterDef) {
  return litSet(treeStart(c), s.tree[c.id] ?? []);
}

/** 角色的星图 + 传承加成合计，进局时算一次 */
export function talentMods(s: Save, c: CharacterDef): Mods {
  const m: Mods = {};
  for (const id of litNodes(s, c)) if (STAR[id]) addMods(m, STAR[id].mods);
  const lg = new Set(s.legacy[c.id] ?? []);
  for (const b of LEGACIES[c.id] ?? []) for (const nd of b.nodes) if (lg.has(nd.id)) addMods(m, nd.mods);
  return m;
}
