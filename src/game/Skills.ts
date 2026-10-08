import { SKILLS, type SkillId, type Stats } from '../config/skills';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

/** 按冷却自动释放已习得的术 */
export class SkillSystem {
  private timers = new Map<SkillId, number>();
  private tmp: Enemy[] = [];

  constructor(private g: GameScene) {}

  update(dt: number) {
    for (const [id, lv] of this.g.build.skills) {
      let t = this.timers.get(id) ?? 0.4;
      t -= dt;
      if (t <= 0) {
        const st = SKILLS[id].stats(lv);
        t = this.fire(id, st) ? st.cd : 0.2;
      }
      this.timers.set(id, t);
    }
  }

  private fire(id: SkillId, st: Stats): boolean {
    const g = this.g;
    const p = g.player;
    const area = g.pstats.area;
    const cx = p.x;
    const cy = p.y - 8;

    switch (id) {
      case 'slash': {
        const ang = Math.atan2(p.facing.y, p.facing.x);
        p.attack();
        audio.sfx('slash');
        this.slash(ang, st);
        if (st.back) {
          g.later(0.12, () => {
            audio.sfx('slash', { rate: 0.85 });
            this.slash(ang + Math.PI, st);
          });
          g.proj.fire('wave', 'pj_wave', cx, cy, Math.cos(ang) * 210, Math.sin(ang) * 210, {
            dmg: st.dmg * 0.6, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40,
          });
        }
        return true;
      }
      case 'flysword': {
        const targets = g.enemies.nearestN(cx, cy, 240, st.count);
        if (!targets.length) return false;
        audio.sfx('sword');
        for (let i = 0; i < st.count; i++) {
          const t = targets[i % targets.length];
          const a = Math.atan2(t.y - 6 - cy, t.x - cx) + (i - (st.count - 1) / 2) * 0.25;
          g.proj.fire('sword', 'pj_sword', cx, cy, Math.cos(a) * 230, Math.sin(a) * 230, {
            dmg: st.dmg, el: 'metal', life: 1.4, pierce: st.pierce, radius: 4, target: t, kb: 25,
          });
        }
        return true;
      }
      case 'fireball': {
        const targets = g.enemies.randomIn(p.x, p.y, 190, st.count);
        if (!targets.length) return false;
        audio.sfx('fireball');
        for (let i = 0; i < st.count; i++) {
          const t = targets[i % targets.length];
          g.proj.lob('pj_fireball', 'pj_fireball', cx, cy, t.x, t.y, 0.5, st.dmg, 'fire', st.radius * area);
        }
        return true;
      }
      case 'leaf': {
        const targets = g.enemies.nearestN(cx, cy, 200, st.count);
        if (!targets.length) return false;
        audio.sfx('leaf');
        for (let i = 0; i < st.count; i++) {
          const t = targets[i % targets.length];
          const a = Math.atan2(t.y - 6 - cy, t.x - cx) + i * 0.3;
          g.proj.fire('leaf', 'pj_leaf', cx, cy, Math.cos(a) * 260, Math.sin(a) * 260, {
            dmg: st.dmg, el: 'wood', life: 2, bounces: st.bounces, radius: 5, kb: 10,
          });
        }
        return true;
      }
      case 'waterdragon': {
        const t = g.enemies.nearest(cx, cy, 260);
        const base = t ? Math.atan2(t.y - 6 - cy, t.x - cx) : Math.atan2(p.facing.y, p.facing.x);
        const offs = st.count > 1 ? [-0.18, 0.18] : [0];
        audio.sfx('water');
        for (const o of offs) {
          const a = base + o;
          g.proj.fire('water', 'pj_water', cx, cy, Math.cos(a) * 170, Math.sin(a) * 170, {
            dmg: st.dmg, el: 'water', life: 1.8, pierce: 999, radius: st.width * area, slow: st.slow, kb: 30, anim: 'pj_water',
          });
        }
        return true;
      }
      case 'stonespike': {
        const targets = g.enemies.randomIn(p.x, p.y, 150, st.count);
        if (!targets.length) return false;
        for (const t of targets) {
          const x = t.x;
          const y = t.y;
          g.fx.crack(x, y, 0.25);
          g.later(0.25, () => {
            audio.sfx('spike');
            g.fx.anim('fx_spike', x, y + 2, { originY: 0.92, depth: y + 1, scale: area });
            for (const e of g.enemies.inRadius(x, y, st.radius * area, this.tmp)) {
              g.hitEnemy(e, st.dmg, 'earth', { stun: st.stun, kb: 30, fromX: x, fromY: y + 10 });
            }
          });
        }
        return true;
      }
    }
  }

  private slash(ang: number, st: Stats) {
    const g = this.g;
    const p = g.player;
    const range = st.range * g.pstats.area;
    const half = ((st.arc / 2) * Math.PI) / 180;
    const cx = p.x;
    const cy = p.y - 8;
    g.fx.anim('fx_slash', cx, cy, { rotation: ang, scale: range / 30, depth: p.y + 5 });
    for (const e of g.enemies.inRadius(cx, cy, range, this.tmp)) {
      const ex = e.x - cx;
      const ey = e.y - 6 - cy;
      const d = Math.hypot(ex, ey);
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - ang), Math.cos(Math.atan2(ey, ex) - ang)));
      if (d < 12 || diff <= half) g.hitEnemy(e, st.dmg, 'metal', { kb: 70, fromX: cx, fromY: cy });
    }
  }
}
