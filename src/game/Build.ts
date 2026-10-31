import { GEN_ORDER, relation, type El, type Rel, type Terrain } from '../config/elements';
import { SKILLS, PASSIVES, SKILL_SLOTS, NORMAL_SKILL_SLOTS, MAX_SKILL_SLOTS, ULTIMATES, MIN_CD_MULT, type SkillId, type SkillDef, type PassiveId, type PassiveDef } from '../config/skills';
import { ADVANCE } from '../config/status';
import type { CharacterDef } from '../config/characters';
import type { LevelDef } from '../config/levels';
import { UPGRADES, type MetaLevels, type UpgradeStat } from '../config/meta';
import type { Mods } from '../config/startree';

export type Option =
  | { kind: 'skill'; id: SkillId; lv: number }
  | { kind: 'passive'; id: PassiveId; lv: number }
  | { kind: 'heal' }
  | { kind: 'lingshi' };

export interface PlayerStats {
  maxHp: number;
  speed: number;
  armor: number;
  regen: number;
  dmgMult: number;
  crit: number;
  area: number;
  pickup: number;
  xpMult: number;
  critDmg: number;
  cdMult: number;
  /** 幸运修炼：0–1，符箓掉率与效果的额外比例。 */
  luck: number;
  /** 各元素术的伤害系数（星图） */
  elDmg: Record<El, number>;
  /** 受各元素敌人伤害的系数（星图） */
  resist: Record<El, number>;
  /** 攻击各元素敌人的伤害系数（星图克弦） */
  vsEl: Record<El, number>;
  slowMult: number;
  stunMult: number;
  /** 本命爆发伤害系数 */
  burstMult: number;
  /** 站立不动时的额外护甲 */
  stillArmor: number;
  meleeBonus: number;
  meleeRange: number;
  /** 敌人身上中毒、灼烧的伤害倍率（药师） */
  dotMult: number;
  /** 傀儡生命、伤害倍率（傀儡师） */
  puppetHp: number;
  puppetDmg: number;
  /** 专属术伤害倍率（角色成长） */
  sigDmg: number;
  /** 能穿透的投射物额外穿透（贯日诀） */
  pierce: number;
  /** 二阶异常触发率的额外百分点；基础率见 ADVANCE。 */
  advanceBonus: Record<El, number>;
}

const EL0 = (v: number): Record<El, number> => ({ metal: v, wood: v, water: v, fire: v, earth: v });

export function optionKey(o: Option) {
  return o.kind === 'skill' || o.kind === 'passive' ? `${o.kind}:${o.id}` : o.kind;
}

/** 修炼项目的合计加成 */
export function upgradeSum(meta: MetaLevels, stat: UpgradeStat) {
  return UPGRADES.filter((u) => u.stat === stat).reduce((s, u) => s + u.v * Math.max(0, Math.min(u.maxLv, Math.floor(meta[u.id] || 0))), 0);
}

/**
 * 升级选项按角色亲和元素和选项元素的关系加权（以角色为攻方）：
 * 本系最常见；我克的、克我的少一些但仍常见；散人五系一样。
 * 实测（第 1 关地气均分、开局）：本系约 41%（含专属术的升级），生我/我生各约 16%，我克约 15%，克我约 12%
 */
const AFFINITY_W: Record<Rel, number> = { same: 1.5, fed: 1, drain: 1, counter: 0.85, countered: 0.7 };

/** 局内构筑：技能、心法、等级、灵根、本命 */
export class Build {
  skills = new Map<SkillId, number>();
  passives = new Map<PassiveId, number>();
  level = 1;
  xp = 0;
  lingen: Record<El, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
  benming: El;
  /** 每次构筑变化 +1，HUD 据此刷新 */
  version = 0;
  /** 斩缘封禁的选项，本局不再出现 */
  banned = new Set<string>();
  private lastLeveled: El;
  /** 升级三选一按这套地气加权：开局是关卡地气，有相位轮转的关卡换相时由 GameScene.setPhase 换成当前那套 */
  terrain: Terrain;

  /** mods：星图与传承加成，见 talents.ts */
  constructor(readonly char: CharacterDef, readonly levelDef: LevelDef, readonly meta: MetaLevels = {}, readonly mods: Mods = {}) {
    this.terrain = levelDef.terrain;
    this.skills.set(char.startSkill, 1);
    this.benming = char.el;
    this.lastLeveled = char.el;
    this.recompute();
  }

  xpNeeded() {
    return this.level < 20 ? 5 + (this.level - 1) * 6 : 119 + (this.level - 20) * 12;
  }

  get skillSlots() {
    return Math.min(MAX_SKILL_SLOTS, SKILL_SLOTS + upgradeSum(this.meta, 'skillSlots'));
  }

  get ultimate() {
    return [...this.skills.keys()].find((id) => SKILLS[id].ultimate);
  }

  get masteredSkills() {
    return [...this.skills].filter(([id, lv]) => !SKILLS[id].ultimate && lv >= SKILLS[id].maxLv).length
      + [...this.passives].filter(([id, lv]) => lv >= PASSIVES[id].maxLv).length;
  }

  private get hasOpenSlot() {
    const normal = [...this.skills.keys()].filter(id => id !== this.char.startSkill && !SKILLS[id].ultimate).length + this.passives.size;
    return normal < Math.min(NORMAL_SKILL_SLOTS, this.skillSlots - 1);
  }

  /** 左侧固定自带术，中间十格混合术/心法，最右固定大招；不按获取顺序挤占独立格。 */
  get slots(): { def: SkillDef | PassiveDef; lv: number }[] {
    const slots: { def: SkillDef | PassiveDef; lv: number }[] = [];
    const starter = this.skills.get(this.char.startSkill);
    if (starter) slots[0] = { def: SKILLS[this.char.startSkill], lv: starter };
    let index = 1;
    for (const [id, lv] of this.skills) if (id !== this.char.startSkill && !SKILLS[id].ultimate) slots[index++] = { def: SKILLS[id], lv };
    for (const [id, lv] of this.passives) slots[index++] = { def: PASSIVES[id], lv };
    const ultimate = this.ultimate;
    if (ultimate) slots[MAX_SKILL_SLOTS - 1] = { def: SKILLS[ultimate], lv: 1 };
    return slots;
  }

  /** 返回升了几级 */
  addXp(v: number): number {
    this.xp += v;
    let ups = 0;
    while (this.xp >= this.xpNeeded()) {
      this.xp -= this.xpNeeded();
      this.level++;
      ups++;
    }
    return ups;
  }

  /** 重算灵根与本命，返回本命是否变化 */
  recompute(): boolean {
    const l: Record<El, number> = { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 };
    l[this.char.el] += this.char.lingen;
    for (const e of GEN_ORDER) l[e] += this.mods[`lingen.${e}`] ?? 0;
    for (const [id, lv] of this.skills) {
      const el = SKILLS[id].el;
      if (el) l[el] += lv;
    }
    for (const [id, lv] of this.passives) {
      const el = PASSIVES[id].el;
      if (el) l[el] += lv;
    }
    // 散人成长：每 10 级给当时灵根最低的一系 +1
    for (const g of this.char.growth.filter((g) => g.stat === 'lowLingen')) {
      for (let i = 0; i < Math.floor(this.level / g.every); i++) {
        const low = GEN_ORDER.reduce((a, b) => (l[b] < l[a] ? b : a));
        l[low] += g.v;
      }
    }
    this.lingen = l;
    const max = Math.max(...GEN_ORDER.map((e) => l[e]));
    const top = GEN_ORDER.filter((e) => l[e] === max);
    const prev = this.benming;
    if (!top.includes(prev)) this.benming = top.includes(this.lastLeveled) ? this.lastLeveled : top[0];
    if (this.skillSlots === MAX_SKILL_SLOTS && !this.ultimate && this.masteredSkills === NORMAL_SKILL_SLOTS + 1) {
      // 自动觉醒也覆盖宝箱升满最后一个术；散人锁定此刻的本命，之后不随本命换招。
      const id = ULTIMATES[this.char.balanced ? this.benming : this.char.el];
      this.skills.set(id, 1);
      return this.recompute() || prev !== this.benming;
    }
    this.version++;
    return prev !== this.benming;
  }

  stats(): PlayerStats {
    const c = this.char;
    // 本系心法效果 +20%
    const p = (id: PassiveId) => (this.passives.get(id) ?? 0) * (!c.balanced && PASSIVES[id].el === c.el ? 1.2 : 1);
    const u = (stat: UpgradeStat) => upgradeSum(this.meta, stat);
    const gr = (stat: string) =>
      c.growth.filter((g) => g.stat === stat).reduce((s, g) => s + Math.min(g.cap ?? Infinity, Math.floor(this.level / g.every) * g.v), 0);
    const m = (k: string) => this.mods[k] ?? 0;
    const elDmg = EL0(1);
    const resist = EL0(1);
    const vsEl = EL0(1);
    for (const e of GEN_ORDER) {
      elDmg[e] += m(`el.${e}`);
      resist[e] -= m(`res.${e}`);
      vsEl[e] += m(`vs.${e}`);
      // 极境印的代价：本系以外的术变弱
      const off = m(`off.${e}`);
      if (off) for (const o of GEN_ORDER) if (o !== e) elDmg[o] += off;
    }
    const armor = c.armor + Math.floor(p('houtu')) + u('armor') + gr('armor') + m('armor');
    // 散人·太极：术的元素越多、五系灵根越平均越强
    const ln = GEN_ORDER.map((e) => this.lingen[e]);
    const even = Math.max(...ln) - Math.min(...ln) <= 3 ? m('xuan.even') : 0;
    const taiji = m('xuan.taiji') && Math.min(...ln) >= 2 ? 1 : 0;
    const variety = new Set([...this.skills.keys()].map((id) => SKILLS[id].el).filter(el => el !== null)).size * m('xuan.variety');
    return {
      maxHp: Math.round(c.hp * (1 + 0.12 * p('houtu') + u('hp') + m('hp'))),
      speed: c.speed * (1 + 0.07 * p('qingshen') + u('speed') + gr('speed') + m('speed') + 0.1 * taiji),
      armor,
      regen: ((c.regen ?? 0) + 0.5 * p('changsheng') + u('regen') + gr('regen') + m('regen')) * (1 + m('regenMult')),
      dmgMult: 1 + 0.08 * p('yanyang') + m('dmg') + gr('dmg') + variety + even + 0.15 * taiji,
      crit: m('noCrit') ? 0 : 0.05 + (c.crit ?? 0) + 0.06 * p('ruijin') + m('crit') + gr('crit'),
      area: 1 + (c.area ?? 0) + 0.08 * p('roushui') + m('area') + gr('area'),
      pickup: 30 * (1 + (c.pickup ?? 0) + 0.25 * p('juling') + u('pickup') + m('pickup')),
      xpMult: 1 + 0.05 * p('juling') + u('xp') + m('xp'),
      critDmg: 2 + m('critDmg'),
      cdMult: Math.max(MIN_CD_MULT, 1 - (c.cdr ?? 0) - m('cd') - gr('cd') - 0.1 * taiji - 0.04 * p('ningshen')),
      luck: u('luck'),
      elDmg,
      resist,
      vsEl,
      slowMult: 1 + m('slowDur'),
      stunMult: 1 + m('stunDur'),
      burstMult: 1 + m('burst'),
      stillArmor: m('stillArmor'),
      meleeBonus: c.meleeBonus + m('melee') + armor * m('xiao.armorMelee'),
      meleeRange: c.meleeRange + m('meleeRange'),
      dotMult: 1 + (c.dotBonus ?? 0) + m('qing.dot'),
      puppetHp: 1 + gr('puppetHp') + m('mo.hp'),
      puppetDmg: 1 + gr('puppetDmg'),
      sigDmg: 1 + gr('sigDmg'),
      pierce: Math.floor((p('guanri') + 1) / 2),
      advanceBonus: { metal: ADVANCE.perLevel * p('pojun'), wood: ADVANCE.perLevel * p('fanmao'), water: ADVANCE.perLevel * p('xuanming'), fire: ADVANCE.perLevel * p('liaoyuan'), earth: ADVANCE.perLevel * p('zhenyue') },
    };
  }

  /** exclude：不要出现的选项 key（斩缘补位时排除其余卡） */
  options(n = 3, exclude: string[] = []): Option[] {
    const cands: { o: Option; w: number }[] = [];
    const add = (o: Option, w: number) => {
      if (!this.banned.has(optionKey(o)) && !exclude.includes(optionKey(o))) cands.push({ o, w });
    };
    const elW = (el: El | null) => {
      if (!el) return 1;
      const aff = this.char.balanced ? 1 : AFFINITY_W[relation(this.char.el, el)];
      return aff * (1 + 2 * this.terrain[el]);
    };
    for (const def of Object.values(SKILLS)) {
      if (def.ultimate) continue;
      if (def.exclusive && def.exclusive !== this.char.id) continue;
      const lv = this.skills.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) add({ kind: 'skill', id: def.id, lv: lv + 1 }, 3 * elW(def.el));
      } else if (this.hasOpenSlot) {
        add({ kind: 'skill', id: def.id, lv: 1 }, 2 * elW(def.el));
      }
    }
    for (const def of Object.values(PASSIVES)) {
      const lv = this.passives.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) add({ kind: 'passive', id: def.id, lv: lv + 1 }, 2 * elW(def.el));
      } else if (this.hasOpenSlot && this.unlocked(def)) {
        add({ kind: 'passive', id: def.id, lv: 1 }, 1.5 * elW(def.el));
      }
    }
    const out: Option[] = [];
    while (out.length < n && cands.length) {
      const total = cands.reduce((s, c) => s + c.w, 0);
      let r = Math.random() * total;
      let i = 0;
      while (i < cands.length - 1 && (r -= cands[i].w) > 0) i++;
      out.push(cands[i].o);
      cands.splice(i, 1);
    }
    if (out.length < n && !exclude.includes('heal')) out.push({ kind: 'heal' });
    if (out.length < n && !exclude.includes('lingshi')) out.push({ kind: 'lingshi' });
    return out;
  }

  /** 有前置的心法：要有指定的术，或本系异常心法要有本系的术 */
  private unlocked(def: PassiveDef) {
    const owned = [...this.skills.keys()];
    if (def.requires && !def.requires.some((id) => this.skills.has(id))) return false;
    return !def.needsEl || owned.some((id) => SKILLS[id].el === def.el);
  }

  /** 应用选项，返回本命是否变化 */
  apply(o: Option): boolean {
    if (o.kind === 'skill') {
      const def = SKILLS[o.id];
      if (def.ultimate || (!this.skills.has(o.id) && !this.hasOpenSlot)) return false;
      this.skills.set(o.id, o.lv);
      if (def.el) this.lastLeveled = def.el;
    } else if (o.kind === 'passive') {
      if (!this.passives.has(o.id) && !this.hasOpenSlot) return false;
      this.passives.set(o.id, o.lv);
      const el = PASSIVES[o.id].el;
      if (el) this.lastLeveled = el;
    } else {
      this.version++;
      return false;
    }
    return this.recompute();
  }

  /** 选了这一项之后的灵根和本命（不改动当前构筑），升级界面预览用 */
  preview(o: Option): { lingen: Record<El, number>; benming: El } {
    const saved = { skills: this.skills, passives: this.passives, lingen: this.lingen, benming: this.benming, last: this.lastLeveled, version: this.version };
    // 在副本上试算，原来的 Map 不动
    this.skills = new Map(saved.skills);
    this.passives = new Map(saved.passives);
    this.apply(o);
    const out = { lingen: this.lingen, benming: this.benming };
    this.skills = saved.skills;
    this.passives = saved.passives;
    this.lingen = saved.lingen;
    this.benming = saved.benming;
    this.lastLeveled = saved.last;
    this.version = saved.version;
    return out;
  }

  /** 宝箱：随机一个未满级的技能 +1 */
  chestUpgrade(): { id: SkillId; lv: number } | null {
    const up = [...this.skills].filter(([id, lv]) => lv < SKILLS[id].maxLv);
    if (!up.length) return null;
    const [id, lv] = up[Math.floor(Math.random() * up.length)];
    this.skills.set(id, lv + 1);
    const el = SKILLS[id].el;
    if (el) this.lastLeveled = el;
    return { id, lv: lv + 1 };
  }
}
