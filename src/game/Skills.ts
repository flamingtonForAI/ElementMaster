import Phaser from 'phaser';
import { SKILLS, type SkillId, type Stats } from '../config/skills';
import { EL_INFO, relation, type El } from '../config/elements';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

/** 毒雾光环是地上的一圈，上下压扁 */
const AURA_FLAT = 0.6;

/** 按冷却自动释放已习得的术 */
export class SkillSystem {
  private timers = new Map<SkillId, number>();
  private tmp: Enemy[] = [];
  /** 剑客传承：上一斩的方向、累计斩数 */
  private lastSlash: number | null = null;
  private slashCount = 0;
  /** 符师：累计抛出的符数（五雷用）、贴在敌人身上还没爆的符 */
  private fuCount = 0;
  private sticks: { e: Enemy; id: number; mark: Phaser.GameObjects.Sprite; x: number; y: number; t: number; dmg: number; el: El; radius: number }[] = [];
  /** 药师：脚下的毒雾光环 */
  /** 毒雾光环的贴图（HD 光影原型读它的位置和大小） */
  aura: Phaser.GameObjects.Image | null = null;
  /** 离火环：绕身的火焰、当前转角、每个敌人下次能再被烫到的时刻 */
  private orbs: Phaser.GameObjects.Sprite[] = [];
  private orbAng = 0;
  private orbHit = new Map<number, number>();
  /** 藤缚：地上的藤蔓 */
  private vines: { x: number; y: number; r: number; t: number; tick: number; dmg: number; img: Phaser.GameObjects.Image }[] = [];

  constructor(private g: GameScene) {}

  update(dt: number) {
    this.updateSticks(dt);
    this.updateAura();
    this.updateOrbs(dt);
    this.updateVines(dt);
    // 海贼·退射：背离最近的敌人移动时冷却走得更快
    const kite = this.mod('ruan.kite');
    if (kite && this.retreating()) dt *= 1 + kite;
    for (const [id, lv] of this.g.build.skills) {
      let t = this.timers.get(id) ?? 0.4;
      t -= dt;
      if (t <= 0) {
        const st = this.stats(id, lv);
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
    const proc = SKILLS[id].proc;

    switch (id) {
      case 'slash': {
        // 移动时朝移动方向斩；站定时自动转向身边最近的敌人
        let ang = Math.atan2(p.facing.y, p.facing.x);
        if (!p.moving) {
          const t = g.enemies.nearest(cx, cy, st.range * area * 1.3);
          if (t) {
            ang = Math.atan2(t.y - 6 - cy, t.x - cx);
            p.facing.x = Math.cos(ang);
            p.facing.y = Math.sin(ang);
          }
        }
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
            dmg: st.dmg * 0.6, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40, proc,
          });
        }
        if (st.back) {
          g.later(0.12, () => {
            audio.sfx('slash', { rate: 0.85 });
            this.slash(ang + Math.PI, st);
          });
          g.proj.fire('wave', 'pj_wave', cx, cy, Math.cos(ang) * 210, Math.sin(ang) * 210, {
            dmg: st.dmg * 0.8, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40, proc,
          });
        }
        return true;
      }
      case 'talisman': {
        // 贴符：符纸追踪飞向敌人，贴上后片刻在敌人身上爆开
        const n = st.count + this.mod('zhu.extra');
        const targets = g.enemies.nearestN(cx, cy, 260, n);
        if (!targets.length) return false;
        p.attack(targets[0].x - p.x, targets[0].y - p.y);
        audio.sfx('leaf', { rate: 0.8 });
        const radius = st.radius * area * (1 + this.mod('zhu.area'));
        for (let i = 0; i < n; i++) {
          const t = targets[i % targets.length];
          const el = this.drawFu(t);
          const dmg = st.dmg * (el === 'fire' ? 1 : 1 + this.mod('zhu.alt'));
          const a = Math.atan2(t.y - 6 - (cy - 6), t.x - cx) + (i - (n - 1) / 2) * 0.6;
          g.proj.fire('fu', `pj_fu_${el}`, cx, cy - 6, Math.cos(a) * 190, Math.sin(a) * 190, {
            dmg: 0, el, life: 1.6, radius: 6, target: t, stick: true, anim: `pj_fu_${el}`,
            onHit: (e) => this.stickFu(e, dmg, el, radius),
          });
        }
        return true;
      }
      case 'crossbow': {
        const range = 260 * (1 + this.mod('ruan.range'));
        const t = g.enemies.nearest(cx, cy, range);
        if (!t) return false;
        p.attack(t.x - p.x, t.y - p.y);
        const speed = 320 * (1 + this.mod('ruan.range'));
        const pierce = st.pierce + this.mod('ruan.pierce');
        const onHit = st.splash ? (e: Enemy) => this.boltSplash(e, st.dmg * 0.3) : undefined;
        // 远射：贴脸不打折，拉开到 180px 以上 ×1.2，奖励边退边打
        const tid = t.id;
        const dmgAt = (e: Enemy) => 1 + 0.2 * Phaser.Math.Clamp((Math.hypot(e.x - p.x, e.y - p.y) - 60) / 120, 0, 1);
        for (let i = 0; i < st.shots; i++) {
          g.later(i * 0.07, () => {
            // 目标死了就沿上一箭的方向继续射
            const tgt = t.alive && t.id === tid ? t : g.enemies.nearest(p.x, p.y - 8, range);
            const ax = tgt ? tgt.x : p.x + p.facing.x;
            const ay = tgt ? tgt.y - 6 : p.y - 8 + p.facing.y;
            const a = Math.atan2(ay - (p.y - 8), ax - p.x) + (Math.random() - 0.5) * 0.06;
            audio.sfx('sword', { rate: 1.3 });
            g.proj.fire('bolt', 'pj_bolt', p.x, p.y - 8, Math.cos(a) * speed, Math.sin(a) * speed, {
              dmg: st.dmg, el: 'water', life: range / speed, pierce, radius: 4, kb: 15, proc, onHit, dmgAt,
            });
          });
        }
        return true;
      }
      case 'duwu': {
        // 毒雾光环：每次判定给光环里的敌人挂上中毒，离开后还会再毒一阵；药师的毒连木系也毒得动
        const r = this.auraRadius(st);
        const linger = st.linger + this.mod('qing.cloudDur');
        for (const e of g.enemies.inRadius(p.x, p.y, r, this.tmp)) {
          if (((e.x - p.x) / r) ** 2 + ((e.y - p.y) / (r * AURA_FLAT)) ** 2 > 1) continue;
          g.poisonEnemy(e, st.dps * g.dmgMult(e, 'wood'), linger, true);
          if (st.slow) g.slowEnemy(e, 0.6);
        }
        if (Math.random() < 0.7) g.fx.burst(p.x + (Math.random() - 0.5) * r * 1.4, p.y + (Math.random() - 0.5) * r * AURA_FLAT, 0x9fe06a, 2);
        return true;
      }
      case 'puppet':
        return g.puppets.summon(st.cd * g.pstats.cdMult);
      case 'flysword': {
        const targets = g.enemies.nearestN(cx, cy, 240, st.count);
        if (!targets.length) return false;
        audio.sfx('sword');
        for (let i = 0; i < st.count; i++) {
          const t = targets[i % targets.length];
          const a = Math.atan2(t.y - 6 - cy, t.x - cx) + (i - (st.count - 1) / 2) * 0.25;
          g.proj.fire('sword', 'pj_sword', cx, cy, Math.cos(a) * 230, Math.sin(a) * 230, {
            dmg: st.dmg, el: 'metal', life: 1.4, pierce: st.pierce, radius: 4, target: t, kb: 25, proc,
          });
        }
        return true;
      }
      case 'fireball': {
        // 炮击：在附近挑敌人最密的几处，慢速高抛砸下去
        const cands = g.enemies.randomIn(p.x, p.y, 220, 10);
        if (!cands.length) return false;
        const r = st.radius * area;
        const spots = cands.map((e) => ({ e, n: g.enemies.inRadius(e.x, e.y, r, this.tmp).length })).sort((a, b) => b.n - a.n);
        audio.sfx('fireball', { rate: 0.8 });
        for (let i = 0; i < st.count; i++) {
          const t = spots[i % spots.length].e;
          const ball = g.proj.lob('pj_fireball', 'pj_fireball', cx, cy, t.x, t.y, 0.8, st.dmg, 'fire', r, undefined, 70);
          ball.sprite.setScale(1.6);
          ball.proc = proc;
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
            dmg: st.dmg, el: 'wood', life: 2, bounces: st.bounces, radius: 5, kb: 10, proc,
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
      case 'jinzhen': {
        // 一蓬金针落在敌人周围一片，越靠中心越密
        const zones = g.enemies.randomIn(p.x, p.y, 220, st.zones);
        if (!zones.length) return false;
        audio.sfx('sword', { rate: 1.6 });
        const spread = 36 * area;
        for (const z of zones) {
          const zx = z.x;
          const zy = z.y;
          for (let i = 0; i < st.count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = spread * Math.sqrt(Math.random());
            this.needle(zx + Math.cos(a) * r, zy + Math.sin(a) * r * AURA_FLAT, i * 0.035, st.dmg, 11 * area);
          }
        }
        return true;
      }
      case 'lihuo':
        // 火焰常驻绕身，在 updateOrbs 里结算
        return true;
      case 'tengfu': {
        const targets = g.enemies.randomIn(p.x, p.y, 180, st.count);
        if (!targets.length) return false;
        audio.sfx('leaf', { rate: 0.6 });
        const r = st.radius * area;
        for (const t of targets) {
          const img = g.add.image(t.x, t.y, 'fx_vine').setDepth(t.y - 40).setScale(r / 20).setAlpha(0);
          g.tweens.add({ targets: img, alpha: 0.55, duration: 150 });
          this.vines.push({ x: t.x, y: t.y, r, t: st.dur, tick: 0, dmg: st.dmg, img });
          g.fx.burst(t.x, t.y - 2, EL_INFO.wood.color, 5);
          if (st.root) for (const e of this.inVine(t.x, t.y, r)) g.stunEnemy(e, st.root);
        }
        return true;
      }
      case 'hanbing': {
        const r = st.radius * area;
        const near = g.enemies.inRadius(p.x, p.y, r, this.tmp);
        if (!near.length) return false;
        audio.sfx('water', { rate: 1.4 });
        g.fx.ring(p.x, p.y - 4, r, 0x9fd0ff, 0.4);
        for (let i = 0; i < 6; i++) g.fx.droplet(p.x + (Math.random() - 0.5) * r, p.y - 6 + (Math.random() - 0.5) * r * 0.6);
        for (const e of [...near]) g.hitEnemy(e, st.dmg, 'water', { slow: st.slow, kb: 25, fromX: p.x, fromY: p.y });
        return true;
      }
      case 'luoshi': {
        // 砸向附近敌人最密的地方；玩家的落石没有地面预警，下落也快，和关卡落石区分开
        const cands = g.enemies.randomIn(p.x, p.y, 240, 10);
        if (!cands.length) return false;
        const r = st.radius * area;
        const spots = cands.map((e) => ({ e, n: g.enemies.inRadius(e.x, e.y, r, this.tmp).length })).sort((a, b) => b.n - a.n);
        for (let i = 0; i < st.count; i++) {
          const t = spots[i % spots.length].e;
          this.boulder(t.x, t.y, i * 0.15, r, st.dmg, st.stun);
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

  /** 贴在敌人身上的符：跟着敌人走，引信到了在原地爆开；敌人先死就在死处爆 */
  private stickFu(e: Enemy, dmg: number, el: El, radius: number) {
    const mark = this.g.add.sprite(e.x, e.y - 10, `pj_fu_${el}`, 0).setDepth(e.y + 1);
    this.g.tweens.add({ targets: mark, alpha: 0.35, duration: 80, yoyo: true, repeat: 2 });
    this.sticks.push({ e, id: e.id, mark, x: e.x, y: e.y, t: 0.5, dmg, el, radius });
  }

  private updateSticks(dt: number) {
    const g = this.g;
    for (let i = this.sticks.length - 1; i >= 0; i--) {
      const s = this.sticks[i];
      // 敌人对象死后会被对象池复用，id 变了就是别的怪
      if (s.e.alive && s.e.id === s.id) {
        s.x = s.e.x;
        s.y = s.e.y;
      }
      s.mark.setPosition(s.x, s.y - 10).setDepth(s.y + 1);
      s.t -= dt;
      if (s.t > 0) continue;
      s.mark.destroy();
      this.sticks.splice(i, 1);
      const tint = s.el === 'fire' ? undefined : EL_INFO[s.el].color;
      const proc = SKILLS.talisman.proc;
      g.explode(s.x, s.y, s.radius, s.dmg, s.el, 80, tint, proc);
      // 符海：原地再爆一次
      const echo = this.mod('zhu.echo');
      const { x, y, radius, dmg, el } = s;
      if (echo) g.later(0.6, () => g.explode(x, y, radius * 0.8, dmg * echo, el, 40, tint, proc));
    }
  }

  private auraRadius(st: Stats) {
    return st.radius * this.g.pstats.area * (1 + this.mod('qing.cloud'));
  }

  /** 毒雾光环的画面：跟着本体，缓慢呼吸 */
  private updateAura() {
    const g = this.g;
    const lv = g.build.skills.get('duwu');
    if (!lv) return;
    const p = g.player;
    if (!this.aura) this.aura = g.add.image(0, 0, 'fx_disc').setTint(0x7ac83a);
    const r = this.auraRadius(SKILLS.duwu.stats(lv));
    const k = r / 31;
    this.aura
      .setVisible(p.alive)
      .setPosition(p.x, p.y)
      .setDepth(p.y - 40)
      .setScale(k, k * AURA_FLAT)
      .setAlpha(0.26 + 0.06 * Math.sin(g.now * 3));
  }

  /** 金针雨的一根针：从空中落下，落地刺中一小圈 */
  private needle(x: number, y: number, delay: number, dmg: number, r: number) {
    const g = this.g;
    g.later(delay, () => {
      const s = g.add.image(x, y - 70, 'pj_needle').setOrigin(0.5, 1).setDepth(y + 2);
      g.tweens.add({
        targets: s, y, duration: 120, ease: 'Quad.in',
        onComplete: () => {
          s.destroy();
          g.fx.burst(x, y - 2, EL_INFO.metal.color, 2);
          for (const e of g.enemies.inRadius(x, y, r, this.tmp)) g.hitEnemy(e, dmg, 'metal', { kb: 10, fromX: x, fromY: y - 10, proc: SKILLS.jinzhen.proc });
        },
      });
    });
  }

  /** 落石：土黄色巨石快速砸下，砸中一片并眩晕 */
  private boulder(x: number, y: number, delay: number, r: number, dmg: number, stun: number) {
    const g = this.g;
    g.later(delay, () => {
      const rock = g.add.image(x, y - 160, 'fx_boulder').setOrigin(0.5, 0.9).setScale(r / 18).setTint(0xf0cc80).setDepth(1e6 - 1);
      g.tweens.add({
        targets: rock, y, duration: 380, ease: 'Quad.in',
        onComplete: () => {
          rock.destroy();
          audio.sfx('explode', { rate: 0.7, vol: 0.6 });
          g.cameras.main.shake(90, 0.003);
          g.fx.crack(x, y, 0.5);
          g.fx.ring(x, y - 2, r, EL_INFO.earth.color, 0.3);
          g.fx.burst(x, y - 4, EL_INFO.earth.dark, 10);
          for (const e of g.enemies.inRadius(x, y, r, this.tmp)) g.hitEnemy(e, dmg, 'earth', { stun, kb: 50, fromX: x, fromY: y });
        },
      });
    });
  }

  /** 离火环：火焰按地面椭圆绕身转，同一个敌人 0.35 秒内只被烫一次 */
  private updateOrbs(dt: number) {
    const g = this.g;
    const lv = g.build.skills.get('lihuo');
    if (!lv) return;
    const st = this.stats('lihuo', lv);
    const p = g.player;
    while (this.orbs.length < st.count) this.orbs.push(g.add.sprite(0, 0, 'pj_fireball', 0).play('pj_fireball').setScale(0.9));
    this.orbAng += (dt * Math.PI * 2) / (st.period * g.pstats.cdMult);
    const R = st.orbit * g.pstats.area;
    const hitR = 9 * g.pstats.area;
    const now = g.now;
    if (this.orbHit.size > 300) for (const [id, t] of this.orbHit) if (t < now) this.orbHit.delete(id);
    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.orbAng + (i / this.orbs.length) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R;
      const y = p.y - 6 + Math.sin(a) * R * AURA_FLAT;
      this.orbs[i].setPosition(x, y).setDepth(y + 10).setVisible(p.alive);
      if (!p.alive) continue;
      for (const e of g.enemies.inRadius(x, y + 6, hitR, this.tmp)) {
        if ((this.orbHit.get(e.id) ?? 0) > now) continue;
        this.orbHit.set(e.id, now + 0.35);
        g.hitEnemy(e, st.dmg, 'fire', { kb: 25, fromX: p.x, fromY: p.y, proc: SKILLS.lihuo.proc });
      }
    }
  }

  /** 藤缚：每 0.5 秒给藤蔓里的敌人一跳伤害并迟缓，到时淡出 */
  private updateVines(dt: number) {
    const g = this.g;
    for (let i = this.vines.length - 1; i >= 0; i--) {
      const v = this.vines[i];
      v.t -= dt;
      v.tick -= dt;
      if (v.tick <= 0 && v.t > 0) {
        v.tick += 0.5;
        for (const e of this.inVine(v.x, v.y, v.r)) {
          g.hitEnemy(e, v.dmg, 'wood', { proc: SKILLS.tengfu.proc });
          if (e.alive) g.slowEnemy(e, 0.6);
        }
      }
      if (v.t <= 0) {
        const img = v.img;
        g.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
        this.vines.splice(i, 1);
      }
    }
  }

  /** 藤蔓是地上的椭圆，上下压扁 */
  private inVine(x: number, y: number, r: number) {
    return [...this.g.enemies.inRadius(x, y, r, this.tmp)].filter((e) => ((e.x - x) / r) ** 2 + ((e.y - y) / (r * AURA_FLAT)) ** 2 <= 1);
  }

  /** 分水连弩满级：命中溅起水花，减速周围敌人，并波及被射中者以外的敌人 */
  private boltSplash(e: Enemy, dmg: number) {
    const g = this.g;
    g.fx.ring(e.x, e.y - 6, 22, 0x8fc0ff, 0.25);
    for (const o of g.enemies.inRadius(e.x, e.y, 22 * g.pstats.area, [])) {
      g.slowEnemy(o, 0.8);
      if (o !== e) g.hitEnemy(o, dmg, 'water', { kb: 10, fromX: e.x, fromY: e.y, noCrit: true });
    }
  }

  /** 术在这一级的数值；专属术（石傀儡另走傀儡伤害）吃角色成长的专属术伤害 */
  private stats(id: SkillId, lv: number): Stats {
    const st = SKILLS[id].stats(lv);
    if (SKILLS[id].exclusive && id !== 'puppet') {
      const k = this.g.pstats.sigDmg;
      if (st.dmg) st.dmg *= k;
      if (st.dps) st.dps *= k;
    }
    return st;
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
      if (d < 12 || diff <= half) g.hitEnemy(e, st.dmg * mult, 'metal', { kb: 70, fromX: cx, fromY: cy, proc: SKILLS.slash.proc });
    }
  }
}
