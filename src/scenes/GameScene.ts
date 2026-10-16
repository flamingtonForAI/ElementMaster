import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../config/characters';
import { LEVELS, DIFF, type LevelDef } from '../config/levels';
import { ENEMIES } from '../config/enemies';
import { ENEMY_CRIT, ENEMY_CRIT_DMG, ON_ENEMY, STATUS_OF, statusChance, type Inflict, type StatusId } from '../config/status';
import { EL_INFO, GEN_ORDER, REL_MULT, relation, terrainMod, type El } from '../config/elements';
import { SKILLS } from '../config/skills';
import { Build, upgradeSum, type Option, type PlayerStats } from '../game/Build';
import { Player } from '../game/Player';
import { EnemyManager, type Enemy } from '../game/Enemies';
import { ProjectileManager } from '../game/Projectiles';
import { PickupManager } from '../game/Pickups';
import { Fx } from '../game/Fx';
import { SkillSystem } from '../game/Skills';
import { PlayerStatus } from '../game/Status';
import { World } from '../game/World';
import { loadSave, writeSave } from '../game/save';
import { talentMods } from '../game/talents';
import { createDebug, debugEnabled } from '../game/debug';
import { hex } from '../ui/text';
import { audio } from '../audio/Audio';
import type { HudScene } from './HudScene';

export interface HitOpts {
  kb?: number;
  fromX?: number;
  fromY?: number;
  stun?: number;
  slow?: number;
  noCrit?: boolean;
  /** 浪花溅射的层数，0 或不填是原始命中 */
  splash?: number;
  /** 触发本元素异常的几率（再乘五行关系） */
  proc?: number;
}

/** 敌人打玩家：附带的异常、暴击率（不填按元素）、暴击倍率、必定暴击（有前摇的重击） */
export interface HurtOpts {
  inflict?: Inflict;
  crit?: number;
  critDmg?: number;
  forceCrit?: boolean;
}

export interface RunResult {
  win: boolean;
  time: number;
  kills: number;
  level: number;
  lingshi: number;
  /** 灵石明细，结算页逐行显示 */
  lingshiLines: string[];
  unlockedNext: boolean;
}

export class GameScene extends Phaser.Scene {
  levelDef!: LevelDef;
  char!: CharacterDef;
  build!: Build;
  pstats!: PlayerStats;
  player!: Player;
  enemies!: EnemyManager;
  proj!: ProjectileManager;
  pickups!: PickupManager;
  fx!: Fx;
  skills!: SkillSystem;
  world!: World;

  /** 局内时钟（秒），暂停时不走 */
  now = 0;
  elapsed = 0;
  kills = 0;
  boss: Enemy | null = null;
  over = false;
  terrainMods!: Record<El, number>;
  dbg = { god: false, timeScale: 1, spawnMult: 1 };
  /** 本局剩余的续命、换签、斩缘次数（洞府修炼） */
  revives = 0;
  rerolls = 0;
  banishes = 0;
  /** 升级卡拿到的灵石，结算时发放 */
  cardLingshi = 0;
  /** 玩家身上的异常 */
  status!: PlayerStatus;

  private pendingLevelUps = 0;
  private iframeUntil = 0;
  private spawnAcc = 0;
  private timeline: { t: number; done: boolean; fn: () => void }[] = [];
  private tasks: { t: number; fn: () => void }[] = [];
  private disposeDebug: (() => void) | null = null;

  constructor() {
    super('game');
  }

  init(data: { level?: number; char?: string }) {
    this.levelDef = LEVELS.find((l) => l.id === (data.level ?? 1) && l.available) ?? LEVELS[0];
    this.char = CHARACTERS.find((c) => c.id === (data.char ?? 'xiao')) ?? CHARACTERS[0];
    this.now = 0;
    this.elapsed = 0;
    this.kills = 0;
    this.boss = null;
    this.over = false;
    this.pendingLevelUps = 0;
    this.iframeUntil = 0;
    this.spawnAcc = 0;
    this.tasks = [];
    this.terrainMods = Object.fromEntries(GEN_ORDER.map((e) => [e, terrainMod(e, this.levelDef.terrain)])) as Record<El, number>;
  }

  create() {
    const L = this.levelDef;
    const save = loadSave();
    const meta = save.meta;
    this.build = new Build(this.char, L, meta, talentMods(save, this.char));
    this.pstats = this.build.stats();
    this.revives = upgradeSum(meta, 'revive');
    this.rerolls = upgradeSum(meta, 'reroll');
    this.banishes = upgradeSum(meta, 'banish');
    this.cardLingshi = 0;
    this.world = new World(this, L);
    this.fx = new Fx(this);
    this.enemies = new EnemyManager(this);
    this.proj = new ProjectileManager(this);
    this.pickups = new PickupManager(this);
    this.skills = new SkillSystem(this);
    this.status = new PlayerStatus(this);
    this.player = new Player(this);

    this.cameras.main.startFollow(this.player.sprite, true, 1, 1);

    const d = L.duration;
    this.timeline = [
      { t: d * 0.35, done: false, fn: () => this.swarm() },
      { t: d * 0.5, done: false, fn: () => this.spawnElite() },
      { t: d * 0.7, done: false, fn: () => this.swarm() },
      { t: d - 90, done: false, fn: () => this.spawnElite() },
      { t: d - 60, done: false, fn: () => this.spawnBoss() },
    ];

    if (this.scene.isActive('hud')) this.scene.stop('hud');
    this.scene.launch('hud');

    this.input.keyboard!.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard!.on('keydown-P', () => this.pauseGame());

    if (debugEnabled()) this.disposeDebug = createDebug(this);
    // 升级、暂停、结算时场景暂停，BGM 跟着压低
    const duck = () => audio.duck(true);
    const unduck = () => audio.duck(false);
    this.events.on(Phaser.Scenes.Events.PAUSE, duck);
    this.events.on(Phaser.Scenes.Events.RESUME, unduck);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposeDebug?.();
      this.disposeDebug = null;
      this.events.off(Phaser.Scenes.Events.PAUSE, duck);
      this.events.off(Phaser.Scenes.Events.RESUME, unduck);
      audio.duck(false);
    });
    audio.music(L.bgm);
  }

  get hud() {
    return this.scene.get('hud') as HudScene;
  }

  update(_t: number, deltaMs: number) {
    const dt = (Math.min(deltaMs, 50) / 1000) * this.dbg.timeScale;
    this.now += dt;
    if (!this.over) this.elapsed += dt;

    this.player.update(dt);
    this.status.update(dt);
    if (!this.over) this.spawnUpdate(dt);
    this.enemies.update(dt);
    if (this.player.alive) this.skills.update(dt);
    this.proj.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.world.update(dt);
    this.runTasks();

    if (!this.over && !this.boss) {
      const L = this.levelDef;
      audio.setIntensity(0.1 + (0.6 * this.elapsed) / Math.max(60, L.duration - 60) + (0.4 * this.enemies.count) / 200);
    }

    if (!this.over) {
      for (const ev of this.timeline) {
        if (!ev.done && this.elapsed >= ev.t) {
          ev.done = true;
          ev.fn();
        }
      }
    }

    if (this.pendingLevelUps > 0 && !this.over && this.player.alive) {
      this.pendingLevelUps--;
      this.openLevelUp();
    }
  }

  // ---------- 调度 ----------

  later(sec: number, fn: () => void) {
    this.tasks.push({ t: this.now + sec, fn });
  }

  private runTasks() {
    if (!this.tasks.length) return;
    const due = this.tasks.filter((t) => t.t <= this.now);
    if (!due.length) return;
    this.tasks = this.tasks.filter((t) => t.t > this.now);
    for (const t of due) t.fn();
  }

  // ---------- 刷怪 ----------

  hpScale() {
    const t = this.elapsed / 60;
    return this.levelDef.hpMult * (1 + DIFF.hpLin * t + DIFF.hpQuad * t * t);
  }

  /** 敌人伤害随时间上升 */
  dmgScale() {
    return 1 + (this.elapsed / 60) * DIFF.dmgLin;
  }

  private spawnCurve(): [number, number] {
    const s = this.levelDef.spawn;
    const t = this.elapsed;
    if (t <= s[0][0]) return [s[0][1], s[0][2]];
    for (let i = 0; i < s.length - 1; i++) {
      const [t0, r0, c0] = s[i];
      const [t1, r1, c1] = s[i + 1];
      if (t <= t1) {
        const k = (t - t0) / (t1 - t0);
        return [r0 + (r1 - r0) * k, c0 + (c1 - c0) * k];
      }
    }
    const last = s[s.length - 1];
    return [last[1], last[2]];
  }

  private pickEnemy(): string {
    const list = this.levelDef.enemies;
    const total = list.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of list) if ((r -= e.w) <= 0) return e.id;
    return list[0].id;
  }

  private ringPos(r: number): [number, number] {
    const a = Math.random() * Math.PI * 2;
    return [this.player.x + Math.cos(a) * r, this.player.y + Math.sin(a) * r];
  }

  private spawnUpdate(dt: number) {
    const [rate, cap] = this.spawnCurve();
    this.spawnAcc += rate * dt * this.dbg.spawnMult;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.count >= cap) continue;
      const [x, y] = this.ringPos(390);
      this.enemies.spawn(this.pickEnemy(), x, y, { hpMult: this.hpScale() });
    }
  }

  private swarm() {
    const id = this.pickEnemy();
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.enemies.spawn(id, this.player.x + Math.cos(a) * 230, this.player.y + Math.sin(a) * 150, { hpMult: this.hpScale() });
    }
    audio.sfx('warn');
    this.hud.toast(`${ENEMIES[id].name}成群来袭！`, EL_INFO[ENEMIES[id].el].css);
  }

  spawnElite() {
    const id = this.pickEnemy();
    const [x, y] = this.ringPos(260);
    this.enemies.spawn(id, x, y, { hpMult: this.hpScale(), elite: true });
    audio.sfx('warn');
    this.hud.toast(`精英 · ${ENEMIES[id].name} 出现，击败可得宝箱`, '#ffd23f');
  }

  spawnBoss() {
    if (this.boss) return;
    const [x, y] = this.ringPos(250);
    this.boss = this.enemies.spawn(this.levelDef.boss, x, y, { hpMult: this.levelDef.hpMult });
    this.hud.toast(`${this.levelDef.bossName} 现身！`, '#ff6a5a');
    audio.sfx('boss');
    audio.music('boss', 0.6);
    this.cameras.main.shake(300, 0.006);
  }

  // ---------- 战斗 ----------

  hitEnemy(e: Enemy, base: number, el: El, o: HitOpts = {}) {
    if (!e.alive) return 0;
    const rel = relation(el, e.def.el);
    const ps = this.pstats;
    let m = REL_MULT[rel] * this.terrainMods[el] * (this.build.benming === el ? 1.25 : 1) * ps.dmgMult * ps.elDmg[el] * ps.vsEl[e.def.el];
    if (ps.meleeBonus > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy <= ps.meleeRange * ps.meleeRange) m *= 1 + ps.meleeBonus;
    }
    const flaw = this.now < e.flawUntil ? (e.boss ? ON_ENEMY.flaw.bossCrit : ON_ENEMY.flaw.crit) : 0;
    const crit = !o.noCrit && Math.random() < this.pstats.crit + flaw;
    const dmg = Math.max(1, Math.round(base * m * (crit ? this.pstats.critDmg : 1) - e.armor));
    e.hp -= dmg;
    // 带毒的 Boss 每掉 20% 血掉一瓶解毒药，落在 Boss 和玩家之间
    if (e.boss && e.def.inflict?.kind === 'poison' && e.hp > 0) {
      const stage = Math.min(4, Math.floor((1 - e.hp / e.maxHp) / 0.2));
      while (e.dropStage < stage) {
        e.dropStage++;
        const a = Math.atan2(this.player.y - e.y, this.player.x - e.x) + (Math.random() - 0.5) * 0.8;
        this.pickups.antidote(e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 50);
      }
    }
    if (this.now - e.flashUntil > 0.12) e.flashUntil = this.now + 0.05;

    if (o.kb && !e.boss) {
      const fx = o.fromX ?? this.player.x;
      const fy = o.fromY ?? this.player.y;
      const dx = e.x - fx;
      const dy = e.y - fy;
      const d = Math.hypot(dx, dy) || 1;
      const k = o.kb * (e.elite ? 0.4 : 1) * 3;
      e.kbx += (dx / d) * k;
      e.kby += (dy / d) * k;
    }
    if (o.stun) this.stunEnemy(e, o.stun);
    if (o.slow) this.slowEnemy(e, o.slow);
    if (o.proc && e.hp > 0 && Math.random() < o.proc * statusChance(STATUS_OF[el], e.def.el, false)) this.afflict(e, STATUS_OF[el], dmg);

    let prefix = '';
    if (rel === 'counter' && !e.counterShown) {
      e.counterShown = true;
      prefix = '克';
    }
    this.fx.number(e.x, e.y - e.sprite.displayHeight * 0.75, dmg, rel, crit, prefix);
    audio.hit(rel, crit);
    if (e.hp <= 0) this.enemies.kill(e);
    // 浪花：暴击时向周围溅射；回澜让溅射也能暴击并再溅一层
    const depth = o.splash ?? 0;
    const chain = this.build.mods['ruan.chain'] ?? 0;
    if (crit && this.char.critSplash && depth <= chain) this.waveSplash(e, base, depth + 1, chain >= depth + 1);
    return dmg;
  }

  private waveSplash(src: Enemy, base: number, depth: number, canCrit: boolean) {
    const mods = this.build.mods;
    const r = 26 * this.pstats.area * (1 + (mods['ruan.splashArea'] ?? 0));
    const k = (this.char.critSplash ?? 0) + (mods['ruan.splash'] ?? 0);
    this.fx.ring(src.x, src.y - 6, r, 0x8fc0ff, 0.3);
    for (let i = 0; i < 4; i++) this.fx.droplet(src.x + (Math.random() - 0.5) * r, src.y - 6 + (Math.random() - 0.5) * r * 0.6);
    const near = this.enemies.inRadius(src.x, src.y, r, []).filter((e) => e !== src);
    for (const e of near) this.hitEnemy(e, base * k, 'water', { kb: 20, fromX: src.x, fromY: src.y, splash: depth, noCrit: !canCrit });
  }

  explode(x: number, y: number, radius: number, dmg: number, el: El, kb: number, tint?: number, proc = 0) {
    audio.sfx('explode');
    this.fx.anim('fx_explosion', x, y - 4, { scale: radius / 22, tint });
    const tmp: Enemy[] = [];
    for (const e of this.enemies.inRadius(x, y, radius, tmp)) this.hitEnemy(e, dmg, el, { kb, fromX: x, fromY: y, proc });
  }

  // ---------- 敌人身上的异常 ----------

  /** 同元素的敌人免疫该异常 */
  private immune(e: Enemy, kind: StatusId) {
    return statusChance(kind, e.def.el, false) === 0;
  }

  slowEnemy(e: Enemy, dur: number) {
    if (this.immune(e, 'slow')) return;
    e.slowUntil = Math.max(e.slowUntil, this.now + dur * this.pstats.slowMult);
    e.slowF = e.boss ? ON_ENEMY.slow.bossF : ON_ENEMY.slow.f;
  }

  /** Boss 不会被定身，改为迟缓；定身结束后短暂免疫 */
  stunEnemy(e: Enemy, dur: number) {
    if (this.immune(e, 'stun')) return;
    const d = dur * this.pstats.stunMult;
    if (e.boss) {
      e.slowUntil = Math.max(e.slowUntil, this.now + d);
      e.slowF = ON_ENEMY.slow.bossF;
      return;
    }
    if (this.now < e.stunUntil || this.now < e.stunImmuneUntil) return;
    e.stunUntil = this.now + d;
    e.stunImmuneUntil = e.stunUntil + ON_ENEMY.stun.immune;
  }

  /** 按几率触发的异常；中毒、灼烧的伤害按本次命中伤害折算 */
  private afflict(e: Enemy, kind: StatusId, dmg: number) {
    const now = this.now;
    switch (kind) {
      case 'slow':
        return this.slowEnemy(e, ON_ENEMY.slow.dur);
      case 'stun':
        return this.stunEnemy(e, ON_ENEMY.stun.dur);
      case 'poison':
        if (now >= e.poisonUntil && now >= e.burnUntil) e.dotTick = 0.5;
        if (now >= e.poisonUntil) e.poisonDps = 0;
        e.poisonDps = Math.max(e.poisonDps, dmg * ON_ENEMY.poison.k);
        e.poisonUntil = now + ON_ENEMY.poison.dur;
        return;
      case 'burn':
        if (now >= e.poisonUntil && now >= e.burnUntil) e.dotTick = 0.5;
        if (now >= e.burnUntil) e.burnStacks = e.burnDps = 0;
        e.burnStacks = Math.min(ON_ENEMY.burn.max, e.burnStacks + 1);
        e.burnDps = Math.max(e.burnDps, dmg * ON_ENEMY.burn.k);
        e.burnUntil = now + ON_ENEMY.burn.dur;
        return;
      case 'flaw':
        e.flawUntil = now + ON_ENEMY.flaw.dur;
        return;
    }
  }

  /** 中毒、灼烧的结算：不吃护甲、不暴击；只给精英和 Boss 跳数字，免得刷屏 */
  dotEnemy(e: Enemy, v: number, kind: StatusId) {
    if (!e.alive) return;
    const dmg = Math.max(1, Math.round(v));
    e.hp -= dmg;
    if (e.boss || e.elite) this.fx.text(e.x + 8, e.y - e.sprite.displayHeight * 0.6, `${dmg}`, kind === 'burn' ? '#ffa060' : '#8fe06a', 0.6);
    if (e.hp <= 0) this.enemies.kill(e);
  }

  /** 敌人的攻击：按元素判定暴击（破绽时更高），先乘暴击再减护甲，命中后判定异常 */
  hurtPlayer(base: number, el: El, o: HurtOpts = {}) {
    const p = this.player;
    if (!p.alive || this.dbg.god || this.over || this.now < this.iframeUntil) return;
    this.iframeUntil = this.now + 0.35;
    const rel = relation(el, this.build.benming);
    const armor = this.pstats.armor + (p.moving ? 0 : this.pstats.stillArmor);
    const crit = o.forceCrit || Math.random() < (o.crit ?? ENEMY_CRIT[el]) + this.status.critTaken;
    const critDmg = crit ? (o.critDmg ?? ENEMY_CRIT_DMG) : 1;
    const dmg = Math.max(1, Math.round(base * critDmg * REL_MULT[rel] * this.pstats.resist[el] - armor));
    p.hurt();
    audio.sfx('hurt', crit ? { rate: 0.75 } : undefined);
    if (crit) this.cameras.main.shake(90, 0.004);
    this.fx.number(p.x, p.y - 30, dmg, 'player', crit);
    if (o.inflict) this.status.inflict(o.inflict);
    this.loseHp(dmg);
  }

  /** 解毒药：清毒并免疫一段时间 */
  curePoison() {
    const p = this.player;
    this.status.cure(6);
    this.fx.text(p.x, p.y - 30, '解毒', '#8fe06a', 0.8);
    this.fx.ring(p.x, p.y - 8, 40, 0x8fe06a, 0.4);
    audio.sfx('pill');
  }

  loseHp(dmg: number) {
    const p = this.player;
    p.hp -= dmg;
    if (p.hp <= 0) {
      if (this.revives > 0) return this.revive();
      p.hp = 0;
      p.die();
      this.endRun(false);
    }
  }

  /** 续命：半血复活，震开周围敌人 */
  private revive() {
    const p = this.player;
    this.revives--;
    p.hp = Math.round(this.pstats.maxHp * 0.5);
    this.iframeUntil = this.now + 2;
    this.status.clear();
    this.proj.clearEnemyShots();
    this.fx.ring(p.x, p.y - 8, 90, 0xffd23f, 0.6);
    const tmp: Enemy[] = [];
    for (const e of this.enemies.inRadius(p.x, p.y - 8, 90, tmp)) this.hitEnemy(e, 20 + this.build.level * 3, this.build.benming, { kb: 120, noCrit: true });
    audio.sfx('benming');
    this.cameras.main.shake(250, 0.006);
    this.hud.toast(`续命！剩余 ${this.revives} 次`, '#ffd23f');
  }

  healPlayer(frac: number) {
    const p = this.player;
    const v = Math.round(this.pstats.maxHp * frac);
    p.hp = Math.min(this.pstats.maxHp, p.hp + v);
    this.fx.text(p.x, p.y - 30, `+${v}`, '#8fe08a', 0.8);
    audio.sfx('pill');
  }

  // ---------- 成长 ----------

  gainXp(v: number) {
    if (this.over) return;
    this.pendingLevelUps += this.build.addXp(v * this.pstats.xpMult);
  }

  private openLevelUp() {
    this.scene.pause();
    audio.sfx('levelup');
    this.hud.showLevelUp(this.build.options(3));
  }

  /** HUD 选完后调用 */
  applyOption(o: Option) {
    const prevMax = this.pstats.maxHp;
    if (o.kind === 'heal') this.healPlayer(0.3);
    if (o.kind === 'lingshi') {
      this.cardLingshi += this.lingshiCard();
      this.hud.toast(`灵石 +${this.lingshiCard()}（结算时发放）`, '#ffd23f');
    }
    const changed = this.build.apply(o);
    // 每次升级都重算：角色成长跟等级走
    this.pstats = this.build.stats();
    if (this.pstats.maxHp > prevMax) this.player.hp += this.pstats.maxHp - prevMax;
    if (changed) this.later(0.05, () => this.benmingBurst());
  }

  /** 升级卡「灵石」的数额 */
  lingshiCard() {
    return 10 * this.levelDef.id;
  }

  openChest() {
    const r = this.build.chestUpgrade();
    let changed = false;
    if (r) {
      changed = this.build.recompute();
      this.hud.toast(`宝箱：${SKILLS[r.id].name} 升到 Lv${r.lv}`, '#ffd23f');
    } else {
      this.player.hp = this.pstats.maxHp;
      this.hud.toast('宝箱：生命回满', '#ffd23f');
    }
    this.pickups.magnetAll();
    audio.sfx('chest');
    this.fx.ring(this.player.x, this.player.y - 8, 60, 0xffd23f, 0.5);
    if (changed) this.later(0.05, () => this.benmingBurst());
  }

  /** 本命变化：以新元素在身边爆发一次 */
  private benmingBurst() {
    const el = this.build.benming;
    const p = this.player;
    this.fx.ring(p.x, p.y - 8, 60, EL_INFO[el].color, 0.45);
    audio.sfx('benming');
    const tmp: Enemy[] = [];
    for (const e of this.enemies.inRadius(p.x, p.y - 8, 56, tmp)) this.hitEnemy(e, (15 + this.build.level * 2) * this.pstats.burstMult, el, { kb: 60 });
    this.hud.toast(`本命转为「${EL_INFO[el].name}」`, hex(EL_INFO[el].color));
  }

  // ---------- 结束 ----------

  onBossKilled(e: Enemy) {
    if (e !== this.boss) return;
    this.boss = null;
    this.proj.clearEnemyShots();
    this.cameras.main.shake(400, 0.008);
    this.endRun(true);
  }

  private endRun(win: boolean) {
    if (this.over) return;
    this.over = true;
    audio.stopMusic(win ? 1.5 : 0.6);
    audio.sfx(win ? 'win' : 'lose');
    const save = loadSave();
    const n = this.levelDef.id;
    const parts: [string, number][] = [[`击杀 ×${1 + 0.25 * (n - 1)}`, Math.floor((this.kills / 10) * (1 + 0.25 * (n - 1)))]];
    if (this.cardLingshi) parts.push(['升级卡', this.cardLingshi]);
    if (win) parts.push(['通关', 30 + 20 * n]);
    if (win && save.unlocked <= n) parts.push(['首次通关', 100 * n]);
    const raw = parts.reduce((s, [, v]) => s + v, 0);
    const greed = upgradeSum(save.meta, 'lingshi');
    const lingshi = Math.round(raw * (1 + greed));
    const lingshiLines = parts.map(([k, v]) => `${k} ${v}`);
    if (greed) lingshiLines.push(`财运 +${Math.round(greed * 100)}%`);
    save.lingshi += lingshi;
    if (win) save.clears[this.char.id] = Math.max(save.clears[this.char.id] ?? 0, n);
    let unlockedNext = false;
    if (win && save.unlocked <= this.levelDef.id) {
      save.unlocked = this.levelDef.id + 1;
      unlockedNext = LEVELS.some((l) => l.id === save.unlocked && l.available);
    }
    writeSave(save);
    const result: RunResult = { win, time: this.elapsed, kills: this.kills, level: this.build.level, lingshi, lingshiLines, unlockedNext };
    this.later(win ? 1.5 : 1.2, () => {
      this.scene.pause();
      this.hud.showResult(result);
    });
  }

  pauseGame() {
    if (this.over || !this.scene.isActive()) return;
    this.scene.pause();
    this.hud.showPause();
  }
}
