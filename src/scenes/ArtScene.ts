import Phaser from 'phaser';
import { coverView, configureView } from '../config/view';
import { HERO_DIRS } from '../art/heroXiao';
import { label } from '../ui/text';
import { LEVELS, enemyTex } from '../config/levels';
import { ENEMIES, tierTex } from '../config/enemies';

/** 美术预览：?art 打开，检查 8 方向动画与敌人 */
export class ArtScene extends Phaser.Scene {
  constructor() {
    super('art');
  }

  create() {
    configureView(this);
    const params = new URLSearchParams(location.search);
    if (params.get('art') === 'enemies') {
      this.showEnemies(Number(params.get('level')) || 2);
      return;
    }
    coverView(this, this.add.tileSprite(0, 0, 640, 360, 'ground_1').setOrigin(0));
    const poses = ['idle', 'run', 'atk', 'atkrun'];
    // ?art=zhu 预览符师，?art=ruan 海贼，?art=qingdai 药师，?art=moheng 傀儡师，?art=xuanyi 散人
    const id = new URLSearchParams(location.search).get('art') || 'xiao';
    const names: Record<string, string> = { zhu: '朱砂', ruan: '阮沧', qingdai: '青黛', moheng: '墨衡', xuanyi: '玄一' };
    label(this, 8, 4, `${names[id] ?? '萧寒锋'} 8 方向（右侧 3 列为镜像）`);
    const dirs: [string, boolean][] = [...HERO_DIRS.map((d): [string, boolean] => [d, false]), ['se', true], ['e', true], ['ne', true]];
    poses.forEach((pose, r) => {
      label(this, 8, 34 + r * 44, pose, '#b8aec8');
      dirs.forEach(([d, flip], c) => {
        const s = this.add.sprite(80 + c * 44, 50 + r * 44, `hero_${id}`, 0).setDisplaySize(32, 32).setFlipX(flip);
        const key = `${id}_${d}_${pose}`;
        if (pose.startsWith('atk')) {
          s.play(key);
          s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(400, () => s.play(key)));
        } else s.play(key);
      });
    });
    const en = ['en_shiyong', 'en_shiyong_moss', 'en_shiyong_rock', 'en_shiyong_lava', 'en_shiyong_armor', 'en_tengguai', 'en_shuigui', 'en_huoya', 'en_tiejia', 'en_zhushe', 'en_zhangchan'];
    en.forEach((k, i) => this.add.sprite(40 + i * 28, 230, k, 0).play(k + '_move'));
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
    // 第 3 关
    ['en_shanxiao', 'en_chuanshan'].forEach((k, i) => this.add.sprite(60 + i * 40, 334, k, 0).play(k + '_move'));
    this.add.sprite(140, 334, 'en_chuanshan', 2).play('en_chuanshan_dig');
    this.add.sprite(200, 326, 'boss_shanxiao', 0).play('boss_shanxiao_move');
    ['ep_rock', 'ep_boulder'].forEach((k, i) => this.add.image(250 + i * 18, 334, k));
    // 第 4、5 关
    const en45 = ['en_chihu', 'en_huojing', 'en_canbing', 'en_feilian'];
    en45.forEach((k, i) => this.add.sprite(60 + i * 40, 270, k, 0).play(k + '_move'));
    this.add.image(220, 272, 'en_canbing', 2);
    this.add.sprite(290, 276, 'boss_bifang', 0).play('boss_bifang_move');
    this.add.sprite(350, 280, 'boss_xingtian', 0).play('boss_xingtian_move');
    ['ep_fire', 'ep_blade'].forEach((k, i) => this.add.image(400 + i * 16, 262, k));
    this.add.sprite(436, 266, 'fx_flame', 0).play('fx_flame');
    this.add.image(480, 262, 'dc_lava', 0);
    const decor45 = ['dc_basalt', 'dc_scorch', 'dc_cinder', 'dc_barricade', 'dc_sword', 'dc_bones'];
    decor45.forEach((k, i) => this.add.image(520 + (i % 3) * 36, 250 + Math.floor(i / 3) * 34, k).setOrigin(0.5, 1));
    // 第 6 关
    ['en_yuyao', 'en_jiao'].forEach((k, i) => this.add.sprite(320 + i * 40, 334, k, 0).play(k + '_move'));
    this.add.sprite(420, 330, 'boss_xiangliu', 0).play('boss_xiangliu_move');
    ['ep_water', 'fx_puddle'].forEach((k, i) => this.add.image(470 + i * 18, 334, k));
    this.add.image(540, 334, 'fx_fog');
    const decor6 = ['dc_reed', 'dc_cattail', 'dc_lotus', 'dc_mud'];
    decor6.forEach((k, i) => this.add.image(600 + (i % 2) * 40, 320 + Math.floor(i / 2) * 34, k).setOrigin(0.5, 1).setScale(k === 'dc_mud' ? 0.4 : 1));
  }

  /** 正式纹理与动画的逐关预览，检查真实尺寸、地域皮肤及升阶。 */
  private showEnemies(levelId: number) {
    const level = LEVELS.find((l) => l.id === levelId && l.available) ?? LEVELS[1];
    this.children.removeAll(true);
    coverView(this, this.add.tileSprite(0, 0, 640, 360, level.ground).setOrigin(0));
    this.add.rectangle(0, 0, 640, 64, 0x15121c, .92).setOrigin(0);
    label(this, 16, 10, `怪物像素预览 · 第 ${level.id} 关 ${level.name}`, '#f4eee0', 24);
    label(this, 16, 42, '← → 切换关卡　上排 2×　下排原尺寸：原 / 凶 / 煞', '#d2c6b6');
    const ids = [...level.enemies.map((e) => e.id), level.boss];
    // 怪多（昆仑）时分两排，只放原尺寸和凶、煞
    const two = ids.length > 10;
    const perRow = two ? Math.ceil(ids.length / 2) : ids.length;
    const step = 600 / perRow;
    ids.forEach((id, i) => {
      const def = ENEMIES[id];
      const tex = enemyTex(level, id, def.tex);
      const row = Math.floor(i / perRow);
      const x = 20 + step * ((i % perRow) + .5);
      if (two) {
        const y = 150 + row * 92;
        this.add.sprite(x, y, tex, 0).setOrigin(.5, .9).setScale(def.boss ? 1 : 1.5).play(`${tex}_move`);
        label(this, x, y + 4, def.name, '#f4eee0').setOrigin(.5, 0);
        return;
      }
      this.add.sprite(x, 204, tex, 0).setOrigin(.5, .9).setScale(2).play(`${tex}_move`);
      label(this, x, 220, def.name, '#f4eee0').setOrigin(.5, 0);
      if (def.boss) this.add.sprite(x, 316, tex, 0).setOrigin(.5, .9).play(`${tex}_move`);
      else for (const tier of [1, 2, 3] as const) {
        const key = tierTex(tex, tier);
        this.add.sprite(x + (tier - 2) * 30, 316, key, 0).setOrigin(.5, .9).play(`${key}_move`);
      }
    });
    label(this, 16, 342, '正式 PNG 素材 · 角色、碰撞与数值沿用当前设置', '#d2c6b6');
    this.input.keyboard?.removeAllListeners('keydown-LEFT');
    this.input.keyboard?.removeAllListeners('keydown-RIGHT');
    const last = Math.max(...LEVELS.filter((l) => l.available).map((l) => l.id));
    this.input.keyboard?.on('keydown-LEFT', () => this.showEnemies(level.id === 1 ? last : level.id - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.showEnemies(level.id === last ? 1 : level.id + 1));
  }
}
