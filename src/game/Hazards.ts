import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from './Enemies';
import { PLAYER_RADIUS } from './Player';
import { audio } from '../audio/Audio';

/**
 * 关卡地形机制。目前只有落石（第 3 关山林）：地上先出现影子，石头从天而降，
 * 砸中玩家造成土伤害并累积震慑；砸中的普通敌人掉一大截血，引怪进落石区是正当打法。
 */
export class Hazards {
  private nextAt: number;
  private warned = false;

  constructor(private g: GameScene) {
    this.nextAt = g.levelDef.rockfall?.start ?? Infinity;
  }

  update() {
    const g = this.g;
    const rf = g.levelDef.rockfall;
    if (!rf || g.over || g.elapsed < this.nextAt) return;
    const k = Math.min(1, g.elapsed / g.levelDef.duration);
    const every = rf.every[0] + (rf.every[1] - rf.every[0]) * k;
    const count = Math.round(rf.count[0] + (rf.count[1] - rf.count[0]) * k);
    this.nextAt = g.elapsed + every * (0.85 + Math.random() * 0.3);
    if (!this.warned) {
      this.warned = true;
      g.hud.toast('山上落石！看准地上的影子', '#e0ad48');
    }
    const p = g.player;
    // 第一块砸在玩家前进方向上，逼着变向；其余散在附近
    const lead = p.moving ? 0.7 * g.pstats.speed : 0;
    this.drop(p.x + p.facing.x * lead, p.y + p.facing.y * lead);
    for (let i = 1; i < count; i++) this.scatter(50, 150);
  }

  /** Boss 用：在玩家周围一口气砸 n 块 */
  rain(n: number) {
    const p = this.g.player;
    this.drop(p.x, p.y);
    for (let i = 1; i < n; i++) this.scatter(40, 130);
  }

  private scatter(r0: number, r1: number) {
    const p = this.g.player;
    const a = Math.random() * Math.PI * 2;
    const r = r0 + Math.random() * (r1 - r0);
    this.drop(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8);
  }

  private drop(x: number, y: number) {
    const g = this.g;
    const rf = g.levelDef.rockfall ?? { radius: 20, warn: 1.1, dmg: 12 };
    const R = rf.radius;
    // 影子越来越深，石头加速落下，落地瞬间结算
    g.fx.disc(x, y, R, 0x1a1208, 0.3, rf.warn);
    g.fx.disc(x, y, R, 0xdaa53e, 0.12, rf.warn);
    const rock = g.add.image(x, y - 150, 'fx_boulder').setOrigin(0.5, 0.9).setDepth(1e6 - 1);
    g.tweens.add({ targets: rock, y, duration: rf.warn * 1000, ease: 'Quad.in', onComplete: () => rock.destroy() });
    g.later(rf.warn, () => {
      if (g.over) return;
      audio.sfx('explode', { rate: 0.8, vol: 0.5 });
      g.fx.crack(x, y, 0.6);
      g.fx.ring(x, y - 2, R + 4, 0xdaa53e, 0.3);
      g.fx.burst(x, y - 4, 0x8a6220, 10);
      const p = g.player;
      if (Math.hypot(p.x - x, (p.y - y) / 0.6) < R + PLAYER_RADIUS) {
        g.hurtPlayer(rf.dmg * g.dmgScale(), 'earth', { inflict: { kind: 'stun', chance: 1 } });
        g.cameras.main.shake(120, 0.005);
      }
      const tmp: Enemy[] = [];
      for (const e of g.enemies.inRadius(x, y, R, tmp)) if (!e.boss) g.envDamage(e, e.maxHp * (e.elite ? 0.15 : 0.6));
    });
  }
}
