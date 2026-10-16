import Phaser from 'phaser';
import { buildHeroXiao } from '../art/heroXiao';
import { buildHeroZhu } from '../art/heroZhu';
import { buildHeroRuan } from '../art/heroRuan';
import { buildHeroQingdai } from '../art/heroQingdai';
import { buildHeroMoheng } from '../art/heroMoheng';
import { buildHeroXuanyi } from '../art/heroXuanyi';
import { buildPuppetArt } from '../art/puppetArt';
import { buildEnemies } from '../art/enemyArt';
import { buildFx } from '../art/fxArt';
import { TOD_LIST, buildVista, getVistaTextureKey } from '../art/vistaArt';
import { audio } from '../audio/Audio';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    for (const t of TOD_LIST) {
      const key = getVistaTextureKey(t.id);
      this.load.image(key, `assets/vista/${key}.png`);
    }
  }

  create() {
    audio.init(this.game);
    buildFx(this);
    buildVista(this);
    buildHeroXiao(this);
    buildHeroZhu(this);
    buildHeroRuan(this);
    buildHeroQingdai(this);
    buildHeroMoheng(this);
    buildHeroXuanyi(this);
    buildPuppetArt(this);
    buildEnemies(this);
    const params = new URLSearchParams(location.search);
    const level = Number(params.get('level'));
    if (params.has('art')) this.scene.start('art');
    else if (level) this.scene.start('game', { level, char: params.get('char') ?? 'xiao' });
    else this.scene.start('title');
  }
}
