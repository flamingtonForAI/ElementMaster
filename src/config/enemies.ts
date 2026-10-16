import type { El } from './elements';
import type { Inflict } from './status';

export type Behavior = 'walk' | 'regen' | 'explode' | 'charge' | 'spit' | 'boss_wolf' | 'boss_tree';

export interface EnemyDef {
  id: string;
  name: string;
  el: El;
  tex: string;
  hp: number;
  speed: number;
  dmg: number;
  armor: number;
  radius: number;
  xp: number;
  behavior: Behavior;
  regen?: number;
  boss?: boolean;
  /** 攻击附带的异常 */
  inflict?: Inflict;
  /** 覆盖按元素给的暴击率（ENEMY_CRIT） */
  crit?: number;
  /** 暴击倍率，不填用 ENEMY_CRIT_DMG */
  critDmg?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  shiyong: { id: 'shiyong', name: '石俑', el: 'earth', tex: 'en_shiyong', hp: 30, speed: 26, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'walk', inflict: { kind: 'stun', chance: 0.5 } },
  tengguai: { id: 'tengguai', name: '藤怪', el: 'wood', tex: 'en_tengguai', hp: 18, speed: 34, dmg: 4, armor: 0, radius: 7, xp: 1, behavior: 'regen', regen: 2, inflict: { kind: 'poison', chance: 0.12, dps: 1.5, dur: 4 } },
  shuigui: { id: 'shuigui', name: '水鬼', el: 'water', tex: 'en_shuigui', hp: 10, speed: 50, dmg: 3, armor: 0, radius: 6, xp: 1, behavior: 'walk', inflict: { kind: 'slow', chance: 0.3 } },
  huoya: { id: 'huoya', name: '火鸦', el: 'fire', tex: 'en_huoya', hp: 8, speed: 52, dmg: 4, armor: 0, radius: 6, xp: 1, behavior: 'explode', inflict: { kind: 'burn', chance: 0.3, dps: 1.5 } },
  tiejia: { id: 'tiejia', name: '铁甲兵', el: 'metal', tex: 'en_tiejia', hp: 26, speed: 30, dmg: 6, armor: 3, radius: 8, xp: 2, behavior: 'charge', inflict: { kind: 'flaw', chance: 0.4 } },
  zhushe: { id: 'zhushe', name: '竹叶青', el: 'wood', tex: 'en_zhushe', hp: 14, speed: 58, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', inflict: { kind: 'poison', chance: 0.3, dps: 2, dur: 4 } },
  zhangchan: { id: 'zhangchan', name: '瘴蟾', el: 'earth', tex: 'en_zhangchan', hp: 24, speed: 30, dmg: 4, armor: 1, radius: 7, xp: 2, behavior: 'spit', inflict: { kind: 'poison', chance: 0.4, dps: 2, dur: 4 } },
  langyao: { id: 'langyao', name: '狼妖', el: 'metal', tex: 'boss_langyao', hp: 2600, speed: 46, dmg: 16, armor: 2, radius: 18, xp: 100, behavior: 'boss_wolf', boss: true, inflict: { kind: 'flaw', chance: 0.5 } },
  shuyao: { id: 'shuyao', name: '千年树妖', el: 'wood', tex: 'boss_shuyao', hp: 5400, speed: 30, dmg: 18, armor: 2, radius: 24, xp: 150, behavior: 'boss_tree', boss: true, regen: 4, inflict: { kind: 'poison', chance: 0.65, dps: 4, dur: 5 } },
};
