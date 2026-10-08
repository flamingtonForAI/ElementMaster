import { relation, type El } from './elements';

/** 洞府：局外成长。价格和数值见 GDD 第 8 节 */

export type UpgradeStat =
  | 'hp' | 'armor' | 'regen' | 'dmg' | 'crit' | 'area' | 'cd' | 'speed' | 'pickup' | 'xp'
  | 'lingshi' | 'revive' | 'reroll' | 'banish';

export interface UpgradeDef {
  id: string;
  name: string;
  glyph: string;
  /** 每级数值 */
  v: number;
  maxLv: number;
  base: number;
  desc: string;
}

export const UPGRADES: (UpgradeDef & { stat: UpgradeStat })[] = [
  { id: 'qixue', stat: 'hp', name: '气血', glyph: '血', v: 0.08, maxLv: 5, base: 100, desc: '生命上限 +8%' },
  { id: 'huti', stat: 'armor', name: '护体', glyph: '甲', v: 1, maxLv: 3, base: 150, desc: '护甲 +1' },
  { id: 'huichun', stat: 'regen', name: '回春', glyph: '春', v: 0.2, maxLv: 3, base: 150, desc: '每秒回复 0.2 生命' },
  { id: 'weili', stat: 'dmg', name: '威力', glyph: '威', v: 0.05, maxLv: 5, base: 150, desc: '全部伤害 +5%' },
  { id: 'ruiyan', stat: 'crit', name: '锐眼', glyph: '眼', v: 0.02, maxLv: 5, base: 150, desc: '暴击率 +2%' },
  { id: 'guangyu', stat: 'area', name: '广域', glyph: '域', v: 0.05, maxLv: 3, base: 200, desc: '技能范围 +5%' },
  { id: 'xunjie', stat: 'cd', name: '迅捷', glyph: '迅', v: 0.03, maxLv: 4, base: 200, desc: '冷却 −3%' },
  { id: 'shenfa', stat: 'speed', name: '身法', glyph: '身', v: 0.05, maxLv: 3, base: 100, desc: '移动速度 +5%' },
  { id: 'shouling', stat: 'pickup', name: '聚灵', glyph: '聚', v: 0.2, maxLv: 2, base: 80, desc: '拾取范围 +20%' },
  { id: 'wuxing', stat: 'xp', name: '悟性', glyph: '悟', v: 0.04, maxLv: 5, base: 150, desc: '经验 +4%' },
  { id: 'caiyun', stat: 'lingshi', name: '财运', glyph: '财', v: 0.1, maxLv: 5, base: 100, desc: '灵石获取 +10%' },
  { id: 'xuming', stat: 'revive', name: '续命', glyph: '命', v: 1, maxLv: 2, base: 800, desc: '每局可原地复活 1 次，复活时回复一半生命' },
  { id: 'huanqian', stat: 'reroll', name: '换签', glyph: '签', v: 1, maxLv: 3, base: 300, desc: '每局可重抽升级选项 1 次' },
  { id: 'zhanyuan', stat: 'banish', name: '斩缘', glyph: '斩', v: 1, maxLv: 3, base: 300, desc: '每局可封禁 1 个升级选项，本局不再出现' },
];

export type TreeStat = 'elDmg' | 'lingen' | 'resist' | 'critDmg';

export interface TreeDef {
  el: El;
  name: string;
  nodes: (UpgradeDef & { stat: TreeStat })[];
}

const common = (el: El, n: string): TreeDef['nodes'] => [
  { id: `${el}.dmg`, stat: 'elDmg', name: `${n}术`, glyph: '术', v: 0.04, maxLv: 5, base: 120, desc: `${n}系术伤害 +4%` },
  { id: `${el}.lingen`, stat: 'lingen', name: '灵根', glyph: '根', v: 1, maxLv: 2, base: 400, desc: `开局${n}灵根 +1（不受亲和缩放）` },
  { id: `${el}.resist`, stat: 'resist', name: `${n}抗`, glyph: '抗', v: 0.05, maxLv: 3, base: 150, desc: `受${n}系敌人伤害 −5%` },
];

/** 第一版只开放金、土两棵；土的特色节点（傀儡生命）等傀儡师上线 */
export const TREES: TreeDef[] = [
  {
    el: 'metal', name: '金 · 白虎',
    nodes: [...common('metal', '金'), { id: 'metal.crit', stat: 'critDmg', name: '破锋', glyph: '锋', v: 0.1, maxLv: 3, base: 200, desc: '暴击伤害 +10%' }],
  },
  { el: 'earth', name: '土 · 黄龙', nodes: common('earth', '土') },
];

/** 已购等级，key 是修炼 id 或天赋节点 id */
export type MetaLevels = Record<string, number>;

export function totalBought(m: MetaLevels) {
  return Object.values(m).reduce((s, v) => s + v, 0);
}

/** 第 k 级价格 = 基础价 × k + ⌊10 × 1.1^已购总级数⌋ */
export function price(def: UpgradeDef, m: MetaLevels) {
  const k = (m[def.id] ?? 0) + 1;
  return def.base * k + Math.floor(10 * Math.pow(1.1, totalBought(m)));
}

/** 角色亲和元素对某棵天赋树的效果系数；克我的那棵随局内等级恢复 */
export function affinity(charEl: El, treeEl: El, level: number) {
  const r = relation(treeEl, charEl);
  if (r === 'same') return 1.5;
  if (r === 'drain') return 1.25; // 树的元素生我
  if (r === 'counter') return Math.min(1, 0.85 + 0.01 * level); // 树的元素克我
  return 1;
}
