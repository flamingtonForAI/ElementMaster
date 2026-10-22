import Phaser from 'phaser';
import { SKILLS } from '../config/skills';
import { EL_INFO, REL_MULT, relation, type El } from '../config/elements';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

/** 傀儡的外壳色：土是石头本色，其余按元素染色 */
const SHELL_TINT: Record<El, number | null> = { earth: null, metal: 0xdfe6ee, wood: 0x9fe08a, water: 0x9fc0ff, fire: 0xffa080 };

export class Puppet {
  x = 0;
  y = 0;
  hp = 0;
  maxHp = 0;
  el: El = 'earth';
  giant = false;
  alive = true;
  radius = 7;
  atkAt = 0;
  /** 出招中（举拳到收势）站定不走 */
  busyUntil = 0;
  flashUntil = 0;
  /** 刚撞过岩壁，这之前都顺着距离场绕回本体 */
  navUntil = 0;
  target: Enemy | null = null;
  /** 锁定时的敌人 id：敌人对象会被对象池复用，对不上就是别的怪了 */
  targetId = 0;
  constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly hpBg: Phaser.GameObjects.Rectangle,
    readonly hpFill: Phaser.GameObjects.Rectangle,
  ) {}
}

/** 吸仇恨的范围：这个范围内的敌人改追傀儡 */
const AGGRO = 70;
const AGGRO_GIANT = 100;
/** 石身：傀儡受到的伤害减半 */
const STONE = 0.5;
/** 傀儡脚下的经验球（多半是它刚打死的怪掉的）飞向本体 */
const GEM_R = 8;
const MAX = 3;
/** 傀儡碎裂时的碎石爆炸 */
const SHATTER = 32;
const SHATTER_GIANT = 50;
const SHATTER_STUN = 0.8;
/** 土身傀儡碎裂时的碎石色，免得和火系爆炸混淆 */
const RUBBLE = 0xc8b896;
/** 傀儡之间至少隔开这么远，免得叠成一团 */
const SPREAD = 4;

/**
 * 傀儡师的石傀儡：跟着本体走，扑向附近的敌人，把周围敌人的仇恨吸过去。
 * 伤害走 hitEnemy，所以继承本体的伤害加成和本命；护甲直接用本体护甲。
 * 灌注：每有一个别系的术，就有一尊傀儡换成该系外壳，攻击用该系结算。
 * 打碎时炸开一片碎石，由石傀儡的冷却重新捏出来。
 */
export class PuppetManager {
  list: Puppet[] = [];
  private tmp: Enemy[] = [];
  private shellVersion = -1;
  /** 每碎一尊记一笔，各自等一个冷却后那个位置才能重新捏；giant 标记碎的是不是巨傀 */
  private pending: { at: number; giant: boolean }[] = [];
  /** 巨傀模式开启时把小傀儡合成巨傀，只合一次 */
  private merged = false;
  private cd = 0;

  constructor(private g: GameScene) {}

  private get lv() {
    return this.g.build.skills.get('puppet') ?? 0;
  }

  /** 巨傀：满级合成，早成可以提前 */
  private get giantMode() {
    const lv = this.lv;
    const early = this.g.build.mods['mo.giantLv'];
    return lv > 0 && (SKILLS.puppet.stats(lv).giant > 0 || (early !== undefined && lv >= early));
  }

  /** 应有的傀儡数，最多 MAX 尊；巨傀模式下是 1 尊巨傀 + 2 尊普通傀儡 */
  private wanted() {
    return this.giantMode ? MAX : Math.min(MAX, SKILLS.puppet.stats(this.lv).count);
  }

  /**
   * 石傀儡的术每 0.2 秒判定一次（总是返回 false，让技能计时器不再另算冷却）：
   * 空位（升级多出来的、碎掉后冷却已过的）每次判定补一尊；巨傀模式刚开启时把小傀儡合成巨傀
   */
  summon(cd: number): boolean {
    if (!this.lv) return false;
    const now = this.g.now;
    this.cd = cd;
    if (this.giantMode && !this.merged) {
      this.merged = true;
      for (const p of this.list.filter((p) => !p.giant)) this.remove(p, false);
      this.pending = [];
      this.add(true);
      this.g.fx.ring(this.g.player.x, this.g.player.y - 8, 50, EL_INFO.earth.color, 0.5);
      this.g.cameras.main.shake(150, 0.004);
      return false;
    }
    this.pending = this.pending.filter((w) => w.at > now);
    if (this.list.length + this.pending.length >= this.wanted()) return false;
    // 巨傀模式下缺巨傀（而且碎掉的巨傀不在冷却里）就先补巨傀
    const giant = this.giantMode && !this.list.some((p) => p.giant) && !this.pending.some((w) => w.giant);
    this.add(giant);
    return false;
  }

  private add(giant: boolean) {
    const g = this.g;
    const p = g.player;
    const a = Math.random() * Math.PI * 2;
    const tex = giant ? 'pp_giant' : 'pp_golem';
    const sprite = g.add.sprite(0, 0, tex, 0).setOrigin(0.5, 0.9);
    sprite.play(`${tex}_move`);
    const hpBg = g.add.rectangle(0, 0, giant ? 22 : 14, 3, 0x1c1424).setOrigin(0.5, 0);
    const hpFill = g.add.rectangle(0, 0, giant ? 20 : 12, 1, 0xdaa53e).setOrigin(0, 0);
    const pp = new Puppet(sprite, hpBg, hpFill);
    pp.giant = giant;
    pp.radius = giant ? 14 : 7;
    pp.x = p.x + Math.cos(a) * 20;
    pp.y = p.y + Math.sin(a) * 20;
    pp.maxHp = pp.hp = Math.round(SKILLS.puppet.stats(this.lv).hp * (giant ? 3 : 1) * this.g.pstats.puppetHp);
    this.list.push(pp);
    this.shellVersion = -1;
    g.fx.burst(pp.x, pp.y - 6, EL_INFO.earth.color, 8);
    audio.sfx('spike', { rate: 1.3, vol: 0.5 });
  }

  /** 灌注：别系的术各给一尊傀儡换外壳，巨傀保持土身 */
  private assignShells() {
    const b = this.g.build;
    if (this.shellVersion === b.version) return;
    this.shellVersion = b.version;
    const shells = [...new Set([...b.skills.keys()].map((id) => SKILLS[id].el))].filter((e) => e !== 'earth');
    let i = 0;
    for (const p of this.list) {
      p.el = p.giant ? 'earth' : shells[i++] ?? 'earth';
      const t = SHELL_TINT[p.el];
      if (t === null) p.sprite.clearTint();
      else p.sprite.setTint(t);
    }
  }

  /** 敌人要追的傀儡：自己在某尊傀儡的仇恨范围内就追最近的那尊 */
  aggroOf(e: Enemy): Puppet | null {
    let best: Puppet | null = null;
    let bd = Infinity;
    for (const p of this.list) {
      const r = p.giant ? AGGRO_GIANT : AGGRO;
      const d = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
      if (d < r * r && d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** 傀儡挨打：用本体护甲，五行关系按傀儡外壳算 */
  hurt(p: Puppet, base: number, el: El) {
    if (!p.alive) return;
    const dmg = Math.max(1, Math.round(base * STONE * REL_MULT[relation(el, p.el)] - this.g.pstats.armor));
    p.hp -= dmg;
    p.flashUntil = this.g.now + 0.08;
    if (p.hp <= 0) this.remove(p, true);
  }

  private remove(p: Puppet, broken: boolean) {
    const g = this.g;
    p.alive = false;
    p.sprite.destroy();
    p.hpBg.destroy();
    p.hpFill.destroy();
    this.list.splice(this.list.indexOf(p), 1);
    this.shellVersion = -1;
    if (!broken) return;
    this.pending.push({ at: g.now + this.cd, giant: p.giant });
    // 碎石爆炸：周围的敌人挨一下并被定身（Boss 改为迟缓）
    const r = (p.giant ? SHATTER_GIANT : SHATTER) * g.pstats.area;
    const dmg = SKILLS.puppet.stats(Math.max(1, this.lv)).dmg * g.pstats.puppetDmg * (p.giant ? 2 : 1);
    this.impact(p.x, p.y, r, p.el === 'earth' ? RUBBLE : EL_INFO[p.el].color, p.giant ? 24 : 14);
    g.cameras.main.shake(p.giant ? 160 : 80, p.giant ? 0.005 : 0.003);
    audio.sfx('explode', { rate: 1.2, vol: 0.5 });
    for (const e of g.enemies.inRadius(p.x, p.y, r, this.tmp)) g.hitEnemy(e, dmg, p.el, { kb: 60, fromX: p.x, fromY: p.y, stun: SHATTER_STUN, puppet: true });
  }

  /** 砸地特效：元素色的爆点和扩散环，地上留裂纹，溅起碎石 */
  private impact(x: number, y: number, r: number, col: number, dust: number) {
    const g = this.g;
    g.fx.anim('fx_explosion', x, y - 3, { scale: r / 20, tint: col, depth: y + 2 });
    g.fx.ring(x, y - 2, r * 1.4, col, 0.3);
    g.fx.crack(x, y, 0.3);
    g.fx.burst(x, y - 3, EL_INFO.earth.color, dust);
  }

  update(dt: number) {
    const g = this.g;
    const pl = g.player;
    const now = g.now;
    this.assignShells();
    const st = this.lv ? SKILLS.puppet.stats(this.lv) : null;
    const mods = g.build.mods;

    // 每尊傀儡各认一个目标：别的傀儡已经在打的敌人不抢，实在没有别的才一起打
    const claimed = new Set<number>();
    this.list.forEach((p, idx) => {
      // 本体离太远就瞬移回身边
      if (Math.hypot(p.x - pl.x, p.y - pl.y) > 260) {
        p.x = pl.x;
        p.y = pl.y + 10;
      }
      const t = p.target;
      // 隔着岩壁的敌人不追，免得贴在墙上走不过去
      const nav = g.world.nav;
      const reachable = nav ? (e: Enemy) => nav.clear(p.x, p.y, e.x, e.y) : undefined;
      if (!t?.alive || t.id !== p.targetId || claimed.has(t.id) || Math.hypot(t.x - pl.x, t.y - pl.y) > 180 || (reachable && !reachable(t))) {
        p.target = g.enemies.nearest(p.x, p.y, 130, claimed, reachable) ?? g.enemies.nearest(p.x, p.y, 130, undefined, reachable);
      }
      if (p.target) {
        p.targetId = p.target.id;
        claimed.add(p.target.id);
      }
      // 互相推开
      for (const o of this.list) {
        if (o === p) continue;
        const ox = p.x - o.x;
        const oy = p.y - o.y;
        const rr = p.radius + o.radius + SPREAD;
        const d2 = ox * ox + oy * oy;
        if (d2 < rr * rr) {
          const od = Math.sqrt(d2) || 0.01;
          const push = Math.min(rr - od, 60 * dt);
          p.x += (d2 ? ox / od : Math.cos(idx)) * push;
          p.y += (d2 ? oy / od : Math.sin(idx)) * push;
        }
      }
      const sp = p.giant ? 60 : 78;
      let tx: number;
      let ty: number;
      let reach = 0;
      if (p.target) {
        tx = p.target.x;
        ty = p.target.y;
        reach = p.radius + p.target.radius + 3;
      } else {
        // 没有敌人时围在本体身后
        const a = Math.atan2(-pl.facing.y, -pl.facing.x) + (idx - (this.list.length - 1) / 2) * 0.9;
        tx = pl.x + Math.cos(a) * 22;
        ty = pl.y + Math.sin(a) * 16;
      }
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > reach + 1 && now >= p.busyUntil) {
        let mx = dx / d;
        let my = dy / d;
        // 回本体身边的路被岩壁挡住时，顺着玩家的距离场绕过去
        const st = !p.target && nav ? nav.steer(p.x, p.y, mx, my, now < p.navUntil) : null;
        if (st) [mx, my] = st;
        const v = Math.min(sp * (p.target ? 1 : Math.max(st ? 1 : 0, Math.min(1.6, d / 20))), d / dt);
        p.x += mx * v * dt;
        p.y += my * v * dt;
      }
      // 实在绕不出来时靠上面的瞬移回身边兜底
      if (g.world.push(p, p.radius)) p.navUntil = now + 0.8;
      if (Math.abs(dx) > 1 && now >= p.busyUntil) p.sprite.setFlipX(dx < 0);

      const s = p.sprite;
      // 攻击：双拳拍地。举拳蓄力时站定、转向目标，拳头落地那一帧才结算，落点在身前朝目标的方向
      if (st && p.target && d <= reach + 2 && now >= p.atkAt) {
        p.atkAt = now + st.atkCd;
        const tex = p.giant ? 'pp_giant' : 'pp_golem';
        const fps = p.giant ? 10 : 14;
        p.busyUntil = now + 5 / fps;
        s.setFlipX(dx < 0);
        s.play(`${tex}_atk`);
        s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => p.alive && s.play(`${tex}_move`));
        const shell = p.el !== 'earth';
        const dmg = st.dmg * g.pstats.puppetDmg * (p.giant ? 2.5 : 1) * (shell ? 1 + (mods['mo.shellDmg'] ?? 0) : 1);
        const proc = shell && mods['mo.shellProc'] ? 1 : SKILLS.puppet.proc;
        const col = EL_INFO[p.el].color;
        // 落点：小傀儡就是目标脚下（不超过出手距离），巨傀砸在身前
        const ux = dx / d;
        const uy = dy / d;
        const fwd = p.giant ? 16 : Math.min(d, reach);
        g.later(2 / fps, () => {
          if (!p.alive || g.over) return;
          const x = p.x + ux * fwd;
          const y = p.y + uy * fwd * 0.8;
          // 拍下去压扁一下再弹回来
          s.setScale(1.15, 0.85);
          g.tweens.add({ targets: s, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.out' });
          if (p.giant) {
            // 巨傀震地：一大圈都挨打并被定身
            const r = 30 * g.pstats.area * (1 + (mods['mo.quake'] ?? 0));
            this.impact(x, y, r, col, 18);
            g.cameras.main.shake(70, 0.0025);
            audio.sfx('spike', { rate: 0.7, vol: 0.5 });
            for (const e of g.enemies.inRadius(x, y, r, this.tmp)) g.hitEnemy(e, dmg, p.el, { kb: 50, fromX: x, fromY: y, stun: 0.4, puppet: true });
          } else {
            const r = st.cleave * g.pstats.area * (shell ? 1 + (mods['mo.shellCleave'] ?? 0) : 1);
            this.impact(x, y, r, col, 8);
            audio.sfx('spike', { rate: 1.5, vol: 0.3 });
            for (const e of g.enemies.inRadius(x, y, r, this.tmp)) g.hitEnemy(e, dmg, p.el, { kb: 35, fromX: x, fromY: y, proc, puppet: true });
          }
        });
      }

      g.pickups.magnetNear(p.x, p.y, GEM_R);

      s.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(p.y);
      if (now < p.flashUntil) s.setTintFill(0xffffff);
      else if (s.tintFill) {
        const t = SHELL_TINT[p.el];
        if (t === null) s.clearTint();
        else s.setTint(t);
      }
      const w = p.giant ? 20 : 12;
      p.hpBg.setPosition(p.x, p.y + 2).setDepth(p.y + 1);
      p.hpFill.setPosition(p.x - w / 2, p.y + 3).setDepth(p.y + 2);
      p.hpFill.width = Math.max(0, w * (p.hp / p.maxHp));
    });
  }
}
