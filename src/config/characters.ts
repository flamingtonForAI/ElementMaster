import type { El } from './elements';
import type { SkillId } from './skills';

export interface Growth {
  every: number;
  stat: 'crit' | 'armor' | 'area' | 'speed' | 'cd';
  v: number;
  cap?: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  el: El;
  hp: number;
  speed: number;
  armor: number;
  startSkill: SkillId;
  /** 初始灵根加成 */
  lingen: number;
  /** 定位，一句话 */
  role: string;
  /** 天生范围、冷却缩短、暴击率、拾取范围加成 */
  area?: number;
  cdr?: number;
  crit?: number;
  pickup?: number;
  /** 浪花：暴击时向周围溅射，数值是溅射伤害占原伤害的比例 */
  critSplash?: number;
  /** 五行均衡（散人）：星图从中宫出发 */
  balanced?: boolean;
  /** 未开放角色的解锁说明 */
  unlock?: string;
  /** 身边 meleeRange 内的伤害加成 */
  meleeBonus: number;
  meleeRange: number;
  /** 局内成长：每升 every 级，stat 加 v（可选上限 cap） */
  growth: Growth[];
  bio: string;
  trait: string;
  available: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'xiao', name: '萧寒锋', title: '剑客', el: 'metal', role: '近战，高伤高甲', hp: 120, speed: 72, armor: 2,
    startSkill: 'slash', lingen: 3, meleeBonus: 0.2, meleeRange: 80,
    growth: [{ every: 5, stat: 'crit', v: 0.01 }, { every: 10, stat: 'armor', v: 1 }],
    bio: '北地剑庐弃徒，一身白衣，剑意属金。',
    trait: '近身伤害 +20%，护甲 +2。成长：每 5 级暴击 +1%，每 10 级护甲 +1。',
    available: true,
  },
  {
    id: 'zhu', name: '朱砂', title: '符师', el: 'fire', role: '法师，范围爆发', hp: 90, speed: 70, armor: 0,
    startSkill: 'talisman', lingen: 3, area: 0.15, cdr: 0.1, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 5, stat: 'area', v: 0.02 }],
    bio: '龙虎山出走的女冠，以朱砂画符，符火不灭。',
    trait: '范围 +15%，冷却 −10%，画符：火符可画成别系。成长：每 5 级范围 +2%。',
    available: true,
  },
  {
    id: 'ruan', name: '阮沧', title: '海贼', el: 'water', role: '射手，远程风筝', hp: 100, speed: 80, armor: 0,
    startSkill: 'crossbow', lingen: 3, cdr: 0.15, crit: 0.05, pickup: 0.3, critSplash: 0.4, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 5, stat: 'speed', v: 0.02 }, { every: 5, stat: 'cd', v: 0.01 }],
    bio: '东海私船的头领，水性通神，人称“浪里蛟”。',
    trait: '攻速 +15%，暴击 +5%，拾取 +30%。浪花：暴击溅起水花。成长：每 5 级移速 +2%、冷却 −1%。',
    available: true,
  },
  // 以下角色还没做，先在选角界面占位
  {
    id: 'qingdai', name: '青黛', title: '药师', el: 'wood', role: '续航，持续伤害与回复', hp: 100, speed: 72, armor: 0,
    startSkill: 'leaf', lingen: 3, meleeBonus: 0, meleeRange: 0,
    growth: [],
    bio: '悬壶济世的游医，药囊里的草木也能杀人。',
    trait: '回春：持续回复，持续伤害更强。',
    unlock: '通关第 3 关解锁',
    available: false,
  },
  {
    id: 'moheng', name: '墨衡', title: '傀儡师', el: 'earth', role: '召唤，傀儡在前本体在后', hp: 85, speed: 66, armor: 1,
    startSkill: 'stonespike', lingen: 3, meleeBonus: 0, meleeRange: 0,
    growth: [],
    bio: '名取《列子》里造傀儡的偃师，石傀儡替他挡在阵前。',
    trait: '傀儡继承本体护甲和本命加成；本体脆、移速慢。',
    unlock: '通关第 6 关解锁',
    available: false,
  },
  {
    id: 'xuanyi', name: '玄一', title: '五行散人', el: 'earth', role: '轮转，五系兼修', hp: 100, speed: 72, armor: 1, balanced: true,
    startSkill: 'fireball', lingen: 0, meleeBonus: 0, meleeRange: 0,
    growth: [],
    bio: '不属任何一系的云游散人，五行在他身上轮流做主。',
    trait: '自带周天心法；星图从中宫出发，离五系一样近。',
    unlock: '其余 5 位角色各自通关第 10 关后解锁',
    available: false,
  },
];
