import type { El } from './elements';

export type UltimateId = 'wanjian' | 'senluo' | 'canghai' | 'tianhuo' | 'kunlun';
export type SkillId = UltimateId
  | 'slash' | 'talisman' | 'crossbow' | 'duwu' | 'puppet' | 'fuchen'
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
  /** null 为无属性，不参与五行生克、灵根及元素加成。 */
  el: El | null;
  maxLv: number;
  /** 命中时触发本元素异常的基础几率；水龙、寒冰环必定迟缓，地脉刺专注击退，落石必定施加一阶眩晕 */
  proc: number;
  /** 专属术只出现在对应角色的升级池 */
  exclusive?: string;
  /** 最右大格专用；十个普通格已填满且角色达到觉醒等级后解锁，无需各项满级。 */
  ultimate?: boolean;
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

/** 十个普通格填满后，角色超过 50 级（即 51 级起）觉醒大招。 */
export const ULTIMATE_UNLOCK_LEVEL = 51;
/** 连续两次大招至少相隔十秒战斗时间，包含退射等冷却计时加速。 */
export const ULTIMATE_MIN_CD = 10;
/** 通用减冷却最多 75%；剑心、退射仍按自身规则乘算，大招另有十秒下限。 */
export const MIN_CD_MULT = 0.25;

export const SKILLS: Record<SkillId, SkillDef> = {
  fuchen: {
    id: 'fuchen', name: '清风拂尘', glyph: '尘', el: null, maxLv: 8, proc: 0, exclusive: 'xuanyi',
    desc: ['自动瞄准近敌，长距扇扫并强力击退；无属性，不附异常', '伤害提高，前扫距离与击退增加', '扫击扇面与距离扩大，冷却缩短', '伤害提高，前扫距离与击退增强', '扫击扇面与距离扩大，冷却缩短', '伤害提高，前扫距离增加，冷却缩短', '扫击角度与距离继续扩大，伤害提高', '伤害大幅提高，长距广扇强力震退，冷却缩短'],
    stats: (lv) => ({
      dmg: at([22, 26, 30, 35, 40, 46, 52, 62], lv),
      // 自动瞄准、无属性无异常，换取比全周环与剑气更长的窄扇前扫距离。
      range: at([60, 64, 68, 72, 76, 80, 84, 88], lv),
      arc: at([105, 110, 115, 120, 125, 130, 138, 145], lv),
      cd: at([1.25, 1.22, 1.18, 1.15, 1.12, 1.08, 1.05, 1.0], lv),
      kb: at([32, 35, 38, 42, 45, 48, 52, 56], lv),
    }),
  },
  wanjian: {
    id: 'wanjian', name: '万剑归宗', glyph: '宗', el: 'metal', maxLv: 1, proc: 1, ultimate: true,
    desc: ['三轮剑阵横扫周围大范围敌人，每轮造成 120 金伤并积累流血；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 120, radius: 260, count: 3, interval: 0.45, cd: 15 }),
  },
  senluo: {
    id: 'senluo', name: '森罗万象', glyph: '森', el: 'wood', maxLv: 1, proc: 1, ultimate: true,
    desc: ['四次森罗脉动，每次造成 80 木伤、施毒并缠身 2 秒；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 80, radius: 250, count: 4, interval: 0.75, root: 2, cd: 15 }),
  },
  canghai: {
    id: 'canghai', name: '沧海归墟', glyph: '沧', el: 'water', maxLv: 1, proc: 0, ultimate: true,
    desc: ['三重寒潮，每重造成 100 水伤、迟缓 3 秒并积累寒意，可进阶冰冻；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 100, radius: 280, count: 3, interval: 0.65, slow: 3, cd: 15 }),
  },
  tianhuo: {
    id: 'tianhuo', name: '天火焚世', glyph: '焚', el: 'fire', maxLv: 1, proc: 1, ultimate: true,
    desc: ['两次天火爆发，每次造成 170 火伤并点燃周围大范围敌人；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 170, radius: 260, count: 2, interval: 0.9, cd: 15 }),
  },
  kunlun: {
    id: 'kunlun', name: '昆仑镇岳', glyph: '岳', el: 'earth', maxLv: 1, proc: 0, ultimate: true,
    desc: ['两次山岳震荡，每次造成 160 土伤并击退、定身 2.5 秒（首领改迟缓）；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 160, radius: 240, count: 2, interval: 0.8, root: 2.5, kb: 90, cd: 15 }),
  },
  slash: {
    id: 'slash', name: '剑气斩', glyph: '斩', el: 'metal', maxLv: 8, proc: 0.35, exclusive: 'xiao',
    desc: ['向面朝方向挥出宽幅扇形剑气（移动时不自动索敌，斩距长于全周环）', '伤害提高，斩距延伸，冷却缩短', '前后双斩，双向各斩出一道剑气波', '伤害提高，斩距延伸，冷却缩短', '范围扩大，伤害提高，冷却缩短', '伤害提高，斩距延伸，冷却缩短', '伤害提高，范围扩大', '伤害大幅提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([19, 23, 25, 29, 32, 36, 40, 44], lv),
      range: at([56, 60, 60, 65, 70, 75, 80, 84], lv),
      cd: at([0.95, 0.92, 0.88, 0.85, 0.82, 0.78, 0.75, 0.72], lv),
      arc: 160,
      back: lv >= 3 ? 1 : 0,
    }),
  },
  talisman: {
    id: 'talisman', name: '火符', glyph: '符', el: 'fire', maxLv: 8, proc: 0.35, exclusive: 'zhu',
    desc: ['符纸追踪近敌，贴附片刻后定点爆裂（必中单点高伤，爆幅紧凑）', '伤害提高，冷却缩短', '一次祭出两张，伤害提高', '爆裂范围扩大，伤害提高，冷却缩短', '伤害提高，爆裂范围扩大', '一次祭出三张，伤害提高，冷却缩短', '伤害提高，爆裂范围扩大', '伤害大幅提高，爆裂范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([24, 29, 31, 35, 39, 42, 46, 52], lv),
      radius: at([24, 24, 26, 28, 30, 32, 34, 36], lv),
      count: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      cd: at([1.4, 1.35, 1.3, 1.24, 1.18, 1.12, 1.06, 1.0], lv),
    }),
  },
  crossbow: {
    id: 'crossbow', name: '分水连弩', glyph: '弩', el: 'water', maxLv: 8, proc: 0.2, exclusive: 'ruan',
    desc: ['朝近敌极速连射三箭，高贯穿长线破敌；远射或连续贯敌均递进增伤', '伤害提高，冷却缩短', '贯穿 +1；每次贯穿均溅起紧凑水花，对邻敌造成 25% 伤害', '伤害提高，每轮 +1 箭', '轮流瞄准附近最多 3 个方向；贯穿 +1，水花增至 35%', '伤害提高，贯穿 +1，冷却缩短', '伤害提高，每轮 +1 箭，水花扩大', '贯穿 +1，水花伤害增至 45% 并附带迟缓；伤害提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([11, 13, 14, 16, 17, 19, 21, 24], lv),
      shots: at([3, 3, 3, 4, 4, 4, 5, 5], lv),
      pierce: at([2, 2, 3, 3, 4, 5, 5, 6], lv),
      cd: at([1.3, 1.26, 1.22, 1.18, 1.12, 1.06, 1.02, 0.95], lv),
      targets: lv >= 5 ? 3 : 1,
      splash: at([0, 0, 0.25, 0.25, 0.35, 0.35, 0.35, 0.45], lv),
      splashRadius: at([0, 0, 22, 22, 28, 28, 32, 36], lv),
      splashSlow: lv >= 8 ? 0.8 : 0,
    }),
  },
  duwu: {
    id: 'duwu', name: '毒雾', glyph: '雾', el: 'wood', maxLv: 8, proc: 0, exclusive: 'qingdai',
    desc: ['周身萦绕毒雾，踏入之敌必定中毒，离雾后余毒仍存片刻', '毒性增强', '毒雾扩大，毒性增强', '毒性增强，离雾后余毒延长', '毒性增强，毒雾扩大', '毒雾扩大，毒性增强', '毒性增强', '毒雾扩大，毒性大幅增强，余毒延长；雾中群妖迟缓'],
    stats: (lv) => ({
      dps: at([17, 20, 22, 25, 29, 32, 36, 42], lv),
      radius: at([48, 50, 56, 58, 62, 68, 72, 78], lv),
      /** 离开毒雾后中毒还持续的秒数 */
      linger: at([2, 2, 2.5, 3, 3, 3.5, 3.5, 4], lv),
      slow: lv >= 8 ? 1 : 0,
      cd: 0.5,
    }),
  },
  puppet: {
    id: 'puppet', name: '石傀儡', glyph: '傀', el: 'earth', maxLv: 8, proc: 0.3, exclusive: 'moheng',
    desc: ['召唤傀儡扑击震敌、引敌护主；损毁后重塑，并牵引灵气', '傀儡 +1，伤害提高', '生命、伤害提高', '傀儡 +1，扑击范围扩大', '重塑加快，生命、伤害提高', '生命、伤害提高，扑击范围扩大', '生命、伤害提高', '化为巨傀并补两尊傀儡；巨傀扑击震地，伤害与范围提高'],
    stats: (lv) => ({
      count: at([1, 2, 2, 3, 3, 3, 3, 3], lv),
      hp: at([60, 64, 74, 80, 92, 104, 118, 128], lv),
      dmg: at([16, 18, 20, 22, 24, 26, 28, 30], lv),
      /** 扑击落点周围一圈都挨打 */
      cleave: at([14, 14, 15, 16, 17, 18, 19, 22], lv),
      atkCd: 0.75,
      cd: at([4, 3.8, 3.6, 3.4, 3, 2.9, 2.8, 2.6], lv),
      giant: lv >= 8 ? 1 : 0,
      /** 早成巨傀的震地威力逐级长到普通满级巨傀，避免 Lv5 直接获得满额倍率。 */
      giantDmg: at([1.75, 1.75, 1.75, 1.75, 1.75, 2, 2.25, 2.5], lv),
    }),
  },
  flysword: {
    id: 'flysword', name: '飞剑', glyph: '剑', el: 'metal', maxLv: 8, proc: 0.3,
    desc: ['御剑自动追踪近敌，点线锋芒连续贯穿敌躯（无范围爆炸，专注串刺与流血）', '伤害提高，冷却缩短', '飞剑 +1，伤害提高', '穿透 +1，伤害提高', '飞剑 +1，伤害提高', '伤害提高，穿透 +1', '飞剑 +1，伤害提高', '伤害大幅提高，穿透 +1，冷却缩短'],
    stats: (lv) => ({
      dmg: at([11, 14, 15, 17, 19, 22, 24, 28], lv),
      count: at([1, 1, 2, 2, 3, 3, 4, 4], lv),
      pierce: at([2, 2, 2, 3, 3, 4, 4, 5], lv),
      cd: at([1.5, 1.44, 1.38, 1.32, 1.26, 1.2, 1.14, 1.05], lv),
    }),
  },
  fireball: {
    id: 'fireball', name: '火球', glyph: '火', el: 'fire', maxLv: 8, proc: 0.4,
    desc: ['慢速高抛赤炎真火，轰击敌群最密集之处，大范围爆裂灼烧（不追踪个体）', '伤害提高，冷却缩短', '火球 +1，爆裂范围扩大', '伤害提高，冷却缩短', '爆裂范围扩大，伤害提高', '火球 +1，伤害提高，冷却缩短', '爆裂范围扩大，伤害提高', '伤害大幅提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([25, 30, 32, 36, 41, 44, 48, 54], lv),
      radius: at([38, 40, 44, 46, 50, 52, 56, 60], lv),
      count: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      cd: at([2.2, 2.12, 2.05, 1.98, 1.9, 1.82, 1.75, 1.65], lv),
    }),
  },
  leaf: {
    id: 'leaf', name: '飞叶', glyph: '叶', el: 'wood', maxLv: 8, proc: 0.4,
    desc: ['追踪弹射传毒，每跳增伤12%；同片不重复命中，无击退', '弹射 +1，伤害提高', '飞叶 +1，伤害提高，冷却缩短', '弹射 +1，伤害提高', '伤害提高，冷却缩短', '弹射 +1，伤害提高', '飞叶 +1，冷却缩短，伤害提高', '伤害大幅提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([9, 10, 12, 13, 15, 17, 19, 22], lv),
      bounces: at([3, 4, 4, 5, 5, 6, 6, 6], lv),
      count: at([1, 1, 2, 2, 2, 2, 3, 3], lv),
      cd: at([1.35, 1.3, 1.25, 1.2, 1.15, 1.1, 0.98, 0.9], lv),
    }),
  },
  waterdragon: {
    id: 'waterdragon', name: '水龙', glyph: '龙', el: 'water', maxLv: 8, proc: 0,
    desc: ['朝近敌直线奔涌，无限穿透并迟缓；出手后不追踪', '伤害提高，水龙加粗', '水龙加粗，伤害提高', '迟缓延长，伤害提高', '双龙并行，通路加宽；每条造成单龙 75% 伤害', '伤害提高，水龙加粗，冷却缩短', '水龙加粗，伤害提高，迟缓延长', '冷却缩短，伤害大幅提高'],
    stats: (lv) => ({
      dmg: at([18, 22, 24, 27, 29, 33, 38, 44], lv),
      width: at([7, 8, 9, 9, 10, 11, 11, 12], lv),
      slow: at([1.4, 1.5, 1.6, 2.0, 2.1, 2.2, 2.4, 2.6], lv),
      count: at([1, 1, 1, 1, 2, 2, 2, 2], lv),
      twinDmg: 0.75,
      cd: at([2.3, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.5], lv),
    }),
  },
  stonespike: {
    // 保留内部 id，兼容构筑、存档和升级池。
    id: 'stonespike', name: '地脉刺', glyph: '脉', el: 'earth', maxLv: 8, proc: 0,
    desc: ['沿面朝方向裂地，强力击退前方敌群；不索敌、不眩晕', '展开为锥形，岩刺 +1 排，伤害提高', '锥形展开角度扩大，伤害提高', '锥形展开角度扩大，击退增强，伤害提高', '锥形展开角度扩大，岩刺 +1 排，延伸更远', '锥形展开角度扩大，伤害提高，岩刺变宽', '锥形展开角度扩大，岩刺 +1 排，伤害提高', '锥形大幅展开，岩刺 +1 排，延伸更远，伤害提高'],
    stats: (lv) => ({
      dmg: at([20, 22, 26, 28, 30, 34, 37, 40], lv),
      count: at([5, 6, 6, 6, 7, 7, 8, 9], lv),
      range: at([112, 136, 136, 136, 160, 160, 184, 208], lv),
      arc: at([0, 12, 18, 24, 30, 36, 42, 48], lv),
      radius: at([14, 14, 15, 15, 16, 17, 18, 19], lv),
      // 通用击退以 3 倍初速、指数 9 衰减：作为无索敌无眩晕的补偿，提供全游最强的破阵推力。
      kb: lv >= 4 ? 210 : 165,
      cd: at([1.9, 1.82, 1.74, 1.66, 1.58, 1.5, 1.4, 1.3], lv),
    }),
  },
  jinzhen: {
    // 保留内部 id，兼容已有构筑与存档。
    id: 'jinzhen', name: '流金剑雨', glyph: '雨', el: 'metal', maxLv: 8, proc: 0.24,
    desc: ['锁定出招朝向，剑雨斜斩前方固定区域；不自动索敌', '伤害提高，落剑 +1', '落剑 +1，伤害提高', '伤害提高，落剑 +1，冷却缩短', '落剑 +1，伤害提高', '伤害提高，落剑 +1，冷却缩短', '落剑 +1，伤害提高', '剑雨向前延伸为两片，每片 14 剑，伤害大幅提高'],
    stats: (lv) => ({
      dmg: at([12, 14, 15, 17, 19, 21, 23, 26], lv),
      count: at([6, 7, 8, 9, 10, 11, 12, 14], lv),
      zones: lv >= 8 ? 2 : 1,
      spread: 54,
      range: 78,
      radius: 16,
      cd: at([1.55, 1.5, 1.45, 1.4, 1.35, 1.3, 1.25, 1.18], lv),
    }),
  },
  lihuo: {
    id: 'lihuo', name: '离火环', glyph: '环', el: 'fire', maxLv: 8, proc: 0.25,
    desc: ['真火绕身疾旋，灼伤环轨上的敌人；环心与环外不受伤', '火焰 +1，伤害提高', '伤害提高，环绕扩大、旋速加快', '火焰 +1，伤害提高', '伤害提高，环绕扩大、旋速加快', '伤害提高，环绕扩大、旋速加快', '火焰 +1，环绕扩大、伤害提高', '火焰 +1，伤害大幅提高，环绕扩大'],
    stats: (lv) => ({
      dmg: at([12, 14, 16, 17, 20, 22, 24, 27], lv),
      count: at([1, 2, 2, 3, 3, 3, 4, 5], lv),
      orbit: at([45, 45, 49, 51, 55, 59, 63, 66], lv),
      /** 纵向稍压扁；火团碰撞半径与轨道同步吃范围加成。 */
      flat: 0.8,
      hitRadius: 9,
      /** 全部火团共享单敌命中间隔，不因火团数或转速重复叠伤。 */
      hitCd: 0.35,
      /** 转一圈的秒数，吃冷却缩短，最短不低于单敌命中间隔。 */
      period: at([1.8, 1.8, 1.7, 1.7, 1.6, 1.55, 1.48, 1.38], lv),
      cd: 1,
    }),
  },
  tengfu: {
    id: 'tengfu', name: '藤缚', glyph: '藤', el: 'wood', maxLv: 8, proc: 0.25,
    desc: ['荆藤绞杀并迟缓；重叠共享间隔，额外藤蔓贡献25%伤害', '伤害提高，范围微扩', '藤蔓 +1，伤害提高', '伤害提高，范围扩大', '冷却缩短，初生短暂缠足', '伤害提高，藤蔓 +1', '范围扩大，冷却缩短，伤害提高', '伤害大幅提高，范围扩大；藤蔓初生定身延长'],
    stats: (lv) => ({
      /** 每 0.5 秒一跳 */
      dmg: at([9, 11, 12, 14, 16, 18, 20, 24], lv),
      count: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      radius: at([26, 28, 28, 32, 34, 34, 38, 42], lv),
      dur: 3,
      root: lv >= 8 ? 0.6 : lv >= 5 ? 0.35 : 0,
      cd: at([2.4, 2.35, 2.3, 2.2, 2.1, 2.0, 1.9, 1.8], lv),
    }),
  },
  hanbing: {
    id: 'hanbing', name: '寒冰环', glyph: '冰', el: 'water', maxLv: 8, proc: 0,
    desc: ['周身寒气伤敌并迟缓，积累寒意；三次命中保底冰冻', '伤害提高，范围微扩', '范围扩大，冷却缩短', '伤害提高，范围扩大', '范围扩大，伤害提高，冷却缩短', '伤害提高，范围扩大，冷却缩短', '范围扩大，冷却缩短，伤害提高', '伤害提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([13, 15, 16, 19, 21, 24, 26, 30], lv),
      radius: at([52, 55, 58, 62, 66, 70, 74, 78], lv),
      slow: 1.6,
      cd: at([2.3, 2.25, 2.15, 2.1, 2.0, 1.9, 1.82, 1.75], lv),
    }),
  },
  luoshi: {
    id: 'luoshi', name: '落石', glyph: '落', el: 'earth', maxLv: 8, proc: 0,
    desc: ['延迟砸向密集敌群，震得敌人眩晕乱走；连击进阶昏厥', '伤害提高，冷却缩短', '范围扩大，伤害提高，冷却缩短', '落石 +1，伤害提高，冷却缩短', '范围扩大，伤害提高，冷却缩短', '伤害提高，眩晕延长，冷却缩短', '范围扩大，伤害提高，冷却缩短', '落石 +1，伤害大幅提高，范围扩大，眩晕延长'],
    stats: (lv) => ({
      dmg: at([26, 31, 34, 37, 41, 46, 50, 56], lv),
      radius: at([36, 38, 40, 42, 44, 46, 48, 52], lv),
      count: at([1, 1, 1, 2, 2, 2, 2, 3], lv),
      daze: at([1.5, 1.5, 1.5, 1.6, 1.6, 1.8, 1.8, 2.0], lv),
      cd: at([3.2, 3.1, 3.0, 2.85, 2.75, 2.6, 2.45, 2.3], lv),
    }),
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  ruijin: { id: 'ruijin', name: '锐金诀', glyph: '锐', el: 'metal', maxLv: 5, desc: '暴击率 +6%' },
  yanyang: { id: 'yanyang', name: '炎阳诀', glyph: '炎', el: 'fire', maxLv: 5, desc: '全部伤害 +8%' },
  changsheng: { id: 'changsheng', name: '长生诀', glyph: '生', el: 'wood', maxLv: 5, desc: '每秒回复 0.7 生命' },
  roushui: { id: 'roushui', name: '柔水诀', glyph: '柔', el: 'water', maxLv: 5, desc: '术法范围 +8%' },
  houtu: { id: 'houtu', name: '厚土诀', glyph: '厚', el: 'earth', maxLv: 5, desc: '生命上限 +12%，护甲 +1' },
  pojun: { id: 'pojun', name: '破军诀', glyph: '破', el: 'metal', maxLv: 5, needsEl: true, desc: '流血进阶为撕裂的几率 +10 个百分点/级' },
  liaoyuan: { id: 'liaoyuan', name: '燎原诀', glyph: '燎', el: 'fire', maxLv: 5, needsEl: true, desc: '点燃进阶为燃烧的几率 +10 个百分点/级；燃烧持续灼伤附近敌人' },
  fanmao: { id: 'fanmao', name: '繁茂诀', glyph: '茂', el: 'wood', maxLv: 5, needsEl: true, desc: '中毒进阶为剧毒的几率 +10 个百分点/级；剧毒造成双倍毒伤' },
  xuanming: { id: 'xuanming', name: '玄冥诀', glyph: '冥', el: 'water', maxLv: 5, needsEl: true, desc: '迟缓进阶为冰冻的几率 +10 个百分点/级' },
  zhenyue: { id: 'zhenyue', name: '镇岳诀', glyph: '镇', el: 'earth', maxLv: 5, requires: ['puppet', 'luoshi'], needsEl: true, desc: '眩晕进阶为昏厥的几率 +10 个百分点/级' },
  ningshen: { id: 'ningshen', name: '凝神诀', glyph: '凝', el: null, maxLv: 5, desc: '冷却 −4%' },
  guanri: { id: 'guanri', name: '贯日诀', glyph: '贯', el: null, maxLv: 5, desc: '每级穿透/弹射 +1（作用于飞剑、分水连弩、飞叶）', requires: ['flysword', 'crossbow', 'leaf'] },
  qingshen: { id: 'qingshen', name: '轻身诀', glyph: '轻', el: null, maxLv: 5, desc: '移动速度 +7%' },
  juling: { id: 'juling', name: '聚灵诀', glyph: '聚', el: null, maxLv: 5, desc: '吸灵范围 +25%，灵气获取 +5%' },
};

/** 总槽位数：独立自带术 + 初始六个普通格；修炼五级再加四普通格及一个大招格。 */
export const SKILL_SLOTS = 7;
export const NORMAL_SKILL_SLOTS = 10;
export const MAX_SKILL_SLOTS = 12;
export const ULTIMATES: Record<El, UltimateId> = {
  metal: 'wanjian', wood: 'senluo', water: 'canghai', fire: 'tianhuo', earth: 'kunlun',
};
