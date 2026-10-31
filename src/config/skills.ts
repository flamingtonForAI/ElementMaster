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
  /** 最右大格专用；自带术和十项普通术/心法全部满级后解锁。 */
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

/** 连续两次大招至少相隔十秒战斗时间，包含退射等冷却计时加速。 */
export const ULTIMATE_MIN_CD = 10;
/** 通用减冷却最多 75%；剑心、退射仍按自身规则乘算，大招另有十秒下限。 */
export const MIN_CD_MULT = 0.25;

export const SKILLS: Record<SkillId, SkillDef> = {
  fuchen: {
    id: 'fuchen', name: '清风拂尘', glyph: '尘', el: null, maxLv: 8, proc: 0, exclusive: 'xuanyi',
    desc: ['拂尘自动扫向近敌，前方扇形尘丝造成伤害并击退', '伤害提高，扫击距离增加', '扫击扇面扩大，冷却缩短', '伤害提高，击退增强', '扫击扇面扩大，冷却缩短', '伤害提高，距离增加，冷却缩短', '扫击角度与距离扩大', '伤害大幅提高，扇面扩大、击退增强，冷却缩短'],
    stats: (lv) => ({
      dmg: at([18, 22, 22, 28, 28, 34, 34, 44], lv),
      // 自动瞄准、无属性的优势换取较窄扇面；距离略长于剑气，低于全周冰环。
      range: at([48, 50, 54, 54, 58, 62, 66, 68], lv),
      arc: at([120, 120, 130, 130, 140, 140, 150, 160], lv),
      cd: at([1.25, 1.25, 1.2, 1.2, 1.15, 1.1, 1.1, 1.05], lv),
      kb: at([30, 30, 30, 40, 40, 40, 40, 50], lv),
    }),
  },
  wanjian: {
    id: 'wanjian', name: '万剑归宗', glyph: '宗', el: 'metal', maxLv: 1, proc: 1, ultimate: true,
    desc: ['三轮剑阵横扫周围大范围敌人，每轮造成 120 金伤并积累流血；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 120, radius: 260, count: 3, interval: 0.45, cd: 15 }),
  },
  senluo: {
    id: 'senluo', name: '森罗万象', glyph: '森', el: 'wood', maxLv: 1, proc: 1, ultimate: true,
    desc: ['四次森罗脉动，每次造成 60 木伤、施毒并缠身 2 秒；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 60, radius: 230, count: 4, interval: 0.8, root: 2, cd: 15 }),
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
    desc: ['两次山岳震荡，每次造成 160 土伤并击退、定身 2.5 秒（Boss 改迟缓）；固定 1 级；基础冷却 15 秒，加成后最低 10 秒'],
    stats: () => ({ dmg: 160, radius: 240, count: 2, interval: 0.8, root: 2.5, kb: 90, cd: 15 }),
  },
  slash: {
    id: 'slash', name: '剑气斩', glyph: '斩', el: 'metal', maxLv: 8, proc: 0.3, exclusive: 'xiao',
    desc: ['向面朝方向挥出扇形剑气', '伤害提高', '范围扩大，冷却缩短', '伤害提高，冷却缩短', '前后双斩，双向各斩出一道剑气波', '伤害提高，范围扩大，冷却缩短', '范围扩大', '伤害大幅提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([18, 22, 22, 27, 27, 33, 33, 40], lv),
      range: at([46, 46, 50, 50, 50, 56, 62, 64], lv),
      cd: at([0.95, 0.95, 0.9, 0.85, 0.85, 0.8, 0.8, 0.75], lv),
      arc: 160,
      back: lv >= 5 ? 1 : 0,
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
    id: 'crossbow', name: '分水连弩', glyph: '弩', el: 'water', maxLv: 8, proc: 0.15, exclusive: 'ruan',
    desc: ['朝最近的敌人连射三箭，射程最远，可贯穿 1 个', '伤害提高', '贯穿 +1；命中溅起小水花，对周围敌人造成 25% 伤害', '伤害提高，每轮 +1 箭', '轮流瞄准附近最多 3 个敌人；水花扩大、伤害增至 35%，冷却缩短', '伤害提高，贯穿 +1，冷却缩短', '伤害提高，每轮 +1 箭，水花扩大', '水花进一步扩大、伤害增至 45%，并迟缓周围敌人；伤害提高，冷却缩短'],
    stats: (lv) => ({
      dmg: at([10, 12, 12, 14, 14, 15, 17, 19], lv),
      shots: at([3, 3, 3, 4, 4, 4, 5, 5], lv),
      pierce: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      cd: at([1.3, 1.3, 1.3, 1.3, 1.2, 1.1, 1.1, 1.0], lv),
      targets: lv >= 5 ? 3 : 1,
      splash: at([0, 0, 0.25, 0.25, 0.35, 0.35, 0.35, 0.45], lv),
      splashRadius: at([0, 0, 22, 22, 28, 28, 32, 36], lv),
      splashSlow: lv >= 8 ? 0.8 : 0,
    }),
  },
  duwu: {
    id: 'duwu', name: '毒雾', glyph: '雾', el: 'wood', maxLv: 8, proc: 0, exclusive: 'qingdai',
    desc: ['脚下环绕一圈毒雾，进入的敌人中毒，离开后还会再毒一阵', '毒性增强', '毒雾扩大', '毒性增强，离开后毒得更久', '毒性增强，毒雾扩大', '毒雾扩大', '毒性增强', '毒雾扩大，毒性大幅增强，离开后毒得更久；雾里的敌人迟缓'],
    stats: (lv) => ({
      dps: at([16, 19, 19, 22, 26, 26, 30, 38], lv),
      radius: at([48, 48, 56, 56, 62, 68, 68, 78], lv),
      /** 离开毒雾后中毒还持续的秒数 */
      linger: at([2, 2, 2, 3, 3, 3, 3, 4], lv),
      slow: lv >= 8 ? 1 : 0,
      cd: 0.5,
    }),
  },
  puppet: {
    id: 'puppet', name: '石傀儡', glyph: '傀', el: 'earth', maxLv: 8, proc: 0.3, exclusive: 'moheng',
    desc: ['召唤石傀儡跟随，扑向最近的敌人砸一圈，并把周围敌人的仇恨吸过去；打碎后会重新捏出来，经过的经验球会飞向你', '傀儡 +1', '生命、伤害提高', '傀儡 +1，扑击范围扩大', '重塑加快，生命、伤害提高', '生命、伤害提高，扑击范围扩大', '生命、伤害提高', '合成一尊巨傀并补充两尊普通傀儡，巨傀攻击带震地；伤害提高，扑击范围扩大'],
    stats: (lv) => ({
      count: at([1, 2, 2, 3, 3, 3, 3, 3], lv),
      hp: at([60, 60, 72, 72, 84, 96, 110, 110], lv),
      dmg: at([16, 16, 19, 19, 21, 23, 25, 26], lv),
      /** 扑击落点周围一圈都挨打 */
      cleave: at([14, 14, 14, 16, 16, 18, 18, 20], lv),
      atkCd: 0.75,
      cd: at([4, 4, 4, 4, 3, 3, 3, 3], lv),
      giant: lv >= 8 ? 1 : 0,
      /** 早成巨傀的震地威力逐级长到普通满级巨傀，避免 Lv5 直接获得满额倍率。 */
      giantDmg: at([1.75, 1.75, 1.75, 1.75, 1.75, 2, 2.25, 2.5], lv),
    }),
  },
  flysword: {
    id: 'flysword', name: '飞剑', glyph: '剑', el: 'metal', maxLv: 8, proc: 0.25,
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
      radius: at([38, 38, 46, 46, 46, 52, 52, 58], lv),
      count: at([1, 1, 1, 2, 2, 2, 3, 3], lv),
      cd: at([2.2, 2.2, 2.2, 2.2, 2.15, 2.1, 2.05, 2.0], lv),
    }),
  },
  leaf: {
    id: 'leaf', name: '飞叶', glyph: '叶', el: 'wood', maxLv: 8, proc: 0.25,
    desc: ['飞叶追向近敌，命中后弹向其他敌人，同一片不重复命中', '弹射 +1', '伤害提高', '飞叶 +1', '弹射 +2', '伤害提高', '冷却缩短', '飞叶 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([8, 8, 11, 11, 11, 14, 14, 17], lv),
      bounces: at([3, 4, 4, 4, 6, 6, 6, 6], lv),
      count: at([1, 1, 1, 2, 2, 2, 2, 3], lv),
      cd: at([1.4, 1.4, 1.35, 1.3, 1.25, 1.2, 1.0, 1.0], lv),
    }),
  },
  waterdragon: {
    id: 'waterdragon', name: '水龙', glyph: '龙', el: 'water', maxLv: 8, proc: 0,
    desc: ['水龙贯穿一线敌人并减速', '伤害提高', '水龙变粗', '减速延长', '伤害提高', '双龙并行，通路加宽；每条造成单龙 75% 伤害', '水龙变粗，伤害提高', '冷却缩短，伤害提高'],
    stats: (lv) => ({
      dmg: at([16, 21, 21, 21, 27, 27, 33, 38], lv),
      width: at([7, 7, 9, 9, 9, 9, 11, 11], lv),
      slow: at([1.2, 1.2, 1.2, 2.0, 2.0, 2.0, 2.0, 2.0], lv),
      count: at([1, 1, 1, 1, 1, 2, 2, 2], lv),
      twinDmg: 0.75,
      cd: at([2.4, 2.4, 2.3, 2.2, 2.1, 2.0, 1.9, 1.6], lv),
    }),
  },
  stonespike: {
    // 保留内部 id，兼容构筑、存档和升级池。
    id: 'stonespike', name: '地脉刺', glyph: '脉', el: 'earth', maxLv: 8, proc: 0,
    desc: ['沿朝向逐段裂地突刺，将敌人向前推开、腾出通路；每轮对同一敌人只伤害和击退一次，精英击退减弱，Boss 不受击退', '展开为锥形，岩刺 +1 排，延伸更远', '锥形展开角度扩大，伤害提高', '锥形展开角度扩大，击退增强', '锥形展开角度扩大，岩刺 +1 排，延伸更远', '锥形展开角度扩大，伤害提高，岩刺变宽', '锥形展开角度扩大，岩刺 +1 排，延伸更远', '锥形展开至 48°，岩刺 +1 排，延伸更远，伤害提高'],
    stats: (lv) => ({
      dmg: at([20, 20, 26, 26, 26, 32, 32, 40], lv),
      count: at([5, 6, 6, 6, 7, 7, 8, 9], lv),
      range: at([112, 136, 136, 136, 160, 160, 184, 208], lv),
      arc: at([0, 12, 18, 24, 30, 36, 42, 48], lv),
      radius: at([14, 14, 14, 14, 14, 17, 17, 18], lv),
      // 通用击退以 3 倍初速、指数 9 衰减：静止普通敌人约推出 50→65 像素。
      kb: lv >= 4 ? 195 : 150,
      cd: at([2.0, 1.95, 1.9, 1.85, 1.8, 1.7, 1.6, 1.5], lv),
    }),
  },
  jinzhen: {
    // 保留内部 id，兼容已有构筑与存档。
    id: 'jinzhen', name: '流金剑雨', glyph: '雨', el: 'metal', maxLv: 8, proc: 0.18,
    desc: ['锁定施放时的朝向，剑雨以 45° 斜落前方大片区域，不追踪敌人', '伤害提高', '落剑 +2', '伤害提高，冷却缩短', '落剑 +2', '伤害提高，冷却缩短', '落剑 +2', '剑雨向前延伸为两片，每片落剑 +2，伤害提高'],
    stats: (lv) => ({
      dmg: at([10, 12, 12, 14, 14, 16, 16, 18], lv),
      count: at([6, 6, 8, 8, 10, 10, 12, 14], lv),
      zones: lv >= 8 ? 2 : 1,
      spread: 54,
      range: 78,
      radius: 16,
      cd: at([1.6, 1.6, 1.6, 1.5, 1.5, 1.4, 1.4, 1.3], lv),
    }),
  },
  lihuo: {
    id: 'lihuo', name: '离火环', glyph: '环', el: 'fire', maxLv: 8, proc: 0.25,
    desc: ['火焰绕身旋转，灼伤碰到的敌人', '火焰 +1', '伤害提高，环绕扩大、转得更快', '火焰 +1', '伤害提高，环绕扩大、转得更快', '伤害提高', '火焰 +1，环绕扩大、转得更快', '火焰 +1，伤害提高'],
    stats: (lv) => ({
      dmg: at([12, 12, 15, 15, 18, 20, 20, 24], lv),
      count: at([1, 2, 2, 3, 3, 3, 4, 5], lv),
      orbit: at([48, 48, 52, 52, 58, 58, 64, 68], lv),
      /** 纵向稍压扁；火团碰撞半径与轨道同步吃范围加成。 */
      flat: 0.8,
      hitRadius: 9,
      /** 全部火团共享单敌命中间隔，不因火团数或转速重复叠伤。 */
      hitCd: 0.35,
      /** 转一圈的秒数，吃冷却缩短，最短不低于单敌命中间隔。 */
      period: at([1.8, 1.8, 1.7, 1.7, 1.6, 1.6, 1.5, 1.4], lv),
      cd: 1,
    }),
  },
  tengfu: {
    id: 'tengfu', name: '藤缚', glyph: '藤', el: 'wood', maxLv: 8, proc: 0.2,
    desc: ['敌人脚下长出藤蔓，持续伤害并迟缓；重叠区域不叠伤', '伤害提高', '藤蔓 +1', '伤害提高，范围扩大', '冷却缩短', '伤害提高，藤蔓 +1', '范围扩大，冷却缩短', '伤害大幅提高，范围扩大；刚长出时把敌人定住'],
    stats: (lv) => ({
      /** 每 0.5 秒一跳 */
      dmg: at([8, 10, 10, 12, 12, 15, 15, 18], lv),
      count: at([1, 1, 2, 2, 2, 3, 3, 3], lv),
      radius: at([26, 26, 26, 30, 30, 30, 34, 38], lv),
      dur: 3,
      root: lv >= 8 ? 0.5 : 0,
      cd: at([2.4, 2.4, 2.4, 2.4, 2.2, 2.2, 2.0, 2.0], lv),
    }),
  },
  hanbing: {
    id: 'hanbing', name: '寒冰环', glyph: '冰', el: 'water', maxLv: 8, proc: 0,
    desc: ['周身迸发一圈寒气，冻伤并迟缓周围敌人；连续命中有几率冰冻，积累 3 次保底冰冻', '伤害提高', '范围扩大，冷却缩短', '伤害提高', '范围扩大', '伤害提高，范围扩大，冷却缩短', '冷却缩短', '伤害大幅提高，范围扩大，冷却缩短'],
    stats: (lv) => ({
      dmg: at([14, 17, 17, 20, 20, 24, 24, 30], lv),
      radius: at([56, 56, 62, 62, 68, 74, 74, 84], lv),
      slow: 1.5,
      cd: at([2.2, 2.2, 2.1, 2.1, 2.1, 1.9, 1.8, 1.7], lv),
    }),
  },
  luoshi: {
    id: 'luoshi', name: '落石', glyph: '落', el: 'earth', maxLv: 8, proc: 0,
    desc: ['巨石砸向敌人最密的地方，使敌人眩晕乱走；连续命中可进阶打昏', '伤害提高', '范围扩大，冷却缩短', '伤害提高，冷却缩短', '落石 +1，范围扩大', '伤害提高，眩晕延长，冷却缩短', '范围扩大，冷却缩短', '伤害大幅提高，范围扩大，眩晕延长'],
    stats: (lv) => ({
      dmg: at([24, 30, 30, 36, 36, 42, 42, 50], lv),
      radius: at([36, 36, 40, 40, 44, 44, 48, 50], lv),
      count: at([1, 1, 1, 1, 2, 2, 2, 2], lv),
      daze: at([1.5, 1.5, 1.5, 1.5, 1.5, 1.8, 1.8, 2.0], lv),
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
  pojun: { id: 'pojun', name: '破军诀', glyph: '破', el: 'metal', maxLv: 5, needsEl: true, desc: '流血进阶为撕裂的几率 +10 个百分点/级' },
  liaoyuan: { id: 'liaoyuan', name: '燎原诀', glyph: '燎', el: 'fire', maxLv: 5, needsEl: true, desc: '点燃进阶为燃烧的几率 +10 个百分点/级；燃烧持续灼伤附近敌人' },
  fanmao: { id: 'fanmao', name: '繁茂诀', glyph: '茂', el: 'wood', maxLv: 5, needsEl: true, desc: '中毒进阶为剧毒的几率 +10 个百分点/级；剧毒造成双倍毒伤' },
  xuanming: { id: 'xuanming', name: '玄冥诀', glyph: '冥', el: 'water', maxLv: 5, needsEl: true, desc: '迟缓进阶为冰冻的几率 +10 个百分点/级' },
  zhenyue: { id: 'zhenyue', name: '镇岳诀', glyph: '镇', el: 'earth', maxLv: 5, requires: ['puppet', 'luoshi'], needsEl: true, desc: '眩晕进阶为打昏的几率 +10 个百分点/级' },
  ningshen: { id: 'ningshen', name: '凝神诀', glyph: '凝', el: null, maxLv: 5, desc: '冷却 −4%' },
  guanri: { id: 'guanri', name: '贯日诀', glyph: '贯', el: null, maxLv: 5, desc: '第 1、3、5 级：穿透 +1（只对能穿透的投射物）', requires: ['flysword', 'crossbow'] },
  qingshen: { id: 'qingshen', name: '轻身诀', glyph: '轻', el: null, maxLv: 5, desc: '移动速度 +7%' },
  juling: { id: 'juling', name: '聚灵诀', glyph: '聚', el: null, maxLv: 5, desc: '拾取范围 +25%，经验 +5%' },
};

/** 总槽位数：独立自带术 + 初始六个普通格；修炼五级再加四普通格及一个大招格。 */
export const SKILL_SLOTS = 7;
export const NORMAL_SKILL_SLOTS = 10;
export const MAX_SKILL_SLOTS = 12;
export const ULTIMATES: Record<El, UltimateId> = {
  metal: 'wanjian', wood: 'senluo', water: 'canghai', fire: 'tianhuo', earth: 'kunlun',
};
