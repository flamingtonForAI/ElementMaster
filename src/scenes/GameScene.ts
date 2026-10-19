import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../config/characters';
import { LEVELS, DIFF, enemyPool, type LevelDef } from '../config/levels';
import { ENEMIES } from '../config/enemies';
import { ENEMY_CRIT, ENEMY_CRIT_DMG, FROZEN, ON_ENEMY, STATUS_INFO, STATUS_OF, statusChance, statusPower, type Inflict, type StatusId } from '../config/status';
import { EL_INFO, GEN_ORDER, REL_MULT, relation, terrainMod, type El } from '../config/elements';
import { SKILLS } from '../config/skills';
import { Build, upgradeSum, type Option, type PlayerStats } from '../game/Build';
import { Player } from '../game/Player';
import { EnemyManager, type Enemy } from '../game/Enemies';
import { ProjectileManager } from '../game/Projectiles';
import { PickupManager } from '../game/Pickups';
import { Fx } from '../game/Fx';
import { SkillSystem } from '../game/Skills';
import { PuppetManager } from '../game/Puppets';
import { PlayerStatus } from '../game/Status';
import { World } from '../game/World';
import { Hazards } from '../game/Hazards';
import { HdLook, hdLookAvailable } from '../game/HdLook';
import { loadSave, writeSave } from '../game/save';
import { talentMods, daoPoints, legacyPoints } from '../game/talents';
import { HEHUA_PROC, HEHUA_VULN, hehuaPairs } from '../config/startree';
import { createDebug, debugEnabled } from '../game/debug';
import { CRATE_LOOT, ITEM_SPAWN, TALISMANS, itemSpot, pickWeighted, type TalismanId } from '../config/map';
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
  /** 傀儡打的，不吃傀儡师的本体术减伤 */
  puppet?: boolean;
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
  /** 这个角色首通拿到的道点、传承点，没有就为空 */
  growth: string;
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
  /** 关卡地形机制：落石、熔岩口、余火、剑阵提示 */
  hazards!: Hazards;
  hdLook: HdLook | null = null;

  /** 局内时钟（秒），暂停时不走 */
  now = 0;
  /** Boss 远吼已经叠了几层 */
  roarStacks = 0;
  elapsed = 0;
  kills = 0;
  boss: Enemy | null = null;
  private musicTmp: Enemy[] = [];
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
  /** 傀儡师的傀儡 */
  puppets!: PuppetManager;
  /** 药师·护心：溢出回复存成的护盾 */
  shield = 0;
  /** 散人·周天：当前轮到的元素和下次轮转的时间 */
  zhoutian: El | null = null;
  /** 点亮的合化要穴：相生的母、子，进局时算一次 */
  hehua: { a: El; b: El }[] = [];
  private zhoutianAt = 0;
  /** 遁符：无敌并加速到这个时刻 */
  dunUntil = 0;
  /** 下一只游荡精英的时间 */
  private nextEliteAt = 0;
  /** 待打开的铜匣（和升级一样排队弹三选一） */
  private pendingCopper = 0;
  /** 下一次刷木匣/符箓的时间 */
  private nextItemAt = 0;

  /** Boss 半血后已换成狂暴版 BGM */
  private rageMusic = false;
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
    this.roarStacks = 0;
    this.kills = 0;
    this.boss = null;
    this.over = false;
    this.rageMusic = false;
    this.pendingLevelUps = 0;
    this.pendingCopper = 0;
    this.dunUntil = 0;
    this.iframeUntil = 0;
    this.spawnAcc = 0;
    this.shield = 0;
    this.zhoutian = null;
    this.tasks = [];
    this.terrainMods = Object.fromEntries(GEN_ORDER.map((e) => [e, terrainMod(e, this.levelDef.terrain)])) as Record<El, number>;
  }

  create() {
    const L = this.levelDef;
    const save = loadSave();
    const meta = save.meta;
    this.build = new Build(this.char, L, meta, talentMods(save, this.char));
    this.hehua = hehuaPairs(this.build.mods);
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
    this.puppets = new PuppetManager(this);
    this.hazards = new Hazards(this);
    if (this.char.balanced) {
      this.zhoutian = GEN_ORDER[Math.floor(Math.random() * 5)];
      this.zhoutianAt = this.zhoutianPeriod();
    }

    this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
    // 镜头最多看到墙外一点
    const h = this.world.half + 56;
    this.cameras.main.setBounds(-h, -h, h * 2, h * 2);
    this.hdLook = hdLookAvailable(L.id) ? new HdLook(this) : null;

    const d = L.duration;
    this.nextEliteAt = L.elites.first;
    this.nextItemAt = ITEM_SPAWN.first;
    this.timeline = [
      { t: d * 0.35, done: false, fn: () => this.swarm() },
      {
        t: d * 0.5, done: false, fn: () => {
          this.eliteWave(3);
          if (L.bgmDanger) audio.music(L.bgmDanger, 2);
        },
      },
      { t: d * 0.7, done: false, fn: () => this.swarm() },
      { t: d - 90, done: false, fn: () => this.spawnElite('gold') },
      { t: d - 60, done: false, fn: () => this.spawnBoss() },
      ...L.enemies.filter((e) => e.from).map((e) => ({ t: e.from!, done: false, fn: () => this.introEnemy(e.id) })),
      ...(L.roar?.times ?? []).map((t) => ({ t, done: false, fn: () => this.roar() })),
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
    this.world.updateNav(this.player.x, this.player.y, dt);
    this.enemies.update(dt);
    if (this.player.alive) this.skills.update(dt);
    this.puppets.update(dt);
    if (this.zhoutian && !this.over && this.now >= this.zhoutianAt) this.rotateZhoutian();
    this.proj.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.world.update(dt);
    this.hazards.update();
    this.hdLook?.update(dt);
    this.runTasks();

    if (!this.over) audio.setIntensity(this.musicIntensity());


    if (!this.over && this.elapsed >= this.nextEliteAt && this.elapsed < this.levelDef.duration - 60) {
      const { every } = this.levelDef.elites;
      const k = Math.min(1, this.elapsed / this.levelDef.duration);
      this.nextEliteAt = this.elapsed + every[0] + (every[1] - every[0]) * k;
      this.spawnElite('copper');
    }

    if (!this.over && this.elapsed >= this.nextItemAt) {
      this.nextItemAt = this.elapsed + ITEM_SPAWN.every;
      this.spawnItem();
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
    } else if (this.pendingCopper > 0 && !this.over && this.player.alive) {
      this.pendingCopper--;
      this.scene.pause();
      audio.sfx('chest');
      this.hud.showLevelUp(this.build.options(3), false, '铜匣 · 选择一项');
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

  /**
   * BGM 局势强度 0~1：时间只占小头，主要看同屏数量和贴身的怪；Boss 战从 0.6 起按掉血往上抬
   */
  private musicIntensity() {
    const p = this.player;
    const progress = Math.min(1, this.elapsed / Math.max(60, this.levelDef.duration - 60));
    const crowd = Math.min(1, this.enemies.count / 120);
    const near = Math.min(1, this.enemies.inRadius(p.x, p.y, 120, this.musicTmp).length / 12);
    // 每吼一层，底子抬高一点
    const I = Math.min(1, 0.1 + 0.25 * progress + 0.3 * crowd + 0.35 * near + 0.05 * this.roarStacks);
    const b = this.boss;
    return b ? Math.max(I, 0.6 + 0.4 * (1 - b.hp / b.maxHp)) : I;
  }

  /** 当前同屏敌人上限 */
  spawnCap() {
    return this.spawnCurve()[1];
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
    const list = enemyPool(this.levelDef, this.elapsed);
    const total = list.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of list) if ((r -= e.w) <= 0) return e.id;
    return list[0].id;
  }

  /** 玩家周围 r 处的随机点；贴着地图边缘或落在岩壁上时换个方向，实在不行夹回地图内 */
  ringPos(r: number): [number, number] {
    let x = 0;
    let y = 0;
    let fallback: [number, number] | null = null;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      x = this.player.x + Math.cos(a) * r;
      y = this.player.y + Math.sin(a) * r;
      if (!this.world.inside(x, y, 20)) continue;
      if (!this.world.blocked(x, y)) return [x, y];
      fallback ??= [x, y];
    }
    return fallback ?? this.world.clampPt(x, y, 20);
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
      let [x, y] = this.world.clampPt(this.player.x + Math.cos(a) * 230, this.player.y + Math.sin(a) * 150, 20);
      if (this.world.blocked(x, y)) [x, y] = this.ringPos(230);
      this.enemies.spawn(id, x, y, { hpMult: this.hpScale() });
    }
    audio.sfx('warn');
    this.hud.toast(`${ENEMIES[id].name}成群来袭！`, EL_INFO[ENEMIES[id].el].css);
  }

  /** 新敌人进池时先来一小群，让玩家看清它长什么样、怎么动 */
  private introEnemy(id: string) {
    for (let i = 0; i < 3; i++) {
      const [x, y] = this.ringPos(300);
      this.enemies.spawn(id, x, y, { hpMult: this.hpScale() });
    }
    this.hud.toast(`${ENEMIES[id].name}出没`, EL_INFO[ENEMIES[id].el].css);
  }

  /**
   * Boss 在远处吼一声：全场叠一层加成，提示两行字、镜头轻震、怪一齐跳一下，
   * 再在玩家附近触发一次小范围地形事件。Boss 已经现身就不再吼
   */
  roar() {
    const r = this.levelDef.roar;
    if (!r || this.boss) return;
    const n = ++this.roarStacks;
    this.enemies.onRoar(n);
    const css = EL_INFO[ENEMIES[this.levelDef.boss].el].css;
    this.hud.toast(r.lines[Math.min(n, r.lines.length) - 1], css);
    this.hud.toast(r.detail, '#b8aec8');
    audio.sfx('boss', { rate: 0.7, vol: 0.55 });
    this.cameras.main.shake(350, 0.004);
    if (r.event?.kind === 'rockfall') this.hazards.rain(r.event.count);
    else if (r.event?.kind === 'lava') this.hazards.erupt(r.event.count);
  }

  /** Boss 狂暴（Enemies.enrage 调用）：最后一吼，全场小怪再叠一层，换狂暴 BGM */
  onBossRage(e: Enemy) {
    const r = this.levelDef.roar;
    this.hud.toast(`${e.def.name}狂暴了！`, EL_INFO[e.def.el].css);
    if (r) {
      const n = ++this.roarStacks;
      this.enemies.onRoar(n);
      this.hud.toast(`群妖应声而起：${r.detail}`, '#b8aec8');
    }
    if (!this.rageMusic) {
      this.rageMusic = true;
      audio.music('boss_rage', 1.5);
    }
  }

  /** 游荡精英掉铜匣，精英潮和 Boss 前的精英掉金宝箱 */
  spawnElite(chest: 'gold' | 'copper' = 'copper', id = this.pickEnemy()) {
    const [x, y] = this.ringPos(260);
    this.enemies.spawn(id, x, y, { hpMult: this.hpScale(), elite: true, chest });
    audio.sfx('warn');
    this.hud.toast(`精英 · ${ENEMIES[id].name} 出现，击败可得${chest === 'gold' ? '宝箱' : '铜匣'}`, chest === 'gold' ? '#ffd23f' : '#d89a5a');
  }

  /** 精英潮：同一种精英一次来 n 只 */
  private eliteWave(n: number) {
    const id = this.pickEnemy();
    for (let i = 0; i < n; i++) {
      const [x, y] = this.ringPos(240 + i * 20);
      this.enemies.spawn(id, x, y, { hpMult: this.hpScale(), elite: true, chest: 'gold' });
    }
    audio.sfx('warn');
    this.hud.toast(`精英潮 · ${n} 只${ENEMIES[id].name}来袭`, '#ffd23f');
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

  /** 玩家一方打这个敌人的伤害倍率：五行、地气、本命、星图、周天，以及护盾、蚀骨这类条件加成 */
  dmgMult(e: Enemy, el: El) {
    const ps = this.pstats;
    const m = this.build.mods;
    let k = REL_MULT[relation(el, e.def.el)] * this.terrainMods[el] * (this.build.benming === el ? 1.25 : 1) * ps.dmgMult * ps.elDmg[el] * ps.vsEl[e.def.el];
    if (el === this.zhoutian) k *= 1.25 + (m['xuan.bonus'] ?? 0);
    if (this.shield > 0 && m['qing.shieldDmg']) k *= 1 + m['qing.shieldDmg'];
    if (m['qing.vuln'] && this.now < e.poisonUntil) k *= 1 + m['qing.vuln'];
    if (m.vsSlow && this.now < e.slowUntil) k *= 1 + m.vsSlow;
    if (m.hpHighDmg && e.hp > e.maxHp * 0.7) k *= 1 + m.hpHighDmg;
    if (m['hh.stunBreak'] && this.now < e.stunUntil) k *= 1 + m['hh.stunBreak'];
    for (const h of this.hehua) if (this.hasStatus(e, STATUS_OF[h.a]) && this.hasStatus(e, STATUS_OF[h.b])) k *= 1 + HEHUA_VULN;
    return k;
  }

  hasStatus(e: Enemy, kind: StatusId) {
    const now = this.now;
    switch (kind) {
      case 'slow': return now < e.slowUntil;
      case 'poison': return now < e.poisonUntil;
      case 'burn': return now < e.burnUntil;
      case 'bleed': return now < e.bleedUntil;
      case 'stun': return now < e.stunUntil;
    }
  }

  /** 敌人对玩家一方的有效护甲：煞气剑阵，透甲、烧结、盘根、熔金 */
  private armorOf(e: Enemy) {
    const m = this.build.mods;
    const zone = this.world?.zoneArmor(e.x, e.y) ?? 0;
    const armor = e.armor + (zone && zone + (this.levelDef.roar?.zoneArmor ?? 0) * this.roarStacks);
    if (armor <= 0) return armor;
    if (m['hh.stunBreak'] && this.now < e.stunUntil) return 0;
    if (m['kx.fire'] && e.def.el === 'metal' && this.now < e.burnUntil) return 0;
    const a = m['kx.wood'] && e.def.el === 'earth' ? armor * 0.5 : armor;
    return Math.max(0, a - (m.armorPen ?? 0));
  }

  /** 星图的跨系效果：合化要穴让两系术互附对方的异常；相克奇穴对被克的那系敌人 */
  private comboHit(e: Enemy, el: El, dmg: number) {
    const m = this.build.mods;
    const foe = e.def.el;
    for (const h of this.hehua) {
      const other = el === h.a ? h.b : el === h.b ? h.a : null;
      if (other && Math.random() < HEHUA_PROC * statusChance(STATUS_OF[other], foe)) this.afflict(e, STATUS_OF[other], dmg);
    }
    if (m['kx.wood'] && foe === 'earth' && Math.random() < 0.2) this.slowEnemy(e, 2);
    if (m['kx.fire'] && foe === 'metal' && Math.random() < 0.25) this.afflict(e, 'burn', dmg);
    if (m['kx.earth'] && foe === 'water' && Math.random() < 0.2) this.stunEnemy(e, 0.6);
  }

  hitEnemy(e: Enemy, base: number, el: El, o: HitOpts = {}) {
    if (!e.alive || this.now < e.invulnUntil) return 0;
    const rel = relation(el, e.def.el);
    const ps = this.pstats;
    let m = this.dmgMult(e, el);
    if (this.char.ownDmg !== undefined && !o.puppet) m *= this.char.ownDmg;
    if (ps.meleeBonus > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy <= ps.meleeRange * ps.meleeRange) m *= 1 + ps.meleeBonus;
    }
    const md = this.build.mods;
    const stunned = this.now < e.stunUntil;
    const rate = this.pstats.crit + (this.player.moving ? 0 : md.stillCrit ?? 0) + (stunned ? md['hh.stunCrit'] ?? 0 : 0);
    const crit = !o.noCrit && !md.noCrit && Math.random() < rate;
    const critDmg = this.pstats.critDmg + (this.now < e.slowUntil ? md['hh.slowCritDmg'] ?? 0 : 0);
    const dmg = Math.max(1, Math.round(base * m * (crit ? critDmg : 1) - this.armorOf(e)));
    e.hp -= dmg;
    e.lastEl = el;
    // 伐木：残血的木系敌人直接斩杀
    if (md['kx.metal'] && e.def.el === 'wood' && !e.boss && e.hp > 0 && e.hp < e.maxHp * 0.15) {
      e.hp = 0;
      this.fx.text(e.x, e.y - 20, '伐', '#e0d8ff', 0.6);
    }
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
    if (o.slow) {
      this.slowEnemy(e, o.slow);
      // 水系命中带来的迟缓攒寒意（毒雾、藤缚这类别系的迟缓不算）
      if (el === 'water') this.chillEnemy(e);
    }
    if (o.proc && e.hp > 0 && Math.random() < o.proc * ps.procMult[el] * statusChance(STATUS_OF[el], e.def.el)) this.afflict(e, STATUS_OF[el], dmg);
    if (e.hp > 0) this.comboHit(e, el, dmg);

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

  /** 异常在这个敌人身上的强度：同系、被克的打折（见 statusPower） */
  private power(e: Enemy, kind: StatusId) {
    return statusPower(kind, e.def.el);
  }

  slowEnemy(e: Enemy, dur: number) {
    e.slowUntil = Math.max(e.slowUntil, this.now + dur * this.pstats.slowMult * this.power(e, 'slow'));
    e.slowF = e.boss ? ON_ENEMY.slow.bossF : ON_ENEMY.slow.f;
  }

  /** 寒意一层：攒满冰冻（机制同定身）；凝冰让流血中的敌人少攒一层；Boss 不冻，攒满改为迟缓 */
  private chillEnemy(e: Enemy) {
    if (!e.alive || this.now < e.chillImmuneUntil || this.now < e.stunUntil || Math.random() >= this.power(e, 'slow')) return;
    const C = ON_ENEMY.chill;
    const now = this.now;
    if (now - e.chillAt > C.window) e.chill = 0;
    e.chillAt = now;
    e.chill++;
    const need = this.pstats.chillNeed - (this.build.mods['hh.freeze'] && now < e.bleedUntil ? 1 : 0);
    if (e.chill < need) return;
    e.chill = 0;
    const d = C.dur * this.pstats.stunMult;
    e.chillImmuneUntil = now + d + C.immune;
    if (e.boss) {
      e.slowUntil = Math.max(e.slowUntil, now + d * 1.5);
      e.slowF = ON_ENEMY.slow.bossF;
      return;
    }
    e.stunUntil = Math.max(e.stunUntil, now + d);
    e.frozenUntil = e.stunUntil;
    this.fx.ring(e.x, e.y - 6, 14, FROZEN.tint, 0.25);
  }

  /** 几率触发的震慑一层：攒满打晕（走定身，吃定身免疫） */
  private dazeEnemy(e: Enemy) {
    if (!e.alive) return;
    const D = ON_ENEMY.daze;
    const now = this.now;
    if (now - e.dazeAt > D.window) e.daze = 0;
    e.dazeAt = now;
    if (++e.daze < D.need) return;
    e.daze = 0;
    this.stunEnemy(e, D.dur * this.pstats.dazeMult);
  }

  /** 流血叠一层：每层伤害取更强的，刷新时间；叠满撕裂，剩下的流血一次打完；金系、火系敌人身上流血打折 */
  bleedEnemy(e: Enemy, dps: number) {
    if (!e.alive) return;
    dps *= this.power(e, 'bleed');
    const now = this.now;
    if (now >= e.poisonUntil && now >= e.burnUntil && now >= e.bleedUntil) e.dotTick = 0.5;
    if (now >= e.bleedUntil) e.bleedStacks = e.bleedDps = 0;
    e.bleedStacks++;
    e.bleedDps = Math.max(e.bleedDps, dps);
    e.bleedUntil = now + ON_ENEMY.bleed.dur;
    if (e.bleedStacks < this.pstats.bleedMax) return;
    const rest = e.bleedStacks * e.bleedDps * ON_ENEMY.bleed.dur;
    e.bleedStacks = e.bleedDps = 0;
    e.bleedUntil = 0;
    this.fx.text(e.x, e.y - e.sprite.displayHeight - 4, '撕裂', STATUS_INFO.bleed.css, 0.6);
    this.bleedTick(e, rest, true);
  }

  /** 流血结算：不吃护甲、不暴击；撕裂总是跳数字 */
  bleedTick(e: Enemy, v: number, tear = false) {
    if (!e.alive || this.now < e.invulnUntil) return;
    const dmg = Math.max(1, Math.round(v));
    e.hp -= dmg;
    e.lastEl = 'metal';
    if (tear || e.boss || e.elite) this.fx.text(e.x + 8, e.y - e.sprite.displayHeight * 0.6, `${dmg}`, STATUS_INFO.bleed.css, 0.6);
    if (e.hp <= 0) this.enemies.kill(e);
  }

  /** Boss 不会被定身，改为迟缓；定身结束后短暂免疫 */
  stunEnemy(e: Enemy, dur: number) {
    const d = dur * this.pstats.stunMult * this.power(e, 'stun');
    if (e.boss) {
      e.slowUntil = Math.max(e.slowUntil, this.now + d);
      e.slowF = ON_ENEMY.slow.bossF;
      return;
    }
    if (this.now < e.stunUntil || this.now < e.stunImmuneUntil) return;
    e.stunUntil = this.now + d;
    e.stunImmuneUntil = e.stunUntil + ON_ENEMY.stun.immune;
  }

  /** 按几率触发的异常；中毒、灼烧、流血的伤害按本次命中伤害折算；迟缓攒寒意、震慑攒层数 */
  private afflict(e: Enemy, kind: StatusId, dmg: number) {
    switch (kind) {
      case 'slow':
        this.slowEnemy(e, ON_ENEMY.slow.dur);
        return this.chillEnemy(e);
      case 'stun':
        return this.dazeEnemy(e);
      case 'poison':
        return this.poisonEnemy(e, dmg * ON_ENEMY.poison.k, ON_ENEMY.poison.dur);
      case 'burn':
        return this.burnEnemy(e, dmg * ON_ENEMY.burn.k);
      case 'bleed':
        return this.bleedEnemy(e, dmg * ON_ENEMY.bleed.k);
    }
  }

  /** 灼烧叠一层：每层伤害取更强的，刷新时间；火系、水系敌人身上灼烧打折，烈焰提高层数上限 */
  burnEnemy(e: Enemy, dps: number) {
    if (!e.alive) return;
    dps *= this.power(e, 'burn');
    const now = this.now;
    if (now >= e.poisonUntil && now >= e.burnUntil && now >= e.bleedUntil) e.dotTick = 0.5;
    if (now >= e.burnUntil) e.burnStacks = e.burnDps = 0;
    e.burnStacks = Math.min(ON_ENEMY.burn.max + (this.build.mods.burnMax ?? 0) + this.pstats.burnMaxAdd, e.burnStacks + 1);
    e.burnDps = Math.max(e.burnDps, dps);
    e.burnUntil = now + ON_ENEMY.burn.dur;
  }

  /** 中毒单层：取更强的伤害，刷新时间（不缩短）；木系、金系敌人身上中毒打折，pierce（药师的毒雾）不打折 */
  poisonEnemy(e: Enemy, dps: number, dur: number, pierce = false) {
    if (!e.alive) return;
    if (!pierce) dps *= this.power(e, 'poison');
    const now = this.now;
    if (now >= e.poisonUntil && now >= e.burnUntil && now >= e.bleedUntil) e.dotTick = 0.5;
    if (now >= e.poisonUntil) e.poisonDps = 0;
    e.poisonDps = Math.max(e.poisonDps, dps);
    e.poisonUntil = Math.max(e.poisonUntil, now + dur * (1 + (this.build.mods.poisonDur ?? 0)));
  }

  /** 中毒、灼烧的结算（poison、burn 是这一跳各自的伤害）：不吃护甲、不暴击；只给精英和 Boss 跳数字，免得刷屏 */
  dotEnemy(e: Enemy, poison: number, burn: number) {
    if (!e.alive || this.now < e.invulnUntil) return;
    const dmg = Math.max(1, Math.round((poison * this.pstats.poisonMult + burn) * this.pstats.dotMult));
    e.hp -= dmg;
    // 灼烧烧死的算火系击杀（残兵不再复活）
    e.lastEl = burn > 0 ? 'fire' : 'wood';
    if (e.boss || e.elite) this.fx.text(e.x + 8, e.y - e.sprite.displayHeight * 0.6, `${dmg}`, burn > 0 ? '#ffa060' : '#8fe06a', 0.6);
    if (e.hp <= 0) this.enemies.kill(e);
  }

  /** 地形造成的伤害（落石、熔岩）：固定数值，不吃玩家加成和护甲 */
  envDamage(e: Enemy, v: number, el: El = 'earth') {
    if (!e.alive || this.now < e.invulnUntil) return;
    e.hp -= Math.max(1, Math.round(v));
    e.lastEl = el;
    e.flashUntil = this.now + 0.05;
    if (e.hp <= 0) this.enemies.kill(e);
  }

  /** 敌人的攻击：按元素判定暴击，先乘暴击再减护甲，命中后判定异常 */
  hurtPlayer(base: number, el: El, o: HurtOpts = {}) {
    const p = this.player;
    if (!p.alive || this.dbg.god || this.over || this.now < this.iframeUntil) return;
    this.iframeUntil = this.now + 0.35;
    const rel = relation(el, this.build.benming);
    const armor = this.pstats.armor + (p.moving ? 0 : this.pstats.stillArmor) + (p.hp < this.pstats.maxHp * 0.5 ? this.build.mods.lowArmor ?? 0 : 0);
    const crit = o.forceCrit || Math.random() < (o.crit ?? ENEMY_CRIT[el]);
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
    // 护盾先挡
    const block = Math.min(this.shield, dmg);
    this.shield -= block;
    dmg -= block;
    if (dmg <= 0) return;
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

  /** 持续回复；护心：生命满了以后溢出的部分存成护盾 */
  regenPlayer(v: number) {
    const p = this.player;
    const max = this.pstats.maxHp;
    const over = p.hp + v - max;
    p.hp = Math.min(max, p.hp + v);
    const cap = this.build.mods['qing.shield'] ?? 0;
    if (over > 0 && cap > 0) this.shield = Math.min(max * cap, this.shield + over);
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
      const prevMax = this.pstats.maxHp;
      this.pstats = this.build.stats();
      if (this.pstats.maxHp > prevMax) this.player.hp += this.pstats.maxHp - prevMax;
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

  /** 在玩家周围屏幕外不远处刷一个木匣或符箓；同类满了就不刷 */
  private spawnItem() {
    const items = this.pickups.items;
    const n = (k: 'crate' | 'talisman') => items.filter((i) => i.kind === k).length;
    const canT = n('talisman') < ITEM_SPAWN.max.talisman;
    const canC = n('crate') < ITEM_SPAWN.max.crate;
    if (!canT && !canC) return;
    const spot = itemSpot(this.player.x, this.player.y, this.world.half, (x, y) => this.world.blocked(x, y));
    if (!spot) return;
    const [x, y] = spot;
    if (canT && (!canC || Math.random() < ITEM_SPAWN.talismanChance)) {
      const talis = (Object.keys(TALISMANS) as TalismanId[]).map((id) => ({ id, w: TALISMANS[id].w }));
      this.pickups.talisman(x, y, pickWeighted(talis), ITEM_SPAWN.life);
    } else this.pickups.crate(x, y, ITEM_SPAWN.life);
  }

  /** 铜匣：排队弹一次三选一 */
  openCopper() {
    this.pendingCopper++;
  }

  /** 木匣：随机一项小奖励 */
  openCrate(x: number, y: number) {
    const loot = pickWeighted(CRATE_LOOT);
    audio.sfx('chest');
    if (loot === 'xp') {
      const total = 4 + this.build.level * 2;
      for (let i = 0; i < 5; i++) this.pickups.gem(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 16, Math.ceil(total / 5));
      this.hud.toast('木匣：一捧灵气', '#9fd8ff');
    } else if (loot === 'pill') {
      this.healPlayer(0.2);
      this.hud.toast('木匣：回气丹，回复 20% 生命', '#8fe08a');
    } else if (loot === 'lingshi') {
      const v = 5 * this.levelDef.id;
      this.cardLingshi += v;
      this.hud.toast(`木匣：灵石 +${v}（结算时发放）`, '#ffd23f');
    } else {
      this.pickups.magnetAll();
      this.hud.toast('木匣：聚灵石，吸取全部灵气', '#9fd8ff');
    }
  }

  /** 符箓：爆符清屏伤害，定身符定住屏内敌人，遁符无敌加速 */
  useTalisman(id: TalismanId) {
    const p = this.player;
    const col = TALISMANS[id].color;
    const onScreen = this.enemies.list.filter((e) => e.alive && Math.abs(e.x - p.x) < 340 && Math.abs(e.y - p.y) < 200);
    this.fx.ring(p.x, p.y - 8, 120, col, 0.6);
    if (id === 'bao') {
      this.cameras.main.flash(180, 255, 140, 90);
      this.cameras.main.shake(200, 0.006);
      const dmg = 40 + this.build.level * 6;
      for (const e of onScreen) this.hitEnemy(e, e.boss ? dmg * 0.25 : dmg, this.build.benming, { kb: 80, fromX: p.x, fromY: p.y, noCrit: true });
      audio.sfx('killBig');
    } else if (id === 'ding') {
      for (const e of onScreen) {
        if (e.boss) {
          e.slowUntil = Math.max(e.slowUntil, this.now + 3);
          e.slowF = ON_ENEMY.slow.bossF;
        } else e.stunUntil = Math.max(e.stunUntil, this.now + 3);
      }
      audio.sfx('benming');
    } else {
      this.dunUntil = this.now + 3;
      this.iframeUntil = Math.max(this.iframeUntil, this.dunUntil);
      audio.sfx('benming');
    }
  }

  // ---------- 散人·周天 ----------

  private zhoutianPeriod() {
    return Math.max(10, 30 + (this.build.mods['xuan.period'] ?? 0));
  }

  /** 按相生顺序轮到下一系；归元：轮转时以新的一系爆发 */
  private rotateZhoutian() {
    const el = GEN_ORDER[(GEN_ORDER.indexOf(this.zhoutian!) + 1) % 5];
    this.zhoutian = el;
    this.zhoutianAt = this.now + this.zhoutianPeriod();
    this.build.version++;
    const p = this.player;
    this.fx.ring(p.x, p.y - 8, 40, EL_INFO[el].color, 0.4);
    this.hud.toast(`周天轮转 · ${EL_INFO[el].name}系伤害提高`, hex(EL_INFO[el].color));
    if (this.build.mods['xuan.burst']) {
      const tmp: Enemy[] = [];
      for (const e of this.enemies.inRadius(p.x, p.y - 8, 56, tmp)) this.hitEnemy(e, (15 + this.build.level * 2) * this.pstats.burstMult, el, { kb: 60 });
    }
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
    const dao0 = daoPoints(save, this.char);
    const lg0 = legacyPoints(save, this.char);
    if (win) {
      const clears = save.clears[this.char.id] ??= [];
      if (!clears.includes(n)) clears.push(n);
    }
    const gain = [daoPoints(save, this.char) - dao0, legacyPoints(save, this.char) - lg0];
    const growth = gain[0] || gain[1] ? `${this.char.name}首通：${[gain[0] ? `道点 +${gain[0]}` : '', gain[1] ? `传承点 +${gain[1]}` : ''].filter(Boolean).join('　')}` : '';
    save.runs++;
    save.playTime += this.elapsed;
    save.lastChar = this.char.id;
    let unlockedNext = false;
    if (win && save.unlocked <= this.levelDef.id) {
      save.unlocked = this.levelDef.id + 1;
      unlockedNext = LEVELS.some((l) => l.id === save.unlocked && l.available);
    }
    writeSave(save);
    const result: RunResult = { win, time: this.elapsed, kills: this.kills, level: this.build.level, lingshi, lingshiLines, unlockedNext, growth };
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
