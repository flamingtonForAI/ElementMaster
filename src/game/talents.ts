import type { CharacterDef } from '../config/characters';
import { STAR, CENTER, addMods, litSet, startNode, type Mods } from '../config/startree';
import { LEGACIES, LEGACY_LEVELS } from '../config/legacy';
import type { Save } from './save';

/** 已通关数：通关第 N 关后 unlocked = N + 1 */
const cleared = (s: Save) => Math.max(0, s.unlocked - 1);

/** 道点总数 = 开局 6 + 每首通一关 3 + 悟道（劫数上线后每劫首通 +1） */
export function daoPoints(s: Save) {
  return 6 + 3 * cleared(s) + s.wudao;
}

export function legacyPoints(s: Save) {
  return LEGACY_LEVELS.filter((n) => cleared(s) >= n).length;
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
