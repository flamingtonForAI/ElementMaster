import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';
import type { TalismanId } from '../config/map';

export type ChestKind = 'gold' | 'copper';

/** 地图上刷出来的东西，不会因为离得远而消失，到时间才消失 */
export interface MapItem {
  img: Phaser.GameObjects.Image;
  kind: 'crate' | 'talisman';
  talisman?: TalismanId;
  expire: number;
  /** 刷出的时刻，小地图上新东西闪一下 */
  born: number;
}

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
  readonly chests: { img: Phaser.GameObjects.Image; kind: ChestKind }[] = [];
  readonly items: MapItem[] = [];
  private pills: Phaser.GameObjects.Image[] = [];
  private antidotes: Phaser.GameObjects.Image[] = [];

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

  chest(x: number, y: number, kind: ChestKind = 'gold') {
    const c = this.g.add.image(x, y, kind === 'gold' ? 'chest' : 'chest_copper').setOrigin(0.5, 0.9).setDepth(y);
    this.g.tweens.add({ targets: c, y: y - 3, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
    c.setData('y', y);
    this.chests.push({ img: c, kind });
  }

  /** 木匣：碰到就开 */
  crate(x: number, y: number, life: number) {
    this.items.push({ img: this.g.add.image(x, y, 'crate').setOrigin(0.5, 0.9).setDepth(y), kind: 'crate', expire: this.g.now + life, born: this.g.now });
  }

  /** 符箓：飘在空中，拾取即用 */
  talisman(x: number, y: number, id: TalismanId, life: number) {
    const img = this.g.add.image(x, y, `item_${id}`).setOrigin(0.5, 0.9).setDepth(y);
    this.g.tweens.add({ targets: img, y: y - 4, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    img.setData('y', y);
    this.items.push({ img, kind: 'talisman', talisman: id, expire: this.g.now + life, born: this.g.now });
  }

  /** 回气丹：拾取回复 15% 生命 */
  pill(x: number, y: number) {
    this.pills.push(this.g.add.image(x, y, 'pill').setOrigin(0.5, 0.9).setDepth(y));
  }

  /** 解毒药：拾取清除中毒并短暂免疫 */
  antidote(x: number, y: number) {
    const c = this.g.add.image(x, y, 'antidote').setOrigin(0.5, 0.9).setDepth(y);
    this.g.tweens.add({ targets: c, scale: 1.15, yoyo: true, repeat: -1, duration: 400, ease: 'Sine.inOut' });
    this.antidotes.push(c);
  }

  /** 吸取全部经验球 */
  magnetAll() {
    for (const gm of this.gems) gm.magnet = true;
  }

  private tex(v: number) {
    return v >= 20 ? 'gem_l' : v >= 5 ? 'gem_m' : 'gem_s';
  }

  /** 傀儡经过：附近的经验球飞向本体 */
  magnetNear(x: number, y: number, r: number) {
    const r2 = r * r;
    for (const gm of this.gems) if (!gm.magnet && (gm.x - x) ** 2 + (gm.y - y) ** 2 < r2) gm.magnet = true;
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
    for (let i = this.antidotes.length - 1; i >= 0; i--) {
      const c = this.antidotes[i];
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < 12 || d > 1000) {
        this.antidotes.splice(i, 1);
        g.tweens.killTweensOf(c);
        c.destroy();
        if (d < 12) g.curePoison();
      }
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const { img: c, kind } = this.chests[i];
      if (Math.hypot(p.x - c.x, p.y - c.getData('y')) < 16) {
        this.chests.splice(i, 1);
        g.tweens.killTweensOf(c);
        c.destroy();
        if (kind === 'gold') g.openChest();
        else g.openCopper();
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const c = it.img;
      const left = it.expire - g.now;
      if (left <= 0) {
        this.items.splice(i, 1);
        g.tweens.killTweensOf(c);
        c.destroy();
        continue;
      }
      // 最后 10 秒闪烁，越接近消失闪得越快
      c.setAlpha(left < 10 ? (Math.sin(g.now * (left < 4 ? 18 : 9)) > 0 ? 1 : 0.35) : 1);
      if (Math.hypot(p.x - c.x, p.y - (c.getData('y') ?? c.y)) < 15) {
        this.items.splice(i, 1);
        g.tweens.killTweensOf(c);
        if (it.kind === 'crate') {
          g.fx.burst(c.x, c.y - 6, 0xa8783a, 8);
          g.openCrate(c.x, c.y);
        } else {
          g.useTalisman(it.talisman!);
        }
        c.destroy();
      }
    }
  }
}
