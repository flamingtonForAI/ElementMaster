// 用 iruidong 的 OpenAI 兼容生图接口（z-image-turbo）出素材表原图。
// usage: RUIDONG_API_KEY=... node tools/art/gen_image.mjs <prompt.txt> <out.png> [size]
// 提示词前面自动拼上 prompts/_style.txt 和 _sheet.txt。key 只从环境变量读，不进仓库。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const [promptFile, out, size = '1024x1024'] = process.argv.slice(2);
const key = process.env.RUIDONG_API_KEY;
if (!key || !promptFile || !out) {
  console.error('usage: RUIDONG_API_KEY=... node tools/art/gen_image.mjs <prompt.txt> <out.png> [size]');
  process.exit(1);
}
const base = process.env.RUIDONG_BASE_URL ?? 'https://iruidong.com/v1';
const model = process.env.RUIDONG_IMAGE_MODEL ?? 'z-image-turbo';
const prompt = ['_style.txt', '_sheet.txt'].map((f) => readFileSync(resolve(dir, 'prompts', f), 'utf8').trim()).concat(readFileSync(promptFile, 'utf8').trim()).join('\n');
const res = await fetch(`${base}/images/generations`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, prompt, size, n: 1 }),
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}
const item = (await res.json()).data?.[0];
const bytes = item?.b64_json ? Buffer.from(item.b64_json, 'base64') : Buffer.from(await (await fetch(item.url)).arrayBuffer());
writeFileSync(out, bytes);
console.log(`${out}: ${bytes.length} bytes`);
