import Phaser from 'phaser';
import { dirFromVector, type HeroDir } from '../art/heroXiao';
import type { GameScene } from '../scenes/GameScene';
import { STATUS_INFO, type StatusId } from '../config/status';
import { stick } from '../ui/touch';

export const PLAYER_RADIUS = 7;
const PIP_ORDER: StatusId[] = ['stun', 'burn', 'poison', 'slow', 'flaw'];

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hpBg: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  /** 血条下方一排异常色块，和震慑累积条 */
  private readonly pips: Record<StatusId, Phaser.GameObjects.Rectangle>;
  private readonly stunBar: Phaser.GameObjects.Rectangle;
  /** 药师·护心的护盾，叠在血条上沿 */
  private readonly shieldBar: Phaser.GameObjects.Rectangle;
  x = 0;
  y = 0;
  hp: number;
  /** 单位朝向向量，停下时保留 */
  facing = { x: 0, y: 1 };
  moving = false;
  alive = true;
  private dir: HeroDir = 's';
  private flip = false;
  private animKey = '';
  private atkUntil = 0;
  private hurtUntil = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(private g: GameScene) {
    this.hp = g.pstats.maxHp;
    this.sprite = g.add.sprite(0, 0, `hero_${g.char.id}`, 0).setOrigin(0.5, 0.92);
    this.hpBg = g.add.rectangle(0, 0, 20, 3, 0x1c1424).setOrigin(0.5, 0);
    this.hpFill = g.add.rectangle(0, 0, 18, 1, 0xe8503f).setOrigin(0, 0);
    this.pips = Object.fromEntries(
      PIP_ORDER.map((k) => [k, g.add.rectangle(0, 0, 3, 2, STATUS_INFO[k].tint).setOrigin(0, 0).setVisible(false)]),
    ) as Record<StatusId, Phaser.GameObjects.Rectangle>;
    this.stunBar = g.add.rectangle(0, 0, 18, 1, 0xdaa53e).setOrigin(0, 0).setVisible(false);
    this.shieldBar = g.add.rectangle(0, 0, 18, 1, 0xe8f0ff).setOrigin(0, 0).setVisible(false);
    this.keys = g.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  update(dt: number) {
    const g = this.g;
    if (!this.alive) return;
    const k = this.keys;
    let mx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let my = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    // 键盘没按时用虚拟摇杆，摇杆推得越远走得越快
    let speedK = 1;
    if (mx === 0 && my === 0 && stick.active) {
      mx = stick.x;
      my = stick.y;
      speedK = Math.min(1, Math.hypot(mx, my));
    }
    const st = g.status;
    // 定身时不能移动，术照常自动释放
    if (st.stunned) mx = my = 0;
    this.moving = mx !== 0 || my !== 0;
    if (this.moving) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      const sp = g.pstats.speed * speedK * st.speedMult * (g.now < g.dunUntil ? 1.4 : 1);
      this.x += mx * sp * dt;
      this.y += my * sp * dt;
      this.facing.x = mx;
      this.facing.y = my;
    }
    g.world.push(this, PLAYER_RADIUS);
    // 遁符期间半透明闪烁
    this.sprite.setAlpha(g.now < g.dunUntil ? 0.55 + 0.2 * Math.sin(g.now * 20) : 1);

    const attacking = g.now < this.atkUntil;
    if (!attacking) {
      const d = dirFromVector(this.facing.x, this.facing.y);
      this.dir = d.dir;
      this.flip = d.flip;
      this.play(`${this.g.char.id}_${this.dir}_${this.moving ? 'run' : 'idle'}`);
    }
    this.sprite.setFlipX(this.flip);
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    const tint = st.stunned ? 'stun' : st.burning ? 'burn' : st.poisoned ? 'poison' : st.slowed ? 'slow' : st.flawed ? 'flaw' : null;
    if (g.now < this.hurtUntil) this.sprite.setTintFill(0xff5a5a);
    else if (tint) this.sprite.setTint(STATUS_INFO[tint].tint);
    else this.sprite.clearTint();

    // 回血，中毒时减半
    const max = g.pstats.maxHp;
    if (g.pstats.regen > 0 && this.alive) g.regenPlayer(g.pstats.regen * st.regenMult * dt);
    this.hpBg.setPosition(this.x, this.y + 4).setDepth(this.y + 1);
    this.hpFill.setPosition(this.x - 9, this.y + 5).setDepth(this.y + 2);
    this.hpFill.width = Math.max(0, 18 * (this.hp / max));
    this.hpFill.fillColor = st.poisoned ? 0x7ad04a : 0xe8503f;
    this.shieldBar.setVisible(g.shield > 0.5);
    if (g.shield > 0.5) {
      this.shieldBar.width = Math.max(1, Math.round(18 * Math.min(1, g.shield / max)));
      this.shieldBar.setPosition(this.x - 9, this.y + 4).setDepth(this.y + 3);
    }
    this.updatePips();
  }

  private updatePips() {
    const st = this.g.status;
    const on: Record<StatusId, boolean> = { stun: st.stunned, burn: st.burning, poison: st.poisoned, slow: st.slowed, flaw: st.flawed };
    const active = PIP_ORDER.filter((k) => on[k]);
    let x = this.x - (active.length * 4 - 1) / 2;
    for (const k of PIP_ORDER) {
      const r = this.pips[k];
      r.setVisible(on[k]);
      if (!on[k]) continue;
      r.setPosition(Math.round(x), this.y + 9).setDepth(this.y + 2);
      x += 4;
    }
    const m = st.stunMeter;
    this.stunBar.setVisible(m > 0);
    if (m > 0) {
      this.stunBar.width = Math.round(18 * m);
      this.stunBar.setPosition(this.x - 9, this.y + 7).setDepth(this.y + 2);
    }
  }

  /** 播放出招动画，持续期间锁定朝向；自动瞄准的术传入目标方向，身体转向目标出招 */
  attack(ax = this.facing.x, ay = this.facing.y) {
    const d = dirFromVector(ax, ay);
    this.dir = d.dir;
    this.flip = d.flip;
    this.animKey = `${this.g.char.id}_${this.dir}_${this.moving ? 'atkrun' : 'atk'}`;
    this.sprite.play(this.animKey);
    this.atkUntil = this.g.now + 0.25;
  }

  hurt() {
    this.hurtUntil = this.g.now + 0.1;
  }

  die() {
    this.alive = false;
    this.sprite.anims.stop();
    this.sprite.setTint(0x6a6070);
    this.g.tweens.add({ targets: this.sprite, angle: 90, alpha: 0.6, duration: 500 });
    this.hpBg.setVisible(false);
    this.hpFill.setVisible(false);
    this.stunBar.setVisible(false);
    this.shieldBar.setVisible(false);
    for (const k of PIP_ORDER) this.pips[k].setVisible(false);
  }

  private play(key: string) {
    if (key === this.animKey) return;
    this.animKey = key;
    this.sprite.play(key);
  }
}
