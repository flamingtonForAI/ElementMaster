import type { El } from './elements';

export type SkillId = 'slash' | 'flysword' | 'fireball' | 'leaf' | 'waterdragon' | 'stonespike';
export type PassiveId = 'ruijin' | 'yanyang' | 'changsheng' | 'roushui' | 'houtu' | 'qingshen' | 'juling';

export type Stats = Record<string, number>;

export interface SkillDef {
  id: SkillId;
  name: string;
  glyph: string;
  el: El;
  maxLv: number;
  /** 专属术只出现在对应角色的升级池 */
  exclusive?: string;
  /** desc[0] 是习得时的描述，desc[n] 是升到 n+1 级的变化 */
  desc: string[];
  stats: (lv: number) => Stats;
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  glyph: string;
  el: El | null;
  maxLv: number;
  desc: string;
}

const at = (arr: number[], lv: number) => arr[Math.min(arr.length, lv) - 1];

export const SKILLS: Record<SkillId, SkillDef> = {
  slash: {
    id: 'slash', name: '剑气斩', glyph: '斩', el: 'metal', maxLv: 8, exclusive: 'xiao',
    desc: ['向面朝方向挥出扇形剑气', '伤害提高', '范围扩大', '伤害提高，冷却缩短', '范围扩大', '伤害提高', '范围扩大，冷却缩短', '前后双斩，并斩出剑气波'],
    stats: (lv) => ({
      dmg: at([16, 20, 20, 25, 25, 31, 31, 38], lv),
      range: at([44, 44, 50, 50, 56, 56, 62, 62], lv),
      cd: at([1.0, 1.0, 1.0, 0.9, 0.9, 0.9, 0.8, 0.8], lv),
      arc: 160,
      back: lv >= 8 ? 1 : 0,
    }),
  },
  flysword: {
    id: 'flysword', name: '飞剑', glyph: '剑', el: 'metal', maxLv: 8,
    desc: ['追踪最近的敌人，可穿透', '伤害提高', '飞剑 +1', '穿透 +1', '飞剑 +1', '伤害提高，穿透 +1', '飞剑 +1', '伤害大幅提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([10, 13, 13, 13, 13, 17, 17, 24], lv),
      count: at([1, 1, 2, 2, 3, 3, 4, 4], lv),
      pierce: at([2, 2, 2, 3, 3, 4, 4, 4], lv),
      cd: at([1.5, 1.5, 1.5, 1.5, 1.4, 1.4, 1.3, 1.1], lv),
    }),
  },
  fireball: {
    id: 'fireball', name: '火球', glyph: '火', el: 'fire', maxLv: 8,
    desc: ['向敌群抛出火球，落地爆炸', '伤害提高', '爆炸范围扩大', '火球 +1', '伤害提高', '爆炸范围扩大', '火球 +1', '伤害大幅提高'],
    stats: (lv) => ({
      dmg: at([18, 23, 23, 23, 29, 29, 29, 40], lv),
      radius: at([26, 26, 31, 31, 31, 36, 36, 40], lv),
      count: at([1, 1, 1, 2, 2, 2, 3, 3], lv),
      cd: at([2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5], lv),
    }),
  },
  leaf: {
    id: 'leaf', name: '飞叶', glyph: '叶', el: 'wood', maxLv: 8,
    desc: ['飞叶在敌人之间弹射', '弹射 +1', '伤害提高', '飞叶 +1', '弹射 +2', '伤害提高', '冷却缩短', '飞叶 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([8, 8, 11, 11, 11, 14, 14, 17], lv),
      bounces: at([3, 4, 4, 4, 6, 6, 6, 6], lv),
      count: at([1, 1, 1, 2, 2, 2, 2, 3], lv),
      cd: at([1.4, 1.4, 1.35, 1.3, 1.25, 1.2, 1.0, 1.0], lv),
    }),
  },
  waterdragon: {
    id: 'waterdragon', name: '水龙', glyph: '龙', el: 'water', maxLv: 8,
    desc: ['水龙贯穿一线敌人并减速', '伤害提高', '水龙变粗', '减速延长', '伤害提高', '水龙 +1', '水龙变粗，伤害提高', '冷却缩短，伤害提高'],
    stats: (lv) => ({
      dmg: at([16, 21, 21, 21, 27, 27, 33, 38], lv),
      width: at([7, 7, 9, 9, 9, 9, 11, 11], lv),
      slow: at([1.2, 1.2, 1.2, 2.0, 2.0, 2.0, 2.0, 2.0], lv),
      count: at([1, 1, 1, 1, 1, 2, 2, 2], lv),
      cd: at([2.4, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 1.6], lv),
    }),
  },
  stonespike: {
    id: 'stonespike', name: '石刺', glyph: '刺', el: 'earth', maxLv: 8,
    desc: ['敌人脚下突起石刺，造成眩晕', '石刺 +1', '伤害提高', '眩晕延长', '石刺 +1', '伤害提高，范围扩大', '石刺 +1', '石刺 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([20, 20, 26, 26, 26, 32, 32, 40], lv),
      count: at([2, 3, 3, 3, 4, 4, 5, 6], lv),
      radius: at([14, 14, 14, 14, 14, 17, 17, 18], lv),
      stun: at([0.35, 0.35, 0.35, 0.6, 0.6, 0.6, 0.6, 0.6], lv),
      cd: at([2.0, 1.95, 1.9, 1.85, 1.8, 1.7, 1.6, 1.5], lv),
    }),
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  ruijin: { id: 'ruijin', name: '锐金诀', glyph: '锐', el: 'metal', maxLv: 5, desc: '暴击率 +6%' },
  yanyang: { id: 'yanyang', name: '炎阳诀', glyph: '炎', el: 'fire', maxLv: 5, desc: '全部伤害 +8%' },
  changsheng: { id: 'changsheng', name: '长生诀', glyph: '生', el: 'wood', maxLv: 5, desc: '每秒回复 0.4 生命' },
  roushui: { id: 'roushui', name: '柔水诀', glyph: '柔', el: 'water', maxLv: 5, desc: '技能范围 +10%' },
  houtu: { id: 'houtu', name: '厚土诀', glyph: '厚', el: 'earth', maxLv: 5, desc: '生命上限 +12%，护甲 +1' },
  qingshen: { id: 'qingshen', name: '轻身诀', glyph: '轻', el: null, maxLv: 5, desc: '移动速度 +7%' },
  juling: { id: 'juling', name: '聚灵诀', glyph: '聚', el: null, maxLv: 5, desc: '拾取范围 +25%，经验 +5%' },
};

export const SKILL_SLOTS = 6;
export const PASSIVE_SLOTS = 6;
