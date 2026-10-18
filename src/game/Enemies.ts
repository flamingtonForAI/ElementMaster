import Phaser from 'phaser';
import { ENEMIES, type EnemyDef } from '../config/enemies';
import { enemyTex, roarBuff, type RoarBuff } from '../config/levels';
import { STATUS_INFO, type Inflict } from '../config/status';
import { EL_INFO, type El } from '../config/elements';
import { SpatialGrid } from './SpatialGrid';
import { PLAYER_RADIUS } from './Player';
import { label, hex } from '../ui/text';
import type { GameScene, HurtOpts } from '../scenes/GameScene';
import type { ChestKind } from './Pickups';
import { audio } from '../audio/Audio';

export class Enemy {
  id = 0;
  def!: EnemyDef;
  /** 本关实际用的贴图：有地域外观时和 def.tex 不同，动画、尸骸都跟着它走 */
  tex = '';
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
  /** 精英掉的宝箱：游荡精英掉铜匣，精英潮和 Boss 前的精英掉金宝箱 */
  chest: ChestKind = 'gold';
  boss = false;
  kbx = 0;
  kby = 0;
  /** 刚撞过岩壁，这之前都顺着距离场绕行 */
  navUntil = 0;
  slowUntil = 0;
  slowF = 1;
  stunUntil = 0;
  /** 定身结束后的免疫期 */
  stunImmuneUntil = 0;
  /** 身上的异常：中毒单层、灼烧叠层（每层 burnDps）、破绽 */
  poisonUntil = 0;
  poisonDps = 0;
  burnUntil = 0;
  burnStacks = 0;
  burnDps = 0;
  flawUntil = 0;
  dotTick = 0;
  flashUntil = 0;
  contactAt = 0;
  counterShown = false;
  /** 行为状态机 */
  state = 0;
  timer = 0;
  timer2 = 0;
  timer3 = 0;
  dashX = 0;
  dashY = 0;
  /** 跳跃的起点、落点（山魈王） */
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  /** 离地高度，贴图往上抬，期间不造成接触伤害 */
  lift = 0;
  tint = -1;
  /** 攻击附带异常的每秒伤害（中毒、灼烧），随时间成长 */
  atkDps = 0;
  /** Boss 已按每 20% 血量掉过几瓶解毒药 */
  dropStage = 0;
  /** 最后一次受伤的元素，判定残兵复活、刑天复起 */
  lastEl: El | null = null;
  /** 这之前不受伤（刑天复起） */
  invulnUntil = 0;
  /** Boss 已进入狂暴（血量跌破 RAGE_AT），之后一直保持；rageUntil 前是吼叫的停顿 */
  raged = false;
  rageUntil = 0;
  /** 狼妖狂暴后的连冲：这一轮还能再冲几次 */
  combo = 0;
  /** 已经复起过（刑天） */
  rose = false;
  noKill = false;
  /** 冲刺留火的里程（赤狐、毕方） */
  trailAcc = 0;
  /** 已吃到的远吼层数，以及由它换算出的行为倍率（见 RoarBuff） */
  roarN = 0;
  cdMul = 1;
  windMul = 1;
  dashMul = 1;
  blastMul = 1;
  regenMul = 1;
  trailAdd = 0;
  reviveSub = 0;
  chanceAdd = 0;
  /** 远吼时全场一跳的起始时刻 */
  hopAt = -1;
  glyph: Phaser.GameObjects.Text | null = null;
  constructor(readonly sprite: Phaser.GameObjects.Sprite) {}
}

/** 远吼时一跳的时长 */
const HOP = 0.3;
/** Boss 血量跌破这个比例进入狂暴：停顿吼一声、全场小怪叠一层远吼，之后换成狂暴的出招 */
export const RAGE_AT = 0.3;
/** 狂暴吼叫的停顿（期间无敌、不出招） */
const RAGE_PAUSE = 1;

const TINTS: Record<number, number> = {
  2: STATUS_INFO.stun.tint,
  3: STATUS_INFO.slow.tint,
  4: 0xff9a8a,
  5: STATUS_INFO.burn.tint,
  6: STATUS_INFO.poison.tint,
  7: STATUS_INFO.flaw.tint,
};

export interface SpawnOpts {
  hpMult?: number;
  elite?: boolean;
  chest?: ChestKind;
  /** 不掉经验（Boss 召唤的小怪） */
  noXp?: boolean;
  /** 不计击杀（复活的残兵：同一只兵反复打不能刷灵石） */
  noKill?: boolean;
}

export class EnemyManager {
  readonly list: Enemy[] = [];
  private pool: Enemy[] = [];
  readonly grid = new SpatialGrid<Enemy>(32);
  private nextId = 1;
  private tmp: Enemy[] = [];
  /** 地上等着复活的残兵尸骸数，超过上限就不再复活 */
  private corpses = 0;
  private reviveHinted = false;

  /** 远吼时一跳染的颜色：Boss 的元素色，调淡一点免得盖住原色 */
  private get roarTint() {
    const c = EL_INFO[ENEMIES[this.g.levelDef.boss]?.el ?? 'metal'].color;
    const mix = (sh: number) => Math.round(((c >> sh) & 255) * 0.6 + 255 * 0.4) << sh;
    return mix(16) | mix(8) | mix(0);
  }

  constructor(private g: GameScene) {}

  spawn(defId: string, x: number, y: number, o: SpawnOpts = {}): Enemy {
    const def = ENEMIES[defId];
    const e = this.pool.pop() ?? new Enemy(this.g.add.sprite(0, 0, def.tex, 0).setOrigin(0.5, 0.9));
    e.id = this.nextId++;
    e.def = def;
    e.x = x;
    e.y = y;
    e.elite = !!o.elite;
    e.chest = o.chest ?? 'gold';
    e.boss = !!def.boss;
    const hpMult = (o.hpMult ?? 1) * (e.elite ? 10 : 1);
    e.maxHp = e.hp = Math.round(def.hp * hpMult);
    e.dmg = def.dmg * (e.elite ? 1.5 : 1) * (e.boss ? 1 : this.g.dmgScale());
    e.armor = def.armor;
    e.radius = def.radius * (e.elite ? 1.5 : 1);
    e.speed = def.speed * (0.9 + Math.random() * 0.2);
    e.xp = o.noXp ? 0 : e.elite ? 20 : def.xp;
    e.atkDps = (def.inflict?.dps ?? 0) * (e.elite ? 1.5 : 1) * (e.boss ? 1 : this.g.dmgScale());
    e.dropStage = 0;
    e.lastEl = null;
    e.invulnUntil = 0;
    e.rose = false;
    e.raged = false;
    e.rageUntil = 0;
    e.combo = 0;
    e.noKill = !!o.noKill;
    e.trailAcc = 0;
    e.roarN = 0;
    e.cdMul = e.windMul = e.dashMul = e.blastMul = e.regenMul = 1;
    e.trailAdd = e.reviveSub = e.chanceAdd = 0;
    e.hopAt = -1;
    e.alive = true;
    e.kbx = e.kby = 0;
    e.slowUntil = e.stunUntil = e.stunImmuneUntil = e.flashUntil = e.contactAt = 0;
    e.poisonUntil = e.poisonDps = e.burnUntil = e.burnStacks = e.burnDps = e.flawUntil = e.dotTick = 0;
    e.counterShown = false;
    e.state = 0;
    e.timer = 1 + Math.random() * 2;
    e.timer2 = 6;
    e.timer3 = 3;
    e.lift = 0;
    e.tint = -1;
    e.navUntil = 0;
    const tex = enemyTex(this.g.levelDef, defId, def.tex);
    e.tex = tex;
    e.sprite.setTexture(tex, 0).setVisible(true).setActive(true).setScale(e.elite ? 1.5 : 1).setAlpha(1).clearTint();
    this.play(e, '_move');
    this.applyRoar(e, this.g.roarStacks);
    if (e.elite || e.boss) {
      e.glyph = label(this.g, 0, 0, EL_INFO[def.el].name, hex(EL_INFO[def.el].color)).setOrigin(0.5, 1);
    }
    this.list.push(e);
    return e;
  }

  /**
   * 把敌人的远吼层数调到 n：生命、速度、伤害按“新层/旧层”的比例补差，护甲补点数，行为倍率直接按 n 重算。
   * Boss 自己不吃加成
   */
  applyRoar(e: Enemy, n: number) {
    const from = e.roarN;
    e.roarN = n;
    const b = e.boss ? null : roarBuff(this.g.levelDef, e.def.id, e.def.el);
    if (!b || n === from) return;
    const ratio = (k: keyof RoarBuff) => (1 + (b[k] ?? 0) * n) / (1 + (b[k] ?? 0) * from);
    const hr = ratio('hp');
    e.maxHp = Math.round(e.maxHp * hr);
    e.hp = Math.min(e.maxHp, e.hp * hr);
    e.speed *= ratio('speed');
    const dr = ratio('dmg');
    e.dmg *= dr;
    e.atkDps *= dr;
    e.armor += (b.armor ?? 0) * (n - from);
    e.cdMul = Math.max(0.5, 1 - (b.cd ?? 0) * n);
    e.windMul = Math.max(0.5, 1 - (b.windup ?? 0) * n);
    e.dashMul = 1 + (b.dash ?? 0) * n;
    e.blastMul = 1 + (b.blast ?? 0) * n;
    e.regenMul = 1 + (b.regen ?? 0) * n;
    e.trailAdd = (b.trail ?? 0) * n;
    e.reviveSub = (b.revive ?? 0) * n;
    e.chanceAdd = (b.chance ?? 0) * n;
  }

  /** 血量跌破 RAGE_AT 就狂暴；等 Boss 回到普通走位（不在蓄力、冲刺、半空里）再触发，免得打断一半的招 */
  maybeEnrage(e: Enemy) {
    if (e.boss && !e.raged && e.state === 0 && e.lift <= 0 && e.hp > 0 && e.hp < e.maxHp * RAGE_AT) this.enrage(e);
  }

  /** Boss 进入狂暴：停顿吼一声（期间无敌），通知场景给全场小怪叠一层 */
  enrage(e: Enemy) {
    const g = this.g;
    e.raged = true;
    e.rageUntil = e.invulnUntil = g.now + RAGE_PAUSE;
    e.timer = Math.max(e.timer, 0.4);
    e.combo = 0;
    const col = EL_INFO[e.def.el].color;
    g.fx.ring(e.x, e.y - 12, 60, col, 0.5);
    g.later(0.25, () => g.fx.ring(e.x, e.y - 12, 90, col, 0.5));
    g.cameras.main.shake(500, 0.008);
    audio.sfx('boss', { rate: 0.8, vol: 0.7 });
    g.onBossRage(e);
  }

  /** 狂暴脉动色：在原色和元素色之间来回 */
  private ragePulse(e: Enemy, now: number) {
    const c = EL_INFO[e.def.el].color;
    const k = 0.25 + 0.25 * Math.sin(now * 6);
    const mix = (sh: number) => Math.round(255 * (1 - k) + ((c >> sh) & 255) * k) << sh;
    return mix(16) | mix(8) | mix(0);
  }

  /** Boss 远吼：场上所有怪升到 n 层，并一齐跳一下 */
  onRoar(n: number) {
    const now = this.g.now;
    for (const e of this.list) {
      if (!e.alive || e.boss) continue;
      this.applyRoar(e, n);
      e.hopAt = now;
    }
  }

  /** 按地域外观播放动作帧；皮肤没做这套帧（如 _dig）就退回默认贴图 */
  private play(e: Enemy, suffix: '_move' | '_dig') {
    const key = e.tex + suffix;
    e.sprite.play(this.g.anims.exists(key) ? key : e.def.tex + suffix);
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
      // 近战的普通怪会被傀儡吸走仇恨；Boss 和远程怪只盯本体
      const pp = !e.boss && e.def.behavior !== 'spit' && g.puppets.list.length ? g.puppets.aggroOf(e) : null;
      const pdist = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const dx = (pp ? pp.x : p.x) - e.x;
      const dy = (pp ? pp.y : p.y) - e.y;
      const dist = pp ? Math.hypot(dx, dy) || 1 : pdist;
      let nx = dx / dist;
      let ny = dy / dist;
      // 被岩壁挡住时顺着玩家的距离场绕到缺口；追傀儡时隔着墙也按这个走（傀儡总在本体附近）
      const nav = !e.boss && !this.underground(e) ? g.world.nav : null;
      if (nav) {
        const blocked = pp ? !nav.clear(e.x, e.y, pp.x, pp.y) : false;
        const st = !pp || blocked ? nav.steer(e.x, e.y, nx, ny, blocked || now < e.navUntil) : null;
        if (st) [nx, ny] = st;
      }
      const stunned = now < e.stunUntil;
      const slow = now < e.slowUntil ? e.slowF : 1;
      let vx = 0;
      let vy = 0;

      this.maybeEnrage(e);
      const roaring = now < e.rageUntil;
      if (!stunned && !roaring) {
        const mv = this.behave(e, dt, nx, ny, dist, slow);
        vx = mv[0];
        vy = mv[1];
      }
      // 中毒期间不回血
      const poisoned = now < e.poisonUntil;
      const burning = now < e.burnUntil;
      if (e.def.regen && !poisoned) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * e.regenMul * dt);
      if (poisoned || burning) {
        e.dotTick -= dt;
        if (e.dotTick <= 0) {
          e.dotTick += 0.5;
          // 润泽：迟缓时中毒加深；引火：中毒时灼烧加深
          const mods = g.build.mods;
          const pd = poisoned ? e.poisonDps * (now < e.slowUntil ? 1 + (mods['hh.slowPoison'] ?? 0) : 1) : 0;
          const bd = burning ? e.burnStacks * e.burnDps * (poisoned ? 1 + (mods['hh.poisonBurn'] ?? 0) : 1) : 0;
          const dps = pd + bd;
          g.dotEnemy(e, dps * 0.5, burning ? 'burn' : 'poison');
          if (!e.alive) continue;
        }
      }

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
      // 岩壁挡住普通敌人：推出去，再沿岩壁切线绕行；Boss 和钻地中的穿山甲不受影响
      const hard = !e.boss && !this.underground(e);
      if (hard ? g.world.push(e, e.radius) : g.world.clamp(e, e.radius)) {
        if (hard) e.navUntil = now + 0.8;
        const tx = -g.world.hitNy;
        const ty = g.world.hitNx;
        const side = tx * nx + ty * ny >= 0 ? 1 : -1;
        e.x += tx * side * e.speed * slow * dt * 0.8;
        e.y += ty * side * e.speed * slow * dt * 0.8;
      }

      // 接触伤害
      const touch = e.lift <= 0 && !this.underground(e);
      if (!touch) {
        // 钻地、跳跃中不造成接触伤害
      } else if (pp && dist < e.radius + pp.radius && now >= e.contactAt) {
        e.contactAt = now + 0.8;
        g.puppets.hurt(pp, e.dmg, e.def.el);
      } else if (p.alive && pdist < e.radius + PLAYER_RADIUS && now >= e.contactAt) {
        e.contactAt = now + 0.8;
        g.hurtPlayer(e.dmg, e.def.el, this.hurtOf(e, this.dashing(e)));
      }

      const s = e.sprite;
      const hop = now - e.hopAt < HOP ? Math.sin(((now - e.hopAt) / HOP) * Math.PI) * 4 : 0;
      s.setPosition(e.x, e.y - e.lift - hop);
      s.setDepth(e.y);
      if (Math.abs(dx) > 2) s.setFlipX(dx < 0);
      // 着色优先级：受击闪白 > 定身 > 冲锋预警 > 灼烧 > 中毒 > 迟缓 > 破绽
      const tint =
        now < e.flashUntil ? 1
        : hop > 0 ? 8
        : stunned ? 2
        : (e.state === 1 && (e.def.behavior === 'charge' || e.boss)) || (e.state === 4 && e.def.behavior === 'boss_xingtian') || (e.state === 2 && e.def.behavior === 'burrow') ? 4
        : burning ? 5
        : poisoned ? 6
        : slow < 1 ? 3
        : now < e.flawUntil ? 7
        : e.raged ? 9
        : 0;
      // 狂暴的 Boss 一直带着元素色脉动，每帧重算
      if (tint === 9) {
        e.tint = 9;
        s.setTint(this.ragePulse(e, now));
      } else if (tint !== e.tint) {
        e.tint = tint;
        if (tint === 1) s.setTintFill(0xffffff);
        else if (tint === 0) s.clearTint();
        else if (tint === 8) s.setTint(this.roarTint);
        else s.setTint(TINTS[tint]);
      }
      if (e.glyph) e.glyph.setPosition(Math.round(e.x), Math.round(e.y - e.lift - s.displayHeight * 0.9)).setDepth(e.y + 1);
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
        [e.x, e.y] = g.ringPos(390);
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
            e.timer = 0.55 * e.windMul;
            e.dashX = nx;
            e.dashY = ny;
            g.fx.line(e.x, e.y - 6, Math.atan2(ny, nx), 90, 0xff5a4a, e.timer);
            audio.sfx('charge');
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
          e.timer = 3.5 * e.cdMul;
        }
        const dash = 170 * e.dashMul * slow;
        // 赤狐：冲过的地方留一溜火
        if (e.def.trail) this.trail(e, dash * dt, 18, 9, 1.8 + e.trailAdd, 3);
        return [e.dashX * dash, e.dashY * dash];
      }
      case 'spit': {
        // 靠近到一定距离后绕着走，定时朝玩家吐毒囊
        e.timer -= dt;
        if (e.timer <= 0 && dist < 180) {
          e.timer = (4.5 + Math.random()) * e.cdMul;
          g.proj.enemyShot(e.def.shot ?? 'ep_poison', e.x, e.y - 8, nx * 90, ny * 90, e.dmg, e.def.el, this.hurtOf(e));
          audio.sfx('bossShot', { rate: 1.6, vol: 0.4 });
        }
        if (dist > 90) return [nx * sp, ny * sp];
        return [-ny * sp * 0.5, nx * sp * 0.5];
      }
      case 'burrow': {
        // 0 走路 → 1 钻地追到脚下 → 2 冒头预警，结束时破土而出
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0 && dist < 220 && dist > 50) {
            e.state = 1;
            e.timer = 2.5;
            this.play(e, '_dig');
          }
          return [nx * sp, ny * sp];
        }
        if (e.state === 1) {
          if (e.timer <= 0 || dist < 12) {
            e.state = 2;
            e.timer = 0.55;
            g.fx.disc(e.x, e.y, 22, 0xdaa53e, 0.3, 0.55);
            g.fx.crack(e.x, e.y, 0.55);
          }
          return [nx * sp * 3, ny * sp * 3];
        }
        if (e.timer <= 0) {
          e.state = 0;
          e.timer = (4 + Math.random() * 2) * e.cdMul;
          this.play(e, '_move');
          audio.sfx('spike', { rate: 0.8 });
          g.fx.anim('fx_spike', e.x, e.y + 2, { originY: 0.92, depth: e.y + 1, tint: 0xdaa53e });
          g.fx.burst(e.x, e.y - 2, 0x8a6220, 8);
          const p = g.player;
          if (Math.hypot(p.x - e.x, p.y - e.y) < 22 + PLAYER_RADIUS) g.hurtPlayer(e.dmg * 1.5, e.def.el, this.hurtOf(e));
        }
        return [0, 0];
      }
      case 'boss_ape':
        return this.ape(e, dt, nx, ny, sp);
      case 'boss_bird':
        return this.bird(e, dt, nx, ny, sp, dist);
      case 'boss_xingtian':
        return this.xingtian(e, dt, nx, ny, sp, dist);
      case 'boss_wolf': {
        e.timer -= dt;
        if (e.state === 0) {
          if (e.timer <= 0) {
            e.state = 1;
            e.timer = 0.7;
            e.dashX = nx;
            e.dashY = ny;
            g.fx.line(e.x, e.y - 10, Math.atan2(ny, nx), 230, 0xff5a4a, 0.7, 10);
            audio.sfx('bossCharge');
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
            const n = e.raged ? 16 : 12;
            const hurt = this.hurtOf(e);
            audio.sfx('bossShot');
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              g.proj.enemyShot('ep_wind', e.x, e.y - 12, Math.cos(a) * 95, Math.sin(a) * 95, 10, 'metal', hurt);
            }
          }
          return [e.dashX * 250, e.dashY * 250];
        }
        if (e.timer <= 0) {
          // 狂暴后一半机会立刻再冲一次：重新瞄准、重新预警
          if (e.raged && e.combo === 0 && Math.random() < 0.5) {
            e.combo = 1;
            e.state = 0;
            e.timer = 0;
          } else {
            e.combo = 0;
            e.state = 0;
            e.timer = e.raged ? 1.5 : 2.2;
          }
        }
        return [0, 0];
      }
      case 'boss_tree': {
        e.timer -= dt;
        e.timer2 -= dt;
        const rage = e.raged;
        const hurt = this.hurtOf(e);
        if (e.timer <= 0) {
          e.timer = rage ? 2.6 : 3.2;
          const n = rage ? 20 : 14;
          audio.sfx('bossShot', { rate: 0.8 });
          const off = Math.random() * Math.PI;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            g.proj.enemyShot('ep_leaf', e.x, e.y - 30, Math.cos(a) * 100, Math.sin(a) * 100, 9, 'wood', hurt);
          }
        }
        if (e.timer2 <= 0) {
          e.timer2 = 10;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            this.spawn('tengguai', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, { hpMult: g.hpScale(), noXp: true });
          }
        }
        // 狂暴后：朝玩家方向钻出一排毒刺
        if (rage) {
          e.timer3 -= dt;
          if (e.timer3 <= 0) {
            e.timer3 = 4.5;
            this.thornLine(e.x, e.y, Math.atan2(ny, nx), hurt);
          }
        }
        return [nx * sp, ny * sp];
      }
      default:
        return [nx * sp, ny * sp];
    }
  }

  /** 钻在地下：不吃岩壁、不碰人 */
  private underground(e: Enemy) {
    return e.def.behavior === 'burrow' && (e.state === 1 || e.state === 2);
  }

  /** 有前摇的冲撞，撞到必定暴击：狼妖扑咬、毕方俯冲、刑天盾冲 */
  private dashing(e: Enemy) {
    const b = e.def.behavior;
    return (b === 'boss_wolf' && e.state === 2) || (b === 'boss_bird' && e.state === 2) || (b === 'boss_xingtian' && e.state === 5);
  }

  /** 每走 step 像素在脚下留一片余火 */
  private trail(e: Enemy, moved: number, step: number, r: number, dur: number, dmg: number) {
    e.trailAcc += moved;
    if (e.trailAcc < step) return;
    e.trailAcc = 0;
    this.g.hazards.patch(e.x, e.y, r, dur, dmg);
  }

  /**
   * 毕方：绕着玩家飞，定时朝玩家扇出一把火球；蓄力后贴地俯冲，冲过的地方留下一道余火；
   * 狂暴后火球更密、俯冲更勤，并且每 6.5 秒在玩家周围降下四道火柱。
   */
  private bird(e: Enemy, dt: number, nx: number, ny: number, sp: number, dist: number): [number, number] {
    const g = this.g;
    const rage = e.raged;
    e.timer -= dt;
    if (rage) {
      e.timer3 -= dt;
      if (e.timer3 <= 0) {
        e.timer3 = 6.5;
        const p = g.player;
        g.hazards.blast(p.x, p.y, 30, 1.1, 14, 2.5);
        const off = Math.random() * Math.PI;
        for (let i = 0; i < 3; i++) {
          const a = off + (i / 3) * Math.PI * 2;
          g.hazards.blast(p.x + Math.cos(a) * 80, p.y + Math.sin(a) * 55, 30, 1.1, 14, 2.5);
        }
      }
    }
    if (e.state === 0) {
      // 飞着的时候身子离地一点
      e.lift = Math.max(0, e.lift - dt * 40);
      e.timer2 -= dt;
      if (e.timer2 <= 0) {
        e.timer2 = rage ? 2.4 : 3.2;
        const n = rage ? 7 : 5;
        const a = Math.atan2(ny, nx);
        audio.sfx('bossShot', { rate: 1.1 });
        for (let i = 0; i < n; i++) {
          const k = (i - (n - 1) / 2) * 0.2;
          g.proj.enemyShot('ep_fire', e.x, e.y - 20, Math.cos(a + k) * 120, Math.sin(a + k) * 120, 10, 'fire', this.hurtOf(e));
        }
      }
      if (e.timer <= 0 && dist < 260) {
        e.state = 1;
        e.timer = 0.75;
        e.dashX = nx;
        e.dashY = ny;
        g.fx.line(e.x, e.y - 6, Math.atan2(ny, nx), 260, 0xff5a4a, 0.75, 12);
        audio.sfx('bossCharge');
      }
      // 远了就飞过来，近了绕着玩家打转
      if (dist > 120) return [nx * sp, ny * sp];
      return [-ny * sp * 0.7 + nx * sp * 0.15, nx * sp * 0.7 + ny * sp * 0.15];
    }
    if (e.state === 1) {
      // 蓄力：抬高身子
      e.lift = Math.min(14, e.lift + dt * 30);
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = 0.75;
        e.lift = 0;
        e.trailAcc = 0;
      }
      return [0, 0];
    }
    if (e.state === 2) {
      this.trail(e, 300 * dt, 22, 14, 3, 5);
      if (e.timer <= 0) {
        e.state = 3;
        e.timer = 0.6;
      }
      return [e.dashX * 300, e.dashY * 300];
    }
    if (e.timer <= 0) {
      e.state = 0;
      e.timer = rage ? 3.2 : 4.5;
    }
    return [0, 0];
  }

  /**
   * 刑天：左干右戚，慢慢逼近。贴身时举斧蓄力劈下（必定暴击）；中距离举盾冲撞；
   * 定时舞干戚甩出一圈飞刃。第一次被打倒时若不是火系击杀，跪地 2 秒后带 35% 生命复起，
   * 之后更快，舞干戚时还会唤起残兵。
   */
  private xingtian(e: Enemy, dt: number, nx: number, ny: number, sp: number, dist: number): [number, number] {
    const g = this.g;
    const rage = e.raged;
    const fast = e.rose ? 1.25 : 1;
    const hurt = this.hurtOf(e);
    if (e.state === 9) {
      // 跪地复起
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 0;
        e.timer = 1;
        e.sprite.setScale(1);
        audio.sfx('bossCharge');
        g.cameras.main.shake(300, 0.008);
        g.fx.ring(e.x, e.y - 10, 70, 0xe06a5a, 0.5);
        this.bladeRing(e, 20, hurt);
      }
      return [0, 0];
    }
    e.timer -= dt;
    e.timer2 -= dt;
    if (e.state === 0) {
      e.timer3 -= dt;
      if (e.timer3 <= 0) {
        e.timer3 = rage ? 5.5 : 7;
        this.bladeRing(e, rage ? 16 : 12, hurt);
        if (e.rose) {
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            this.spawn('canbing', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 30, { hpMult: g.hpScale(), noXp: true });
          }
        }
      }
      if (e.timer <= 0 && dist < 70) {
        // 举斧：锁定身前一片
        e.state = 1;
        e.timer = 0.55 / fast;
        e.tx = e.x + nx * 34;
        e.ty = e.y + ny * 34;
        e.sprite.setScale(1.06, 0.92);
        g.fx.disc(e.tx, e.ty, 46, 0xff5a4a, 0.25, e.timer);
        audio.sfx('bossCharge');
        return [0, 0];
      }
      if (e.timer2 <= 0 && dist > 90 && dist < 300) {
        e.state = 4;
        e.timer = 0.7 / fast;
        e.dashX = nx;
        e.dashY = ny;
        g.fx.line(e.x, e.y - 10, Math.atan2(ny, nx), 200, 0xff5a4a, e.timer, 14);
        audio.sfx('bossCharge');
        return [0, 0];
      }
      return [nx * sp * fast, ny * sp * fast];
    }
    if (e.state === 1) {
      if (e.timer <= 0) {
        // 劈下
        e.sprite.setScale(1);
        audio.sfx('explode', { rate: 0.6 });
        g.cameras.main.shake(200, 0.007);
        g.fx.crack(e.tx, e.ty, 0.6);
        g.fx.ring(e.tx, e.ty - 4, 46, 0xe0d8ff, 0.35);
        g.fx.burst(e.tx, e.ty - 4, 0x9aa4b8, 14);
        const p = g.player;
        if (Math.hypot(p.x - e.tx, p.y - e.ty) < 46 + PLAYER_RADIUS) g.hurtPlayer(e.dmg * 1.2, 'metal', this.hurtOf(e, true));
        e.state = 3;
        e.timer = 0.7 / fast;
      }
      return [0, 0];
    }
    if (e.state === 4) {
      if (e.timer <= 0) {
        e.state = 5;
        e.timer = 0.5;
      }
      return [0, 0];
    }
    if (e.state === 5) {
      if (e.timer <= 0) {
        e.state = 3;
        e.timer = 0.6 / fast;
        e.timer2 = rage ? 4.5 : 6;
      }
      return [e.dashX * 260, e.dashY * 260];
    }
    // 收招
    if (e.timer <= 0) {
      e.state = 0;
      e.timer = rage ? 1.2 : 1.8;
    }
    return [0, 0];
  }

  /** 舞干戚：一圈飞刃 */
  private bladeRing(e: Enemy, n: number, hurt: HurtOpts) {
    const g = this.g;
    audio.sfx('bossShot', { rate: 0.9 });
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      g.proj.enemyShot('ep_blade', e.x, e.y - 18, Math.cos(a) * 95, Math.sin(a) * 95, 10, 'metal', hurt);
    }
  }

  /** 刑天第一次被打倒：跪地无敌 2 秒，然后带一截生命复起 */
  private rise(e: Enemy) {
    const g = this.g;
    e.rose = true;
    e.hp = Math.round(e.maxHp * (e.def.rise ?? 0.3));
    e.state = 9;
    e.timer = 2;
    e.invulnUntil = e.contactAt = g.now + 2;
    e.kbx = e.kby = 0;
    e.lift = 0;
    e.sprite.setScale(1.1, 0.8);
    e.poisonUntil = e.burnUntil = e.slowUntil = 0;
    g.proj.clearEnemyShots();
    g.fx.burst(e.x, e.y - 16, 0xc8372d, 24);
    g.hud.toast(`${e.def.name}断首犹战！以火终结才不会复起`, '#ff6a5a');
    audio.sfx('boss');
  }

  /** 残兵倒地：留下尸骸，几秒后原地复活（不再掉经验） */
  private corpse(e: Enemy) {
    const g = this.g;
    const { x, y, def } = e;
    if (this.corpses >= 60) return;
    this.corpses++;
    // 尸骸用第 2 帧；皮肤只有移动帧时退回默认贴图（测试里的假场景没有 textures，也走默认）
    const skinned = e.tex !== def.tex && g.textures?.get(e.tex)?.has('2');
    const img = g.add.image(x, y, skinned ? e.tex : def.tex, 2).setOrigin(0.5, 0.9).setDepth(y - 1).setFlipX(e.sprite.flipX);
    const t = Math.max(1.5, def.revive! - e.reviveSub);
    // 复活前抖一下
    g.later(t - 0.8, () => {
      if (img.active) g.tweens.add({ targets: img, x: x + 1, duration: 60, yoyo: true, repeat: 5 });
    });
    const revive = () => {
      if (g.over) {
        this.corpses--;
        img.destroy();
        return;
      }
      // 同屏满了就再躺一会儿，不越过刷怪上限
      if (this.count >= g.spawnCap()) return g.later(1, revive);
      this.corpses--;
      img.destroy();
      this.spawn(def.id, x, y, { hpMult: g.hpScale(), noXp: true, noKill: true });
      g.fx.burst(x, y - 6, 0x9aa4b8, 8);
      if (!this.reviveHinted) {
        this.reviveHinted = true;
        g.hud.toast(`${def.name}又爬起来了！用火系击杀（灼烧也算）才不会复活`, '#ffa060');
      }
    };
    g.later(t, revive);
  }

  /**
   * 山魈王：追着走，定时蓄力跳到玩家脚下砸地（落地放一圈碎石），间隙朝玩家扔三块巨石；
   * 狂暴后跳得更勤，并且每 6 秒在玩家周围召一波落石。
   */
  private ape(e: Enemy, dt: number, nx: number, ny: number, sp: number): [number, number] {
    const g = this.g;
    const rage = e.raged;
    const R = 46;
    e.timer -= dt;
    if (rage) {
      e.timer3 -= dt;
      if (e.timer3 <= 0) {
        e.timer3 = 6;
        g.hazards?.rain(5);
      }
    }
    if (e.state === 0) {
      e.timer2 -= dt;
      if (e.timer2 <= 0) {
        e.timer2 = rage ? 4 : 5.5;
        audio.sfx('bossShot', { rate: 0.7 });
        const a = Math.atan2(ny, nx);
        for (const k of [-0.28, 0, 0.28]) g.proj.enemyShot('ep_boulder', e.x, e.y - 26, Math.cos(a + k) * 115, Math.sin(a + k) * 115, 12, 'earth', this.hurtOf(e));
      }
      if (e.timer <= 0) {
        // 蓄力：锁定玩家当前位置
        e.state = 1;
        e.timer = 0.75;
        e.sx = e.x;
        e.sy = e.y;
        e.tx = g.player.x;
        e.ty = g.player.y;
        e.sprite.setScale(1.08, 0.88);
        g.fx.disc(e.tx, e.ty, R, 0xff5a4a, 0.25, 1.35);
        audio.sfx('bossCharge');
      }
      return [nx * sp, ny * sp];
    }
    if (e.state === 1) {
      if (e.timer <= 0) {
        e.state = 2;
        e.timer = 0.6;
        e.sprite.setScale(1);
      }
      return [0, 0];
    }
    if (e.state === 2) {
      const k = Math.min(1, 1 - e.timer / 0.6);
      e.x = e.sx + (e.tx - e.sx) * k;
      e.y = e.sy + (e.ty - e.sy) * k;
      e.lift = Math.sin(k * Math.PI) * 60;
      if (e.timer <= 0) {
        e.lift = 0;
        e.state = 3;
        e.timer = 0.8;
        audio.sfx('explode', { rate: 0.6 });
        g.cameras.main.shake(220, 0.007);
        g.fx.ring(e.x, e.y - 4, R, 0xdaa53e, 0.4);
        g.fx.burst(e.x, e.y - 4, 0x8a6220, 18);
        const p = g.player;
        // 有前摇的重击必定暴击
        if (Math.hypot(p.x - e.x, p.y - e.y) < R + PLAYER_RADIUS) g.hurtPlayer(e.dmg, 'earth', this.hurtOf(e, true));
        const n = rage ? 14 : 10;
        const off = Math.random() * Math.PI;
        const hurt = this.hurtOf(e);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          g.proj.enemyShot('ep_rock', e.x, e.y - 6, Math.cos(a) * 90, Math.sin(a) * 90, 9, 'earth', hurt);
        }
      }
      return [0, 0];
    }
    if (e.timer <= 0) {
      e.state = 0;
      e.timer = rage ? 3 : 4.2;
    }
    return [0, 0];
  }

  /** 星图里挂在击杀上的效果：薪传、余烬、甘霖、灭焰 */
  private comboKill(e: Enemy) {
    const g = this.g;
    const m = g.build.mods;
    const x = e.x;
    const y = e.y;
    if (g.now < e.burnUntil) {
      if (m['hh.burnSpread']) {
        g.fx.ring(x, y - 6, 45, STATUS_INFO.burn.tint, 0.3);
        for (const o of this.inRadius(x, y, 45, [])) if (o !== e) g.burnEnemy(o, e.burnDps);
      }
      const ember = m['hh.ember'];
      if (ember && !e.boss) {
        const dmg = e.maxHp * ember * (e.elite ? 0.25 : 1);
        // 稍等一下再爆，连锁时一圈圈炸开
        g.later(0.08, () => {
          g.fx.ring(x, y - 6, 36, 0xe8a050, 0.35);
          for (const o of this.inRadius(x, y, 36, [])) g.hitEnemy(o, dmg, 'earth', { kb: 30, fromX: x, fromY: y, proc: 0.5, noCrit: true });
        });
      }
    }
    if (m['hh.poisonHeal'] && g.now < e.poisonUntil) g.regenPlayer(m['hh.poisonHeal']);
    if (m['kx.water'] && e.def.el === 'fire') g.regenPlayer(0.3);
  }

  kill(e: Enemy) {
    if (!e.alive) return;
    const g = this.g;
    const burnt = e.lastEl === 'fire';
    if (e.def.rise && !e.rose && !burnt && !g.over) return this.rise(e);
    e.alive = false;
    e.sprite.setVisible(false).setActive(false);
    e.sprite.anims.stop();
    if (e.glyph) {
      e.glyph.destroy();
      e.glyph = null;
    }
    if (!e.noKill) g.kills++;
    // 药师·传染：中毒的敌人死时把毒传给周围
    if (g.build.mods['qing.spread'] && g.now < e.poisonUntil) {
      g.fx.ring(e.x, e.y - 6, 50, STATUS_INFO.poison.tint, 0.3);
      for (const o of this.inRadius(e.x, e.y, 50, [])) if (o !== e) g.poisonEnemy(o, e.poisonDps, 3);
    }
    this.comboKill(e);
    g.fx.burst(e.x, e.y - 6, EL_INFO[e.def.el].color, e.boss ? 40 : e.elite ? 16 : 6);
    if (e.boss || e.elite) audio.sfx('killBig');
    else audio.sfx('kill');
    if (e.xp > 0) g.pickups.gem(e.x, e.y, e.xp);
    if (e.elite) g.pickups.chest(e.x, e.y, e.chest);
    else if (!e.boss && Math.random() < 0.012) g.pickups.pill(e.x + 6, e.y);
    else if (!e.boss && e.def.inflict?.kind === 'poison' && Math.random() < 0.015) g.pickups.antidote(e.x - 6, e.y);
    // 灭焰：火系敌人死后不再自爆
    if (e.def.behavior === 'explode' && !(g.build.mods['kx.water'] && e.def.el === 'fire')) {
      const x = e.x;
      const y = e.y;
      // 自爆必定灼烧
      const burn: Inflict | undefined = e.def.inflict && { ...e.def.inflict, chance: 1, dps: e.atkDps };
      const R = 18 * e.blastMul;
      g.fx.disc(x, y, R, 0xff5a3a, 0.28, 0.6);
      g.later(0.6, () => {
        g.fx.anim('fx_explosion', x, y, { scale: (0.8 * R) / 18 });
        audio.sfx('explode', { rate: 1.3, vol: 0.6 });
        const p = g.player;
        if (Math.hypot(p.x - x, p.y - y) < R + PLAYER_RADIUS) g.hurtPlayer(4 * g.dmgScale(), 'fire', { inflict: burn });
      });
    }
    // 残兵：不是被火系击杀就会复活；精英不复活
    if (e.def.revive && !e.elite && !g.over) {
      if (burnt) {
        g.fx.text(e.x, e.y - 18, '焚', '#ffa060', 0.6);
        g.fx.burst(e.x, e.y - 6, 0xff8a3a, 6);
      } else this.corpse(e);
    }
    if (e.boss && e.def.rise && burnt) g.fx.text(e.x, e.y - 40, '焚', '#ffa060', 1.2);
    if (e.boss) g.onBossKilled(e);
  }

  /** 敌人这次攻击附带的异常和暴击 */
  private hurtOf(e: Enemy, forceCrit = false): HurtOpts {
    const f = e.def.inflict;
    return { inflict: f && { ...f, chance: Math.min(1, f.chance + e.chanceAdd), dps: e.atkDps }, crit: e.def.crit, critDmg: e.def.critDmg, forceCrit };
  }

  /** 预警 0.7 秒后沿直线钻出毒刺，压到玩家就造成伤害 */
  private thornLine(x: number, y: number, a: number, hurt?: HurtOpts) {
    const g = this.g;
    const len = 260;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    g.fx.line(x, y - 4, a, len, 0x6fbf5a, 0.7, 10);
    g.later(0.7, () => {
      if (g.over) return;
      audio.sfx('spike');
      for (let d = 26; d <= len; d += 26) {
        const sx = x + cx * d;
        const sy = y + cy * d;
        g.fx.anim('fx_spike', sx, sy + 2, { originY: 0.92, depth: sy + 1, tint: 0x8fd06a });
      }
      // 玩家到线段的距离
      const p = g.player;
      const t = Math.max(0, Math.min(len, (p.x - x) * cx + (p.y - y) * cy));
      if (Math.hypot(p.x - (x + cx * t), p.y - (y + cy * t)) < 10 + PLAYER_RADIUS) g.hurtPlayer(16, 'wood', hurt);
    });
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

  /** ok：额外的筛选条件，只在距离更近时才调用 */
  nearest(x: number, y: number, maxR: number, exclude?: Set<number>, ok?: (e: Enemy) => boolean): Enemy | null {
    let best: Enemy | null = null;
    let bd = maxR * maxR;
    for (const e of this.list) {
      if (!e.alive || (exclude && exclude.has(e.id))) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd && (!ok || ok(e))) {
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
