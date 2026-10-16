import Phaser from 'phaser';
import { HERO_DIRS } from '../art/heroXiao';
import { label } from '../ui/text';

/** 美术预览：?art 打开，检查 8 方向动画与敌人 */
export class ArtScene extends Phaser.Scene {
  constructor() {
    super('art');
  }

  create() {
    this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0);
    const poses = ['idle', 'run', 'atk', 'atkrun'];
    // ?art=zhu 预览符师，?art=ruan 海贼，?art=qingdai 药师，?art=moheng 傀儡师，?art=xuanyi 散人
    const id = new URLSearchParams(location.search).get('art') || 'xiao';
    const names: Record<string, string> = { zhu: '朱砂', ruan: '阮沧', qingdai: '青黛', moheng: '墨衡', xuanyi: '玄一' };
    label(this, 8, 4, `${names[id] ?? '萧寒锋'} 8 方向（右侧 3 列为镜像）`);
    const dirs: [string, boolean][] = [...HERO_DIRS.map((d): [string, boolean] => [d, false]), ['se', true], ['e', true], ['ne', true]];
    poses.forEach((pose, r) => {
      label(this, 8, 34 + r * 44, pose, '#b8aec8');
      dirs.forEach(([d, flip], c) => {
        const s = this.add.sprite(80 + c * 44, 50 + r * 44, `hero_${id}`, 0).setFlipX(flip);
        const key = `${id}_${d}_${pose}`;
        if (pose.startsWith('atk')) {
          s.play(key);
          s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(400, () => s.play(key)));
        } else s.play(key);
      });
    });
    const en = ['en_shiyong', 'en_tengguai', 'en_shuigui', 'en_huoya', 'en_tiejia', 'en_zhushe', 'en_zhangchan'];
    en.forEach((k, i) => this.add.sprite(60 + i * 40, 230, k, 0).play(k + '_move'));
    this.add.sprite(370, 236, 'boss_langyao', 0).play('boss_langyao_move');
    this.add.sprite(460, 226, 'boss_shuyao', 0).play('boss_shuyao_move');
    this.add.sprite(530, 236, 'pp_golem', 0).play('pp_golem_move');
    this.add.sprite(560, 236, 'pp_golem', 0).setTint(0x9fc0ff).play('pp_golem_move');
    this.add.sprite(605, 230, 'pp_giant', 0).play('pp_giant_move');
    const fx = ['pj_sword', 'pj_bolt', 'pj_leaf', 'pj_wave', 'gem_s', 'gem_m', 'gem_l', 'chest', 'ep_leaf', 'ep_wind', 'ep_poison', 'antidote'];
    fx.forEach((k, i) => this.add.image(60 + i * 30, 300, k));
    this.add.sprite(420, 300, 'pj_water', 0).play('pj_water');
    this.add.sprite(460, 300, 'pj_fireball', 0).play('pj_fireball');
    ['fire', 'metal', 'wood', 'water', 'earth'].forEach((el, i) => this.add.sprite(490 + i * 14, 300, `pj_fu_${el}`, 0).play(`pj_fu_${el}`));
    const decor = ['dc_rock', 'dc_tuft', 'dc_tablet', 'dc_deadtree', 'dc_bamboo', 'dc_shoot', 'dc_mossrock', 'dc_fern'];
    decor.forEach((k, i) => this.add.image(470 + (i % 4) * 40, 120 + Math.floor(i / 4) * 70, k).setOrigin(0.5, 1));
  }
}
