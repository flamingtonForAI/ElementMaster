import Phaser from 'phaser';
import { CHARACTERS, type CharacterDef } from '../config/characters';
import { LEVELS, type LevelDef } from '../config/levels';
import { ENEMIES } from '../config/enemies';
import { EL_INFO, GEN_ORDER, REL_MULT, relation, terrainMod, type El } from '../config/elements';
import { SKILLS } from '../config/skills';
import { Build, type Option, type PlayerStats } from '../game/Build';
import { Player } from '../game/Player';
import { EnemyManager, type Enemy } from '../game/Enemies';
import { ProjectileManager } from '../game/Projectiles';
import { PickupManager } from '../game/Pickups';
import { Fx } from '../game/Fx';
import { SkillSystem } from '../game/Skills';
import { World } from '../game/World';
import { loadSave, writeSave } from '../game/save';
import { createDebug, debugEnabled } from '../game/debug';
import { hex } from '../ui/text';
import type { HudScene } from './HudScene';

export interface HitOpts {
  kb?: number;
  fromX?: number;
  fromY?: number;
  stun?: number;
  slow?: number;
  noCrit?: boolean;
}

export interface RunResult {
  win: boolean;
  time: number;
  kills: number;
  level: number;
  lingshi: number;
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
    this.build = new Build(this.char, L);
    this.pstats = this.build.stats();
    this.world = new World(this, L);
    this.fx = new Fx(this);
    this.enemies = new EnemyManager(this);
    this.proj = new ProjectileManager(this);
    this.pickups = new PickupManager(this);
    this.skills = new SkillSystem(this);
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposeDebug?.();
      this.disposeDebug = null;
    });
  }

  get hud() {
    return this.scene.get('hud') as HudScene;
  }

  update(_t: number, deltaMs: number) {
    const dt = (Math.min(deltaMs, 50) / 1000) * this.dbg.timeScale;
    this.now += dt;
    if (!this.over) this.elapsed += dt;

    this.player.update(dt);
    if (!this.over) this.spawnUpdate(dt);
    this.enemies.update(dt);
    if (this.player.alive) this.skills.update(dt);
    this.proj.update(dt);
    this.pickups.update(dt);
    this.fx.update(dt);
    this.world.update(dt);
    this.runTasks();

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
    return this.levelDef.hpMult * (1 + (this.elapsed / 60) * 0.2);
  }

  /** 敌人伤害随时间上升 */
  dmgScale() {
    return 1 + (this.elapsed / 60) * 0.12;
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
    this.hud.toast(`${ENEMIES[id].name}成群来袭！`, EL_INFO[ENEMIES[id].el].css);
  }

  spawnElite() {
    const id = this.pickEnemy();
    const [x, y] = this.ringPos(260);
    this.enemies.spawn(id, x, y, { hpMult: this.hpScale(), elite: true });
    this.hud.toast(`精英 · ${ENEMIES[id].name} 出现，击败可得宝箱`, '#ffd23f');
  }

  spawnBoss() {
    if (this.boss) return;
    const [x, y] = this.ringPos(250);
    this.boss = this.enemies.spawn(this.levelDef.boss, x, y);
    this.hud.toast(`${this.levelDef.bossName} 现身！`, '#ff6a5a');
    this.cameras.main.shake(300, 0.006);
  }

  // ---------- 战斗 ----------

  hitEnemy(e: Enemy, base: number, el: El, o: HitOpts = {}) {
    if (!e.alive) return 0;
    const rel = relation(el, e.def.el);
    let m = REL_MULT[rel] * this.terrainMods[el] * (this.build.benming === el ? 1.25 : 1) * this.pstats.dmgMult;
    const c = this.char;
    if (c.meleeBonus > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy <= c.meleeRange * c.meleeRange) m *= 1 + c.meleeBonus;
    }
    const crit = !o.noCrit && Math.random() < this.pstats.crit;
    const dmg = Math.max(1, Math.round(base * m * (crit ? 2 : 1) - e.armor));
    e.hp -= dmg;
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
    if (o.stun) e.stunUntil = Math.max(e.stunUntil, this.now + o.stun * (e.boss ? 0.3 : 1));
    if (o.slow) {
      e.slowUntil = this.now + o.slow;
      e.slowF = e.boss ? 0.75 : 0.5;
    }

    let prefix = '';
    if (rel === 'counter' && !e.counterShown) {
      e.counterShown = true;
      prefix = '克';
    }
    this.fx.number(e.x, e.y - e.sprite.displayHeight * 0.75, dmg, rel, crit, prefix);
    if (e.hp <= 0) this.enemies.kill(e);
    return dmg;
  }

  explode(x: number, y: number, radius: number, dmg: number, el: El, kb: number) {
    this.fx.anim('fx_explosion', x, y - 4, { scale: radius / 22 });
    const tmp: Enemy[] = [];
    for (const e of this.enemies.inRadius(x, y, radius, tmp)) this.hitEnemy(e, dmg, el, { kb, fromX: x, fromY: y });
  }

  hurtPlayer(base: number, el: El) {
    const p = this.player;
    if (!p.alive || this.dbg.god || this.over || this.now < this.iframeUntil) return;
    this.iframeUntil = this.now + 0.35;
    const rel = relation(el, this.build.benming);
    const dmg = Math.max(1, Math.round(base * REL_MULT[rel] - this.pstats.armor));
    p.hp -= dmg;
    p.hurt();
    this.fx.number(p.x, p.y - 30, dmg, 'player', false);
    if (p.hp <= 0) {
      p.hp = 0;
      p.die();
      this.endRun(false);
    }
  }

  healPlayer(frac: number) {
    const p = this.player;
    const v = Math.round(this.pstats.maxHp * frac);
    p.hp = Math.min(this.pstats.maxHp, p.hp + v);
    this.fx.text(p.x, p.y - 30, `+${v}`, '#8fe08a', 0.8);
  }

  // ---------- 成长 ----------

  gainXp(v: number) {
    if (this.over) return;
    this.pendingLevelUps += this.build.addXp(v * this.pstats.xpMult);
  }

  private openLevelUp() {
    this.scene.pause();
    this.hud.showLevelUp(this.build.options(3));
  }

  /** HUD 选完后调用 */
  applyOption(o: Option) {
    if (o.kind === 'heal') {
      this.healPlayer(0.3);
      this.build.apply(o);
      return;
    }
    if (o.kind === 'lingshi') {
      this.build.apply(o);
      return;
    }
    const prevMax = this.pstats.maxHp;
    const changed = this.build.apply(o);
    this.pstats = this.build.stats();
    if (this.pstats.maxHp > prevMax) this.player.hp += this.pstats.maxHp - prevMax;
    if (changed) this.later(0.05, () => this.benmingBurst());
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
    this.fx.ring(this.player.x, this.player.y - 8, 60, 0xffd23f, 0.5);
    if (changed) this.later(0.05, () => this.benmingBurst());
  }

  /** 本命变化：以新元素在身边爆发一次 */
  private benmingBurst() {
    const el = this.build.benming;
    const p = this.player;
    this.fx.ring(p.x, p.y - 8, 60, EL_INFO[el].color, 0.45);
    const tmp: Enemy[] = [];
    for (const e of this.enemies.inRadius(p.x, p.y - 8, 56, tmp)) this.hitEnemy(e, 15 + this.build.level * 2, el, { kb: 60 });
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
    const save = loadSave();
    const lingshi = Math.floor(this.kills / 10) + (win ? 50 : 0);
    save.lingshi += lingshi;
    let unlockedNext = false;
    if (win && save.unlocked <= this.levelDef.id) {
      save.unlocked = this.levelDef.id + 1;
      unlockedNext = LEVELS.some((l) => l.id === save.unlocked && l.available);
    }
    writeSave(save);
    const result: RunResult = { win, time: this.elapsed, kills: this.kills, level: this.build.level, lingshi, unlockedNext };
    this.later(win ? 1.5 : 1.2, () => {
      this.scene.pause();
      this.hud.showResult(result);
    });
  }

  private pauseGame() {
    if (this.over || !this.scene.isActive()) return;
    this.scene.pause();
    this.hud.showPause();
  }
}
