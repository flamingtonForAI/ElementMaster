// 静态对比度检查：只对照第一关地面，不代表动画或实战可读性
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MIN_LUM_DELTA, rgbToOklab, runReadabilityCheck } from '../readability.mjs';

const folder = fileURLToPath(new URL('./enemies/level1-v1/', import.meta.url));
// 描边属于轮廓，不参与主体明度统计；直接复用画面里的描边色
const { OUTLINE, OUTLINE_LIT } = await import('../../src/art/painter.ts');
const outline = [OUTLINE, OUTLINE_LIT].map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
const level1 = runReadabilityCheck({ writeImages: false }).find((r) => r.levelId === 1);
if (!level1) throw new Error('第 1 关未开放，读不到地面明度');
const ground = level1.groundP95L;
const maxColors = JSON.parse(readFileSync(`${folder}sprites.json`, 'utf8')).palette.length;
const data = JSON.parse(execFileSync('python3', ['-c', `
import json, sys
from PIL import Image
from pathlib import Path
outline = [tuple(c) for c in json.loads(sys.argv[2])]
out = []
for f in sorted(Path(sys.argv[1]).glob('*-native.png')):
    im = Image.open(f).convert('RGBA')
    raw = im.tobytes()
    pixels = [tuple(raw[i:i+4]) for i in range(0, len(raw), 4)]
    body = [p[:3] for p in pixels if p[3] and p[:3] not in outline]
    out.append({'file': f.name, 'size': im.size, 'bytes': f.stat().st_size, 'alpha': sorted({p[3] for p in pixels}), 'colors': len({p[:3] for p in pixels if p[3]}), 'body': body})
print(json.dumps(out))
`, folder, JSON.stringify(outline)], { encoding: 'utf8' }));
if (data.length !== 6) throw new Error('应有六张当前尺寸切片');
const sprites = data.map(({ body, ...s }) => {
  const ls = body.map(c => rgbToOklab(...c).L).sort((a, b) => a - b);
  const avg = ls.reduce((a, b) => a + b, 0) / ls.length;
  const p75 = ls[Math.floor(ls.length * .75)];
  const dL = Math.max(Math.abs(p75 - ground), Math.abs(avg - ground));
  const hardAlpha = s.alpha.length === 2 && s.alpha[0] === 0 && s.alpha[1] === 255;
  return { ...s, groundP95L: ground, dL: +dL.toFixed(3), pass: dL >= MIN_LUM_DELTA && hardAlpha && s.colors <= maxColors };
});
writeFileSync(`${folder}validation.json`, JSON.stringify({
  method: `主体排除描边；abs(p75L-groundP95L) 或 abs(meanL-groundP95L) ≥ ${MIN_LUM_DELTA}；沿用现有 OKLab 转换。另检查硬透明与色数（上限取 sprites.json 的 ${maxColors} 色）。仅为静态对比度检查。`, sprites,
}, null, 2) + '\n');
console.table(sprites.map(({ file, dL, colors, bytes, pass }) => ({ file, dL, colors, bytes, pass })));
if (sprites.some(s => !s.pass)) process.exitCode = 1;
