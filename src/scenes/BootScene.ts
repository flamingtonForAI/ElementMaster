import Phaser from 'phaser';
import { buildHeroXiao } from '../art/heroXiao';
import { buildEnemies } from '../art/enemyArt';
import { buildFx } from '../art/fxArt';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create() {
    buildFx(this);
    buildHeroXiao(this);
    buildEnemies(this);
    const params = new URLSearchParams(location.search);
    const level = Number(params.get('level'));
    if (params.has('art')) this.scene.start('art');
    else if (level) this.scene.start('game', { level, char: 'xiao' });
    else this.scene.start('menu');
  }
}
