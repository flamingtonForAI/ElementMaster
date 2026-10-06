import Phaser from 'phaser';
import type { Rel } from '../config/elements';
import { label } from '../ui/text';
import type { GameScene } from '../scenes/GameScene';

interface Num {
  t: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

interface Part {
  s: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

const REL_COLOR: Record<Rel, string> = {
  counter: '#ffd23f',
  fed: '#ffa860',
  drain: '#e8e2d4',
  same: '#e8e2d4',
  countered: '#8a8494',
};

const FX_DEPTH = 1e6;

export class Fx {
  private nums: Num[] = [];
  private numIdx = 0;
  private parts: Part[] = [];
  private partPool: Phaser.GameObjects.Image[] = [];
  private animPool = new Map<string, Phaser.GameObjects.Sprite[]>();

  constructor(private g: GameScene) {
    for (let i = 0; i < 70; i++) {
      const t = label(g, 0, 0, '', '#fff').setOrigin(0.5, 1).setVisible(false).setDepth(FX_DEPTH + 10);
      this.nums.push({ t, life: 0, vy: 0 });
    }
  }

  number(x: number, y: number, v: number, rel: Rel | 'player', crit: boolean, prefix = '') {
    const n = this.nums[this.numIdx];
    this.numIdx = (this.numIdx + 1) % this.nums.length;
    const color = rel === 'player' ? '#ff5a5a' : REL_COLOR[rel];
    n.t.setText(prefix + v + (crit ? '!' : '')).setColor(color).setPosition(Math.round(x + (Math.random() - 0.5) * 8), Math.round(y)).setVisible(true).setAlpha(1);
    n.life = 0.7;
    n.vy = -26;
  }

  text(x: number, y: number, s: string, color: string, life = 1.2) {
    const n = this.nums[this.numIdx];
    this.numIdx = (this.numIdx + 1) % this.nums.length;
    n.t.setText(s).setColor(color).setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(1);
    n.life = life;
    n.vy = -14;
  }

  burst(x: number, y: number, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.partPool.pop() ?? this.g.add.image(0, 0, 'px');
      s.setVisible(true).setTint(color).setPosition(x, y).setDepth(FX_DEPTH).setAlpha(1);
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      const life = 0.3 + Math.random() * 0.3;
      this.parts.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life, max: life });
    }
  }

  droplet(x: number, y: number) {
    const s = this.partPool.pop() ?? this.g.add.image(0, 0, 'px');
    s.setVisible(true).setTint(Math.random() < 0.5 ? 0x8fc0ff : 0x4a7fe8).setPosition(x, y).setDepth(y + 25).setAlpha(1);
    this.parts.push({ s, vx: (Math.random() - 0.5) * 10, vy: 10, life: 0.35, max: 0.35 });
  }

  /** 播放一次性动画后回收 */
  anim(key: string, x: number, y: number, o: { rotation?: number; scale?: number; depth?: number; originY?: number; tint?: number } = {}) {
    let pool = this.animPool.get(key);
    if (!pool) this.animPool.set(key, (pool = []));
    const s = pool.pop() ?? this.g.add.sprite(0, 0, key, 0);
    s.setVisible(true).setActive(true).setPosition(x, y).setRotation(o.rotation ?? 0).setScale(o.scale ?? 1).setOrigin(0.5, o.originY ?? 0.5).setDepth(o.depth ?? FX_DEPTH).setAlpha(1);
    if (o.tint !== undefined) s.setTint(o.tint);
    else s.clearTint();
    s.play(key);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      s.setVisible(false).setActive(false);
      pool!.push(s);
    });
    return s;
  }

  /** 扩散的圆环 */
  ring(x: number, y: number, radius: number, color: number, dur = 0.35) {
    const s = this.g.add.image(x, y, 'fx_ring').setTint(color).setDepth(FX_DEPTH).setScale(0.2).setAlpha(1);
    this.g.tweens.add({ targets: s, scale: radius / 31, alpha: 0, duration: dur * 1000, ease: 'Cubic.out', onComplete: () => s.destroy() });
  }

  /** 预警圆盘 */
  disc(x: number, y: number, radius: number, color: number, alpha: number, dur: number) {
    const s = this.g.add.image(x, y, 'fx_disc').setTint(color).setDepth(y - 40).setScale(radius / 31, (radius / 31) * 0.6).setAlpha(alpha);
    this.g.tweens.add({ targets: s, alpha: alpha * 1.8, duration: dur * 1000, ease: 'Linear', onComplete: () => s.destroy() });
  }

  /** 预警直线 */
  line(x: number, y: number, angle: number, len: number, color: number, dur: number, width = 6) {
    const s = this.g.add.image(x, y, 'px').setOrigin(0, 0.5).setTint(color).setAlpha(0.35).setRotation(angle).setScale(len / 2, width / 2).setDepth(y - 40);
    this.g.tweens.add({ targets: s, alpha: 0.6, duration: dur * 1000, onComplete: () => s.destroy() });
  }

  /** 地面裂纹预警 */
  crack(x: number, y: number, dur: number) {
    const s = this.g.add.image(x, y, 'fx_crack').setDepth(y - 40);
    this.g.tweens.add({ targets: s, alpha: 0, delay: dur * 1000, duration: 200, onComplete: () => s.destroy() });
  }

  update(dt: number) {
    for (const n of this.nums) {
      if (n.life <= 0) continue;
      n.life -= dt;
      n.t.y += n.vy * dt;
      n.vy *= Math.exp(-3 * dt);
      if (n.life < 0.25) n.t.setAlpha(Math.max(0, n.life / 0.25));
      if (n.life <= 0) n.t.setVisible(false);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.vy += 160 * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.s.setAlpha(p.life / p.max);
      if (p.life <= 0) {
        p.s.setVisible(false);
        this.partPool.push(p.s);
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
      }
    }
  }
}
