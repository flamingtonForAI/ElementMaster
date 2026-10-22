#!/usr/bin/env python3
"""Convert an imagegen monster sheet; no creature geometry is drawn in code.

python3 tools/art/pixelize_enemies.py
Requires Pillow. Keeps source art and exports a 384×256 low-res master,
24/28/32px studies, current-size sprites, and explicit contact anchors.
"""
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pixelize import nearest_palette_color, selective_outline

ROOT = Path(__file__).resolve().parent / 'enemies/level1-v1'
IDS = ['shiyong', 'tengguai', 'shuigui', 'huoya', 'tiejia', 'langyao']
NAMES = ['石俑', '藤怪', '水鬼', '火鸦', '铁甲兵', '狼妖']
NATIVE = [(24, 24)] * 4 + [(28, 28), (56, 48)]
# Shared monster colors, deliberately separate from the subdued scenery palette.
PALETTE_HEX = [
    '1c1424', '2c2238', '443245', '665260',
    '543846', '805440', 'aa754a', 'd59b56', 'efc47d', 'ffe0a3',
    '1e3536', '304e42', '4f7045', '75904e', 'a6b66b', 'd8dda0',
    '182638', '2b3d60', '3b5b81', '5885a1', '83b5c3', 'c2e2e2',
    '412338', '73313e', 'b74436', 'e76a32', 'ffa347', 'ffe69b',
    '313848', '525c71', '78839a', 'a6afbb', 'd8d9cf', 'f5ead8',
    '6a332d', '9e4335', 'cb5a3e', 'e08760',
]
PALETTE = [tuple(bytes.fromhex(h)) for h in PALETTE_HEX]
# Source paintings have illustration-level shadows; lift midtones before
# palette snapping so the tiny sprites stay legible on the actual game floor.
MIDTONE_GAMMA = 0.55


def extract_subjects(source, columns=3, rows=2):
    """Find alpha-connected subjects: imagegen grids are not exact crop guides."""
    w, h = source.size
    alpha = source.getchannel('A').tobytes()
    seen = bytearray(w * h)
    components = []
    for start, a in enumerate(alpha):
        if a < 128 or seen[start]:
            continue
        seen[start] = 1
        queue = deque([start])
        points = []
        while queue:
            i = queue.popleft()
            points.append(i)
            x, y = i % w, i // w
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    j = yy * w + xx
                    if not seen[j] and alpha[j] >= 128:
                        seen[j] = 1
                        queue.append(j)
        if len(points) > w * h * .03 / (columns * rows):
            components.append(points)
    if len(components) != columns * rows:
        raise ValueError(f'Expected {columns * rows} separate subjects; got {len(components)}. Inspect source before cropping.')
    ordered = {}
    for points in components:
        xs, ys = [i % w for i in points], [i // w for i in points]
        col = min(columns - 1, int(sum(xs) / len(xs) / w * columns))
        row = min(rows - 1, int(sum(ys) / len(ys) / h * rows))
        slot = row * columns + col
        if slot in ordered:
            raise ValueError('Two subjects occupy the same grid slot.')
        bounds = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        mask = Image.new('L', source.size)
        data = bytearray(w * h)
        for i in points:
            data[i] = 255
        mask.frombytes(bytes(data))
        cut = source.copy()
        cut.putalpha(mask)
        ordered[slot] = (cut.crop(bounds), bounds)
    return [ordered[i] for i in range(columns * rows)]


def fit(source, size, padding=0):
    """Preserve aspect, premultiplied-alpha box reduction, bottom align."""
    w, h = size
    ratio = min((w - padding * 2) / source.width, (h - padding * 2) / source.height)
    dims = (max(1, round(source.width * ratio)), max(1, round(source.height * ratio)))
    small = source.convert('RGBa').resize(dims, Image.Resampling.BOX).convert('RGBA')
    out = Image.new('RGBA', size)
    out.paste(small, ((w - small.width) // 2, h - padding - small.height))
    return out


def pixelize(source, size):
    out = fit(source, size, padding=2)
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            r, g, b = (round(255 * (v / 255) ** MIDTONE_GAMMA) for v in (r, g, b))
            px[x, y] = (*nearest_palette_color(r, g, b, PALETTE), 255) if a >= 110 else (0, 0, 0, 0)
    # Downsampled wisps can become isolated dots. Remove tiny alpha islands
    # before outlining; otherwise each dot grows into a distracting cross.
    seen = set()
    for y in range(out.height):
        for x in range(out.width):
            if not px[x, y][3] or (x, y) in seen:
                continue
            queue = [(x, y)]
            seen.add((x, y))
            island = []
            while queue:
                xx, yy = queue.pop()
                island.append((xx, yy))
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    nx, ny = xx + dx, yy + dy
                    if 0 <= nx < out.width and 0 <= ny < out.height and px[nx, ny][3] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            if len(island) <= 2:
                for point in island:
                    px[point] = (0, 0, 0, 0)
    return selective_outline(out)


def save_indexed(img, path):
    """Lossless index assignment, one transparent index; no dithering."""
    raw = img.tobytes()
    pixels = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    colors = sorted({p[:3] for p in pixels if p[3]})
    if len(colors) > 255:
        raise ValueError('Too many colors for an indexed sprite')
    lookup = {c: i + 1 for i, c in enumerate(colors)}
    out = Image.new('P', img.size)
    pal = [0, 0, 0] + [v for c in colors for v in c]
    out.putpalette(pal + [0] * (768 - len(pal)))
    out.putdata([lookup[p[:3]] if p[3] else 0 for p in pixels])
    out.save(path, transparency=0, optimize=True)
    return len(colors)


def comparison_sheet():
    """Lay out existing bitmaps and labels; never draw monster shapes."""
    font_path = next((p for p in [Path('/System/Library/Fonts/STHeiti Light.ttc'), Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()), None)
    def font(size):
        return ImageFont.truetype(str(font_path), size) if font_path else ImageFont.load_default(size=size)
    sheet = Image.new('RGB', (1368, 858), '#1c2326')
    draw = ImageDraw.Draw(sheet)
    draw.text((30, 20), '荒郊古道 / 六怪造型与像素化' if font_path else 'OLD ROAD / ENEMY ART STUDY', font=font(30), fill='#f0e6d5')
    draw.text((30, 67), '原画生成 → 96px 母图 → 共享色板 / 中间色提亮 / 硬透明边缘' if font_path else 'Generated art > 96px source > shared palette / midtones / hard alpha', font=font(17), fill='#c0c6bd')
    labels = ['低分辨率原图', '游戏当前尺寸 · 放大检查', '32px 对照 · 放大检查', '当前尺寸 · 1:1'] if font_path else ['96px SOURCE', 'NATIVE SIZE / ENLARGED', '32px STUDY / ENLARGED', 'NATIVE SIZE / 1:1']
    for label, y in zip(labels, [145, 366, 582, 797]):
        draw.text((30, y), label, font=font(16), fill='#d4ad72')
    for i, ident in enumerate(IDS):
        cx = 114 + i * 228
        draw.text((cx, 115), NAMES[i] if font_path else ident, anchor='mm', font=font(22), fill='#eee8d9')
        for variant, cy, factor in [('source96', 263, 2), ('native', 479, 3 if i == 5 else 5), ('native' if i == 5 else '32', 690, 3 if i == 5 else 5), ('native', 831, 1)]:
            image = Image.open(ROOT / f'{ident}-{variant}.png').convert('RGBA')
            image = image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)
            sheet.paste(image, (cx - image.width // 2, cy - image.height // 2), image)
    sheet.save(ROOT / 'comparison.png', optimize=True)


def main():
    source = Image.open(ROOT / 'source.png').convert('RGBA')
    subjects = extract_subjects(source)
    master = Image.new('RGBA', (384, 256))
    manifest = {'status': '静态造型试稿；未替换正式战斗动画', 'palette': PALETTE_HEX, 'midtoneGamma': MIDTONE_GAMMA, 'sprites': []}
    for i, (subject, bounds) in enumerate(subjects):
        low = fit(subject, (96, 96), padding=2)
        low.save(ROOT / f'{IDS[i]}-source96.png', optimize=True)
        master.alpha_composite(low, ((i % 3) * 128 + 16, (i // 3) * 128 + 16))
        sizes = {str(n): (n, n) for n in (24, 28, 32)}
        sizes['native'] = NATIVE[i]
        item = {'id': IDS[i], 'name': NAMES[i], 'sourceBounds': bounds, 'variants': {}}
        for label, size in sizes.items():
            # Every final version is derived from the low-res image, not drawn.
            sprite = pixelize(low.crop(low.getbbox()), size)
            filename = f'{IDS[i]}-{label}.png'
            count = save_indexed(sprite, ROOT / filename)
            bbox = sprite.getbbox()
            item['variants'][label] = {
                'file': filename, 'width': size[0], 'height': size[1], 'colors': count,
                'bounds': bbox, 'contactAnchor': [size[0] // 2, bbox[3] - 1],
            }
            assert set(sprite.getchannel('A').tobytes()) <= {0, 255}
        manifest['sprites'].append(item)
    master.save(ROOT / 'source-lowres.png', optimize=True)
    (ROOT / 'sprites.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    comparison_sheet()
    print(json.dumps({'subjects': 6, 'lowResMaster': list(master.size), 'paletteColors': len(PALETTE), 'output': str(ROOT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
