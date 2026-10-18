import Phaser from 'phaser';
import { buildFx } from '../../../src/art/fxArt';
import { buildEnemies } from '../../../src/art/enemyArt';
import { buildHeroXiao } from '../../../src/art/heroXiao';
import { ENEMIES } from '../../../src/config/enemies';

const ids = ['shiyong', 'tengguai', 'shuigui', 'huoya', 'tiejia', 'langyao'];
const roles = ['土 · 慢速重装', '木 · 再生围堵', '水 · 快速追击', '火 · 死亡自爆', '金 · 预警冲锋', '金 · 冲锋与环射'];
const assets = new Map<string, HTMLImageElement>();
await Promise.all(ids.flatMap(id => ['source96', 'native', '24', '32'].map(async size => {
  const img = new Image();
  img.src = `./level1-v1/${id}-${size}.png`;
  await img.decode();
  assets.set(`${id}-${size}`, img);
})));

new Phaser.Game({
  type: Phaser.CANVAS, width: 1, height: 1, parent: 'engine', audio: { noAudio: true },
  scene: { create() {
    buildFx(this); buildEnemies(this); buildHeroXiao(this);
    const old = new Map<string, HTMLCanvasElement>();
    const texture = (key: string, frame: string | number = 0) => {
      const f = this.textures.getFrame(key, frame);
      const c = document.createElement('canvas'); c.width = f.cutWidth; c.height = f.cutHeight;
      c.getContext('2d')!.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, c.width, c.height);
      return c;
    };
    ids.forEach(id => old.set(id, texture(ENEMIES[id].tex)));
    const ground = texture('ground_1'), hero = texture('hero_xiao');
    const gems = ['gem_s', 'gem_m', 'gem_l'].map(k => texture(k));
    const decor = ['dc_rock', 'dc_tuft', 'dc_deadtree', 'dc_tablet'].map(k => texture(k));
    const root = document.querySelector('#studies')!;
    const study = (image: HTMLImageElement | HTMLCanvasElement, factor: number, caption: string) => {
      const wrap = document.createElement('div'); wrap.className = 'study';
      const canvas = document.createElement('canvas'); canvas.width = image.width * factor; canvas.height = image.height * factor;
      const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      wrap.append(canvas);
      const text = document.createElement('div'); text.className = 'caption'; text.textContent = caption;
      return [wrap, text];
    };
    ids.forEach((id, i) => {
      const card = document.createElement('article'); card.className = 'monster';
      const title = document.createElement('h3'); title.textContent = ENEMIES[id].name;
      const role = document.createElement('small'); role.textContent = roles[i];
      card.append(title, role,
        ...study(assets.get(`${id}-source96`)!, 1, 'AI 原画 · 96px 母图'),
        ...study(old.get(id)!, id === 'langyao' ? 3 : 4, '当前程序画（游戏内）'),
        ...study(assets.get(`${id}-native`)!, id === 'langyao' ? 3 : 4, 'AI 试稿 · 当前尺寸'),
        ...study(assets.get(`${id}-${id === 'langyao' ? 'native' : '32'}`)!, id === 'langyao' ? 3 : 4, id === 'langyao' ? 'Boss 保持 56 × 48' : 'AI 试稿 · 32px 对照'));
      root.append(card);
    });
    let generated = true, zoom = 2;
    const canvas = document.querySelector<HTMLCanvasElement>('#crowd')!;
    const ctx = canvas.getContext('2d')!;
    const size = document.querySelector<HTMLSelectElement>('#size')!;
    const filter = document.querySelector<HTMLSelectElement>('#filter')!;
    const density = document.querySelector<HTMLSelectElement>('#density')!;
    function draw() {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 640, 360);
      ctx.fillStyle = ctx.createPattern(ground, 'repeat')!; ctx.fillRect(0, 0, 640, 360);
      for (let i = 0; i < 16; i++) ctx.drawImage(decor[i % 4], (i * 137) % 610, (i * 97) % 320);
      for (let i = 0; i < 24; i++) ctx.drawImage(gems[i % 3], 200 + (i * 53) % 240, 110 + (i * 37) % 140);
      const count = Number(density.value);
      const figures = Array.from({ length: count }, (_, i) => ({ id: ids[i % 5], x: 30 + (i * 157) % 580, y: 35 + (i * 97) % 295 }));
      figures.push({ id: 'langyao', x: 448, y: 226 });
      figures.sort((a, b) => a.y - b.y);
      for (const fig of figures) {
        const image = generated ? assets.get(`${fig.id}-${fig.id === 'langyao' ? 'native' : size.value}`)! : old.get(fig.id)!;
        const x = Math.round(fig.x - image.width / 2), y = Math.round(fig.y - image.height * .9);
        if (filter.value === 'silhouette') {
          const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
          const cctx = c.getContext('2d')!; cctx.drawImage(image, 0, 0); cctx.globalCompositeOperation = 'source-in'; cctx.fillStyle = '#171923'; cctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(c, x, y);
        } else ctx.drawImage(image, x, y);
      }
      ctx.drawImage(hero, 320 - hero.width / 2, 180 - hero.height * .9);
      canvas.style.width = `${640 * zoom}px`; canvas.style.height = `${360 * zoom}px`;
      canvas.style.filter = filter.value === 'silhouette' ? 'none' : filter.value;
    }
    document.querySelector<HTMLButtonElement>('#original')!.onclick = () => { generated = false; update(); };
    document.querySelector<HTMLButtonElement>('#generated')!.onclick = () => { generated = true; update(); };
    document.querySelector<HTMLButtonElement>('#zoom')!.onclick = () => { zoom = zoom === 2 ? 1 : 2; update(); };
    function update() {
      document.querySelector('#original')!.setAttribute('aria-pressed', String(!generated));
      document.querySelector('#generated')!.setAttribute('aria-pressed', String(generated));
      document.querySelector('#zoom')!.setAttribute('aria-pressed', String(zoom === 2));
      document.querySelector('#zoom')!.textContent = `显示 ${zoom}×`;
      draw();
    }
    [size, filter, density].forEach(el => el.onchange = draw);
    update();
  } },
});
