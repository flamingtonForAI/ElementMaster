import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureTextures, runReadabilityCheck } from '../tools/readability.mjs';
import ENEMY_SHEETS from '../src/art/enemySheets.json' with { type: 'json' };

test('OKLab 战斗区可读性守门：地面平静度、装饰不撞宝石色、敌人与宝石显著高于地面', () => {
  const results = runReadabilityCheck({ writeImages: false });
  assert.ok(results.length >= 2, '应至少检查前两关');
  for (const r of results) {
    assert.ok(
      r.groundCalmPass,
      `第 ${r.levelId} 关 (${r.levelName}) 地面明度标准差过高: ${r.groundStdL} > 0.05`,
    );
    for (const d of r.decorChecks) {
      assert.ok(
        d.pass,
        `第 ${r.levelId} 关装饰 ${d.tex} 与宝石撞色占比过高: ${(d.clashRatio * 100).toFixed(2)}% >= 1%`,
      );
    }
    for (const e of r.entityChecks) {
      assert.ok(
        e.pass,
        `第 ${r.levelId} 关实体 ${e.key} 可读性不足: dL=${e.dL} (<0.12), dC=${e.dC}, dH=${e.dH}°`,
      );
    }
  }
});

test('原画 PNG 接入正式贴图、升阶和特殊帧；第一关造型不变', () => {
  const current = captureTextures();
  const fallback = captureTextures({ raster: false });
  for (const [key, spec] of Object.entries(ENEMY_SHEETS)) {
    for (const suffix of key.startsWith('boss_') ? [''] : ['', '_t2', '_t3']) {
      const frames = current.get(key + suffix)?.frames;
      assert.equal(frames?.length, spec.frames, `${key + suffix} 动画 / 特殊帧缺失`);
      for (const frame of frames) {
        assert.deepEqual([frame.w, frame.h], [spec.width, spec.height], key);
        const alpha = frame.data.filter((_, i) => i % 4 === 3);
        assert.ok(alpha.some((a) => a === 255), `${key} 空帧`);
        assert.ok(alpha.every((a) => a === 0 || a === 255), `${key} 有半透明毛边`);
      }
      const walk = current.animations.get(key + suffix + '_move');
      const indices = walk.frames.map((f) => f.frame);
      assert.equal(indices.length, 4, `${key} 应播放完整四姿势移动循环`);
      for (let i = 0; i < indices.length; i++) {
        assert.notDeepEqual(frames[indices[i]].data, frames[indices[(i + 1) % indices.length]].data, `${key} 相邻移动帧重复`);
      }
      if (key.includes('chuanshan')) assert.ok(indices.every((i) => i !== 2 && i !== 3), `${key} 走路时不能播放土包`);
      if (key === 'en_canbing') assert.ok(!indices.includes(2), '残兵走路时不能播放尸骸');
    }
  }
  for (const key of ['en_shiyong', 'en_tengguai', 'en_shuigui', 'en_huoya', 'en_tiejia', 'boss_langyao']) {
    assert.deepEqual(current.get(key).frames, fallback.get(key).frames, `${key} 第一关原画被意外替换`);
    assert.deepEqual(current.animations.get(key + '_move'), fallback.animations.get(key + '_move'), `${key} 第一关动作被意外改变`);
  }
  for (const key of ['en_chuanshan', 'en_chuanshan_armor', 'en_canbing']) {
    assert.notDeepEqual(current.get(key).frames[0].data, current.get(key).frames[2].data, `${key} 钻地 / 尸骸不能仍是站立帧`);
  }
  for (const key of ['en_chuanshan', 'en_chuanshan_armor']) {
    assert.deepEqual(current.animations.get(key + '_dig').frames.map((f) => f.frame), [2, 3]);
  }
});
