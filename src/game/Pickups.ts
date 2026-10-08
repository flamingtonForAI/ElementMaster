import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

class Gem {
  active = false;
  x = 0;
  y = 0;
  value = 0;
  magnet = false;
  speed = 0;
  constructor(readonly sprite: Phaser.GameObjects.Image) {}
}

const MAX_GEMS = 400;

export class PickupManager {
  private gems: Gem[] = [];
  private pool: Gem[] = [];
  private chests: Phaser.GameObjects.Image[] = [];
  private pills: Phaser.GameObjects.Image[] = [];

  constructor(private g: GameScene) {}

  gem(x: number, y: number, value: number) {
    // 太多时合并到附近的经验球
    if (this.gems.length >= MAX_GEMS) {
      let best: Gem | null = null;
      let bd = Infinity;
      for (const o of this.gems) {
        const d = (o.x - x) ** 2 + (o.y - y) ** 2;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        best.value += value;
        best.sprite.setTexture(this.tex(best.value));
        return;
      }
    }
    const gm = this.pool.pop() ?? new Gem(this.g.add.image(0, 0, 'gem_s'));
    gm.active = true;
    gm.x = x + (Math.random() - 0.5) * 6;
    gm.y = y + (Math.random() - 0.5) * 6;
    gm.value = value;
    gm.magnet = false;
    gm.speed = 0;
    gm.sprite.setTexture(this.tex(value)).setVisible(true).setPosition(gm.x, gm.y).setDepth(gm.y - 20);
    this.gems.push(gm);
  }

  chest(x: number, y: number) {
    const c = this.g.add.image(x, y, 'chest').setOrigin(0.5, 0.9).setDepth(y);
    this.g.tweens.add({ targets: c, y: y - 3, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
    c.setData('y', y);
    this.chests.push(c);
  }

  /** 回气丹：拾取回复 15% 生命 */
  pill(x: number, y: number) {
    this.pills.push(this.g.add.image(x, y, 'pill').setOrigin(0.5, 0.9).setDepth(y));
  }

  /** 吸取全部经验球 */
  magnetAll() {
    for (const gm of this.gems) gm.magnet = true;
  }

  private tex(v: number) {
    return v >= 20 ? 'gem_l' : v >= 5 ? 'gem_m' : 'gem_s';
  }

  update(dt: number) {
    const g = this.g;
    const p = g.player;
    const r2 = g.pstats.pickup * g.pstats.pickup;
    for (const gm of this.gems) {
      const dx = p.x - gm.x;
      const dy = p.y - 6 - gm.y;
      const d2 = dx * dx + dy * dy;
      if (!gm.magnet && d2 < r2) gm.magnet = true;
      if (gm.magnet) {
        gm.speed = Math.min(400, gm.speed + 600 * dt);
        const d = Math.sqrt(d2) || 1;
        const step = Math.min(d, (60 + gm.speed) * dt);
        gm.x += (dx / d) * step;
        gm.y += (dy / d) * step;
        gm.sprite.setPosition(gm.x, gm.y).setDepth(gm.y);
        if (d < 8) {
          gm.active = false;
          gm.sprite.setVisible(false);
          audio.gem();
          g.gainXp(gm.value);
        }
      }
    }
    for (let i = this.gems.length - 1; i >= 0; i--) {
      if (!this.gems[i].active) {
        this.pool.push(this.gems[i]);
        this.gems[i] = this.gems[this.gems.length - 1];
        this.gems.pop();
      }
    }
    for (let i = this.pills.length - 1; i >= 0; i--) {
      const c = this.pills[i];
      if (Math.hypot(p.x - c.x, p.y - c.y) < 12) {
        this.pills.splice(i, 1);
        c.destroy();
        g.healPlayer(0.15);
      } else if (Math.abs(p.x - c.x) > 900 || Math.abs(p.y - c.y) > 700) {
        this.pills.splice(i, 1);
        c.destroy();
      }
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      if (Math.hypot(p.x - c.x, p.y - c.getData('y')) < 16) {
        this.chests.splice(i, 1);
        g.tweens.killTweensOf(c);
        c.destroy();
        g.openChest();
      }
    }
  }
}
