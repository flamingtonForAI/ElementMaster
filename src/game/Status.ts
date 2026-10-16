import { ON_PLAYER, STATUS_INFO, statusChance, type Inflict } from '../config/status';
import type { GameScene } from '../scenes/GameScene';

/**
 * 玩家身上的异常。中毒单层，取更强的伤害和更晚的结束时间；灼烧最多 3 层，每叠一层刷新时间；
 * 震慑先攒累积，攒满才定身，之后免疫一段时间
 */
export class PlayerStatus {
  slowUntil = 0;
  poisonUntil = 0;
  poisonDps = 0;
  burnUntil = 0;
  burnStacks = 0;
  burnDps = 0;
  flawUntil = 0;
  stunUntil = 0;
  stunImmuneUntil = 0;
  /** 震慑累积次数，lastStunHit 之后 window 秒没再被打就清零 */
  stunBuild = 0;
  private lastStunHit = 0;
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
  get flawed() {
    return this.g.now < this.flawUntil;
  }
  get stunned() {
    return this.g.now < this.stunUntil;
  }
  /** 当前震慑累积（0–1），超时清零 */
  get stunMeter() {
    if (this.g.now - this.lastStunHit > ON_PLAYER.stun.window) return 0;
    return this.stunBuild / ON_PLAYER.stun.need;
  }

  get speedMult() {
    return this.slowed ? ON_PLAYER.slow.f : 1;
  }
  get regenMult() {
    return this.poisoned ? ON_PLAYER.poison.regen : 1;
  }
  /** 破绽：所有敌人对你的暴击率提高 */
  get critTaken() {
    return this.flawed ? ON_PLAYER.flaw.crit : 0;
  }

  /** 命中后按几率挂上异常；几率按异常元素和本命的生克缩放 */
  inflict(f: Inflict) {
    const g = this.g;
    if (Math.random() >= f.chance * statusChance(f.kind, g.build.benming, true)) return;
    const now = g.now;
    const p = g.player;
    const info = STATUS_INFO[f.kind];
    let shown = false;
    switch (f.kind) {
      case 'slow':
        shown = !this.slowed;
        this.slowUntil = now + (f.dur ?? ON_PLAYER.slow.dur);
        break;
      case 'poison':
        if (now < this.antidoteUntil) return;
        if (!this.poisoned) {
          this.poisonDps = 0;
          this.resetTick();
          shown = true;
        }
        this.poisonDps = Math.max(this.poisonDps, f.dps ?? 0);
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
        this.burnDps = Math.max(this.burnDps, f.dps ?? 0);
        this.burnUntil = now + (f.dur ?? ON_PLAYER.burn.dur);
        break;
      case 'flaw':
        shown = !this.flawed;
        this.flawUntil = now + (f.dur ?? ON_PLAYER.flaw.dur);
        break;
      case 'stun': {
        const S = ON_PLAYER.stun;
        if (this.stunned || now < this.stunImmuneUntil) return;
        if (now - this.lastStunHit > S.window) this.stunBuild = 0;
        this.lastStunHit = now;
        this.stunBuild++;
        if (this.stunBuild < S.need) return;
        this.stunBuild = 0;
        this.stunUntil = now + S.dur;
        this.stunImmuneUntil = this.stunUntil + S.immune;
        shown = true;
        g.cameras.main.shake(120, 0.004);
        break;
      }
    }
    if (shown) {
      const name = f.kind === 'burn' && this.burnStacks > 1 ? `${info.name}×${this.burnStacks}` : info.name;
      g.fx.text(p.x, p.y - 40, name, info.css, 0.8);
    }
  }

  /** 中毒和灼烧每 0.5 秒一起结算，不吃护甲和无敌帧 */
  update(dt: number) {
    const g = this.g;
    if (!this.poisoned && !this.burning) return;
    if (!g.player.alive || g.over) return;
    this.tick -= dt;
    if (this.tick > 0) return;
    this.tick += 0.5;
    if (g.dbg.god) return;
    const p = g.player;
    const dps = (this.poisoned ? this.poisonDps : 0) + (this.burning ? this.burnStacks * this.burnDps : 0);
    const dmg = Math.max(1, Math.round(dps * 0.5));
    g.fx.text(p.x + 8, p.y - 26, `${dmg}`, this.burning ? STATUS_INFO.burn.css : STATUS_INFO.poison.css, 0.6);
    g.loseHp(dmg);
  }

  /** 解毒药：清毒并免疫中毒一段时间 */
  cure(immune: number) {
    this.poisonUntil = 0;
    this.antidoteUntil = this.g.now + immune;
  }

  clear() {
    this.slowUntil = this.poisonUntil = this.burnUntil = this.flawUntil = this.stunUntil = 0;
    this.stunBuild = 0;
  }

  /** 已经在掉血时不重置结算节奏，避免两种 DoT 交替挂上时连跳 */
  private resetTick() {
    if (!this.poisoned && !this.burning) this.tick = 0.5;
  }
}
