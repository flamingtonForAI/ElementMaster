import { GEN_ORDER, type El } from '../config/elements';
import { SKILLS, PASSIVES, SKILL_SLOTS, PASSIVE_SLOTS, type SkillId, type PassiveId } from '../config/skills';
import type { CharacterDef } from '../config/characters';
import type { LevelDef } from '../config/levels';

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
  private lastLeveled: El;

  constructor(readonly char: CharacterDef, readonly levelDef: LevelDef) {
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
    const p = (id: PassiveId) => this.passives.get(id) ?? 0;
    return {
      maxHp: Math.round(this.char.hp * (1 + 0.12 * p('houtu'))),
      speed: this.char.speed * (1 + 0.07 * p('qingshen')),
      armor: this.char.armor + p('houtu'),
      regen: 0.4 * p('changsheng'),
      dmgMult: 1 + 0.08 * p('yanyang'),
      crit: 0.05 + 0.06 * p('ruijin'),
      area: 1 + 0.1 * p('roushui'),
      pickup: 30 * (1 + 0.25 * p('juling')),
      xpMult: 1 + 0.05 * p('juling'),
    };
  }

  options(n = 3): Option[] {
    const cands: { o: Option; w: number }[] = [];
    const elW = (el: El | null) => {
      if (!el) return 1;
      return (el === this.char.el ? 1.5 : 1) * (1 + 2 * this.levelDef.terrain[el]);
    };
    for (const def of Object.values(SKILLS)) {
      if (def.exclusive && def.exclusive !== this.char.id) continue;
      const lv = this.skills.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) cands.push({ o: { kind: 'skill', id: def.id, lv: lv + 1 }, w: 3 * elW(def.el) });
      } else if (this.skills.size < SKILL_SLOTS) {
        cands.push({ o: { kind: 'skill', id: def.id, lv: 1 }, w: 2 * elW(def.el) });
      }
    }
    for (const def of Object.values(PASSIVES)) {
      const lv = this.passives.get(def.id);
      if (lv !== undefined) {
        if (lv < def.maxLv) cands.push({ o: { kind: 'passive', id: def.id, lv: lv + 1 }, w: 2 * elW(def.el) });
      } else if (this.passives.size < PASSIVE_SLOTS) {
        cands.push({ o: { kind: 'passive', id: def.id, lv: 1 }, w: 1.5 * elW(def.el) });
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
    if (out.length < n) out.push({ kind: 'heal' });
    if (out.length < n) out.push({ kind: 'lingshi' });
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
