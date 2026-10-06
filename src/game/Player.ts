import Phaser from 'phaser';
import { dirFromVector, type HeroDir } from '../art/heroXiao';
import type { GameScene } from '../scenes/GameScene';

export const PLAYER_RADIUS = 7;

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly hpBg: Phaser.GameObjects.Rectangle;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
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
    this.sprite = g.add.sprite(0, 0, 'hero_xiao', 0).setOrigin(0.5, 0.92);
    this.hpBg = g.add.rectangle(0, 0, 20, 3, 0x1c1424).setOrigin(0.5, 0);
    this.hpFill = g.add.rectangle(0, 0, 18, 1, 0xe8503f).setOrigin(0, 0);
    this.keys = g.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
  }

  update(dt: number) {
    const g = this.g;
    if (!this.alive) return;
    const k = this.keys;
    let mx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    let my = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    this.moving = mx !== 0 || my !== 0;
    if (this.moving) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      this.x += mx * g.pstats.speed * dt;
      this.y += my * g.pstats.speed * dt;
      this.facing.x = mx;
      this.facing.y = my;
    }

    const attacking = g.now < this.atkUntil;
    if (!attacking) {
      const d = dirFromVector(this.facing.x, this.facing.y);
      this.dir = d.dir;
      this.flip = d.flip;
      this.play(`xiao_${this.dir}_${this.moving ? 'run' : 'idle'}`);
    }
    this.sprite.setFlipX(this.flip);
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y);
    if (g.now < this.hurtUntil) this.sprite.setTintFill(0xff5a5a);
    else this.sprite.clearTint();

    // 回血
    const max = g.pstats.maxHp;
    if (g.pstats.regen > 0) this.hp = Math.min(max, this.hp + g.pstats.regen * dt);
    this.hpBg.setPosition(this.x, this.y + 4).setDepth(this.y + 1);
    this.hpFill.setPosition(this.x - 9, this.y + 5).setDepth(this.y + 2);
    this.hpFill.width = Math.max(0, 18 * (this.hp / max));
  }

  /** 播放出招动画，持续期间锁定朝向 */
  attack() {
    const d = dirFromVector(this.facing.x, this.facing.y);
    this.dir = d.dir;
    this.flip = d.flip;
    this.animKey = `xiao_${this.dir}_${this.moving ? 'atkrun' : 'atk'}`;
    this.sprite.play(this.animKey);
    this.atkUntil = this.g.now + 0.22;
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
  }

  private play(key: string) {
    if (key === this.animKey) return;
    this.animKey = key;
    this.sprite.play(key);
  }
}
