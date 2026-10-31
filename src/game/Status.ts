import { FROZEN, MOB_REPEAT, MOB_SLOW_DUR, ON_PLAYER, STATUS_INFO, statusChance, statusPower, type Inflict, type StatusId } from '../config/status';
import type { GameScene } from '../scenes/GameScene';

/**
 * 玩家身上的异常，和敌人同一套规则。中毒单层，取更强的伤害和更晚的结束时间；灼烧、流血叠层，每叠一层刷新时间，流血叠满撕裂；
 * 迟缓攒寒意、震慑攒层数，攒满冰冻或定身，之后免疫一段时间。星图的御 X 降低对应异常的几率（sres.<异常>）；
 * 小怪的异常已经挂着时，再中的几率乘 MOB_REPEAT
 */
export class PlayerStatus {
  slowUntil = 0;
  poisonUntil = 0;
  poisonDps = 0;
  burnUntil = 0;
  burnStacks = 0;
  burnDps = 0;
  bleedUntil = 0;
  bleedStacks = 0;
  bleedDps = 0;
  stunUntil = 0;
  frozen = false;
  stunImmuneUntil = 0;
  /** 震慑累积次数，lastStunHit 之后 window 秒没再被打就清零 */
  stunBuild = 0;
  private lastStunHit = 0;
  /** 寒意累积，规则同震慑 */
  chillBuild = 0;
  private lastChill = 0;
  private chillImmuneUntil = 0;
  /** 解毒药的免疫期 */
  antidoteUntil = 0;
  private tick = 0;

  constructor(private g: GameScene) {}

  get slowed() {
    return this.g.now < this.slowUntil;
  }
  get poisoned() {
    return this.g.now < this.poisonUntil;
  }
  get burning() {
    return this.g.now < this.burnUntil;
  }
  get bleeding() {
    return this.g.now < this.bleedUntil;
  }
  get stunned() {
    return this.g.now < this.stunUntil;
  }
  /** 当前震慑累积（0–1），超时清零 */
  get stunMeter() {
    if (this.g.now - this.lastStunHit > ON_PLAYER.stun.window) return 0;
    return this.stunBuild / ON_PLAYER.stun.need;
  }
  /** 当前寒意累积（0–1），超时清零 */
  get chillMeter() {
    if (this.g.now - this.lastChill > ON_PLAYER.chill.window) return 0;
    return this.chillBuild / ON_PLAYER.chill.need;
  }

  /** 身上是否挂着这种异常 */
  has(kind: StatusId) {
    return kind === 'slow' ? this.slowed : kind === 'poison' ? this.poisoned : kind === 'burn' ? this.burning : kind === 'bleed' ? this.bleeding : this.stunned;
  }

  get speedMult() {
    return this.slowed ? ON_PLAYER.slow.f : 1;
  }
  get regenMult() {
    return this.poisoned ? ON_PLAYER.poison.regen : 1;
  }
  /** 命中后按几率挂上异常；几率按异常元素和本命的生克缩放 */
  inflict(f: Inflict) {
    const g = this.g;
    const sres = g.build.mods[`sres.${f.kind}`] ?? 0;
    const activeOrBuilding = this.has(f.kind) || (f.kind === 'stun' && this.stunMeter > 0);
    const again = f.mob && activeOrBuilding ? MOB_REPEAT : 1;
    if (Math.random() >= f.chance * again * statusChance(f.kind, g.build.benming) * Math.max(0, 1 - sres)) return;
    // 本命和异常同系、或克这个异常时，异常也变弱
    const k = statusPower(f.kind, g.build.benming);
    const now = g.now;
    const p = g.player;
    const info = STATUS_INFO[f.kind];
    let shown = false;
    switch (f.kind) {
      case 'slow': {
        shown = !this.slowed;
        this.slowUntil = Math.max(this.slowUntil, now + (f.dur ?? ON_PLAYER.slow.dur) * k * (f.mob ? MOB_SLOW_DUR : 1));
        const C = ON_PLAYER.chill;
        if (this.stunned || now < this.chillImmuneUntil || Math.random() >= k) break;
        if (now - this.lastChill > C.window) this.chillBuild = 0;
        if (f.mob && this.chillBuild > 0 && now - this.lastChill < 0.25) break;
        this.lastChill = now;
        if (++this.chillBuild < C.need) break;
        this.chillBuild = 0;
        this.stunUntil = now + C.dur;
        this.frozen = true;
        this.chillImmuneUntil = this.stunUntil + C.immune;
        g.fx.text(p.x, p.y - 40, FROZEN.name, FROZEN.css, 0.8);
        return;
      }
      case 'poison':
        if (now < this.antidoteUntil) return;
        if (!this.poisoned) {
          this.poisonDps = 0;
          this.resetTick();
          shown = true;
        }
        this.poisonDps = Math.max(this.poisonDps, (f.dps ?? 0) * k);
        this.poisonUntil = Math.max(this.poisonUntil, now + (f.dur ?? ON_PLAYER.poison.dur));
        break;
      case 'burn':
        if (!this.burning) {
          this.burnStacks = this.burnDps = 0;
          this.resetTick();
        }
        if (this.burnStacks < ON_PLAYER.burn.max) {
          this.burnStacks++;
          shown = true;
        }
        this.burnDps = Math.max(this.burnDps, (f.dps ?? 0) * k);
        this.burnUntil = now + (f.dur ?? ON_PLAYER.burn.dur);
        break;
      case 'bleed': {
        if (!this.bleeding) {
          this.bleedStacks = this.bleedDps = 0;
          this.resetTick();
        }
        this.bleedStacks++;
        shown = true;
        const nextDps = (f.dps ?? 0) * k;
        this.bleedDps = this.bleedStacks === 1 ? nextDps : (this.bleedDps * (this.bleedStacks - 1) + nextDps) / this.bleedStacks;
        this.bleedUntil = now + (f.dur ?? ON_PLAYER.bleed.dur);
        if (this.bleedStacks >= ON_PLAYER.bleed.max) {
          // 撕裂：剩下的流血一次打完
          const dmg = Math.max(1, Math.round(this.bleedStacks * this.bleedDps * ON_PLAYER.bleed.dur));
          this.bleedStacks = this.bleedDps = 0;
          this.bleedUntil = 0;
          g.fx.text(p.x, p.y - 40, '撕裂', info.css, 0.8);
          if (!g.dbg.god) g.loseHp(dmg);
          return;
        }
        break;
      }
      case 'stun': {
        const S = ON_PLAYER.stun;
        if (this.stunned || now < this.stunImmuneUntil) return;
        if (now - this.lastStunHit > S.window) this.stunBuild = 0;
        if (f.mob && this.stunBuild > 0 && now - this.lastStunHit < 0.25) return;
        this.lastStunHit = now;
        this.stunBuild++;
        if (this.stunBuild < S.need) return;
        this.stunBuild = 0;
        this.stunUntil = now + S.dur;
        this.frozen = false;
        this.stunImmuneUntil = this.stunUntil + S.immune;
        shown = true;
        g.cameras.main.shake(120, 0.004);
        break;
      }
    }
    if (shown) {
      const stacks = f.kind === 'burn' ? this.burnStacks : f.kind === 'bleed' ? this.bleedStacks : 0;
      const name = stacks > 1 ? `${info.name}×${stacks}` : info.name;
      g.fx.text(p.x, p.y - 40, name, info.css, 0.8);
    }
  }

  /** 中毒和灼烧每 0.5 秒一起结算，不吃护甲和无敌帧 */
  update(dt: number) {
    const g = this.g;
    if (!this.poisoned && !this.burning && !this.bleeding) return;
    if (!g.player.alive || g.over) return;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick += 0.5;
    if (g.dbg.god) return;
    const p = g.player;
    const dps = (this.poisoned ? this.poisonDps : 0) + (this.burning ? this.burnStacks * this.burnDps : 0) + (this.bleeding ? this.bleedStacks * this.bleedDps : 0);
    const dmg = Math.max(1, Math.round(dps * 0.5));
    const css = this.burning ? STATUS_INFO.burn.css : this.poisoned ? STATUS_INFO.poison.css : STATUS_INFO.bleed.css;
    g.fx.text(p.x + 8, p.y - 26, `${dmg}`, css, 0.6);
    g.loseHp(dmg);
  }

  /** 解毒药：清毒并免疫中毒一段时间 */
  cure(immune: number) {
    this.poisonUntil = 0;
    this.antidoteUntil = this.g.now + immune;
  }

  clear() {
    this.slowUntil = this.poisonUntil = this.burnUntil = this.bleedUntil = this.stunUntil = 0;
    this.stunBuild = this.chillBuild = this.bleedStacks = 0;
  }

  /** 已经在掉血时不重置结算节奏，避免两种 DoT 交替挂上时连跳 */
  private resetTick() {
    if (!this.poisoned && !this.burning && !this.bleeding) this.tick = 0.5;
  }
}
