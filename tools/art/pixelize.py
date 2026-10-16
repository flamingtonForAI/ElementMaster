#!/usr/bin/env python3
"""
tools/art/pixelize.py
生图到真像素管线（参照 VibeValley 做法 + 五行师可读性约束）：
1. 支持单张远景图（--mode vista）或品红底素材表切图（--mode sheet）；
2. Box 平均下采样到目标真实像素尺寸（1 美术像素 = 1 画布像素）；
3. 去除品红（#FF00FF）溢色、硬 alpha 阈值化（无半透明毛边）；
4. 吸附到共享调色板（24 色基础仙侠角色色板 + 关卡专属扩展色，自动剔除与经验宝石撞色的高饱和亮色）；
5. 补 1px 上下分色外描边（selectiveOutline：受光顶面 #2c2238，背光底面 #1c1424）；
6. 记录每个切片的底部锚点（最低非透明行的水平中点）并输出 PNG 与 sprites.json。
"""

import argparse
import json
import math
from pathlib import Path
from PIL import Image

OUTLINE_TOP = (0x2C, 0x22, 0x38, 255)
OUTLINE_BOT = (0x1C, 0x14, 0x24, 255)

# 24 色基础角色/通用仙侠调色板 + 关卡沧桑岩石与苍竹色阶（严格避开 gem_s/gem_m/gem_l 高饱和亮色）
SHARED_PALETTE_HEX = [
    # 岩石与古碑（冷蓝灰暗部 -> 暖米灰高光）
    0x1E2230, 0x363D4F, 0x525C70, 0x788291, 0xA6ADBA, 0xDCD6C4,
    # 枯木、古道木料与土壤（紫褐暗部 -> 琥珀暖褐 -> 沙黄高光）
    0x2C1E26, 0x45302E, 0x634838, 0x87654D, 0xA88464, 0xD4B462,
    # 荒草与苍苔（深冷黛青 -> 苍翠墨绿 -> 橄榄暗黄绿，不含亮翠绿）
    0x142A2A, 0x1E3F38, 0x2E5946, 0x3E683E, 0x587C48, 0x749452,
    # 仙家建筑点缀（黛瓦蓝灰、暗朱砂、古铜金、暖白）
    0x262C40, 0x424E68, 0x6E2828, 0x9A3E32, 0xB88A44, 0xEAE2D0,
]

PALETTE_RGB = [((h >> 16) & 255, (h >> 8) & 255, h & 255) for h in SHARED_PALETTE_HEX]


def is_magenta(r: int, g: int, b: int, tol: int = 55) -> bool:
    return r >= 200 and b >= 200 and g <= tol and abs(r - b) <= 45


def despill_magenta(r: int, g: int, b: int) -> tuple[int, int, int]:
    """抑制边缘像素掺入的品红溢色"""
    if r > g + 35 and b > g + 35:
        excess = min(r - g, b - g) // 2
        r = max(0, r - excess)
        b = max(0, b - excess)
    return r, g, b


def nearest_palette_color(r: int, g: int, b: int, palette: list[tuple[int, int, int]]) -> tuple[int, int, int]:
    best = palette[0]
    best_d = 1e18
    for pr, pg, pb in palette:
        # 加权欧氏距离（人眼对绿色与明度更敏感）
        dr = r - pr
        dg = g - pg
        db = b - pb
        d = dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11
        if d < best_d:
            best_d = d
            best = (pr, pg, pb)
    return best


def selective_outline(img: Image.Image) -> Image.Image:
    w, h = img.size
    px = img.load()
    to_add: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0:
                continue
            has_neighbor = False
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 255:
                    has_neighbor = True
                    break
            if has_neighbor:
                to_add.append((x, y))
    for x, y in to_add:
        px[x, y] = OUTLINE_TOP if y < h * 0.42 else OUTLINE_BOT
    return img


def find_anchor(img: Image.Image) -> tuple[int, int]:
    w, h = img.size
    px = img.load()
    for y in range(h - 1, -1, -1):
        xs = [x for x in range(w) if px[x, y][3] > 0]
        if xs:
            return (round(sum(xs) / len(xs)), y)
    return (w // 2, h - 1)


def process_cell(
    cell: Image.Image,
    target_w: int,
    target_h: int,
    palette: list[tuple[int, int, int]] | None,
    add_outline: bool = True,
) -> Image.Image:
    rgba = cell.convert("RGBA")
    cw, ch = rgba.size
    cpx = rgba.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = cpx[x, y]
            if a < 128 or is_magenta(r, g, b):
                cpx[x, y] = (0, 0, 0, 0)
            else:
                r, g, b = despill_magenta(r, g, b)
                cpx[x, y] = (r, g, b, 255)

    # 留出 1px 描边安全边距后 Box 缩放到目标像素网格
    inner_w = max(1, target_w - (2 if add_outline else 0))
    inner_h = max(1, target_h - (2 if add_outline else 0))
    small = rgba.resize((inner_w, inner_h), Image.Resampling.BOX)

    out = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    ox = 1 if add_outline else 0
    oy = 1 if add_outline else 0
    spx = small.load()
    opx = out.load()
    for y in range(inner_h):
        for x in range(inner_w):
            r, g, b, a = spx[x, y]
            if a < 110:
                continue
            r, g, b = despill_magenta(r, g, b)
            if palette:
                r, g, b = nearest_palette_color(r, g, b, palette)
            opx[x + ox, y + oy] = (r, g, b, 255)

    if add_outline:
        selective_outline(out)
    return out


def regrade_vista_pixel(r: int, g: int, b: int, tod: str) -> tuple[int, int, int]:
    """基于傍晚基准图（vista_dusk），使用纯色彩空间连续映射（无任何 x/y 空间矩形边界裁切），
    确保四个时辰 100% 像素构图对齐且无任何分界接缝。"""
    if tod == "dusk":
        return r, g, b

    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    lum = 0.299 * rf + 0.587 * gf + 0.114 * bf
    # 晚霞暖度权重（天空橘粉云与晚霞渐变 r 明显高于 g/b，而青松/山石/瀑布不满足）
    warm_sky = max(0.0, min(1.0, (rf - bf) * 1.8)) * max(0.0, min(1.0, (lum - 0.18) * 2.2))
    # 暮色紫穹权重（顶部深紫蓝天空：r 与 b 均高于 g）
    violet_sky = max(0.0, min(1.0, min(rf - gf, bf - gf) * 4.5))

    if tod == "dawn":
        # 清晨：褪去暮紫，转为清透晨曦蓝紫与柔粉金朝霞，暗部崖壁保持深邃青黛
        sky_w = max(warm_sky, violet_sky)
        nr = rf * (0.86 + 0.08 * warm_sky) + bf * 0.12 + 0.03 * lum
        ng = gf * 1.06 + rf * 0.06 * warm_sky + bf * 0.10 * violet_sky + 0.04 * lum
        nb = bf * 1.22 + rf * 0.16 * sky_w + 0.05 * lum
        # 保持左侧深色崖壁与松竹剪影的低明度
        shadow_keep = min(1.0, lum * 2.6)
        nr = rf * (1 - shadow_keep) + nr * shadow_keep
        ng = gf * (1 - shadow_keep) + ng * shadow_keep
        nb = bf * (1 - shadow_keep) + nb * shadow_keep
        return (
            max(0, min(255, round(nr * 255))),
            max(0, min(255, round(ng * 255))),
            max(0, min(255, round(nb * 255))),
        )

    if tod == "day":
        # 白天：将紫穹与晚霞连续映射为晴空蔚蓝与白云，松林与山崖转为清新日光色
        sky_w = max(warm_sky, violet_sky)
        # 晴空目标色：随明度从蔚蓝 (0.28, 0.56, 0.88) 过渡到白云 (0.96, 0.98, 1.0)
        cloud_t = max(0.0, min(1.0, (lum - 0.45) / 0.42))
        sky_r = 0.26 + cloud_t * 0.70
        sky_g = 0.54 + cloud_t * 0.43
        sky_b = 0.86 + cloud_t * 0.14

        # 山体与林木日光目标色：去暖红偏色，增强翠绿与日光岩面
        land_r = rf * 0.90 + gf * 0.08
        land_g = gf * 1.14 + rf * 0.05
        land_b = bf * 1.16 + gf * 0.08

        nr = land_r * (1 - sky_w) + sky_r * sky_w
        ng = land_g * (1 - sky_w) + sky_g * sky_w
        nb = land_b * (1 - sky_w) + sky_b * sky_w

        # 暗部崖壁保持深青黛阴影，确保左侧菜单文字高对比度
        shadow_keep = min(1.0, lum * 2.5)
        nr = rf * 0.85 * (1 - shadow_keep) + nr * shadow_keep
        ng = gf * 0.95 * (1 - shadow_keep) + ng * shadow_keep
        nb = bf * 1.05 * (1 - shadow_keep) + nb * shadow_keep
        return (
            max(0, min(255, round(nr * 255))),
            max(0, min(255, round(ng * 255))),
            max(0, min(255, round(nb * 255))),
        )

    if tod == "night":
        # 夜里：深邃星夜靛蓝，唯独高饱和朱红灯笼与炉火保留温暖橘金光晕
        lantern_w = max(0.0, min(1.0, (rf - gf * 1.35) * 3.2)) * max(0.0, min(1.0, (0.55 - bf) * 3.0))
        night_r = (rf * 0.22 + gf * 0.10) * 0.85
        night_g = (gf * 0.42 + bf * 0.16) * 0.90
        night_b = min(0.82, bf * 0.68 + rf * 0.20 + 0.05 * lum)

        glow_r = min(1.0, rf * 1.10)
        glow_g = min(1.0, gf * 1.15 + 0.08)
        glow_b = bf * 0.75

        nr = night_r * (1 - lantern_w) + glow_r * lantern_w
        ng = night_g * (1 - lantern_w) + glow_g * lantern_w
        nb = night_b * (1 - lantern_w) + glow_b * lantern_w
        return (
            max(0, min(255, round(nr * 255))),
            max(0, min(255, round(ng * 255))),
            max(0, min(255, round(nb * 255))),
        )

    return r, g, b


def process_vista(src_path: Path, out_path: Path, w: int = 320, h: int = 180, colors: int = 64, tod: str = "dusk"):
    """将高分辨率仙侠远景图通过 Box 下采样到 320×180 真像素网格，按时辰调色、量化为 64 色并 2× 邻近放大为 640×360 PNG"""
    img = Image.open(src_path).convert("RGB")
    small = img.resize((w, h), Image.Resampling.BOX)
    spx = small.load()
    for y in range(h):
        for x in range(w):
            r, g, b = spx[x, y]
            spx[x, y] = regrade_vista_pixel(r, g, b, tod)
    # 夜里在深蓝天幕像素上点缀星辰
    if tod == "night":
        stars = [(98, 16), (124, 12), (156, 22), (188, 14), (218, 20), (242, 12), (112, 34), (172, 32), (232, 28)]
        for sx, sy in stars:
            spx[sx, sy] = (224, 238, 255)
    quant = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    upscaled = quant.convert("RGB").resize((w * 2, h * 2), Image.Resampling.NEAREST)
    final_p = upscaled.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    final_p.save(out_path, optimize=True)


def main():
    ap = argparse.ArgumentParser(description="Pixelize raw AI art into crisp game-ready pixel assets")
    ap.add_argument("--mode", choices=["vista", "sheet"], required=True)
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--tod", choices=["dawn", "day", "dusk", "night"], default="dusk")
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--target-w", type=int, default=24)
    ap.add_argument("--target-h", type=int, default=24)
    ap.add_argument("--colors", type=int, default=64)
    args = ap.parse_args()

    if args.mode == "vista":
        process_vista(args.input, args.output, colors=args.colors, tod=args.tod)
        print(f"Saved quantized vista ({args.tod}) to {args.output}")
    else:
        sheet = Image.open(args.input).convert("RGBA")
        sw, sh = sheet.size
        cw, ch = sw // args.cols, sh // args.rows
        args.output.mkdir(parents=True, exist_ok=True)
        meta = []
        idx = 0
        for r in range(args.rows):
            for c in range(args.cols):
                box = (c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)
                cell = sheet.crop(box)
                sprite = process_cell(cell, args.target_w, args.target_h, PALETTE_RGB, add_outline=True)
                ax, ay = find_anchor(sprite)
                name = f"sprite_{idx:02d}.png"
                sprite.save(args.output / name, optimize=True)
                meta.append({"index": idx, "file": name, "w": args.target_w, "h": args.target_h, "anchor": [ax, ay]})
                idx += 1
        with open(args.output / "sprites.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"Extracted {idx} sprites to {args.output}")


if __name__ == "__main__":
    main()
