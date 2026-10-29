import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import '../tools/readability.mjs';
const { fitView, setViewLayout, configureView, viewPoint, RENDER_SCALE: R } = await import('../src/config/view.ts');

const plain = { left: 0, right: 0, top: 0, bottom: 0 };
const project = (p, c) => ({
  x: (p.x - c.scrollX - c.width / 2) * c.zoom + c.width / 2,
  y: (p.y - c.scrollY - c.height / 2) * c.zoom + c.height / 2,
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

// 手机实际像素比例、刘海方向及 Home indicator 均不能裁掉原有菜单。
test('手机横屏铺满画布，原 UI 四角留在安全区内，触摸准确映射', () => {
  for (const [w, h, safe] of [
    [844, 390, { ...plain, left: 47, right: 47, bottom: 21 }],
    [852, 393, { ...plain, left: 59, right: 59, bottom: 21 }],
    [932, 430, { ...plain, left: 59, right: 0, bottom: 21 }],
    [932, 430, { ...plain, right: 59, bottom: 21 }],
    [667, 375, plain], [1024, 768, { ...plain, bottom: 20 }],
  ]) {
    const v = fitView(w, h, true, safe);
    setViewLayout(v);
    assert.ok(v.width * v.zoom >= w && v.height * v.zoom >= h);
    assert.ok(v.width * v.zoom < w + 1 && v.height * v.zoom < h + 1);
    const camera = Object.assign(new EventEmitter(), {
      width: v.width, height: v.height,
      setZoom(z) { this.zoom = z; return this; },
      setScroll(x, y) { this.scrollX = x; this.scrollY = y; return this; },
    });
    const scale = new EventEmitter(), events = new EventEmitter();
    const scene = { cameras: { main: camera }, scale, events };
    configureView(scene);
    for (const p of [{ x: 0, y: 0 }, { x: 640, y: 360 }, { x: 320, y: 180 }]) {
      const screen = project(p, camera);
      const point = viewPoint(screen);
      near(point.x, p.x); near(point.y, p.y);
      const x = screen.x * v.zoom + (w - v.width * v.zoom) / 2;
      const y = screen.y * v.zoom + (h - v.height * v.zoom) / 2;
      assert.ok(x >= safe.left - 1e-8 && x <= w - safe.right + 1e-8);
      assert.ok(y >= safe.top - 1e-8 && y <= h - safe.bottom + 1e-8);
    }
    events.emit('shutdown');
    assert.equal(scale.listenerCount('resize'), 0);
  }
  setViewLayout(fitView(640, 360, false));
});

test('旋转后 UI 相机重新定位，战斗相机不重置跟随位置，桌面仍为整数倍', () => {
  const scale = new EventEmitter(), events = new EventEmitter();
  const makeCamera = () => Object.assign(new EventEmitter(), {
    width: 640 * R, height: 360 * R, scrollX: 93, scrollY: 57,
    setZoom(z) { this.zoom = z; return this; },
    setScroll(x, y) { this.scrollX = x; this.scrollY = y; return this; },
  });
  const ui = makeCamera(), world = makeCamera();
  configureView({ cameras: { main: ui }, scale, events });
  configureView({ cameras: { main: world }, scale, events }, true);
  const v = fitView(852, 393, true, { ...plain, bottom: 21 });
  setViewLayout(v);
  for (const c of [ui, world]) { c.width = v.width; c.height = v.height; }
  scale.emit('resize');
  const middle = viewPoint(project({ x: 320, y: 180 }, ui));
  near(middle.x, 320); near(middle.y, 180);
  assert.deepEqual([world.scrollX, world.scrollY], [93, 57]);
  events.emit('shutdown');
  assert.equal(scale.listenerCount('resize'), 0);
  const desktop = fitView(1500, 900, false);
  assert.deepEqual([desktop.width, desktop.height, desktop.zoom], [640 * R, 360 * R, 2 / R]);
  const portrait = fitView(390, 844, true);
  assert.equal(portrait.width / portrait.height, 640 / 360);
  setViewLayout(fitView(640, 360, false));
});
