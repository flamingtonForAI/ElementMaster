import type { El } from './elements';
import type { Inflict } from './status';

export type Behavior = 'walk' | 'regen' | 'explode' | 'charge' | 'spit' | 'burrow' | 'boss_wolf' | 'boss_tree' | 'boss_ape' | 'boss_bird' | 'boss_xingtian' | 'boss_snake';

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
  /** charge 冲刺时在身后留下减速的水洼（蛟） */
  puddle?: boolean;
  /** 死后几秒原地复活，被火系击杀则不会（残兵）；复活的不再掉经验 */
  revive?: number;
  /** Boss 第一次被打倒时带这么多比例的生命复起，被火系击杀则不会（刑天） */
  rise?: number;
}

/**
 * 后期关卡给敌人加的手段（按关卡在 LevelDef.tricks 里开，前几关的同一种怪不受影响）：
 * - lob：吐弹改成抛射，落点先预警，落地按元素留东西（火留余火、水留水洼、木土留毒气）
 * - quake：贴近时停下蓄力震地，脚下一圈攒震慑（石俑）
 * - formation：列阵，周围的妖物护甲 +armor（铁甲兵），脚下一圈可见的阵环
 * - roots：隔着距离在玩家脚下催生缠根，踩上去迟缓（藤怪）
 */
export type Trick = 'lob' | 'quake' | 'formation' | 'roots';

export const TRICKS = {
  /** 飞行 dur 秒，落点 aoe 内直接受伤；落地后的余火、水洼、毒气持续 left 秒 */
  lob: { dur: 1.4, aoe: 16, left: 4 },
  /** 冷却 cd 秒，玩家进到 range 内开招，蓄力 warn 秒，半径 r；全场两次震地至少隔 gap 秒（冷却按只算，怪一多就会连着放） */
  quake: { cd: 10, range: 44, warn: 0.6, r: 36, gap: 1.5 },
  /** 每 every 秒刷新一次，半径 r 内的其他妖物护甲 +armor */
  formation: { r: 64, armor: 2, every: 0.5 },
  /** 冷却 cd 秒，玩家在 range 内开招，预警 warn 秒，缠根半径 r、持续 dur 秒；冒出来时一半几率迟缓；全场至少隔 gap 秒 */
  roots: { cd: 11, range: 150, warn: 1.2, r: 22, dur: 3, gap: 3 },
};

/**
 * 精英词缀（后期关卡的精英随机带 LevelDef.eliteAffixes 个）：
 * - miasma 瘴：身边一圈瘴气，玩家进去按 tick 中毒
 * - guard 护：周围的妖物护甲 +armor
 * - summon 召：每 every 秒唤 n 只同种小怪（不掉经验）
 */
export type Affix = 'miasma' | 'guard' | 'summon';

export const AFFIXES: Record<Affix, { name: string; css: string; r?: number; tick?: number; armor?: number; every?: number; n?: number }> = {
  miasma: { name: '瘴', css: '#8fe06a', r: 44, tick: 0.7 },
  guard: { name: '护', css: '#e8d38a', r: 72, armor: 2 },
  summon: { name: '召', css: '#c8a0ff', every: 9, n: 2 },
};

/**
 * 小怪升阶：同一种怪的二阶「凶」、三阶「煞」，数值加强、贴图在启动时按原帧重新着色（见 art/enemyArt.ts 的 tierFrame），
 * 不换色相（五行色就是元素），只往深里压：凶更深更饱和，煞压到很暗、描边换成本元素的亮色、亮处（眼睛、火光）保持发亮。
 * 脚下的元素底座不动。精英、Boss、召唤物不升阶。出现比例按关卡配，见 LevelDef.tiers
 */
export type Tier = 1 | 2 | 3;

export const TIERS: Record<2 | 3, { name: string; css: string; hp: number; dmg: number; speed: number; armor: number; xp: number; scale: number }> = {
  2: { name: '凶', css: '#e8a050', hp: 1.6, dmg: 1.25, speed: 1.05, armor: 1, xp: 2, scale: 1.1 },
  3: { name: '煞', css: '#ff6a5a', hp: 2.6, dmg: 1.5, speed: 1.1, armor: 2, xp: 3, scale: 1.2 },
};

/** 升阶贴图的 key：一阶就是原贴图 */
export function tierTex(tex: string, tier: Tier) {
  return tier === 1 ? tex : `${tex}_t${tier}`;
}

export const ENEMIES: Record<string, EnemyDef> = {
  shiyong: { id: 'shiyong', name: '石俑', el: 'earth', tex: 'en_shiyong', hp: 30, speed: 26, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'walk', inflict: { kind: 'stun', chance: 0.3 } },
  tengguai: { id: 'tengguai', name: '藤怪', el: 'wood', tex: 'en_tengguai', hp: 18, speed: 34, dmg: 4, armor: 0, radius: 7, xp: 1, behavior: 'regen', regen: 2, inflict: { kind: 'poison', chance: 0.1, dps: 1.5, dur: 4 } },
  shuigui: { id: 'shuigui', name: '水鬼', el: 'water', tex: 'en_shuigui', hp: 10, speed: 50, dmg: 3, armor: 0, radius: 6, xp: 1, behavior: 'walk', inflict: { kind: 'slow', chance: 0.15 } },
  huoya: { id: 'huoya', name: '火鸦', el: 'fire', tex: 'en_huoya', hp: 8, speed: 52, dmg: 4, armor: 0, radius: 6, xp: 1, behavior: 'explode', inflict: { kind: 'burn', chance: 0.2, dps: 1.5 } },
  tiejia: { id: 'tiejia', name: '铁甲兵', el: 'metal', tex: 'en_tiejia', hp: 26, speed: 30, dmg: 6, armor: 3, radius: 8, xp: 2, behavior: 'charge', inflict: { kind: 'bleed', chance: 0.25, dps: 1.5 } },
  zhushe: { id: 'zhushe', name: '竹叶青', el: 'wood', tex: 'en_zhushe', hp: 14, speed: 58, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', inflict: { kind: 'poison', chance: 0.2, dps: 2, dur: 4 } },
  zhangchan: { id: 'zhangchan', name: '瘴蟾', el: 'earth', tex: 'en_zhangchan', hp: 24, speed: 30, dmg: 4, armor: 1, radius: 7, xp: 2, behavior: 'spit', inflict: { kind: 'poison', chance: 0.25, dps: 2, dur: 4 } },
  shanxiao: { id: 'shanxiao', name: '山魈', el: 'earth', tex: 'en_shanxiao', hp: 22, speed: 40, dmg: 5, armor: 0, radius: 7, xp: 2, behavior: 'spit', shot: 'ep_rock', inflict: { kind: 'stun', chance: 0.2 } },
  chuanshan: { id: 'chuanshan', name: '穿山甲', el: 'earth', tex: 'en_chuanshan', hp: 34, speed: 30, dmg: 7, armor: 2, radius: 7, xp: 2, behavior: 'burrow', inflict: { kind: 'stun', chance: 0.25 } },
  chihu: { id: 'chihu', name: '赤狐', el: 'fire', tex: 'en_chihu', hp: 14, speed: 56, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', trail: true, inflict: { kind: 'burn', chance: 0.15, dps: 1.5 } },
  huojing: { id: 'huojing', name: '火精', el: 'fire', tex: 'en_huojing', hp: 16, speed: 34, dmg: 5, armor: 0, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_fire', inflict: { kind: 'burn', chance: 0.2, dps: 1.5 } },
  canbing: { id: 'canbing', name: '残兵', el: 'metal', tex: 'en_canbing', hp: 22, speed: 30, dmg: 6, armor: 2, radius: 7, xp: 2, behavior: 'walk', revive: 5, inflict: { kind: 'bleed', chance: 0.15, dps: 1.5 } },
  feilian: { id: 'feilian', name: '飞镰', el: 'metal', tex: 'en_feilian', hp: 18, speed: 38, dmg: 5, armor: 1, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_blade', inflict: { kind: 'bleed', chance: 0.2, dps: 1.5 } },
  yuyao: { id: 'yuyao', name: '鱼妖', el: 'water', tex: 'en_yuyao', hp: 18, speed: 36, dmg: 5, armor: 0, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_water', inflict: { kind: 'slow', chance: 0.2 } },
  jiao: { id: 'jiao', name: '蛟', el: 'water', tex: 'en_jiao', hp: 30, speed: 40, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'charge', puddle: true, inflict: { kind: 'slow', chance: 0.2 } },
  langyao: { id: 'langyao', name: '狼妖', el: 'metal', tex: 'boss_langyao', hp: 2600, speed: 46, dmg: 16, armor: 2, radius: 18, xp: 100, behavior: 'boss_wolf', boss: true, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  shuyao: { id: 'shuyao', name: '千年树妖', el: 'wood', tex: 'boss_shuyao', hp: 5400, speed: 30, dmg: 18, armor: 2, radius: 24, xp: 150, behavior: 'boss_tree', boss: true, regen: 4, inflict: { kind: 'poison', chance: 0.65, dps: 4, dur: 5 } },
  shanxiaowang: { id: 'shanxiaowang', name: '山魈王', el: 'earth', tex: 'boss_shanxiao', hp: 5000, speed: 40, dmg: 18, armor: 3, radius: 20, xp: 150, behavior: 'boss_ape', boss: true, inflict: { kind: 'stun', chance: 0.5 } },
  bifang: { id: 'bifang', name: '毕方', el: 'fire', tex: 'boss_bifang', hp: 5000, speed: 48, dmg: 18, armor: 2, radius: 20, xp: 150, behavior: 'boss_bird', boss: true, inflict: { kind: 'burn', chance: 0.5, dps: 3 } },
  xingtian: { id: 'xingtian', name: '刑天', el: 'metal', tex: 'boss_xingtian', hp: 5200, speed: 34, dmg: 20, armor: 4, radius: 22, xp: 150, behavior: 'boss_xingtian', boss: true, rise: 0.35, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  xiangliu: { id: 'xiangliu', name: '相柳', el: 'water', tex: 'boss_xiangliu', hp: 5600, speed: 30, dmg: 20, armor: 3, radius: 24, xp: 150, behavior: 'boss_snake', boss: true, inflict: { kind: 'slow', chance: 0.5 } },
};
