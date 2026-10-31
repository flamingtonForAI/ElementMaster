import type { El } from './elements';
import type { Inflict } from './status';

export type Behavior = 'walk' | 'regen' | 'explode' | 'charge' | 'spit' | 'burrow' | 'boss_wolf' | 'boss_tree' | 'boss_ape' | 'boss_bird' | 'boss_xingtian' | 'boss_snake' | 'sidestep' | 'boss_xuanming' | 'sting' | 'boss_hanba' | 'leap' | 'boss_jiuying' | 'boss_dijiang';

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
  /** 第 6 关起的分工修正；精英仅继承移速，不继承普通怪的血量和经验修正。 */
  lateRole?: 'frontline' | 'runner';
  /** 首次分批亮相时提示的招式，帮助辨认后期新怪。 */
  intro?: string;
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
  /** 死后几秒原地复活一次，被火系击杀则不会（残兵）；复活的不再掉经验 */
  revive?: number;
  /** Boss 第一次被打倒时带这么多比例的生命复起，被火系击杀则不会（刑天） */
  rise?: number;
  /** Boss 血量跌破这个比例换第二相（旱魃焚身化火，见 HANBA_FIRE） */
  phase?: number;
  /** spit 一次扇形吐几道（焰蛸），不填一道 */
  spread?: number;
}

/**
 * 后期关卡给敌人加的手段（按关卡在 LevelDef.tricks 里开，前几关的同一种怪不受影响）：
 * - lob：吐弹改成抛射，落点先预警，落地按元素留东西（火留余火、水留水洼、木土留毒气）
 * - quake：贴近时停下蓄力震地，脚下一圈攒震慑（石俑）
 * - formation：列阵，周围的妖物护甲 +armor（铁甲兵），脚下一圈可见的阵环
 * - roots：隔着距离在玩家脚下催生缠根，踩上去迟缓（藤怪）
 * - boomerang：甩出的飞刃飞到头会折回来，从背后再扫一遍（飞镰）
 * - sinkhole：钻地破土时在原地陷出一小片流沙（穿山甲）
 */
export type Trick = 'lob' | 'quake' | 'formation' | 'roots' | 'boomerang' | 'sinkhole';

export const TRICKS = {
  /** 飞行 dur 秒，落点 aoe 内直接受伤；落地后的余火、水洼、毒气持续 left 秒 */
  lob: { dur: 1.4, aoe: 16, left: 4 },
  /** 冷却 cd 秒，玩家进到 range 内开招，蓄力 warn 秒，半径 r；全场两次震地至少隔 gap 秒（冷却按只算，怪一多就会连着放） */
  quake: { cd: 10, range: 44, warn: 0.6, r: 36, gap: 1.5 },
  /** 每 every 秒刷新一次，半径 r 内的其他妖物护甲 +armor */
  formation: { r: 64, armor: 2, every: 0.5 },
  /** 冷却 cd 秒，玩家在 range 内开招，预警 warn 秒，缠根半径 r、持续 dur 秒；冒出来时一半几率迟缓；全场至少隔 gap 秒 */
  roots: { cd: 11, range: 150, warn: 1.2, r: 22, dur: 3, gap: 3 },
  /** 出手速度 speed，一直受反向加速度 back：飞 speed / back 秒到头（约 130 像素），再原路加速折回 */
  boomerang: { speed: 130, back: 65 },
  /** 破土处的流沙半径 r、持续 dur 秒 */
  sinkhole: { r: 26, dur: 5 },
};

/**
 * 精英词缀（后期关卡的精英随机带 LevelDef.eliteAffixes 个）：
 * - miasma 瘴：身边一圈瘴气，玩家进去按 tick 中毒
 * - guard 护：周围的妖物护甲 +armor
 * - summon 召：每 every 秒唤 n 只同种小怪（不掉经验）
 * - frost 寒：身边一圈寒气，玩家进去按 tick 迟缓（会攒寒意）
 * from：第几关起才会抽到，不填从有词缀的关卡就有
 */
export type Affix = 'miasma' | 'guard' | 'summon' | 'frost';

export const AFFIXES: Record<Affix, { name: string; css: string; r?: number; tick?: number; chance?: number; armor?: number; first?: number; every?: number; n?: number; from?: number }> = {
  miasma: { name: '瘴', css: '#8fe06a', r: 72, tick: 1, chance: 0.6 },
  guard: { name: '护', css: '#e8d38a', r: 96, armor: 3 },
  summon: { name: '召', css: '#c8a0ff', first: 4, every: 8, n: 3 },
  frost: { name: '寒', css: '#c8ecff', r: 64, tick: 1, chance: 0.65, from: 7 },
};

/** 词缀光环的显示与判定共用纵向比例。列阵仍保留原来的范围。 */
export const AFFIX_SQUASH = 0.7;

/** 额外直接伤害成长；不重复放大异常、余火或已有时间成长的地形招式。 */
export const ENEMY_DAMAGE_GROWTH = {
  rampStart: 90, rampEnd: 240,
  mobFrom: 6, mobPerLevel: 0.05,
  elitePerLevel: 0.04,
  bossPerLevel: 0.06,
} as const;

/** 普通怪/精英按出生时间缓入，Boss 按关卡独立成长，不吃普通怪的时间倍率。 */
export function enemyAttackGrowth(level: number, elapsed: number, kind: 'mob' | 'elite' | 'boss'): number {
  const D = ENEMY_DAMAGE_GROWTH;
  const lv = Math.max(1, Math.min(10, level));
  if (kind === 'boss') return 1 + (lv - 1) * D.bossPerLevel;
  const ramp = Math.max(0, Math.min(1, (elapsed - D.rampStart) / (D.rampEnd - D.rampStart)));
  const bonus = kind === 'elite' ? (lv - 1) * D.elitePerLevel : Math.max(0, lv - D.mobFrom + 1) * D.mobPerLevel;
  return 1 + bonus * ramp;
}

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

/** 后期同屏密度高：前排少堆血、多给经验；快怪需活着接近玩家才能发挥移速。 */
export const LATE_MOB_ROLES = {
  fromLevel: 6,
  frontline: { hp: 0.85, speed: 1, xp: 1.5 },
  runner: { hp: 1.3, speed: 1.1, xp: 1 },
} as const;

/** 常规快怪（50+）血量 8–14；中速突进怪 18–28；慢速前排 30–42。远程怪以较低血量换射程，Boss 独立配平。 */
/** 可躲避的直射、回旋和抛射命中，比同怪接触伤害更痛；不放大异常与残留地形。 */
export const ENEMY_PROJECTILE_DAMAGE = 1.4;

export const ENEMIES: Record<string, EnemyDef> = {
  shiyong: { id: 'shiyong', lateRole: 'frontline', name: '石俑', el: 'earth', tex: 'en_shiyong', hp: 40, speed: 26, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'walk', inflict: { kind: 'stun', chance: 0.3 } },
  tengguai: { id: 'tengguai', name: '藤怪', el: 'wood', tex: 'en_tengguai', hp: 24, speed: 34, dmg: 4, armor: 0, radius: 7, xp: 1, behavior: 'regen', regen: 2, inflict: { kind: 'poison', chance: 0.1, dps: 1.5, dur: 4 } },
  shuigui: { id: 'shuigui', lateRole: 'runner', name: '水鬼', el: 'water', tex: 'en_shuigui', hp: 10, speed: 50, dmg: 3, armor: 0, radius: 6, xp: 1, behavior: 'walk', inflict: { kind: 'slow', chance: 0.15 } },
  huoya: { id: 'huoya', lateRole: 'runner', name: '火鸦', el: 'fire', tex: 'en_huoya', hp: 8, speed: 52, dmg: 4, armor: 0, radius: 6, xp: 1, behavior: 'explode', inflict: { kind: 'burn', chance: 0.2, dps: 1.5 } },
  tiejia: { id: 'tiejia', lateRole: 'frontline', name: '铁甲兵', el: 'metal', tex: 'en_tiejia', hp: 34, speed: 30, dmg: 6, armor: 3, radius: 8, xp: 2, behavior: 'charge', inflict: { kind: 'bleed', chance: 0.25, dps: 1.5 } },
  zhushe: { id: 'zhushe', lateRole: 'runner', name: '竹叶青', el: 'wood', tex: 'en_zhushe', hp: 14, speed: 58, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', inflict: { kind: 'poison', chance: 0.2, dps: 2, dur: 4 } },
  zhangchan: { id: 'zhangchan', name: '瘴蟾', el: 'earth', tex: 'en_zhangchan', hp: 28, speed: 30, dmg: 4, armor: 1, radius: 7, xp: 2, behavior: 'spit', inflict: { kind: 'poison', chance: 0.25, dps: 2, dur: 4 } },
  shanxiao: { id: 'shanxiao', name: '山魈', el: 'earth', tex: 'en_shanxiao', hp: 22, speed: 40, dmg: 5, armor: 0, radius: 7, xp: 2, behavior: 'spit', shot: 'ep_rock', inflict: { kind: 'stun', chance: 0.2 } },
  chuanshan: { id: 'chuanshan', lateRole: 'frontline', name: '穿山甲', el: 'earth', tex: 'en_chuanshan', hp: 42, speed: 30, dmg: 7, armor: 2, radius: 7, xp: 2, behavior: 'burrow', inflict: { kind: 'stun', chance: 0.25 } },
  chihu: { id: 'chihu', lateRole: 'runner', name: '赤狐', el: 'fire', tex: 'en_chihu', hp: 14, speed: 56, dmg: 5, armor: 0, radius: 6, xp: 1, behavior: 'charge', trail: true, inflict: { kind: 'burn', chance: 0.15, dps: 1.5 } },
  huojing: { id: 'huojing', name: '火精', el: 'fire', tex: 'en_huojing', hp: 20, speed: 34, dmg: 5, armor: 0, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_fire', inflict: { kind: 'burn', chance: 0.2, dps: 1.5 } },
  canbing: { id: 'canbing', lateRole: 'frontline', name: '残兵', el: 'metal', tex: 'en_canbing', hp: 30, speed: 30, dmg: 6, armor: 2, radius: 7, xp: 2, behavior: 'walk', revive: 5, inflict: { kind: 'bleed', chance: 0.15, dps: 1.5 } },
  feilian: { id: 'feilian', name: '飞镰', el: 'metal', tex: 'en_feilian', hp: 18, speed: 38, dmg: 5, armor: 1, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_blade', inflict: { kind: 'bleed', chance: 0.2, dps: 1.5 } },
  yuyao: { id: 'yuyao', name: '鱼妖', el: 'water', tex: 'en_yuyao', hp: 22, speed: 36, dmg: 5, armor: 0, radius: 6, xp: 2, behavior: 'spit', shot: 'ep_water', inflict: { kind: 'slow', chance: 0.2 } },
  jiao: { id: 'jiao', name: '蛟', el: 'water', tex: 'en_jiao', hp: 26, speed: 40, dmg: 6, armor: 1, radius: 8, xp: 2, behavior: 'charge', puddle: true, inflict: { kind: 'slow', chance: 0.2 } },
  // 第 7 关寒江：冰蚕死时冰爆（自爆按元素走，水系是迟缓），铁螯蟹横着挪过来夹人
  bingcan: { id: 'bingcan', intro: '毙命后寒气爆裂，避开冰圈再拾灵气', lateRole: 'frontline', name: '冰蚕', el: 'water', tex: 'en_bingcan', hp: 40, speed: 24, dmg: 5, armor: 1, radius: 8, xp: 2, behavior: 'explode', inflict: { kind: 'slow', chance: 0.2 } },
  aoxie: { id: 'aoxie', intro: '横行逼近的重甲巨蟹，宜以火法破甲', lateRole: 'frontline', name: '铁螯蟹', el: 'metal', tex: 'en_aoxie', hp: 38, speed: 34, dmg: 7, armor: 4, radius: 8, xp: 2, behavior: 'sidestep', inflict: { kind: 'bleed', chance: 0.25, dps: 1.5 } },
  // 第 8 关大漠：沙蝎贴近了尾针直刺一条线，金蜣隔着距离滚金丸
  shaxie: { id: 'shaxie', intro: '尾针直刺一线，见预警即向两侧闪避', name: '沙蝎', el: 'earth', tex: 'en_shaxie', hp: 28, speed: 40, dmg: 6, armor: 2, radius: 7, xp: 2, behavior: 'sting', inflict: { kind: 'poison', chance: 0.25, dps: 2, dur: 4 } },
  jinqiang: { id: 'jinqiang', intro: '远距滚出金丸，侧移绕开弹道', name: '金蜣', el: 'metal', tex: 'en_jinqiang', hp: 30, speed: 32, dmg: 6, armor: 3, radius: 7, xp: 2, behavior: 'spit', shot: 'ep_sandball', inflict: { kind: 'stun', chance: 0.2 } },
  // 第 9 关东海归墟：夜叉跳到玩家脚下砸地，焰蛸一次扇形喷三道火
  yecha: { id: 'yecha', intro: '跃至足下猛砸，速离脚下预警圈', name: '夜叉', el: 'water', tex: 'en_yecha', hp: 24, speed: 42, dmg: 7, armor: 1, radius: 7, xp: 2, behavior: 'leap', inflict: { kind: 'slow', chance: 0.2 } },
  yanshao: { id: 'yanshao', intro: '扇形喷吐三道烈火，寻弹道间隙穿行', name: '焰蛸', el: 'fire', tex: 'en_yanshao', hp: 24, speed: 30, dmg: 5, armor: 0, radius: 7, xp: 2, behavior: 'spit', shot: 'ep_fire', spread: 3, inflict: { kind: 'burn', chance: 0.15, dps: 1.5 } },
  langyao: { id: 'langyao', name: '狼妖', el: 'metal', tex: 'boss_langyao', hp: 2600, speed: 55, dmg: 20, armor: 2, radius: 18, xp: 100, behavior: 'boss_wolf', boss: true, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  shuyao: { id: 'shuyao', name: '千年树妖', el: 'wood', tex: 'boss_shuyao', hp: 5400, speed: 36, dmg: 23, armor: 2, radius: 24, xp: 150, behavior: 'boss_tree', boss: true, regen: 4, inflict: { kind: 'poison', chance: 0.65, dps: 4, dur: 5 } },
  shanxiaowang: { id: 'shanxiaowang', name: '山魈王', el: 'earth', tex: 'boss_shanxiao', hp: 5000, speed: 48, dmg: 23, armor: 3, radius: 20, xp: 150, behavior: 'boss_ape', boss: true, inflict: { kind: 'stun', chance: 0.5 } },
  bifang: { id: 'bifang', name: '毕方', el: 'fire', tex: 'boss_bifang', hp: 5000, speed: 58, dmg: 23, armor: 2, radius: 20, xp: 150, behavior: 'boss_bird', boss: true, inflict: { kind: 'burn', chance: 0.5, dps: 3 } },
  xingtian: { id: 'xingtian', name: '刑天', el: 'metal', tex: 'boss_xingtian', hp: 5200, speed: 41, dmg: 25, armor: 4, radius: 22, xp: 150, behavior: 'boss_xingtian', boss: true, rise: 0.35, inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  xiangliu: { id: 'xiangliu', name: '相柳', el: 'water', tex: 'boss_xiangliu', hp: 5600, speed: 36, dmg: 25, armor: 3, radius: 24, xp: 150, behavior: 'boss_snake', boss: true, inflict: { kind: 'slow', chance: 0.5 } },
  xuanming: { id: 'xuanming', name: '玄冥', el: 'water', tex: 'boss_xuanming', hp: 5800, speed: 41, dmg: 25, armor: 3, radius: 28, xp: 150, behavior: 'boss_xuanming', boss: true, inflict: { kind: 'slow', chance: 0.5 } },
  hanba: { id: 'hanba', name: '旱魃', el: 'earth', tex: 'boss_hanba', hp: 6000, speed: 36, dmg: 25, armor: 4, radius: 26, xp: 150, behavior: 'boss_hanba', boss: true, phase: 0.5, inflict: { kind: 'stun', chance: 0.5 } },
  jiuying: { id: 'jiuying', name: '九婴', el: 'water', tex: 'boss_jiuying', hp: 6200, speed: 38, dmg: 25, armor: 3, radius: 31, xp: 150, behavior: 'boss_jiuying', boss: true, inflict: { kind: 'slow', chance: 0.5 } },
  dijiang: { id: 'dijiang', name: '帝江', el: 'earth', tex: 'boss_dijiang', hp: 6600, speed: 41, dmg: 28, armor: 3, radius: 34, xp: 200, behavior: 'boss_dijiang', boss: true, inflict: { kind: 'stun', chance: 0.5 } },
};

/** 旱魃焚身化火之后换成这份定义：同一只 Boss（id 不变，图鉴照记），改成火系、贴图换成火相，攻击改附带灼烧 */
export const HANBA_FIRE: EnemyDef = { ...ENEMIES.hanba, el: 'fire', tex: 'boss_hanba_fire', speed: 43, armor: 3, inflict: { kind: 'burn', chance: 0.5, dps: 3 } };

/** 平时、狂暴后各一个值 */
export type Pair = readonly [number, number];

/** 第 8、9 关新小怪的出招：沙蝎尾针够得着的长度、预警；夜叉跳砸的起跳距离范围、预警、腾空时长、落地半径 */
export const MOB_MOVES = {
  sting: { len: 54, warn: 0.5 },
  leap: { min: 50, max: 160, warn: 0.8, air: 0.45, r: 22 },
} as const;

/**
 * 第 7–10 关 Boss 的出招节奏和规模（Boss 体型逐关加大：玄冥 72、旱魃 60×72、九婴 80、帝江 88 像素，近身招的半径跟着放大），调平衡改这里（Pair 为 [平时, 狂暴后]）。every 是间隔秒数，n 是发数 / 处数，
 * r 半径，warn 预警，range 是玩家在这么近时才放，dur 持续秒数
 */
export const BOSS_MOVES = {
  /** 玄冥：冰羽扇射、冰锥（落地结 ice 秒冰面）、吸寒（拉力 pull，收完半径 r 冰爆，原地留冰） */
  xuanming: {
    feather: { every: [3.2, 2.6] as Pair, n: [7, 9] as Pair },
    icicle: { every: [7, 5] as Pair, n: [4, 6] as Pair, warn: 1.2, r: 22, dmg: 12, ice: 6 },
    inhale: { every: [11, 8] as Pair, warn: 2.8, pull: [45, 58] as Pair, r: [68, 80] as Pair, range: 220, ice: 6 },
  },
  /** 旱魃：土相裂地、陷沙，火相火环、焚风，两相都跺地；ignite 是焚身停顿 */
  hanba: {
    thorn: { every: 4.5 },
    sand: { every: 8, warn: 1.2, r: 44, dur: 7 },
    ring: { every: [3.6, 2.8] as Pair, n: [14, 18] as Pair },
    blast: { every: [7, 5] as Pair, n: [3, 5] as Pair },
    stomp: { r: 58, warn: 0.6, range: 72, rest: [3, 2.2] as Pair },
    ignite: 1.5,
  },
  /** 九婴：九首旋喷、潮攻（水柱 / 焚风）、婴啼（唤 n 只同系小怪） */
  jiuying: {
    spiral: { every: [3, 2.2] as Pair, n: [18, 24] as Pair },
    tide: { every: [7, 5] as Pair, n: [3, 5] as Pair },
    cry: { every: [11, 8] as Pair, n: [3, 4] as Pair, r: 84, warn: 1, range: 260 },
  },
  /** 帝江：每掉 step 的生命换一系；每系的招按 move 间隔放，发数见 n；歌舞每 dance.every 秒一次 */
  dijiang: {
    step: 0.2,
    move: [3.4, 2.6] as Pair,
    ring: [10, 14] as Pair,
    dance: { every: [8, 6] as Pair, dur: 2, range: 240 },
    n: { wood: [3, 4] as Pair, fire: [14, 18] as Pair, earth: [4, 6] as Pair, metal: [12, 16] as Pair, water: [4, 6] as Pair },
  },
};

/** 帝江（混沌）自己按相生轮转的五相：元素、贴图、攻击附带的异常各换一份，id 不变 */
export const DIJIANG_FORMS: Record<El, EnemyDef> = {
  earth: ENEMIES.dijiang,
  metal: { ...ENEMIES.dijiang, el: 'metal', tex: 'boss_dijiang_metal', inflict: { kind: 'bleed', chance: 0.5, dps: 3 } },
  water: { ...ENEMIES.dijiang, el: 'water', tex: 'boss_dijiang_water', inflict: { kind: 'slow', chance: 0.5 } },
  wood: { ...ENEMIES.dijiang, el: 'wood', tex: 'boss_dijiang_wood', inflict: { kind: 'poison', chance: 0.5, dps: 4, dur: 4 } },
  fire: { ...ENEMIES.dijiang, el: 'fire', tex: 'boss_dijiang_fire', inflict: { kind: 'burn', chance: 0.5, dps: 3 } },
};

/** 随关卡相位换元素的 Boss：每一相用哪份定义（九婴：水火之怪，涨潮是水系、退潮是火系，id 不变） */
export const PHASE_FORMS: Record<string, Partial<Record<El, EnemyDef>>> = {
  jiuying: { water: ENEMIES.jiuying, fire: { ...ENEMIES.jiuying, el: 'fire', tex: 'boss_jiuying_fire', inflict: { kind: 'burn', chance: 0.5, dps: 3 } } },
};
