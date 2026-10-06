import type { El } from './elements';
import type { SkillId } from './skills';

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
  bio: string;
  trait: string;
  available: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'xiao', name: '萧寒锋', title: '剑客', el: 'metal', hp: 120, speed: 72, armor: 2,
    startSkill: 'slash', lingen: 3, meleeBonus: 0.2, meleeRange: 80,
    bio: '北地剑庐弃徒，一身白衣，剑意属金。',
    trait: '身边 80 内伤害 +20%，护甲 +2。剑气斩朝移动方向挥出。',
    available: true,
  },
  {
    id: 'zhu', name: '朱砂', title: '符师', el: 'fire', hp: 90, speed: 70, armor: 0,
    startSkill: 'fireball', lingen: 3, meleeBonus: 0, meleeRange: 0,
    bio: '龙虎山出走的女冠，以朱砂画符，符火不灭。',
    trait: '第二阶段开放',
    available: false,
  },
  {
    id: 'ruan', name: '阮沧', title: '海贼', el: 'water', hp: 100, speed: 80, armor: 0,
    startSkill: 'waterdragon', lingen: 3, meleeBonus: 0, meleeRange: 0,
    bio: '东海私船的头领，水性通神，人称“浪里蛟”。',
    trait: '第二阶段开放',
    available: false,
  },
];
