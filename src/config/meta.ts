/** 洞府修炼：花灵石买的通用成长。价格和数值见 GDD 第 8 节；星图见 startree.ts */

export type UpgradeStat =
  | 'hp' | 'armor' | 'regen' | 'speed' | 'pickup' | 'xp'
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
  { id: 'shenfa', stat: 'speed', name: '身法', glyph: '身', v: 0.05, maxLv: 3, base: 100, desc: '移动速度 +5%' },
  { id: 'shouling', stat: 'pickup', name: '聚灵', glyph: '聚', v: 0.2, maxLv: 2, base: 80, desc: '拾取范围 +20%' },
  { id: 'wuxing', stat: 'xp', name: '悟性', glyph: '悟', v: 0.04, maxLv: 5, base: 150, desc: '经验 +4%' },
  { id: 'caiyun', stat: 'lingshi', name: '财运', glyph: '财', v: 0.1, maxLv: 5, base: 100, desc: '灵石获取 +10%' },
  { id: 'xuming', stat: 'revive', name: '续命', glyph: '命', v: 1, maxLv: 2, base: 800, desc: '每局可原地复活 1 次，复活时回复一半生命' },
  { id: 'huanqian', stat: 'reroll', name: '换签', glyph: '签', v: 1, maxLv: 3, base: 300, desc: '每局可重抽升级选项 1 次' },
  { id: 'zhanyuan', stat: 'banish', name: '斩缘', glyph: '斩', v: 1, maxLv: 3, base: 300, desc: '每局可封禁 1 个升级选项，本局不再出现' },
];

/** 修炼已购等级，key 是修炼 id */
export type MetaLevels = Record<string, number>;

export function totalBought(m: MetaLevels) {
  return Object.values(m).reduce((s, v) => s + v, 0);
}

/** 第 k 级价格 = 基础价 × k + ⌊10 × 1.1^已购总级数⌋ */
export function price(def: UpgradeDef, m: MetaLevels) {
  const k = (m[def.id] ?? 0) + 1;
  return def.base * k + Math.floor(10 * Math.pow(1.1, totalBought(m)));
}

/** 悟道：用灵石买道点，最多 5 次，不可退还 */
export const WUDAO_MAX = 5;
export function wudaoPrice(bought: number) {
  return 500 * Math.pow(2, bought);
}
