import type { El } from './elements';
import type { SkillId } from './skills';

export interface Growth {
  every: number;
  /** puppetHp / puppetDmg 傀儡生命、伤害倍率，lowLingen 给灵根最低的元素 +v */
  /** sigDmg 专属术伤害倍率（满级后还能继续涨） */
  stat: 'crit' | 'armor' | 'area' | 'speed' | 'cd' | 'regen' | 'puppetHp' | 'puppetDmg' | 'lowLingen' | 'sigDmg' | 'dmg';
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
  /** 天生每秒回复 */
  regen?: number;
  /** 敌人身上的中毒、灼烧伤害加成 */
  dotBonus?: number;
  /** 本体的术伤害倍率（傀儡师：输出靠傀儡，本体的术只是给傀儡换外壳） */
  ownDmg?: number;
  /** 五行均衡（散人）：星图从中宫出发，升级选项不按元素加权，周天轮转 */
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

/**
 * 初始生命参照 DND 的生命骰：战士 d10、游侠/游荡者 d8、法师 d6，按 100 / 80 / 70 落地。
 * 三个初始角色都是进攻型，容错靠走位和局外成长，不靠血厚；药师、散人 85；傀儡师本体最脆，由傀儡顶在前面。
 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'xiao', name: '萧寒锋', title: '剑客', el: 'metal', role: '近战，高伤中甲', hp: 100, speed: 72, armor: 1,
    startSkill: 'slash', lingen: 3, meleeBonus: 0.2, meleeRange: 80,
    growth: [{ every: 4, stat: 'sigDmg', v: 0.04 }, { every: 5, stat: 'crit', v: 0.01 }, { every: 10, stat: 'armor', v: 1 }],
    bio: '北地剑庐弃徒，一身白衣，剑意属金。',
    trait: '近身伤害 +20%，护甲 +1。成长：每 4 级剑气斩伤害 +4%，每 5 级暴击 +1%，每 10 级护甲 +1。',
    available: true,
  },
  {
    id: 'zhu', name: '朱砂', title: '符师', el: 'fire', role: '法师，范围爆发，低甲', hp: 70, speed: 70, armor: 0,
    startSkill: 'talisman', lingen: 3, area: 0.15, cdr: 0.1, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 4, stat: 'sigDmg', v: 0.04 }, { every: 5, stat: 'area', v: 0.02 }],
    bio: '龙虎山出走的女冠，以朱砂画符，符火不灭。',
    trait: '范围 +15%，冷却 −10%，画符：火符可画成别系。成长：每 4 级火符伤害 +4%，每 5 级范围 +2%。',
    available: true,
  },
  {
    id: 'ruan', name: '阮沧', title: '海贼', el: 'water', role: '射手，远程风筝', hp: 80, speed: 76, armor: 0,
    startSkill: 'crossbow', lingen: 3, cdr: 0.15, crit: 0.05, pickup: 0.3, critSplash: 0.4, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 4, stat: 'sigDmg', v: 0.04 }, { every: 10, stat: 'speed', v: 0.02 }, { every: 5, stat: 'cd', v: 0.01 }],
    bio: '东海私船的头领，水性通神，人称“浪里蛟”。',
    trait: '攻速 +15%，暴击 +5%，拾取 +30%。远射：弩箭越远越痛。浪花：暴击溅起水花。成长：每 4 级连弩伤害 +4%，每 5 级冷却 −1%，每 10 级移速 +2%。',
    available: true,
  },
  {
    id: 'qingdai', name: '青黛', title: '药师', el: 'wood', role: '续航，持续伤害与回复', hp: 85, speed: 72, armor: 0,
    startSkill: 'duwu', lingen: 3, regen: 0.5, dotBonus: 0.3, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 4, stat: 'sigDmg', v: 0.04 }, { every: 5, stat: 'regen', v: 0.1 }],
    bio: '悬壶济世的游医，药囊里的草木也能杀人。',
    trait: '回春：每秒回复 0.5，敌人身上的中毒、灼烧伤害 +30%。成长：每 4 级毒雾毒性 +4%，每 5 级回复 +0.1/s。',
    available: true,
  },
  {
    id: 'moheng', name: '墨衡', title: '傀儡师', el: 'earth', role: '召唤，傀儡在前本体在后', hp: 65, speed: 66, armor: 1,
    startSkill: 'puppet', lingen: 3, ownDmg: 0.5, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 5, stat: 'puppetHp', v: 0.05 }, { every: 5, stat: 'puppetDmg', v: 0.06 }],
    bio: '名取《列子》偃师，石傀儡替他挡在阵前。',
    trait: '傀儡继承护甲和本命加成；本体脆、慢，自己的术伤害 −50%。灌注：别系的术给傀儡换外壳。成长：每 5 级傀儡生命 +5%、伤害 +6%。',
    available: true,
  },
  {
    id: 'xuanyi', name: '玄一', title: '五行散人', el: 'earth', role: '轮转，五系兼修', hp: 85, speed: 72, armor: 1, balanced: true,
    startSkill: 'fireball', lingen: 0, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 4, stat: 'dmg', v: 0.02 }, { every: 10, stat: 'lowLingen', v: 1 }],
    bio: '云游散人，五行在他身上轮流做主。',
    trait: '周天：每 30 秒按相生轮转一系，该系伤害 +25%。升级选项五系均等，星图从中宫出发。成长：每 4 级全部伤害 +2%，每 10 级最低灵根 +1。',
    available: true,
  },
];
