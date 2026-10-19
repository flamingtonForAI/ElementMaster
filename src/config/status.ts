import { relation, type El } from './elements';

/**
 * 五行异常（敌我共用）：水迟缓（攒寒意冰冻）、木中毒、火灼烧、金流血（叠满撕裂）、土震慑（攒满打晕）。
 * stun 这个 id 指土系的震慑：几率触发的震慑先攒层数，石刺、落石这类必定定身的直接定住
 */
export type StatusId = 'slow' | 'poison' | 'burn' | 'bleed' | 'stun';

export const STATUS_OF: Record<El, StatusId> = { water: 'slow', wood: 'poison', fire: 'burn', metal: 'bleed', earth: 'stun' };

export const STATUS_INFO: Record<StatusId, { name: string; el: El; css: string; tint: number }> = {
  slow: { name: '迟缓', el: 'water', css: '#9fc0ff', tint: 0x9fc0ff },
  poison: { name: '中毒', el: 'wood', css: '#8fe06a', tint: 0xb8f0a0 },
  burn: { name: '灼烧', el: 'fire', css: '#ffa060', tint: 0xffa070 },
  bleed: { name: '流血', el: 'metal', css: '#ff6a7a', tint: 0xe04a5a },
  stun: { name: '定身', el: 'earth', css: '#e8d38a', tint: 0xe8d38a },
};

/** 寒意攒满后的冰冻：机制上就是定身，画成冰色 */
export const FROZEN = { name: '冰冻', css: '#d8f0ff', tint: 0xc8ecff };

/** 敌人攻击附带的异常：命中后按 chance 判定；dps 用于中毒和灼烧（每层），dur 不填用默认时长 */
export interface Inflict {
  kind: StatusId;
  chance: number;
  dps?: number;
  dur?: number;
}

/** 挂在敌人身上：中毒、灼烧的 k 是每秒伤害占本次命中伤害的比例 */
export const ON_ENEMY = {
  slow: { dur: 2, f: 0.5, bossF: 0.75 },
  /** 水系命中造成迟缓时攒一层寒意，window 秒内攒满 need 层冰冻 dur 秒，之后 immune 秒内不再冰冻；Boss 不冻，改为迟缓 */
  chill: { need: 3, window: 5, dur: 1, immune: 3 },
  poison: { dur: 4, k: 0.3 },
  burn: { dur: 2, k: 0.2, max: 3 },
  /** 每层每秒造成本次伤害的 k，无视护甲；叠满 max 层撕裂：剩下的流血一次打完 */
  bleed: { dur: 3, k: 0.12, max: 5 },
  /** 必定定身（石刺、落石）：结束后 immune 秒内不会再被定身；Boss 不会被定身，改为迟缓 */
  stun: { dur: 0.5, immune: 1 },
  /** 几率触发的震慑：window 秒内攒满 need 层打晕 dur 秒 */
  daze: { need: 3, window: 4, dur: 0.8 },
};

/** 挂在玩家身上 */
export const ON_PLAYER = {
  slow: { dur: 2, f: 0.75 },
  /** 寒意累积：window 秒内被迟缓 need 次冰冻 dur 秒，之后免疫 immune 秒 */
  chill: { need: 3, window: 4, dur: 0.6, immune: 5 },
  poison: { dur: 4, regen: 0.5 },
  burn: { dur: 2, max: 3 },
  bleed: { dur: 3, max: 3 },
  /** 震慑累积：window 秒内攒满 need 次触发定身，之后免疫 immune 秒 */
  stun: { need: 3, window: 4, dur: 0.6, immune: 5 },
};

/**
 * 异常按五行关系缩放（异常元素 → 目标元素，敌我一样，目标是敌人元素或玩家本命）。没有完全免疫：
 * 被克（如火系敌人身上的流血）最难挂，同系次之。几率乘这个系数；系数低于 1 时，异常的强度
 * （持续伤害、迟缓和定身时长、攒寒意的机会）也乘它
 */
const STATUS_REL = { counter: 1.5, fed: 1.2, drain: 0.8, same: 0.5, countered: 0.3 };

export function statusChance(kind: StatusId, target: El): number {
  return STATUS_REL[relation(STATUS_INFO[kind].el, target)];
}

/** 异常强度的减免系数（最多 1，不会因为克制而加强） */
export function statusPower(kind: StatusId, target: El): number {
  return Math.min(1, statusChance(kind, target));
}

/** 敌人暴击率：以金为中心，按和金的生克递减 */
export const ENEMY_CRIT: Record<El, number> = { metal: 0.1, earth: 0.06, water: 0.04, wood: 0.03, fire: 0.02 };
/** 敌人默认暴击倍率；EnemyDef.critDmg 可单独覆盖，以后做暴伤成长也从这里接 */
export const ENEMY_CRIT_DMG = 1.5;
