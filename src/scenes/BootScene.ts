import Phaser from 'phaser';
import { preloadHeroes, buildHeroes } from '../art/heroes';
import { buildPuppetArt } from '../art/puppetArt';
import { buildEnemies } from '../art/enemyArt';
import { preloadEnemySheets } from '../art/enemySheets';
import { buildPortraits, PORTRAITS } from '../art/portraits';
import { buildFx } from '../art/fxArt';
import { TOD_LIST, buildVista, getVistaTextureKey } from '../art/vistaArt';
import { audio } from '../audio/Audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    preloadHeroes(this);
    preloadEnemySheets(this);
    for (const id of Object.keys(PORTRAITS)) {
      this.load.image(`portrait_${id}`, `assets/portraits/${id}.png`);
    }
    for (const t of TOD_LIST) {
      const key = getVistaTextureKey(t.id);
      this.load.image(key, `assets/vista/${key}.png`);
    }
  }

  create() {
    audio.init(this.game);
    buildFx(this);
    buildVista(this);
    buildHeroes(this);
    buildPuppetArt(this);
    buildEnemies(this);
    buildPortraits(this);
    const params = new URLSearchParams(location.search);
    const level = Number(params.get('level'));
    if (params.has('art')) this.scene.start('art');
    else if (level) this.scene.start('game', { level, char: params.get('char') ?? 'xiao' });
    else this.scene.start('title');
  }
}
