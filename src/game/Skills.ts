import { SKILLS, type SkillId, type Stats } from '../config/skills';
import { EL_INFO, relation, type El } from '../config/elements';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

/** 按冷却自动释放已习得的术 */
export class SkillSystem {
  private timers = new Map<SkillId, number>();
  private tmp: Enemy[] = [];
  /** 剑客传承：上一斩的方向、累计斩数 */
  private lastSlash: number | null = null;
  private slashCount = 0;
  /** 符师：累计抛出的符数（五雷用） */
  private fuCount = 0;

  constructor(private g: GameScene) {}

  update(dt: number) {
    // 海贼·退射：背离最近的敌人移动时冷却走得更快
    const kite = this.mod('ruan.kite');
    if (kite && this.retreating()) dt *= 1 + kite;
    for (const [id, lv] of this.g.build.skills) {
      let t = this.timers.get(id) ?? 0.4;
      t -= dt;
      if (t <= 0) {
        const st = SKILLS[id].stats(lv);
        const cd = st.cd * this.g.pstats.cdMult * (id === 'slash' ? 1 - this.mod('slashCd') : 1);
        t = this.fire(id, st) ? cd : 0.2;
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
        // 回锋：转身出剑加伤
        const turned = this.lastSlash !== null && Math.abs(Math.atan2(Math.sin(ang - this.lastSlash), Math.cos(ang - this.lastSlash))) > Math.PI / 2;
        this.lastSlash = ang;
        this.slashCount++;
        this.slash(ang, st, turned ? 1 + this.mod('xiao.turn') : 1);
        const chain = this.mod('xiao.chain') > 0 && this.slashCount % 3 === 0;
        if (chain && !st.back) {
          g.proj.fire('wave', 'pj_wave', cx, cy, Math.cos(ang) * 210, Math.sin(ang) * 210, {
            dmg: st.dmg * 0.6, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40,
          });
        }
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
      case 'talisman': {
        const n = st.count + this.mod('zhu.extra');
        const targets = g.enemies.nearestN(cx, cy, 200, n);
        if (!targets.length) return false;
        p.attack(targets[0].x - p.x, targets[0].y - p.y);
        audio.sfx('fireball');
        const radius = st.radius * area * (1 + this.mod('zhu.area'));
        for (let i = 0; i < n; i++) {
          const t = targets[i % targets.length];
          const el = this.drawFu(t);
          const dmg = st.dmg * (el === 'fire' ? 1 : 1 + this.mod('zhu.alt'));
          const tx = t.x + (i >= targets.length ? (Math.random() - 0.5) * 30 : 0);
          const ty = t.y + (i >= targets.length ? (Math.random() - 0.5) * 20 : 0);
          g.proj.lob(`pj_fu_${el}`, `pj_fu_${el}`, cx, cy - 6, tx, ty, 0.45, dmg, el, radius, (x, y) => this.fuLand(x, y, dmg, el, radius));
        }
        return true;
      }
      case 'crossbow': {
        const range = 300 * (1 + this.mod('ruan.range'));
        const t = g.enemies.nearest(cx, cy, range);
        if (!t) return false;
        p.attack(t.x - p.x, t.y - p.y);
        const speed = 320 * (1 + this.mod('ruan.range'));
        const pierce = st.pierce + this.mod('ruan.pierce');
        const onHit = st.splash ? (e: Enemy) => this.boltSplash(e) : undefined;
        for (let i = 0; i < st.shots; i++) {
          g.later(i * 0.07, () => {
            // 目标死了就沿上一箭的方向继续射
            const tgt = t.alive ? t : g.enemies.nearest(p.x, p.y - 8, range);
            const ax = tgt ? tgt.x : p.x + p.facing.x;
            const ay = tgt ? tgt.y - 6 : p.y - 8 + p.facing.y;
            const a = Math.atan2(ay - (p.y - 8), ax - p.x) + (Math.random() - 0.5) * 0.06;
            audio.sfx('sword', { rate: 1.3 });
            g.proj.fire('bolt', 'pj_bolt', p.x, p.y - 8, Math.cos(a) * speed, Math.sin(a) * speed, {
              dmg: st.dmg, el: 'water', life: range / speed, pierce, radius: 4, kb: 15, onHit,
            });
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

  /**
   * 画符：每有一个别系的术，就有一次机会（15% + 丹青）把这张符画成该系。
   * 五雷：每第 5 张优先画成克制目标的元素
   */
  private drawFu(t: Enemy): El {
    const owned = [...new Set([...this.g.build.skills.keys()].map((id) => SKILLS[id].el))];
    this.fuCount++;
    if (this.mod('zhu.thunder') && this.fuCount % 5 === 0) {
      const best = owned.find((e) => relation(e, t.def.el) === 'counter') ?? owned.find((e) => relation(e, t.def.el) === 'fed');
      if (best) return best;
    }
    const chance = 0.15 + this.mod('zhu.draw');
    const others = owned.filter((e) => e !== 'fire').sort(() => Math.random() - 0.5);
    for (const e of others) if (Math.random() < chance) return e;
    return 'fire';
  }

  /** 符落地后亮一下再炸；符海：原地再爆一次 */
  private fuLand(x: number, y: number, dmg: number, el: El, radius: number) {
    const g = this.g;
    const mark = g.add.sprite(x, y, `pj_fu_${el}`, 0).setDepth(y - 1);
    g.tweens.add({ targets: mark, alpha: 0.3, duration: 75, yoyo: true, repeat: 1 });
    const tint = el === 'fire' ? undefined : EL_INFO[el].color;
    g.later(0.3, () => {
      mark.destroy();
      g.explode(x, y, radius, dmg, el, 80, tint);
      const echo = this.mod('zhu.echo');
      if (echo) g.later(0.6, () => g.explode(x, y, radius * 0.8, dmg * echo, el, 40, tint));
    });
  }

  /** 分水连弩满级：命中溅起水花，减速周围敌人 */
  private boltSplash(e: Enemy) {
    const g = this.g;
    g.fx.ring(e.x, e.y - 6, 22, 0x8fc0ff, 0.25);
    for (const o of g.enemies.inRadius(e.x, e.y, 22 * g.pstats.area, this.tmp)) {
      o.slowUntil = Math.max(o.slowUntil, g.now + 0.8 * g.pstats.slowMult);
      o.slowF = o.boss ? 0.75 : 0.5;
    }
  }

  private retreating() {
    const p = this.g.player;
    if (!p.moving) return false;
    const e = this.g.enemies.nearest(p.x, p.y, 160);
    if (!e) return false;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return (p.facing.x * dx + p.facing.y * dy) / d < -0.5;
  }

  private mod(k: string) {
    return this.g.build.mods[k] ?? 0;
  }

  private slash(ang: number, st: Stats, mult = 1) {
    const g = this.g;
    const p = g.player;
    const range = st.range * g.pstats.area * (1 + this.mod('slashArea'));
    const half = ((st.arc / 2) * Math.PI) / 180;
    const cx = p.x;
    const cy = p.y - 8;
    g.fx.anim('fx_slash', cx, cy, { rotation: ang, scale: range / 30, depth: p.y + 5 });
    for (const e of g.enemies.inRadius(cx, cy, range, this.tmp)) {
      const ex = e.x - cx;
      const ey = e.y - 6 - cy;
      const d = Math.hypot(ex, ey);
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - ang), Math.cos(Math.atan2(ey, ex) - ang)));
      if (d < 12 || diff <= half) g.hitEnemy(e, st.dmg * mult, 'metal', { kb: 70, fromX: cx, fromY: cy });
    }
  }
}
