import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runReadabilityCheck } from '../tools/readability.mjs';

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
