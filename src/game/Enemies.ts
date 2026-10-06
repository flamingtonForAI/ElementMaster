import Phaser from 'phaser';
import { ENEMIES, type EnemyDef } from '../config/enemies';
import { EL_INFO } from '../config/elements';
import { SpatialGrid } from './SpatialGrid';
import { PLAYER_RADIUS } from './Player';
import { label, hex } from '../ui/text';
import type { GameScene } from '../scenes/GameScene';

export class Enemy {
  id = 0;
  def!: EnemyDef;
  x = 0;
  y = 0;
  hp = 0;
  maxHp = 0;
  dmg = 0;
  armor = 0;
  radius = 0;
  speed = 0;
  xp = 0;
  alive = false;
  elite = false;
  boss = false;
  kbx = 0;
  kby = 0;
  slowUntil = 0;
  slowF = 1;
  stunUntil = 0;
  flashUntil = 0;
  contactAt = 0;
  counterShown = false;
  /** 行为状态机 */
  state = 0;
  timer = 0;
  timer2 = 0;
  dashX = 0;
  dashY = 0;
  tint = -1;
  glyph: Phaser.GameObjects.Text | null = null;
  constructor(readonly sprite: Phaser.GameObjects.Sprite) {}
}

export interface SpawnOpts {
  hpMult?: number;
  elite?: boolean;
}

export class EnemyManager {
  readonly list: Enemy[] = [];
  private pool: Enemy[] = [];
  readonly grid = new SpatialGrid<Enemy>(32);
  private nextId = 1;
  private tmp: Enemy[] = [];

  constructor(private g: GameScene) {}

  spawn(defId: string, x: number, y: number, o: SpawnOpts = {}): Enemy {
    const def = ENEMIES[defId];
    const e = this.pool.pop() ?? new Enemy(this.g.add.sprite(0, 0, def.tex, 0).setOrigin(0.5, 0.9));
    e.id = this.nextId++;
    e.def = def;
    e.x = x;
    e.y = y;
    e.elite = !!o.elite;
    e.boss = !!def.boss;
    const hpMult = (o.hpMult ?? 1) * (e.elite ? 10 : 1);
    e.maxHp = e.hp = Math.round(def.hp * hpMult);
    e.dmg = def.dmg * (e.elite ? 1.5 : 1) * (e.boss ? 1 : this.g.dmgScale());
    e.armor = def.armor;
    e.radius = def.radius * (e.elite ? 1.5 : 1);
    e.speed = def.speed * (0.9 + Math.random() * 0.2);
    e.xp = e.elite ? 20 : def.xp;
    e.alive = true;
    e.kbx = e.kby = 0;
    e.slowUntil = e.stunUntil = e.flashUntil = e.contactAt = 0;
    e.counterShown = false;
    e.state = 0;
    e.timer = 1 + Math.random() * 2;
    e.timer2 = 6;
    e.tint = -1;
    e.sprite.setTexture(def.tex, 0).setVisible(true).setActive(true).setScale(e.elite ? 1.5 : 1).setAlpha(1).clearTint();
    e.sprite.play(def.tex + '_move');
    if (e.elite || e.boss) {
      e.glyph = label(this.g, 0, 0, EL_INFO[def.el].name, hex(EL_INFO[def.el].color)).setOrigin(0.5, 1);
    }
    this.list.push(e);
    return e;
  }

  get count() {
    return this.list.length;
  }

  update(dt: number) {
    const g = this.g;
    const p = g.player;
    const now = g.now;
    const grid = this.grid;
    grid.clear();
    for (const e of this.list) grid.insert(e);

    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const stunned = now < e.stunUntil;
      const slow = now < e.slowUntil ? e.slowF : 1;
      let vx = 0;
      let vy = 0;

      if (!stunned) {
        const mv = this.behave(e, dt, nx, ny, dist, slow);
        vx = mv[0];
        vy = mv[1];
      }
      if (e.def.regen) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt);

      // 击退衰减
      vx += e.kbx;
      vy += e.kby;
      const decay = Math.exp(-9 * dt);
      e.kbx *= decay;
      e.kby *= decay;

      // 分离，防止叠成一团
      if (!e.boss) {
        const near = grid.query(e.x, e.y, 14, this.tmp);
        for (const o of near) {
          if (o === e || !o.alive) continue;
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const rr = e.radius + o.radius;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const push = (rr - d) * 12;
            vx += (ox / d) * push;
            vy += (oy / d) * push;
          }
        }
      }

      e.x += vx * dt;
      e.y += vy * dt;

      // 接触伤害
      if (p.alive && dist < e.radius + PLAYER_RADIUS && now >= e.contactAt) {
        e.contactAt = now + 0.8;
        g.hurtPlayer(e.dmg, e.def.el);
      }

      const s = e.sprite;
      s.setPosition(e.x, e.y);
      s.setDepth(e.y);
      if (Math.abs(dx) > 2) s.setFlipX(dx < 0);
      const tint = now < e.flashUntil ? 1 : stunned ? 2 : slow < 1 ? 3 : e.state === 1 && (e.def.behavior === 'charge' || e.boss) ? 4 : 0;
      if (tint !== e.tint) {
        e.tint = tint;
        if (tint === 1) s.setTintFill(0xffffff);
        else if (tint === 2) s.setTint(0xe8d38a);
        else if (tint === 3) s.setTint(0x9fc0ff);
        else if (tint === 4) s.setTint(0xff9a8a);
        else s.clearTint();
      }
      if (e.glyph) e.glyph.setPosition(Math.round(e.x), Math.round(e.y - s.displayHeight * 0.9)).setDepth(e.y + 1);
    }

    // 移除死亡的
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) {
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        this.pool.push(e);
      } else if (!e.boss && !e.elite && (Math.abs(e.x - p.x) > 520 || Math.abs(e.y - p.y) > 380)) {
        // 离得太远的普通怪拉回玩家附近，保持压力
        const a = Math.random() * Math.PI * 2;
        e.x = p.x + Math.cos(a) * 390;
        e.y = p.y + Math.sin(a) * 390;
      }
    }
  }

  /** 返回本帧的移动速度向量 */
  private behave(e: Enemy, dt: number, nx: number, ny: number, dist: number, slow: number): [number, number] {
    const g = this.g;
    const sp = e.speed * slow;
    switch (e.def.behavior) {
      case 'charge': {
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0 && dist < 130) {
            e.state = 1;
            e.timer = 0.55;
            e.dashX = nx;
            e.dashY = ny;
            g.fx.line(e.x, e.y - 6, Math.atan2(ny, nx), 90, 0xff5a4a, 0.55);
          }
          return [nx * sp, ny * sp];
        }
        if (e.state === 1) {
          if (e.timer <= 0) {
            e.state = 2;
            e.timer = 0.4;
          }
          return [0, 0];
        }
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = 3.5;
        }
        return [e.dashX * 170 * slow, e.dashY * 170 * slow];
      }
      case 'boss_wolf': {
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0) {
            e.state = 1;
            e.timer = 0.7;
            e.dashX = nx;
            e.dashY = ny;
            g.fx.line(e.x, e.y - 10, Math.atan2(ny, nx), 230, 0xff5a4a, 0.7, 10);
          }
          return [nx * sp, ny * sp];
        }
        if (e.state === 1) {
          if (e.timer <= 0) {
            e.state = 2;
            e.timer = 0.55;
          }
          return [0, 0];
        }
        if (e.state === 2) {
          if (e.timer <= 0) {
            e.state = 3;
            e.timer = 0.6;
            const n = e.hp < e.maxHp * 0.5 ? 16 : 12;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              g.proj.enemyShot('ep_wind', e.x, e.y - 12, Math.cos(a) * 95, Math.sin(a) * 95, 10, 'metal');
            }
          }
          return [e.dashX * 250, e.dashY * 250];
        }
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = 2.2;
        }
        return [0, 0];
      }
      case 'boss_tree': {
        e.timer -= dt;
        e.timer2 -= dt;
        if (e.timer <= 0) {
          e.timer = 3.2;
          const n = e.hp < e.maxHp * 0.5 ? 20 : 14;
          const off = Math.random() * Math.PI;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            g.proj.enemyShot('ep_leaf', e.x, e.y - 30, Math.cos(a) * 70, Math.sin(a) * 70, 9, 'wood');
          }
        }
        if (e.timer2 <= 0) {
          e.timer2 = 9;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            this.spawn('tengguai', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, { hpMult: g.hpScale() });
          }
        }
        return [nx * sp, ny * sp];
      }
      default:
        return [nx * sp, ny * sp];
    }
  }

  kill(e: Enemy) {
    if (!e.alive) return;
    const g = this.g;
    e.alive = false;
    e.sprite.setVisible(false).setActive(false);
    e.sprite.anims.stop();
    if (e.glyph) {
      e.glyph.destroy();
      e.glyph = null;
    }
    g.kills++;
    g.fx.burst(e.x, e.y - 6, EL_INFO[e.def.el].color, e.boss ? 40 : e.elite ? 16 : 6);
    g.pickups.gem(e.x, e.y, e.xp);
    if (e.elite) g.pickups.chest(e.x, e.y);
    else if (!e.boss && Math.random() < 0.012) g.pickups.pill(e.x + 6, e.y);
    if (e.def.behavior === 'explode') {
      const x = e.x;
      const y = e.y;
      g.fx.disc(x, y, 18, 0xff5a3a, 0.28, 0.6);
      g.later(0.6, () => {
        g.fx.anim('fx_explosion', x, y, { scale: 0.8 });
        const p = g.player;
        if (Math.hypot(p.x - x, p.y - y) < 18 + PLAYER_RADIUS) g.hurtPlayer(4 * g.dmgScale(), 'fire');
      });
    }
    if (e.boss) g.onBossKilled(e);
  }

  /** 精确范围查询（含敌人半径） */
  inRadius(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    const cand = this.grid.query(x, y, r + 24, this.tmp);
    out.length = 0;
    for (const e of cand) {
      if (!e.alive) continue;
      const rr = r + e.radius;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr) out.push(e);
    }
    return out;
  }

  nearest(x: number, y: number, maxR: number, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (const e of this.list) {
      if (!e.alive || (exclude && exclude.has(e.id))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** 由近到远的 n 个敌人 */
  nearestN(x: number, y: number, maxR: number, n: number): Enemy[] {
    const arr: { e: Enemy; d: number }[] = [];
    const r2 = maxR * maxR;
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d <= r2) arr.push({ e, d });
    }
    arr.sort((a, b) => a.d - b.d);
    return arr.slice(0, n).map((a) => a.e);
  }

  randomIn(x: number, y: number, maxR: number, n: number): Enemy[] {
    const r2 = maxR * maxR;
    const arr = this.list.filter((e) => e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 <= r2);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, n);
  }
}
