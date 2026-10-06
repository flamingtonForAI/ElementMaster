import Phaser from 'phaser';
import type { El } from '../config/elements';
import { PLAYER_RADIUS } from './Player';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';

export type ProjKind = 'sword' | 'wave' | 'leaf' | 'water' | 'lob' | 'enemy';

export class Proj {
  active = false;
  kind: ProjKind = 'sword';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  dmg = 0;
  el: El = 'metal';
  pierce = 0;
  bounces = 0;
  radius = 4;
  life = 0;
  slow = 0;
  kb = 0;
  target: Enemy | null = null;
  hit = new Set<number>();
  // 抛物线
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  t = 0;
  dur = 0;
  aoe = 0;
  trail = 0;
  constructor(readonly sprite: Phaser.GameObjects.Sprite) {}
}

export interface FireOpts {
  dmg: number;
  el: El;
  life: number;
  pierce?: number;
  bounces?: number;
  radius?: number;
  slow?: number;
  kb?: number;
  target?: Enemy | null;
  anim?: string;
}

export class ProjectileManager {
  private list: Proj[] = [];
  private pool: Proj[] = [];
  private tmp: Enemy[] = [];

  constructor(private g: GameScene) {}

  private take(tex: string): Proj {
    const p = this.pool.pop() ?? new Proj(this.g.add.sprite(0, 0, tex, 0));
    p.sprite.setTexture(tex, 0).setVisible(true).setActive(true).setAlpha(1).setScale(1).setRotation(0).clearTint().setOrigin(0.5);
    p.sprite.anims.stop();
    p.hit.clear();
    p.active = true;
    p.target = null;
    p.trail = 0;
    this.list.push(p);
    return p;
  }

  fire(kind: ProjKind, tex: string, x: number, y: number, vx: number, vy: number, o: FireOpts): Proj {
    const p = this.take(tex);
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.dmg = o.dmg;
    p.el = o.el;
    p.life = o.life;
    p.pierce = o.pierce ?? 0;
    p.bounces = o.bounces ?? 0;
    p.radius = o.radius ?? 4;
    p.slow = o.slow ?? 0;
    p.kb = o.kb ?? 20;
    p.target = o.target ?? null;
    if (o.anim) p.sprite.play(o.anim);
    return p;
  }

  /** 抛物线投掷，落地触发 onLand */
  lob(tex: string, anim: string, sx: number, sy: number, tx: number, ty: number, dur: number, dmg: number, el: El, aoe: number) {
    const p = this.take(tex);
    p.kind = 'lob';
    p.sx = p.x = sx;
    p.sy = p.y = sy;
    p.tx = tx;
    p.ty = ty;
    p.t = 0;
    p.dur = dur;
    p.dmg = dmg;
    p.el = el;
    p.aoe = aoe;
    p.life = dur + 1;
    p.sprite.play(anim);
  }

  enemyShot(tex: string, x: number, y: number, vx: number, vy: number, dmg: number, el: El) {
    const p = this.take(tex);
    p.kind = 'enemy';
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.dmg = dmg;
    p.el = el;
    p.life = 5;
    p.radius = 4;
  }

  update(dt: number) {
    const g = this.g;
    const pl = g.player;
    for (const p of this.list) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }

      if (p.kind === 'lob') {
        p.t += dt;
        const k = Math.min(1, p.t / p.dur);
        p.x = p.sx + (p.tx - p.sx) * k;
        p.y = p.sy + (p.ty - p.sy) * k;
        p.sprite.setPosition(p.x, p.y - Math.sin(k * Math.PI) * 36).setDepth(p.y + 20);
        if (k >= 1) {
          g.explode(p.x, p.y, p.aoe, p.dmg, p.el, 80);
          this.release(p);
        }
        continue;
      }

      if (p.kind === 'sword' && p.target) {
        if (!p.target.alive) p.target = g.enemies.nearest(p.x, p.y, 200, p.hit);
        if (p.target) {
          const want = Math.atan2(p.target.y - 6 - p.y, p.target.x - p.x);
          const cur = Math.atan2(p.vy, p.vx);
          const diff = Phaser.Math.Angle.Wrap(want - cur);
          const turn = Math.sign(diff) * Math.min(Math.abs(diff), 7 * dt);
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(cur + turn) * sp;
          p.vy = Math.sin(cur + turn) * sp;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const s = p.sprite;
      s.setPosition(p.x, p.y).setDepth(p.y + 30);
      if (p.kind === 'leaf') s.rotation += 14 * dt;
      else if (p.kind !== 'enemy') s.setRotation(Math.atan2(p.vy, p.vx));
      else s.rotation += 6 * dt;

      if (p.kind === 'water') {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.03;
          g.fx.droplet(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
        }
      }

      if (Math.abs(p.x - pl.x) > 480 || Math.abs(p.y - pl.y) > 320) {
        this.release(p);
        continue;
      }

      if (p.kind === 'enemy') {
        if (pl.alive && Math.hypot(pl.x - p.x, pl.y - 6 - p.y) < p.radius + PLAYER_RADIUS) {
          g.hurtPlayer(p.dmg, p.el);
          this.release(p);
        }
        continue;
      }

      // 命中敌人（以身体中心判定）
      const hits = g.enemies.inRadius(p.x, p.y + 6, p.radius, this.tmp);
      for (const e of hits) {
        if (p.hit.has(e.id)) continue;
        p.hit.add(e.id);
        g.hitEnemy(e, p.dmg, p.el, { kb: p.kb, fromX: p.x - p.vx, fromY: p.y - p.vy, slow: p.slow });
        if (p.kind === 'leaf') {
          p.bounces--;
          const next = p.bounces >= 0 ? g.enemies.nearest(p.x, p.y, 130, p.hit) : null;
          if (!next) {
            this.release(p);
          } else {
            const a = Math.atan2(next.y - 6 - p.y, next.x - p.x);
            const sp = Math.hypot(p.vx, p.vy);
            p.vx = Math.cos(a) * sp;
            p.vy = Math.sin(a) * sp;
          }
          break;
        }
        p.pierce--;
        if (p.pierce < 0) {
          this.release(p);
          break;
        }
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].active) {
        this.pool.push(this.list[i]);
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
      }
    }
  }

  clearEnemyShots() {
    for (const p of this.list) if (p.active && p.kind === 'enemy') this.release(p);
  }

  private release(p: Proj) {
    p.active = false;
    p.sprite.setVisible(false).setActive(false);
    p.sprite.anims.stop();
  }
}
