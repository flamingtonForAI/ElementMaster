import type { El } from './elements';

export type SkillId =
  | 'slash' | 'talisman' | 'crossbow' | 'duwu' | 'puppet'
  | 'flysword' | 'fireball' | 'leaf' | 'waterdragon' | 'stonespike'
  | 'jinzhen' | 'lihuo' | 'tengfu' | 'hanbing' | 'luoshi';
export type PassiveId =
  | 'ruijin' | 'yanyang' | 'changsheng' | 'roushui' | 'houtu'
  | 'pojun' | 'liaoyuan' | 'fanmao' | 'xuanming' | 'zhenyue'
  | 'ningshen' | 'guanri' | 'qingshen' | 'juling';

export type Stats = Record<string, number>;

export interface SkillDef {
  id: SkillId;
  name: string;
  glyph: string;
  el: El;
  maxLv: number;
  /** 命中时触发本元素异常的基础几率；水龙、寒冰环自带必定的迟缓，石刺、落石自带必定的眩晕 */
  proc: number;
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
  /** 前置：身上至少有其中一个术才会出现在升级选项里（已学会的照常升级） */
  requires?: SkillId[];
  /** 本系异常心法：身上有本系的术才会出现 */
  needsEl?: boolean;
}

const at = (arr: number[], lv: number) => arr[Math.min(arr.length, lv) - 1];

export const SKILLS: Record<SkillId, SkillDef> = {
  slash: {
    id: 'slash', name: '剑气斩', glyph: '斩', el: 'metal', maxLv: 8, proc: 0.2, exclusive: 'xiao',
    desc: ['向面朝方向挥出扇形剑气', '伤害提高', '范围扩大，冷却缩短', '伤害提高，冷却缩短', '范围扩大', '伤害提高，冷却缩短', '范围扩大', '前后双斩，并斩出剑气波；伤害提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([18, 22, 22, 27, 27, 33, 33, 40], lv),
      range: at([46, 46, 50, 50, 56, 56, 62, 64], lv),
      cd: at([0.95, 0.95, 0.9, 0.85, 0.85, 0.8, 0.8, 0.75], lv),
      arc: 160,
      back: lv >= 8 ? 1 : 0,
    }),
  },
  talisman: {
    id: 'talisman', name: '火符', glyph: '符', el: 'fire', maxLv: 8, proc: 0.3, exclusive: 'zhu',
    desc: ['符纸追踪飞向最近的敌人，贴上后片刻爆开', '伤害提高', '爆炸范围扩大', '一次抛出两张，冷却缩短', '伤害提高', '伤害提高，爆炸范围扩大', '一次抛出三张，伤害提高，冷却缩短', '伤害提高，爆炸范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([22, 28, 28, 28, 34, 38, 42, 46], lv),
      radius: at([26, 26, 32, 32, 32, 36, 36, 40], lv),
      count: at([1, 1, 1, 2, 2, 2, 3, 3], lv),
      cd: at([1.4, 1.4, 1.4, 1.25, 1.25, 1.25, 1.1, 1.0], lv),
    }),
  },
  crossbow: {
    id: 'crossbow', name: '分水连弩', glyph: '弩', el: 'water', maxLv: 8, proc: 0.08, exclusive: 'ruan',
    desc: ['朝最近的敌人连射三箭，射程最远，可贯穿 1 个', '伤害提高', '贯穿 +1', '伤害提高，每轮 +1 箭', '冷却缩短', '伤害提高，贯穿 +1，冷却缩短', '伤害提高，每轮 +1 箭', '命中溅起水花，减速周围敌人并造成 30% 伤害；伤害提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([10, 12, 12, 14, 14, 15, 17, 19], lv),
      shots: at([3, 3, 3, 4, 4, 4, 5, 5], lv),
      pierce: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      cd: at([1.3, 1.3, 1.3, 1.3, 1.2, 1.1, 1.1, 1.0], lv),
      splash: lv >= 8 ? 1 : 0,
    }),
  },
  duwu: {
    id: 'duwu', name: '毒雾', glyph: '雾', el: 'wood', maxLv: 8, proc: 0, exclusive: 'qingdai',
    desc: ['脚下环绕一圈毒雾，进入的敌人中毒，离开后还会再毒一阵', '毒性增强', '毒雾扩大', '毒性增强，离开后毒得更久', '毒性增强，毒雾扩大', '毒雾扩大', '毒性增强', '毒雾扩大，毒性大幅增强，离开后毒得更久；雾里的敌人迟缓'],
    stats: (lv) => ({
      dps: at([12, 15, 15, 18, 22, 22, 27, 34], lv),
      radius: at([48, 48, 56, 56, 62, 68, 68, 78], lv),
      /** 离开毒雾后中毒还持续的秒数 */
      linger: at([2, 2, 2, 3, 3, 3, 3, 4], lv),
      slow: lv >= 8 ? 1 : 0,
      cd: 0.5,
    }),
  },
  puppet: {
    id: 'puppet', name: '石傀儡', glyph: '傀', el: 'earth', maxLv: 8, proc: 0.15, exclusive: 'moheng',
    desc: ['召唤石傀儡跟随，扑向最近的敌人砸一圈，并把周围敌人的仇恨吸过去；打碎后会重新捏出来，经过的经验球会飞向你', '傀儡 +1', '生命、伤害提高', '傀儡 +1，扑击范围扩大', '重塑加快，生命、伤害提高', '生命、伤害提高，扑击范围扩大', '生命、伤害提高', '合成一尊巨傀，攻击带震地；伤害提高，扑击范围扩大'],
    stats: (lv) => ({
      count: at([1, 2, 2, 3, 3, 3, 3, 3], lv),
      hp: at([60, 60, 72, 72, 84, 96, 110, 110], lv),
      dmg: at([16, 16, 19, 19, 21, 23, 25, 26], lv),
      /** 扑击落点周围一圈都挨打 */
      cleave: at([14, 14, 14, 16, 16, 18, 18, 20], lv),
      atkCd: 0.75,
      cd: at([4, 4, 4, 4, 3, 3, 3, 3], lv),
      giant: lv >= 8 ? 1 : 0,
    }),
  },
  flysword: {
    id: 'flysword', name: '飞剑', glyph: '剑', el: 'metal', maxLv: 8, proc: 0.15,
    desc: ['追踪最近的敌人，可穿透', '伤害提高', '飞剑 +1', '穿透 +1', '飞剑 +1', '伤害提高，穿透 +1', '飞剑 +1', '伤害大幅提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([10, 13, 13, 13, 13, 17, 17, 24], lv),
      count: at([1, 1, 2, 2, 3, 3, 4, 4], lv),
      pierce: at([2, 2, 2, 3, 3, 4, 4, 4], lv),
      cd: at([1.5, 1.5, 1.5, 1.5, 1.4, 1.4, 1.3, 1.1], lv),
    }),
  },
  fireball: {
    id: 'fireball', name: '火球', glyph: '火', el: 'fire', maxLv: 8, proc: 0.35,
    desc: ['慢速高抛火球，砸向敌人最密的地方，大范围爆炸', '伤害提高', '爆炸范围扩大', '火球 +1', '伤害提高', '爆炸范围扩大', '火球 +1', '伤害大幅提高，范围扩大'],
    stats: (lv) => ({
      dmg: at([24, 29, 29, 29, 36, 36, 36, 44], lv),
      radius: at([32, 32, 37, 37, 37, 42, 42, 46], lv),
      count: at([1, 1, 1, 2, 2, 2, 3, 3], lv),
      cd: at([2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.0], lv),
    }),
  },
  leaf: {
    id: 'leaf', name: '飞叶', glyph: '叶', el: 'wood', maxLv: 8, proc: 0.1,
    desc: ['飞叶在敌人之间弹射', '弹射 +1', '伤害提高', '飞叶 +1', '弹射 +2', '伤害提高', '冷却缩短', '飞叶 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([8, 8, 11, 11, 11, 14, 14, 17], lv),
      bounces: at([3, 4, 4, 4, 6, 6, 6, 6], lv),
      count: at([1, 1, 1, 2, 2, 2, 2, 3], lv),
      cd: at([1.4, 1.4, 1.35, 1.3, 1.25, 1.2, 1.0, 1.0], lv),
    }),
  },
  waterdragon: {
    id: 'waterdragon', name: '水龙', glyph: '龙', el: 'water', maxLv: 8, proc: 0,
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
    id: 'stonespike', name: '石刺', glyph: '刺', el: 'earth', maxLv: 8, proc: 0,
    desc: ['敌人脚下突起石刺，造成眩晕', '石刺 +1', '伤害提高', '眩晕延长', '石刺 +1', '伤害提高，范围扩大', '石刺 +1', '石刺 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([20, 20, 26, 26, 26, 32, 32, 40], lv),
      count: at([2, 3, 3, 3, 4, 4, 5, 6], lv),
      radius: at([14, 14, 14, 14, 14, 17, 17, 18], lv),
      stun: at([0.35, 0.35, 0.35, 0.6, 0.6, 0.6, 0.6, 0.6], lv),
      cd: at([2.0, 1.95, 1.9, 1.85, 1.8, 1.7, 1.6, 1.5], lv),
    }),
  },
  jinzhen: {
    id: 'jinzhen', name: '金针雨', glyph: '针', el: 'metal', maxLv: 8, proc: 0.12,
    desc: ['一蓬金针落向一片敌人', '伤害提高', '金针 +2', '伤害提高，冷却缩短', '金针 +2', '伤害提高，冷却缩短', '金针 +2', '同时落两片，金针 +2，伤害提高'],
    stats: (lv) => ({
      dmg: at([10, 12, 12, 14, 14, 16, 16, 18], lv),
      count: at([6, 6, 8, 8, 10, 10, 12, 14], lv),
      zones: lv >= 8 ? 2 : 1,
      cd: at([1.6, 1.6, 1.6, 1.5, 1.5, 1.4, 1.4, 1.3], lv),
    }),
  },
  lihuo: {
    id: 'lihuo', name: '离火环', glyph: '环', el: 'fire', maxLv: 8, proc: 0.25,
    desc: ['火焰绕身旋转，灼伤碰到的敌人', '火焰 +1', '伤害提高，环绕扩大、转得更快', '火焰 +1', '伤害提高，环绕扩大、转得更快', '伤害提高', '火焰 +1，环绕扩大、转得更快', '火焰 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([12, 12, 15, 15, 18, 20, 20, 24], lv),
      count: at([1, 2, 2, 3, 3, 3, 4, 5], lv),
      orbit: at([40, 40, 44, 44, 48, 48, 52, 56], lv),
      /** 转一圈的秒数，吃冷却缩短 */
      period: at([1.8, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.4], lv),
      cd: 1,
    }),
  },
  tengfu: {
    id: 'tengfu', name: '藤缚', glyph: '藤', el: 'wood', maxLv: 8, proc: 0.2,
    desc: ['敌人脚下长出藤蔓，缠住的敌人迟缓并持续受伤', '伤害提高', '藤蔓 +1', '伤害提高，范围扩大', '冷却缩短', '伤害提高，藤蔓 +1', '范围扩大，冷却缩短', '伤害大幅提高，范围扩大；刚长出时把敌人定住'],
    stats: (lv) => ({
      /** 每 0.5 秒一跳 */
      dmg: at([8, 10, 10, 12, 12, 15, 15, 18], lv),
      count: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      radius: at([22, 22, 22, 26, 26, 26, 30, 34], lv),
      dur: 3,
      root: lv >= 8 ? 0.5 : 0,
      cd: at([2.4, 2.4, 2.4, 2.4, 2.2, 2.2, 2.0, 2.0], lv),
    }),
  },
  hanbing: {
    id: 'hanbing', name: '寒冰环', glyph: '冰', el: 'water', maxLv: 8, proc: 0,
    desc: ['周身迸发一圈寒气，冻伤并迟缓周围敌人；连续命中攒寒意，攒满冰冻', '伤害提高', '范围扩大，冷却缩短', '伤害提高', '范围扩大', '伤害提高，范围扩大，冷却缩短', '冷却缩短', '伤害大幅提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([10, 13, 13, 16, 16, 19, 19, 24], lv),
      radius: at([56, 56, 62, 62, 68, 74, 74, 84], lv),
      slow: 1.5,
      cd: at([2.2, 2.2, 2.1, 2.1, 2.1, 1.9, 1.8, 1.7], lv),
    }),
  },
  luoshi: {
    id: 'luoshi', name: '落石', glyph: '落', el: 'earth', maxLv: 8, proc: 0,
    desc: ['巨石砸向敌人最密的地方，眩晕一片', '伤害提高', '范围扩大，冷却缩短', '伤害提高，冷却缩短', '落石 +1，范围扩大', '伤害提高，眩晕延长，冷却缩短', '范围扩大，冷却缩短', '伤害大幅提高，范围扩大，眩晕延长'],
    stats: (lv) => ({
      dmg: at([24, 30, 30, 36, 36, 42, 42, 50], lv),
      radius: at([36, 36, 40, 40, 44, 44, 48, 50], lv),
      count: at([1, 1, 1, 1, 2, 2, 2, 2], lv),
      stun: at([0.6, 0.6, 0.6, 0.6, 0.6, 0.8, 0.8, 1.0], lv),
      cd: at([3.4, 3.4, 3.3, 3.2, 3.2, 3.1, 3.0, 3.0], lv),
    }),
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  ruijin: { id: 'ruijin', name: '锐金诀', glyph: '锐', el: 'metal', maxLv: 5, desc: '暴击率 +6%' },
  yanyang: { id: 'yanyang', name: '炎阳诀', glyph: '炎', el: 'fire', maxLv: 5, desc: '全部伤害 +8%' },
  changsheng: { id: 'changsheng', name: '长生诀', glyph: '生', el: 'wood', maxLv: 5, desc: '每秒回复 0.5 生命' },
  roushui: { id: 'roushui', name: '柔水诀', glyph: '柔', el: 'water', maxLv: 5, desc: '技能范围 +8%' },
  houtu: { id: 'houtu', name: '厚土诀', glyph: '厚', el: 'earth', maxLv: 5, desc: '生命上限 +12%，护甲 +1' },
  pojun: { id: 'pojun', name: '破军诀', glyph: '破', el: 'metal', maxLv: 5, needsEl: true, desc: '流血触发几率 +15%；满 5 级叠 4 层就撕裂' },
  liaoyuan: { id: 'liaoyuan', name: '燎原诀', glyph: '燎', el: 'fire', maxLv: 5, needsEl: true, desc: '灼烧触发几率 +15%；满 5 级灼烧上限 +2 层' },
  fanmao: { id: 'fanmao', name: '繁茂诀', glyph: '茂', el: 'wood', maxLv: 5, needsEl: true, desc: '中毒触发几率 +15%，中毒伤害 +10%' },
  xuanming: { id: 'xuanming', name: '玄冥诀', glyph: '冥', el: 'water', maxLv: 5, needsEl: true, desc: '迟缓触发几率 +15%；满 5 级攒 2 层寒意就冰冻' },
  zhenyue: { id: 'zhenyue', name: '镇岳诀', glyph: '镇', el: 'earth', maxLv: 5, needsEl: true, desc: '震慑触发几率 +15%，打晕时长 +15%' },
  ningshen: { id: 'ningshen', name: '凝神诀', glyph: '凝', el: null, maxLv: 5, desc: '冷却 −4%' },
  guanri: { id: 'guanri', name: '贯日诀', glyph: '贯', el: null, maxLv: 5, desc: '第 1、3、5 级：穿透 +1（只对能穿透的投射物）', requires: ['flysword', 'crossbow'] },
  qingshen: { id: 'qingshen', name: '轻身诀', glyph: '轻', el: null, maxLv: 5, desc: '移动速度 +7%' },
  juling: { id: 'juling', name: '聚灵诀', glyph: '聚', el: null, maxLv: 5, desc: '拾取范围 +25%，经验 +5%' },
};

export const SKILL_SLOTS = 6;
export const PASSIVE_SLOTS = 6;
