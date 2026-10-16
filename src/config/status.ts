import { relation, type El } from './elements';

/** 五行异常：水迟缓、木中毒、火灼烧、金破绽、土震慑 */
export type StatusId = 'slow' | 'poison' | 'burn' | 'flaw' | 'stun';

export const STATUS_OF: Record<El, StatusId> = { water: 'slow', wood: 'poison', fire: 'burn', metal: 'flaw', earth: 'stun' };

export const STATUS_INFO: Record<StatusId, { name: string; el: El; css: string; tint: number }> = {
  slow: { name: '迟缓', el: 'water', css: '#9fc0ff', tint: 0x9fc0ff },
  poison: { name: '中毒', el: 'wood', css: '#8fe06a', tint: 0xb8f0a0 },
  burn: { name: '灼烧', el: 'fire', css: '#ffa060', tint: 0xffa070 },
  flaw: { name: '破绽', el: 'metal', css: '#e0d8ff', tint: 0xd8d0ff },
  stun: { name: '定身', el: 'earth', css: '#e8d38a', tint: 0xe8d38a },
};

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
  poison: { dur: 4, k: 0.3 },
  burn: { dur: 2, k: 0.2, max: 3 },
  flaw: { dur: 3, crit: 0.15, bossCrit: 0.08 },
  /** 定身结束后 immune 秒内不会再被定身；Boss 不会被定身，改为迟缓 */
  stun: { dur: 0.5, immune: 1 },
};

/** 挂在玩家身上 */
export const ON_PLAYER = {
  slow: { dur: 2, f: 0.75 },
  poison: { dur: 4, regen: 0.5 },
  burn: { dur: 2, max: 3 },
  flaw: { dur: 3, crit: 0.15 },
  /** 震慑累积：window 秒内攒满 need 次触发定身，之后免疫 immune 秒 */
  stun: { need: 3, window: 4, dur: 0.6, immune: 5 },
};

/**
 * 异常几率按五行关系缩放（异常元素 → 目标元素）。
 * 敌人免疫同元素异常；玩家本命同元素时几率减半
 */
const STATUS_REL = { counter: 1.5, fed: 1.2, drain: 0.8, countered: 0.6, same: 0 };

export function statusChance(kind: StatusId, target: El, isPlayer: boolean): number {
  const rel = relation(STATUS_INFO[kind].el, target);
  return rel === 'same' && isPlayer ? 0.5 : STATUS_REL[rel];
}

/** 敌人暴击率：以金为中心，按和金的生克递减 */
export const ENEMY_CRIT: Record<El, number> = { metal: 0.1, earth: 0.06, water: 0.04, wood: 0.03, fire: 0.02 };
/** 敌人默认暴击倍率；EnemyDef.critDmg 可单独覆盖，以后做暴伤成长也从这里接 */
export const ENEMY_CRIT_DMG = 1.5;
