import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'phaser') {
      return {
        url: 'data:text/javascript,export default { Scene: class {}, Geom: { Rectangle: class {} } }',
        shortCircuit: true,
      };
    }
    if (specifier === 'tweakpane') {
      return { url: 'data:text/javascript,export class Pane {}', shortCircuit: true };
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) {
      return {
        format: 'module',
        source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform', sourceUrl: url }),
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

// 轻量级 Canvas 桩：把 addSheet 写入的 ImageData 捕获为 RGBA 缓冲区与帧列表
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') return {};
    const canvas = {
      width: 0,
      height: 0,
      _buf: null,
      getContext() {
        return {
          createImageData(w, h) {
            return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
          },
          putImageData(img, ox, oy) {
            if (!canvas._buf || canvas._buf.length !== canvas.width * canvas.height * 4) {
              canvas._buf = new Uint8ClampedArray(canvas.width * canvas.height * 4);
            }
            for (let y = 0; y < img.height; y++) {
              for (let x = 0; x < img.width; x++) {
                const si = (y * img.width + x) * 4;
                const di = ((oy + y) * canvas.width + (ox + x)) * 4;
                canvas._buf[di] = img.data[si];
                canvas._buf[di + 1] = img.data[si + 1];
                canvas._buf[di + 2] = img.data[si + 2];
                canvas._buf[di + 3] = img.data[si + 3];
              }
            }
          },
        };
      },
    };
    return canvas;
  },
};

const { buildFx } = await import('../src/art/fxArt.ts');
const { buildEnemies } = await import('../src/art/enemyArt.ts');
const { OUTLINE, OUTLINE_LIT, rng } = await import('../src/art/painter.ts');
const { LEVELS } = await import('../src/config/levels.ts');
const { ENEMIES } = await import('../src/config/enemies.ts');

// ---------- OKLab 色彩空间转换 ----------

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToOklab(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { L, a: A, b: B, C, H };
}

export function hexToOklab(hex) {
  return rgbToOklab((hex >> 16) & 255, (hex >> 8) & 255, hex & 255);
}

export function oklabDist(p, q) {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

export function hueDiffDeg(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------- 零依赖 PNG 编码器 ----------

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < w * 4; x++) raw[rowStart + 1 + x] = rgba[y * w * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 提取图集帧像素 ----------

function captureTextures() {
  const store = new Map();
  const mockScene = {
    textures: {
      exists: (k) => store.has(k),
      remove: (k) => store.delete(k),
      addCanvas(key, canvas) {
        const frames = [];
        store.set(key, { canvas, frames });
        return {
          add(idx, _src, x, y, w, h) {
            const data = new Uint8ClampedArray(w * h * 4);
            for (let py = 0; py < h; py++) {
              for (let px = 0; px < w; px++) {
                const si = ((y + py) * canvas.width + (x + px)) * 4;
                const di = (py * w + px) * 4;
                data[di] = canvas._buf[si];
                data[di + 1] = canvas._buf[si + 1];
                data[di + 2] = canvas._buf[si + 2];
                data[di + 3] = canvas._buf[si + 3];
              }
            }
            frames[idx] = { w, h, data };
          },
        };
      },
    },
    anims: { create() {} },
  };
  buildFx(mockScene);
  buildEnemies(mockScene);
  return store;
}

/** 提取精灵的主体像素（排除透明像素、半透明脚底光环与外描边） */
function extractBodyLabs(frame) {
  const labs = [];
  const { w, h, data } = frame;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a < 250) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const hex = (r << 16) | (g << 8) | b;
    if (hex === OUTLINE || hex === OUTLINE_LIT || hex === 0x163a24 || hex === 0x162a5a || hex === 0x2a4a12 || hex === 0x2a3a12 || hex === 0x4a3a6a) {
      continue;
    }
    labs.push(rgbToOklab(r, g, b));
  }
  return labs;
}

function summarizeLabs(labs) {
  const sortedL = labs.map((p) => p.L).sort((a, b) => a - b);
  const n = labs.length || 1;
  const meanL = labs.reduce((s, p) => s + p.L, 0) / n;
  const meanA = labs.reduce((s, p) => s + p.a, 0) / n;
  const meanB = labs.reduce((s, p) => s + p.b, 0) / n;
  const variance = labs.reduce((s, p) => s + (p.L - meanL) ** 2, 0) / n;
  const stdL = Math.sqrt(variance);
  const p50L = sortedL[Math.floor(n * 0.5)] ?? meanL;
  const p75L = sortedL[Math.floor(n * 0.75)] ?? meanL;
  const p95L = sortedL[Math.floor(n * 0.95)] ?? meanL;
  const C = Math.hypot(meanA, meanB);
  const H = ((Math.atan2(meanB, meanA) * 180) / Math.PI + 360) % 360;
  return { meanL, stdL, p50L, p75L, p95L, meanA, meanB, C, H };
}

// ---------- 合成 640×360 样本图 + 灰度图 + 高斯模糊图 ----------

function blitFrame(dst, dw, dh, frame, ox, oy) {
  const { w, h, data } = frame;
  for (let y = 0; y < h; y++) {
    const dy = oy + y;
    if (dy < 0 || dy >= dh) continue;
    for (let x = 0; x < w; x++) {
      const dx = ox + x;
      if (dx < 0 || dx >= dw) continue;
      const si = (y * w + x) * 4;
      const sa = data[si + 3] / 255;
      if (sa <= 0) continue;
      const di = (dy * dw + dx) * 4;
      dst[di] = Math.round(data[si] * sa + dst[di] * (1 - sa));
      dst[di + 1] = Math.round(data[si + 1] * sa + dst[di + 1] * (1 - sa));
      dst[di + 2] = Math.round(data[si + 2] * sa + dst[di + 2] * (1 - sa));
      dst[di + 3] = 255;
    }
  }
}

function toGrayscale(w, h, rgba) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const lab = rgbToOklab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const v = Math.max(0, Math.min(255, Math.round(lab.L * 255)));
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function gaussianBlur2px(w, h, rgba) {
  // 5×5 可分离高斯核（sigma ≈ 2px）
  const k = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
  const tmp = new Float32Array(w * h * 4);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let d = -2; d <= 2; d++) {
        const nx = Math.min(w - 1, Math.max(0, x + d));
        const si = (y * w + nx) * 4;
        const wgt = k[d + 2];
        r += rgba[si] * wgt;
        g += rgba[si + 1] * wgt;
        b += rgba[si + 2] * wgt;
      }
      const di = (y * w + x) * 4;
      tmp[di] = r;
      tmp[di + 1] = g;
      tmp[di + 2] = b;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let d = -2; d <= 2; d++) {
        const ny = Math.min(h - 1, Math.max(0, y + d));
        const si = (ny * w + x) * 4;
        const wgt = k[d + 2];
        r += tmp[si] * wgt;
        g += tmp[si + 1] * wgt;
        b += tmp[si + 2] * wgt;
      }
      const di = (y * w + x) * 4;
      out[di] = Math.round(r);
      out[di + 1] = Math.round(g);
      out[di + 2] = Math.round(b);
      out[di + 3] = 255;
    }
  }
  return out;
}

export function runReadabilityCheck({ writeImages = true } = {}) {
  const store = captureTextures();
  const gemColors = [
    { id: 'gem_s', lab: hexToOklab(0x5aa8ff) },
    { id: 'gem_m', lab: hexToOklab(0x5fd06a) },
    { id: 'gem_l', lab: hexToOklab(0xff5a6a) },
  ];

  const results = [];
  const outDir = resolve(ROOT, 'tools/art/reports');
  if (writeImages) mkdirSync(outDir, { recursive: true });

  for (const level of LEVELS.filter((l) => l.available)) {
    const gFrame = store.get(level.ground).frames[0];
    const gLabs = extractBodyLabs(gFrame);
    const gStat = summarizeLabs(gLabs);

    const groundCalmPass = gStat.stdL <= 0.05;

    // 检查装饰物与三种宝石颜色的冲突率（ΔE < 0.10 占比 < 1%）
    const decorChecks = [];
    for (const d of level.ridges ? [...level.decor, { tex: level.ridges.tex }] : level.decor) {
      const dFrames = store.get(d.tex).frames;
      const dLabs = dFrames.flatMap(extractBodyLabs);
      let clash = 0;
      for (const lab of dLabs) {
        if (gemColors.some((gc) => oklabDist(lab, gc.lab) < 0.1)) clash++;
      }
      const ratio = dLabs.length ? clash / dLabs.length : 0;
      decorChecks.push({ tex: d.tex, clashRatio: ratio, pass: ratio < 0.01 });
    }

    // 检查敌人、Boss 与三种宝石的可读性
    const targets = [
      ...level.enemies.map((e) => ENEMIES[e.id].tex),
      ENEMIES[level.boss].tex,
      'gem_s',
      'gem_m',
      'gem_l',
    ];
    const entityChecks = [];
    for (const key of targets) {
      const frame = store.get(key).frames[0];
      const labs = extractBodyLabs(frame);
      const st = summarizeLabs(labs);
      // 主体亮部（p75L）或均值（meanL）与地面 95% 分位的明度差，或暗色精灵与地面均值的明度差
      const dL = Math.max(Math.abs(st.p75L - gStat.p95L), Math.abs(st.meanL - gStat.p95L), Math.abs(gStat.meanL - st.meanL));
      const dC = Math.abs(st.C - gStat.C);
      const dH = hueDiffDeg(st.H, gStat.H);
      const passL = dL >= 0.12;
      const passCH = dC >= 0.08 && dH >= 30;
      const pass = passL || passCH;
      entityChecks.push({
        key,
        dL: Number(dL.toFixed(3)),
        dC: Number(dC.toFixed(3)),
        dH: Number(dH.toFixed(1)),
        passL,
        passCH,
        pass,
      });
    }

    if (writeImages) {
      const W = 640;
      const H = 360;
      const sample = new Uint8ClampedArray(W * H * 4);
      // 铺地面
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const gx = x % gFrame.w;
          const gy = y % gFrame.h;
          const si = (gy * gFrame.w + gx) * 4;
          const di = (y * W + x) * 4;
          sample[di] = gFrame.data[si];
          sample[di + 1] = gFrame.data[si + 1];
          sample[di + 2] = gFrame.data[si + 2];
          sample[di + 3] = 255;
        }
      }
      // 撒装饰物
      const R = rng(level.id * 999);
      for (let i = 0; i < 16; i++) {
        const d = level.decor[i % level.decor.length];
        const dFrames = store.get(d.tex).frames;
        const df = dFrames[Math.floor(i / level.decor.length) % dFrames.length];
        const px = Math.floor(R() * (W - df.w));
        const py = Math.floor(R() * (H - df.h));
        blitFrame(sample, W, H, df, px, py);
      }
      // 摆上所有敌人与三种宝石
      targets.forEach((key, idx) => {
        const f = store.get(key).frames[0];
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        const px = 80 + col * 140 - Math.floor(f.w / 2);
        const py = 75 + row * 105 - Math.floor(f.h / 2);
        blitFrame(sample, W, H, f, px, py);
      });

      writeFileSync(resolve(outDir, `readability_l${level.id}_color.png`), encodePng(W, H, sample));
      writeFileSync(resolve(outDir, `readability_l${level.id}_gray.png`), encodePng(W, H, toGrayscale(W, H, sample)));
      writeFileSync(resolve(outDir, `readability_l${level.id}_blur.png`), encodePng(W, H, gaussianBlur2px(W, H, sample)));
    }

    results.push({
      levelId: level.id,
      levelName: level.name,
      groundStdL: Number(gStat.stdL.toFixed(4)),
      groundP95L: Number(gStat.p95L.toFixed(3)),
      groundCalmPass,
      decorChecks,
      entityChecks,
      pass: groundCalmPass && decorChecks.every((d) => d.pass) && entityChecks.every((e) => e.pass),
    });
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const res = runReadabilityCheck({ writeImages: true });
  for (const r of res) {
    console.log(`\n=== 第 ${r.levelId} 关：${r.levelName} (${r.pass ? 'PASS' : 'FAIL'}) ===`);
    console.log(`地面平静度 σ_L = ${r.groundStdL} (阈值 ≤ 0.05) -> ${r.groundCalmPass ? 'PASS' : 'FAIL'}, 地面 L95 = ${r.groundP95L}`);
    console.log('装饰物宝石撞色检查 (ΔE < 0.10 占比 < 1%):');
    console.table(r.decorChecks);
    console.log('敌人与宝石可读性检查 (ΔL ≥ 0.12 或 (ΔC ≥ 0.08 且 ΔH ≥ 30°)):');
    console.table(r.entityChecks);
  }
  if (!res.every((r) => r.pass)) process.exit(1);
}
