import Phaser from 'phaser';
import { buildHeroXiao } from '../art/heroXiao';
import { buildHeroZhu } from '../art/heroZhu';
import { buildHeroRuan } from '../art/heroRuan';
import { buildEnemies } from '../art/enemyArt';
import { buildFx } from '../art/fxArt';
import { audio } from '../audio/Audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    audio.init(this.game);
    buildFx(this);
    buildHeroXiao(this);
    buildHeroZhu(this);
    buildHeroRuan(this);
    buildEnemies(this);
    const params = new URLSearchParams(location.search);
    const level = Number(params.get('level'));
    if (params.has('art')) this.scene.start('art');
    else if (level) this.scene.start('game', { level, char: params.get('char') ?? 'xiao' });
    else this.scene.start('menu');
  }
}
