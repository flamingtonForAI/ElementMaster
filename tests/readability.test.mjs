import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
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

test('原画 PNG 接入正式贴图、升阶和特殊帧，第 1 关起全部用原画', () => {
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
  // 第 1 关的怪也换成了原画，不再等于程序画回退
  for (const key of ['en_shiyong', 'en_tengguai', 'en_shuigui', 'en_huoya', 'en_tiejia', 'boss_langyao']) {
    assert.notDeepEqual(current.get(key).frames[0].data, fallback.get(key).frames[0].data, `${key} 仍是程序画`);
  }
  for (const key of ['en_chuanshan', 'en_chuanshan_armor', 'en_canbing']) {
    assert.notDeepEqual(current.get(key).frames[0].data, current.get(key).frames[2].data, `${key} 钻地 / 尸骸不能仍是站立帧`);
  }
  for (const key of ['en_chuanshan', 'en_chuanshan_armor']) {
    assert.deepEqual(current.animations.get(key + '_dig').frames.map((f) => f.frame), [2, 3]);
  }
});

test('傀儡原画图集：走路 4 帧 + 拍地 4 帧，硬透明', () => {
  const out = execFileSync('python3', ['-c', `
import json
from PIL import Image
m = json.load(open('src/art/puppetSheets.json'))
for k, s in m.items():
    im = Image.open('public/assets/puppets/' + k + '.png').convert('RGBA')
    assert im.size == (s['width'] * s['frames'], s['height']), k
    assert s['frames'] == 8, k
    assert set(im.getchannel('A').tobytes()) <= {0, 255}, k
    frames = [im.crop((i * s['width'], 0, (i + 1) * s['width'], s['height'])).tobytes() for i in range(8)]
    assert len(set(frames)) == 8, k
print(','.join(m))
`], { encoding: 'utf8' });
  assert.equal(out.trim(), 'pp_golem,pp_giant');
});

test('毕方拍翼留出完整轮廓，颈胸位置不随脚尖上下漂移', () => {
  const frames = captureTextures().get('boss_bifang').frames;
  const centers = frames.map(({ w, h, data }) => {
    let sy = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!data[i + 3]) continue;
      assert.ok(x > 0 && x < w - 1 && y > 0 && y < h - 1, '翅尖 / 描边不能碰到画布边界');
      const [r, g, b] = data.slice(i, i + 3);
      if (Math.min(r, g, b) > 150 && Math.abs(r - g) < 45 && r >= b) { sy += y; n++; }
    }
    assert.ok(n > 0, '应保留浅色颈胸');
    return sy / n;
  });
  assert.ok(Math.max(...centers) - Math.min(...centers) < 2, '身体应固定，拍翼由翅膀和腿的姿势表现');
});
