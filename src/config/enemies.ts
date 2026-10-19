import type { El } from './elements';
import type { Inflict } from './status';

export type Behavior = 'walk' | 'regen' | 'explode' | 'charge' | 'spit' | 'burrow' | 'boss_wolf' | 'boss_tree' | 'boss_ape' | 'boss_bird' | 'boss_xingtian';

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
  /** spit 行为发射的弹丸贴图，不填为毒囊 */
  shot?: string;
  /** charge 冲刺时在身后留火（赤狐） */
  trail?: boolean;
  /** 死后几秒原地复活，被火系击杀则不会（残兵）；复活的不再掉经验 */
  revive?: number;
  /** Boss 第一次被打倒时带这么多比例的生命复起，被火系击杀则不会（刑天） */
  rise?: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
  shiyong: { id: 'shiyong', name: '石俑', el: 'earth', tex: 'en_shiyong', hp: 30, speed: 26, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'walk', inflict: { kind: 'stun', chance: 0.5 } },
  tengguai: { id: 'tengguai', name: '藤怪', el: 'wood', tex: 'en_tengguai', hp: 18, speed: 34, dmg: 4, armor: 0, radius: 7, xp: 1, behavior: 'regen', regen: 2, inflict: { kind: 'poison', chance: 0.12, dps: 1.5, dur: 4 } },
  shuigui: { id: 'shuigui', name: '水鬼', el: 'water', tex: 'en_shuigui', hp: 10, speed: 50, dmg: 3, armor: 0, radius: 6, xp: 1, behavior: 'walk', inflict: { kind: 'slow', chance: 0.3 } },
  huoya: { id: 'huoya', name: '火鸦', el: 'fire', tex: 'en_huoya', hp: 8, speed: 52, dmg: 4, armor: 0, radius: 6, xp: 1, behavior: 'explode', inflict: { kind: 'burn', chance: 0.3, dps: 1.5 } },
  tiejia: { id: 'tiejia', name: '铁甲兵', el: 'metal', tex: 'en_tiejia', hp: 26, speed: 30, dmg: 6, armor: 3, radius: 8, xp: 2, behavior: 'charge', inflict: { kind: 'bleed', chance: 0.4, dps: 1.5 } },
  zhushe: { id: 'zhushe', name: '竹叶青', el: 'wood', tex: 'en_zhushe', hp: 14, speed: 58, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', inflict: { kind: 'poison', chance: 0.3, dps: 2, dur: 4 } },
  zhangchan: { id: 'zhangchan', name: '瘴蟾', el: 'earth', tex: 'en_zhangchan', hp: 24, speed: 30, dmg: 4, armor: 1, radius: 7, xp: 2, behavior: 'spit', inflict: { kind: 'poison', chance: 0.4, dps: 2, dur: 4 } },
  shanxiao: { id: 'shanxiao', name: '山魈', el: 'earth', tex: 'en_shanxiao', hp: 22, speed: 40, dmg: 5, armor: 0, radius: 7, xp: 2, behavior: 'spit', shot: 'ep_rock', inflict: { kind: 'stun', chance: 0.35 } },
  chuanshan: { id: 'chuanshan', name: '穿山甲', el: 'earth', tex: 'en_chuanshan', hp: 34, speed: 30, dmg: 7, armor: 2, radius: 7, xp: 2, behavior: 'burrow', inflict: { kind: 'stun', chance: 0.4 } },
  chihu: { id: 'chihu', name: '赤狐', el: 'fire', tex: 'en_chihu', hp: 14, speed: 56, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', trail: true, inflict: { kind: 'burn', chance: 0.3, dps: 1.5 } },
  huojing: { id: 'huojing', name: '火精', el: 'fire', tex: 'en_huojing', hp: 16, speed: 34, dmg: 5, armor: 0, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_fire', inflict: { kind: 'burn', chance: 0.35, dps: 1.5 } },
  canbing: { id: 'canbing', name: '残兵', el: 'metal', tex: 'en_canbing', hp: 22, speed: 30, dmg: 6, armor: 2, radius: 7, xp: 2, behavior: 'walk', revive: 5, inflict: { kind: 'bleed', chance: 0.3, dps: 1.5 } },
  feilian: { id: 'feilian', name: '飞镰', el: 'metal', tex: 'en_feilian', hp: 18, speed: 38, dmg: 5, armor: 1, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_blade', inflict: { kind: 'bleed', chance: 0.35, dps: 1.5 } },
  langyao: { id: 'langyao', name: '狼妖', el: 'metal', tex: 'boss_langyao', hp: 2600, speed: 46, dmg: 16, armor: 2, radius: 18, xp: 100, behavior: 'boss_wolf', boss: true, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  shuyao: { id: 'shuyao', name: '千年树妖', el: 'wood', tex: 'boss_shuyao', hp: 5400, speed: 30, dmg: 18, armor: 2, radius: 24, xp: 150, behavior: 'boss_tree', boss: true, regen: 4, inflict: { kind: 'poison', chance: 0.65, dps: 4, dur: 5 } },
  shanxiaowang: { id: 'shanxiaowang', name: '山魈王', el: 'earth', tex: 'boss_shanxiao', hp: 5000, speed: 40, dmg: 18, armor: 3, radius: 20, xp: 150, behavior: 'boss_ape', boss: true, inflict: { kind: 'stun', chance: 0.5 } },
  bifang: { id: 'bifang', name: '毕方', el: 'fire', tex: 'boss_bifang', hp: 5000, speed: 48, dmg: 18, armor: 2, radius: 20, xp: 150, behavior: 'boss_bird', boss: true, inflict: { kind: 'burn', chance: 0.5, dps: 3 } },
  xingtian: { id: 'xingtian', name: '刑天', el: 'metal', tex: 'boss_xingtian', hp: 5200, speed: 34, dmg: 20, armor: 4, radius: 22, xp: 150, behavior: 'boss_xingtian', boss: true, rise: 0.35, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
};
