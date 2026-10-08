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
    id: 'xiao', name: '萧寒锋', title: '剑客', el: 'metal', hp: 120, speed: 72, armor: 2,
    startSkill: 'slash', lingen: 3, meleeBonus: 0.2, meleeRange: 80,
    growth: [{ every: 5, stat: 'crit', v: 0.01 }, { every: 10, stat: 'armor', v: 1 }],
    bio: '北地剑庐弃徒，一身白衣，剑意属金。',
    trait: '近身伤害 +20%，护甲 +2。成长：每 5 级暴击 +1%，每 10 级护甲 +1。',
    available: true,
  },
  {
    id: 'zhu', name: '朱砂', title: '符师', el: 'fire', hp: 90, speed: 70, armor: 0,
    startSkill: 'fireball', lingen: 3, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 5, stat: 'area', v: 0.02 }],
    bio: '龙虎山出走的女冠，以朱砂画符，符火不灭。',
    trait: '第二阶段开放',
    available: false,
  },
  {
    id: 'ruan', name: '阮沧', title: '海贼', el: 'water', hp: 100, speed: 80, armor: 0,
    startSkill: 'waterdragon', lingen: 3, meleeBonus: 0, meleeRange: 0,
    growth: [{ every: 5, stat: 'speed', v: 0.02 }, { every: 5, stat: 'cd', v: 0.01 }],
    bio: '东海私船的头领，水性通神，人称“浪里蛟”。',
    trait: '第二阶段开放',
    available: false,
  },
];
