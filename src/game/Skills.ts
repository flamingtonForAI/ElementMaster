import Phaser from 'phaser';
import { SKILLS, ULTIMATE_MIN_CD, type SkillId, type Stats } from '../config/skills';
import { EL_INFO, relation, type El } from '../config/elements';
import type { Enemy } from './Enemies';
import type { GameScene } from '../scenes/GameScene';
import { audio } from '../audio/Audio';

/** 毒雾光环是地上的一圈，上下压扁 */
const AURA_FLAT = 0.6;

/** 按冷却自动释放已习得的术 */
export class SkillSystem {
  private timers = new Map<SkillId, number>();
  /** 最早可再次施放的战斗时刻；不随退射加速，暂停时也不流逝。 */
  private ultimateReadyAt = new Map<SkillId, number>();
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
  /** 同一敌人处于多片藤蔓中时，仍只每半秒受伤一次。 */
  private vineHit = new Map<number, number>();

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
      const ultimate = SKILLS[id].ultimate;
      let t = this.timers.get(id) ?? 0.4;
      t -= dt;
      if (ultimate) t = Math.max(t, (this.ultimateReadyAt.get(id) ?? 0) - this.g.now);
      if (t <= 0) {
        const st = this.stats(id, lv);
        const cd = st.cd * this.g.pstats.cdMult * (id === 'slash' ? 1 - this.mod('slashCd') : 1);
        const fired = this.fire(id, st);
        t = fired ? (ultimate ? Math.max(ULTIMATE_MIN_CD, cd) : cd) : 0.2;
        if (fired && ultimate) this.ultimateReadyAt.set(id, this.g.now + ULTIMATE_MIN_CD);
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

    if (SKILLS[id].ultimate) return this.ultimate(id, st);

    switch (id) {
      case 'fuchen': {
        const range = st.range * area;
        const target = g.enemies.nearest(cx, cy, range);
        if (!target) return false;
        const angle = Math.atan2(target.y - 6 - cy, target.x - cx);
        const half = st.arc * Math.PI / 360;
        p.attack(target.x - cx, target.y - 6 - cy);
        audio.sfx('leaf', { rate: 0.75 });
        g.fx.whisk(cx, cy, angle, range, st.arc);
        for (const e of [...g.enemies.inRadius(cx, cy, range, this.tmp)]) {
          const dx = e.x - cx, dy = e.y - 6 - cy;
          if (Math.hypot(dx, dy) > range) continue;
          const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle)));
          if (Math.hypot(dx, dy) < 12 || diff <= half) g.hitEnemy(e, st.dmg, null, { kb: st.kb, fromX: cx, fromY: cy });
        }
        return true;
      }
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
          // 连斩升级后强化现有双向波，避免传承失效或额外增加同屏弹数。
          const waveDmg = st.dmg * (chain ? 1.4 : 0.8);
          g.later(0.12, () => {
            audio.sfx('slash', { rate: 0.85 });
            this.slash(ang + Math.PI, st);
            g.proj.fire('wave', 'pj_wave', p.x, p.y - 8, -Math.cos(ang) * 210, -Math.sin(ang) * 210, {
              dmg: waveDmg, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40, proc,
            });
          });
          g.proj.fire('wave', 'pj_wave', cx, cy, Math.cos(ang) * 210, Math.sin(ang) * 210, {
            dmg: waveDmg, el: 'metal', life: 0.7, pierce: 99, radius: 9, kb: 40, proc,
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
          const extraDmg = i >= st.count ? (g.build.mods['zhu.extraDmg'] ?? 1) : 1;
          const dmg = st.dmg * extraDmg * (el === 'fire' ? 1 : 1 + this.mod('zhu.alt'));
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
        // 远射：贴脸不打折，拉开到 180px 以上 ×1.2，奖励边退边打
        const tid = t.id;
        const dmgAt = (e: Enemy) => 1 + 0.2 * Phaser.Math.Clamp((Math.hypot(e.x - p.x, e.y - p.y) - 60) / 120, 0, 1);
        for (let i = 0; i < st.shots; i++) {
          g.later(i * 0.07, () => {
            // 中期起逐箭分配目标；每箭重新查询，避免追着死敌或对象池复用后的旧目标射。
            const targets = st.targets > 1 ? g.enemies.nearestN(p.x, p.y - 8, range, st.targets) : [];
            const tgt = st.targets > 1 ? (targets.length ? targets[i % targets.length] : undefined)
              : t.alive && t.id === tid ? t : g.enemies.nearest(p.x, p.y - 8, range);
            const ax = tgt ? tgt.x : p.x + p.facing.x;
            const ay = tgt ? tgt.y - 6 : p.y - 8 + p.facing.y;
            const a = Math.atan2(ay - (p.y - 8), ax - p.x) + (Math.random() - 0.5) * 0.06;
            // 同一支箭贯穿多人时，每个敌人至多承受一次水花伤害；各箭独立。
            const splashed = new Set<number>();
            const onHit = st.splash ? (e: Enemy) => this.boltSplash(e, st.dmg * st.splash, st.splashRadius * area, st.splashSlow, splashed) : undefined;
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
          g.poisonEnemy(e, st.dps * g.dmgMult(e, 'wood'), linger);
          if (st.slow) g.slowEnemy(e, 0.6);
        }
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
        const r = st.radius * area;
        const targets = this.clusterTargets(220, st.count, r);
        if (!targets.length) return false;
        audio.sfx('fireball', { rate: 0.8 });
        for (const t of targets) {
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
          const a = Math.atan2(t.y - 6 - cy, t.x - cx);
          g.proj.fire('leaf', 'pj_leaf', cx, cy, Math.cos(a) * 260, Math.sin(a) * 260, {
            dmg: st.dmg, el: 'wood', life: 2, bounces: st.bounces, radius: 5, kb: 10, proc, target: t,
          });
        }
        return true;
      }
      case 'waterdragon': {
        const t = g.enemies.nearest(cx, cy, 260);
        const base = t ? Math.atan2(t.y - 6 - cy, t.x - cx) : Math.atan2(p.facing.y, p.facing.x);
        const width = st.width * area;
        // 两条平行通路在中心稍有重叠，远处不会因发散而漏掉瞄准的目标。
        const offs = st.count > 1 ? [-width * 0.85, width * 0.85] : [0];
        audio.sfx('water');
        for (const o of offs) {
          const dragon = g.proj.fire('water', 'pj_water', cx - Math.sin(base) * o, cy + Math.cos(base) * o, Math.cos(base) * 170, Math.sin(base) * 170, {
            dmg: st.dmg * (st.count > 1 ? st.twinDmg : 1), el: 'water', life: 1.8, pierce: 999, radius: width, slow: st.slow, kb: 30, anim: 'pj_water',
          });
          // 水龙的宽度随技能成长，仍保留细长的穿透轮廓。
          dragon.sprite.setScale(1, st.width * area / 7);
        }
        return true;
      }
      case 'jinzhen': {
        // 施放时锁定方向和落区；移动、转身或敌人死亡都不会改变这轮剑雨。
        const ang = Math.atan2(p.facing.y, p.facing.x);
        const fx = Math.cos(ang), fy = Math.sin(ang);
        const spread = st.spread * area;
        p.attack();
        audio.sfx('sword', { rate: 1.2 });
        for (let z = 0; z < st.zones; z++) {
          const reach = (st.range + z * st.spread * 1.3) * area;
          const zx = cx + fx * reach;
          const zy = p.y + fy * reach;
          const phase = Math.random() * Math.PI * 2;
          for (let i = 0; i < st.count; i++) {
            // 螺旋均匀铺开，扩大范围后仍能覆盖中心和边缘。
            const a = phase + i * Math.PI * (3 - Math.sqrt(5));
            const r = spread * Math.sqrt((i + 0.5) / st.count);
            const along = Math.cos(a) * r;
            const across = Math.sin(a) * r * AURA_FLAT;
            this.rainSword(zx + fx * along - fy * across, zy + fy * along + fx * across,
              z * 0.12 + i * 0.045, st.dmg, st.radius * area, fx, fy);
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
        audio.sfx('vine');
        const r = st.radius * area;
        for (const t of targets) {
          const img = g.add.image(t.x, t.y, 'fx_vine').setDepth(t.y - 40).setScale(r / 20).setAlpha(0.3);
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
        audio.sfx('frost');
        g.fx.impact('ice', p.x, p.y, r);
        for (const e of [...near]) g.hitEnemy(e, st.dmg, 'water', { slow: st.slow, kb: 25, fromX: p.x, fromY: p.y });
        return true;
      }
      case 'luoshi': {
        // 砸向附近敌人最密的地方；玩家的落石没有地面预警，下落也快，和关卡落石区分开
        const r = st.radius * area;
        const targets = this.clusterTargets(240, st.count, r);
        if (!targets.length) return false;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          this.boulder(t.x, t.y, i * 0.15, r, st.dmg, st.daze);
        }
        return true;
      }
      case 'stonespike': {
        // 整轮锁定起点和朝向；同一敌人不会被相邻岩刺或击退后的后续岩刺重复命中。
        const ang = Math.atan2(p.facing.y, p.facing.x);
        const fx = Math.cos(ang), fy = Math.sin(ang);
        const ox = p.x, oy = p.y;
        const hit = new Set<number>();
        const r = st.radius * area;
        const spread = Math.tan(st.arc * Math.PI / 360);
        p.attack();
        for (let i = 0; i < st.count; i++) {
          const reach = (12 + (st.range - 12) * i / (st.count - 1)) * area;
          const x = ox + fx * reach, y = oy + fy * reach;
          // 每排由中间向两侧铺开；近端收拢，远端增宽，范围加成同时放大长宽。
          const halfWidth = (reach - 12 * area) * spread;
          const wings = halfWidth < r * 0.5 ? 0 : Math.ceil(halfWidth / (r * 1.5));
          const points = Array.from({ length: wings * 2 + 1 }, (_, j) => {
            const side = wings ? (j - wings) * halfWidth / wings : 0;
            return { x: x - fy * side, y: y + fx * side };
          });
          g.later(i * 0.06, () => {
            for (const point of points) g.fx.crack(point.x, point.y, 0.12, { rotation: ang, scale: area * 1.4 });
          });
          g.later(0.12 + i * 0.06, () => {
            audio.sfx('spike', { vol: 0.65, rate: 0.9 + i * 0.025 });
            for (const point of points) g.fx.anim('fx_earth_ridge', point.x, point.y + 2, { originY: 0.92, depth: point.y + 1, scale: area });
            g.fx.burst(x, y - 2, 0x91816a, 2);
            for (const e of [...g.enemies.inRadius(x, y, r + halfWidth, this.tmp)]) {
              const id = e.id;
              if (hit.has(id)) continue;
              // 横向胶囊覆盖整排，避免岩刺之间漏判；宽圈仅作候选查询。
              const dx = e.x - x, dy = e.y - y;
              const along = dx * fx + dy * fy;
              const across = Math.max(0, Math.abs(-dx * fy + dy * fx) - halfWidth);
              if (Math.hypot(along, across) > r + e.radius) continue;
              // 以敌人当前点后方为击退原点，严格沿施放方向开路。
              if (g.hitEnemy(e, st.dmg, 'earth', { kb: st.kb, fromX: e.x - fx * 10, fromY: e.y - fy * 10 }) > 0) hit.add(id);
            }
          });
        }
        return true;
      }
    }
    return false;
  }

  /** 优先落在尚未覆盖的密集敌群；全覆盖后允许余下炮击继续集火。 */
  private clusterTargets(range: number, count: number, radius: number): Enemy[] {
    const g = this.g;
    const candidates = g.enemies.randomIn(g.player.x, g.player.y, range, 10);
    const spots = candidates.map(e => ({ e, near: [...g.enemies.inRadius(e.x, e.y, radius, this.tmp)] }));
    if (!spots.length) return [];
    const covered = new Set<number>();
    const result: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const best = [...spots].sort((a, b) => {
        const fresh = (s: typeof a) => s.near.filter(e => !covered.has(e.id)).length;
        return fresh(b) - fresh(a) || b.near.length - a.near.length;
      })[0];
      result.push(best.e);
      for (const e of best.near) covered.add(e.id);
    }
    return result;
  }

  /** 大招的每一轮都重新查找活敌人，不保留会被对象池复用的目标。 */
  private ultimate(id: SkillId, st: Stats): boolean {
    const g = this.g;
    const def = SKILLS[id];
    if (!def.el) return false;
    const r = st.radius * g.pstats.area;
    if (!g.enemies.inRadius(g.player.x, g.player.y, r, []).length) return false;
    const col = EL_INFO[def.el].color;
    g.player.attack();
    g.hud.toast(`大招 · ${def.name}`, EL_INFO[def.el].css);
    audio.sfx('benming');
    for (let wave = 0; wave < st.count; wave++) {
      g.later(0.15 + wave * st.interval, () => {
        if (g.over || !g.player.alive) return;
        const { x, y } = g.player;
        g.fx.ring(x, y - 6, r, col, 0.6);
        // 控制每轮的装饰数量，十个普通术同时施放时仍能看清角色和敌弹。
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + wave * 0.25;
          const px = x + Math.cos(a) * r * 0.6;
          const py = y + Math.sin(a) * r * 0.6;
          if (def.el === 'metal') g.fx.anim('fx_slash', px, py, { rotation: a, scale: 1.5, tint: col });
          else if (def.el === 'wood') g.fx.burst(px, py, col, 4);
          else g.fx.impact(def.el === 'fire' ? 'fire' : def.el === 'water' ? 'ice' : 'stone', px, py, 28, col);
        }
        for (const e of g.enemies.inRadius(x, y, r, [])) {
          g.hitEnemy(e, st.dmg, def.el, {
            proc: def.proc, slow: st.slow, stun: st.root,
            kb: st.kb ?? 15, fromX: x, fromY: y,
            // 昆仑由山岳傀灵施放，沿用傀儡伤害通路，免受本体术减伤。
            puppet: def.el === 'earth',
          });
        }
      });
    }
    return true;
  }

  /**
   * 画符：每有一个别系的术，就有一次机会（15% + 丹青）把这张符画成该系。
   * 五雷：每第 5 张优先画成克制目标的元素
   */
  private drawFu(t: Enemy): El {
    const owned = [...new Set([...this.g.build.skills.keys()].map((id) => SKILLS[id].el).filter((el): el is El => el !== null))];
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
      const tint = s.el === 'fire' ? 0xffd078 : EL_INFO[s.el].color;
      const proc = SKILLS.talisman.proc;
      g.explode(s.x, s.y, s.radius, s.dmg, s.el, 80, tint, proc, 'seal');
      // 符海：原地再爆一次
      const echo = this.mod('zhu.echo');
      const { x, y, radius, dmg, el } = s;
      if (echo) g.later(0.6, () => g.explode(x, y, radius * 0.8, dmg * echo, el, 40, tint, proc, 'seal'));
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
    if (!this.aura) this.aura = g.add.sprite(0, 0, 'fx_poison_mist').play('fx_poison_mist');
    const r = this.auraRadius(SKILLS.duwu.stats(lv));
    const k = r / 31;
    this.aura
      .setVisible(p.alive)
      .setPosition(p.x, p.y)
      .setDepth(p.y - 40)
      .setScale(k, k * AURA_FLAT)
      .setAlpha(0.55 + 0.1 * Math.sin(g.now * 2));
  }

  /** 流金剑雨：前进距离等于落高（45°），地面纵深按俯视透视压扁。 */
  private rainSword(x: number, y: number, delay: number, dmg: number, r: number, fx: number, fy: number) {
    const g = this.g;
    const height = 80;
    const dx = fx * height;
    const dy = height + fy * height * AURA_FLAT;
    g.later(delay, () => {
      const s = g.add.image(x - dx, y - dy, 'pj_sword')
        .setOrigin(1, 0.5).setRotation(Math.atan2(dy, dx)).setDepth(y + 2);
      g.tweens.add({
        targets: s, x, y, duration: 200, ease: 'Quad.in',
        onComplete: () => {
          s.destroy();
          g.fx.burst(x, y - 2, EL_INFO.metal.color, 2);
          for (const e of [...g.enemies.inRadius(x, y, r, this.tmp)]) g.hitEnemy(e, dmg, 'metal', { kb: 10, fromX: x - fx * 10, fromY: y - fy * 10, proc: SKILLS.jinzhen.proc });
        },
      });
    });
  }

  /** 落石：土黄色巨石快速砸下，砸中一片并眩晕 */
  private boulder(x: number, y: number, delay: number, r: number, dmg: number, daze: number) {
    const g = this.g;
    g.later(delay, () => {
      const rock = g.add.image(x, y - 160, 'fx_boulder').setOrigin(0.5, 0.9).setScale(r / 18).setTint(0xf0cc80).setDepth(1e6 - 1);
      g.tweens.add({
        targets: rock, y, duration: 380, ease: 'Quad.in',
        onComplete: () => {
          rock.destroy();
          audio.sfx('stoneImpact');
          g.fx.impact('stone', x, y, r);
          const near = g.enemies.inRadius(x, y, r, this.tmp);
          if (near.length) g.cameras.main.shake(90, 0.003);
          for (const e of [...near]) g.hitEnemy(e, dmg, 'earth', { daze, kb: 50, fromX: x, fromY: y });
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
    while (this.orbs.length < st.count) this.orbs.push(g.add.sprite(0, 0, 'fx_orbit_flame', 0).play('fx_orbit_flame'));
    const R = st.orbit * g.pstats.area;
    const hitR = st.hitRadius * g.pstats.area;
    const period = Math.max(st.hitCd, st.period * g.pstats.cdMult);
    const advance = (dt * Math.PI * 2) / period;
    const previous = this.orbAng;
    this.orbAng = (previous + advance) % (Math.PI * 2);
    // 高减冷却/低帧率下沿本帧弧线补点，点间距不超过火团半径，避免跳过敌人。
    const steps = Math.max(1, Math.ceil(advance * R / hitR));
    const now = g.now;
    if (this.orbHit.size > 300) for (const [id, t] of this.orbHit) if (t < now) this.orbHit.delete(id);
    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.orbAng + (i / this.orbs.length) * Math.PI * 2;
      const x = p.x + Math.cos(a) * R;
      const y = p.y - 6 + Math.sin(a) * R * st.flat;
      this.orbs[i].setPosition(x, y).setDepth(y + 10).setVisible(p.alive)
        .setRotation(Math.atan2(Math.cos(a) * st.flat, -Math.sin(a))).setScale(g.pstats.area);
      if (!p.alive) continue;
      for (let step = 1; step <= steps; step++) {
        const hitAngle = previous + advance * step / steps + (i / this.orbs.length) * Math.PI * 2;
        const hx = p.x + Math.cos(hitAngle) * R;
        const hy = p.y + Math.sin(hitAngle) * R * st.flat;
        // 伤害可能触发死亡范围效果，查询结果单独保留。
        for (const e of [...g.enemies.inRadius(hx, hy, hitR, this.tmp)]) {
          if ((this.orbHit.get(e.id) ?? 0) > now) continue;
          this.orbHit.set(e.id, now + st.hitCd);
          g.hitEnemy(e, st.dmg, 'fire', { kb: 25, fromX: p.x, fromY: p.y, proc: SKILLS.lihuo.proc });
        }
      }
    }
  }

  /** 藤缚：每 0.5 秒给藤蔓里的敌人一跳伤害并迟缓，到时淡出 */
  private updateVines(dt: number) {
    const g = this.g;
    const due = new Map<number, { e: Enemy; dmg: number }>();
    for (const [id, until] of this.vineHit) if (until <= g.now + 1e-8) this.vineHit.delete(id);
    for (let i = this.vines.length - 1; i >= 0; i--) {
      const v = this.vines[i];
      v.t -= dt;
      v.tick -= dt;
      if (v.tick <= 0 && v.t > 0) {
        v.tick += 0.5;
        // 每次结算时藤须向内收紧，再松开，节奏与半秒一跳的伤害一致。
        v.img.setScale(v.r / 20 * 0.9).setAlpha(0.85);
        g.tweens.add({ targets: v.img, scale: v.r / 20, alpha: 0.55, duration: 260, ease: 'Cubic.out' });
        for (const e of this.inVine(v.x, v.y, v.r)) {
          if ((this.vineHit.get(e.id) ?? 0) - g.now > 1e-8) continue;
          if (v.dmg > (due.get(e.id)?.dmg ?? 0)) due.set(e.id, { e, dmg: v.dmg });
        }
      }
      if (v.t <= 0) {
        const img = v.img;
        g.tweens.add({ targets: img, alpha: 0, duration: 250, onComplete: () => img.destroy() });
        this.vines.splice(i, 1);
      }
    }
    for (const { e, dmg } of due.values()) {
      this.vineHit.set(e.id, g.now + 0.5);
      g.hitEnemy(e, dmg, 'wood', { proc: SKILLS.tengfu.proc });
      if (e.alive) g.slowEnemy(e, 0.6);
    }
  }

  /** 藤蔓是地上的椭圆，上下压扁 */
  private inVine(x: number, y: number, r: number) {
    return [...this.g.enemies.inRadius(x, y, r, this.tmp)].filter((e) => ((e.x - x) / r) ** 2 + ((e.y - y) / (r * AURA_FLAT)) ** 2 <= 1);
  }

  /** 分水连弩：水花随等级成长，满级才附带迟缓；不暴击或递归触发浪花。 */
  private boltSplash(e: Enemy, dmg: number, radius: number, slow: number, splashed: Set<number>) {
    const g = this.g;
    g.fx.ring(e.x, e.y - 6, radius, 0x8fc0ff, 0.25);
    for (const o of g.enemies.inRadius(e.x, e.y, radius, [])) {
      if (slow) g.slowEnemy(o, slow);
      if (o === e || splashed.has(o.id)) continue;
      splashed.add(o.id);
      g.hitEnemy(o, dmg, 'water', { kb: 10, fromX: e.x, fromY: e.y, noCrit: true });
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
    for (const e of [...g.enemies.inRadius(cx, cy, range, this.tmp)]) {
      const ex = e.x - cx;
      const ey = e.y - 6 - cy;
      const d = Math.hypot(ex, ey);
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(ey, ex) - ang), Math.cos(Math.atan2(ey, ex) - ang)));
      if (d < 12 || diff <= half) g.hitEnemy(e, st.dmg * mult, 'metal', { kb: 70, fromX: cx, fromY: cy, proc: SKILLS.slash.proc });
    }
  }
}
