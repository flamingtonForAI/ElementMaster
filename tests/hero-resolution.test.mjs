import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import '../tools/readability.mjs';
import animations from '../src/art/heroAnimations.json' with { type: 'json' };

const { configureView, viewPoint, RENDER_SCALE } = await import('../src/config/view.ts');
const { buildHeroes } = await import('../src/art/heroes.ts');

test('48 主角沿用原版全部动画帧序与时长，缺图仍可生成 32 原版', () => {
  const originalAnimations = [];
  const originalFrames = [];
  buildHeroes({
    textures: { exists: () => false, addCanvas() { return { add(i, _, x, y, w, h) { originalFrames.push([w, h]); } }; } },
    anims: { create(a) { originalAnimations.push(a); } },
  });
  assert.deepEqual(animations, originalAnimations);
  assert.equal(originalFrames.length, 840);
  assert.ok(originalFrames.every(([w, h]) => w === 32 && h === 32));
  const loaded = [];
  buildHeroes({ textures: { exists: () => true }, anims: { create(a) { loaded.push(a); } } });
  assert.deepEqual(loaded, originalAnimations);
});

test('48 图集包含六人各 140 帧，所有动作都有可见主体', () => {
  execFileSync('python3', ['-c', `
from PIL import Image
for hero in ['xiao','zhu','ruan','qingdai','moheng','xuanyi']:
    im=Image.open('public/assets/heroes/'+hero+'-48.png').convert('RGBA')
    assert im.size==(48*28,48*5), hero
    for row in range(5):
        for col in range(28):
            frame=im.crop((col*48,row*48,(col+1)*48,(row+1)*48))
            assert 255 in frame.getchannel('A').tobytes(), (hero,row,col)
`]);
});

test('高清画布保持 640×360 可见世界，鼠标/触摸仍指向相同逻辑位置', () => {
  const events = new Map();
  const camera = {
    width: 640 * RENDER_SCALE, height: 360 * RENDER_SCALE,
    setZoom(z) { this.zoom = z; return this; },
    setScroll(x, y) { this.scrollX = x; this.scrollY = y; return this; },
    on(key, fn) { assert.ok(!events.has(key), '重复初始化不能重复校正震屏'); events.set(key, fn); },
  };
  const scene = { cameras: { main: camera }, scale: { on() {}, off() {} }, events: { once() {} } };
  configureView(scene);
  for (const point of [{ x: 0, y: 0 }, { x: 320, y: 180 }, { x: 640, y: 360 }]) {
    const screen = {
      x: (point.x - camera.scrollX - camera.width / 2) * camera.zoom + camera.width / 2,
      y: (point.y - camera.scrollY - camera.height / 2) * camera.zoom + camera.height / 2,
    };
    assert.deepEqual(viewPoint(screen), point);
  }
  configureView(scene);
  let intensity = .003;
  events.get('camerashakestart')(camera, { intensity: { scale(k) { intensity *= k; } } });
  // 对照 Phaser Shake.update 中 width * zoom 的运算，世界单位位移应与原版相同。
  assert.ok(Math.abs(intensity * camera.width * camera.zoom - .003 * 640) < 1e-9);
});
