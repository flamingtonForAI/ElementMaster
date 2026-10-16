#!/usr/bin/env python3
"""将 imagegen 肖像转为 88×112、32 色像素图；运行 python3 tools/art/pixelize_portraits.py。"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
IDS = ('xiao', 'zhu', 'ruan', 'qingdai', 'moheng', 'xuanyi')
OUT = ROOT / 'public/assets/portraits'
# 六人对照图只给人看，放在不进仓库的 reports 目录，不随游戏打包
REPORTS = ROOT / 'tools/art/reports'


def pixelize(name):
    image = Image.open(ROOT / f'tools/art/raw/portraits-v2/{name}.png').convert('RGB')
    # 原画已按像素色块设计；最近邻采样保留硬边，不再锐化制造碎点。
    image = ImageOps.fit(image, (88, 112), method=Image.Resampling.NEAREST)
    image = image.quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    assert image.size == (88, 112) and len(image.getcolors()) <= 32
    image.save(OUT / f'{name}.png', optimize=True)
    return image.convert('RGB')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGB', (88 * len(IDS), 112))
    for i, name in enumerate(IDS):
        preview.paste(pixelize(name), (i * 88, 0))
    preview.resize((88 * len(IDS) * 3, 112 * 3), Image.Resampling.NEAREST).save(REPORTS / 'portraits_preview.png')
    print('Saved six 88×112 portraits; preview at tools/art/reports/portraits_preview.png')
