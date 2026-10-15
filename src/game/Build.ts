import { GEN_ORDER, type El } from '../config/elements';
import { SKILLS, PASSIVES, SKILL_SLOTS, PASSIVE_SLOTS, type SkillId, type PassiveId } from '../config/skills';
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
}

const EL0 = (v: number): Record<El, number> => ({ metal: v, wood: v, water: v, fire: v, earth: v });

export function optionKey(o: Option) {
  return o.kind === 'skill' || o.kind === 'passive' ? `${o.kind}:${o.id}` : o.kind;
}

/** 修炼项目的合计加成 */
export function upgradeSum(meta: MetaLevels, stat: UpgradeStat) {
  return UPGRADES.filter((u) => u.stat === stat).reduce((s, u) => s + u.v * (meta[u.id] ?? 0), 0);
}

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

  /** mods：星图与传承加成，见 talents.ts */
  constructor(readonly char: CharacterDef, readonly levelDef: LevelDef, readonly meta: MetaLevels = {}, readonly mods: Mods = {}) {
    this.skills.set(char.startSkill, 1);
    this.benming = char.el;
    this.lastLeveled = char.el;
    this.recompute();
  }

  xpNeeded() {
    return this.level < 20 ? 5 + (this.level - 1) * 6 : 119 + (this.level - 20) * 12;
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
    for (const [id, lv] of this.skills) l[SKILLS[id].el] += lv;
    for (const [id, lv] of this.passives) {
      const el = PASSIVES[id].el;
      if (el) l[el] += lv;
    }
    this.lingen = l;
    const max = Math.max(...GEN_ORDER.map((e) => l[e]));
    const top = GEN_ORDER.filter((e) => l[e] === max);
    const prev = this.benming;
    if (!top.includes(prev)) this.benming = top.includes(this.lastLeveled) ? this.lastLeveled : top[0];
    this.version++;
    return prev !== this.benming;
  }

  stats(): PlayerStats {
    const c = this.char;
    // 本系心法效果 +20%
    const p = (id: PassiveId) => (this.passives.get(id) ?? 0) * (PASSIVES[id].el === c.el ? 1.2 : 1);
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
    return {
      maxHp: Math.round(c.hp * (1 + 0.12 * p('houtu') + u('hp') + m('hp'))),
      speed: c.speed * (1 + 0.07 * p('qingshen') + u('speed') + gr('speed') + m('speed')),
      armor,
      regen: (0.4 * p('changsheng') + u('regen') + m('regen')) * (1 + m('regenMult')),
      dmgMult: 1 + 0.08 * p('yanyang') + m('dmg'),
      crit: m('noCrit') ? 0 : 0.05 + (c.crit ?? 0) + 0.06 * p('ruijin') + m('crit') + gr('crit'),
      area: 1 + (c.area ?? 0) + 0.1 * p('roushui') + m('area') + gr('area'),
      pickup: 30 * (1 + (c.pickup ?? 0) + 0.25 * p('juling') + u('pickup') + m('pickup')),
      xpMult: 1 + 0.05 * p('juling') + u('xp') + m('xp'),
      critDmg: 2 + m('critDmg'),
      cdMult: 1 - (c.cdr ?? 0) - m('cd') - gr('cd'),
      elDmg,
      resist,
      vsEl,
      slowMult: 1 + m('slowDur'),
      stunMult: 1 + m('stunDur'),
      burstMult: 1 + m('burst'),
      stillArmor: m('stillArmor'),
      meleeBonus: c.meleeBonus + m('melee') + armor * m('xiao.armorMelee'),
      meleeRange: c.meleeRange + m('meleeRange'),
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
      return (el === this.char.el ? 1.5 : 1) * (1 + 2 * this.levelDef.terrain[el]);
    };
    for (const def of Object.values(SKILLS)) {
      if (def.exclusive && def.exclusive !== this.char.id) continue;
      const lv = this.skills.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) add({ kind: 'skill', id: def.id, lv: lv + 1 }, 3 * elW(def.el));
      } else if (this.skills.size < SKILL_SLOTS) {
        add({ kind: 'skill', id: def.id, lv: 1 }, 2 * elW(def.el));
      }
    }
    for (const def of Object.values(PASSIVES)) {
      const lv = this.passives.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) add({ kind: 'passive', id: def.id, lv: lv + 1 }, 2 * elW(def.el));
      } else if (this.passives.size < PASSIVE_SLOTS) {
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

  /** 应用选项，返回本命是否变化 */
  apply(o: Option): boolean {
    if (o.kind === 'skill') {
      this.skills.set(o.id, o.lv);
      this.lastLeveled = SKILLS[o.id].el;
    } else if (o.kind === 'passive') {
      this.passives.set(o.id, o.lv);
      const el = PASSIVES[o.id].el;
      if (el) this.lastLeveled = el;
    } else {
      this.version++;
      return false;
    }
    return this.recompute();
  }

  /** 宝箱：随机一个未满级的技能 +1 */
  chestUpgrade(): { id: SkillId; lv: number } | null {
    const up = [...this.skills].filter(([id, lv]) => lv < SKILLS[id].maxLv);
    if (!up.length) return null;
    const [id, lv] = up[Math.floor(Math.random() * up.length)];
    this.skills.set(id, lv + 1);
    this.lastLeveled = SKILLS[id].el;
    return { id, lv: lv + 1 };
  }
}
