import Phaser from 'phaser';
import type { El } from '../config/elements';
import { PLAYER_RADIUS } from './Player';
import type { Enemy } from './Enemies';
import type { GameScene, HurtOpts } from '../scenes/GameScene';

export type ProjKind = 'sword' | 'fu' | 'bolt' | 'wave' | 'leaf' | 'water' | 'lob' | 'enemy';

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
  /** 命中触发本元素异常的几率 */
  proc = 0;
  kb = 0;
  target: Enemy | null = null;
  /** 敌人对象会被对象池复用，id 对不上就重新找 */
  targetId = 0;
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
  /** 命中敌人后的额外效果 */
  onHit: ((e: Enemy) => void) | null = null;
  /** 命中时按目标调整伤害（如弩箭按距离衰减） */
  dmgAt: ((e: Enemy) => number) | null = null;
  /** 命中时只触发 onHit、不直接造成伤害（贴符） */
  stick = false;
  /** 抛物线弧高 */
  arc = 36;
  /** 抛物线落地时代替默认爆炸 */
  onLand: ((x: number, y: number) => void) | null = null;
  /** 敌方弹幕的异常和暴击 */
  hurt: HurtOpts | undefined = undefined;
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
  proc?: number;
  kb?: number;
  target?: Enemy | null;
  anim?: string;
  onHit?: (e: Enemy) => void;
  dmgAt?: (e: Enemy) => number;
  stick?: boolean;
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
    p.proc = o.proc ?? 0;
    p.kb = o.kb ?? 20;
    p.target = o.target ?? null;
    p.targetId = p.target?.id ?? 0;
    p.onHit = o.onHit ?? null;
    p.dmgAt = o.dmgAt ?? null;
    p.stick = !!o.stick;
    if (o.anim) p.sprite.play(o.anim);
    return p;
  }

  /** 抛物线投掷，落地触发 onLand */
  lob(tex: string, anim: string, sx: number, sy: number, tx: number, ty: number, dur: number, dmg: number, el: El, aoe: number, onLand?: (x: number, y: number) => void, arc = 36) {
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
    p.onLand = onLand ?? null;
    p.stick = false;
    p.proc = 0;
    p.arc = arc;
    p.life = dur + 1;
    p.sprite.play(anim);
    return p;
  }

  enemyShot(tex: string, x: number, y: number, vx: number, vy: number, dmg: number, el: El, hurt?: HurtOpts) {
    const p = this.take(tex);
    p.hurt = hurt;
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
        p.sprite.setPosition(p.x, p.y - Math.sin(k * Math.PI) * p.arc).setDepth(p.y + 20);
        if (k >= 1) {
          if (p.onLand) p.onLand(p.x, p.y);
          else g.explode(p.x, p.y, p.aoe, p.dmg, p.el, 80, undefined, p.proc);
          this.release(p);
        }
        continue;
      }

      // 带目标的弹道会追踪（飞剑、贴符）
      if (p.target) {
        if (!p.target.alive || p.target.id !== p.targetId) {
          p.target = g.enemies.nearest(p.x, p.y, 200, p.hit);
          p.targetId = p.target?.id ?? 0;
        }
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
      else if (p.kind === 'fu') s.setRotation(Math.atan2(p.vy, p.vx) + Math.PI / 2);
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
          g.hurtPlayer(p.dmg, p.el, p.hurt);
          this.release(p);
        }
        continue;
      }

      // 命中敌人（以身体中心判定）
      const hits = g.enemies.inRadius(p.x, p.y + 6, p.radius, this.tmp);
      for (const e of hits) {
        if (p.hit.has(e.id)) continue;
        p.hit.add(e.id);
        if (p.stick) {
          p.onHit?.(e);
          this.release(p);
          break;
        }
        g.hitEnemy(e, p.dmg * (p.dmgAt?.(e) ?? 1), p.el, { kb: p.kb, fromX: p.x - p.vx, fromY: p.y - p.vy, slow: p.slow, proc: p.proc });
        p.onHit?.(e);
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
