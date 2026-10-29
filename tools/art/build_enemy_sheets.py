#!/usr/bin/env python3
"""Pixelize the approved level 2–10 paintings into runtime PNG animation sheets.

Requires Pillow. No monster geometry is drawn: movement comes from generated
articulated pose sheets, with shared scale and anchors across each cycle.
Run: python3 tools/art/build_enemy_sheets.py (level 7–10 concepts live in output/enemy-concepts-2026-10-21)
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from pixelize import nearest_palette_color, selective_outline
from pixelize_enemies import PALETTE_HEX, extract_subjects, fit, save_indexed

ROOT = Path(__file__).resolve().parents[2]
STUDY = ROOT / 'tools/art/enemies/later-levels-v1'
SOURCES = STUDY / 'source96'
OUTPUT = ROOT / 'public/assets/enemies'
CONCEPTS = ROOT / 'output/enemy-concepts-2026-10-20'
# 第 7–10 关的新怪：两张概念图，A 冰蚕至旱魃，B 旱魃火相至帝江
LATE = ROOT / 'output/enemy-concepts-2026-10-21'
# 九婴第一版只有 8 个头，10-22 单独重画（'j'，2 列 1 行：水相、火相），动作也单独出一张（2 行 × 4 帧）
# 第 1 关（'l1'，3 列 2 行：石俑、藤怪、水鬼、火鸦、狼妖、石傀儡）10-22 补画，和后几关同一画风；动作原画 source-7.png（6 行 × 4 帧）
CONCEPT_FILES = {**{n: CONCEPTS / f'level-{n}-source.png' for n in range(2, 7)}, 'a': LATE / 'sheet-a-alpha.png', 'b': LATE / 'sheet-b.png',
                 'j': ROOT / 'output/enemy-concepts-2026-10-22/jiuying-v2.png', 'l1': ROOT / 'output/enemy-concepts-2026-10-22/level1/level-1-source.png'}
CONCEPT_GRID = {'j': (2, 1)}
# 动作原画默认按 SPECS 每 6 只一张 source-N.png（4 列 6 行）；这里列出单独出图的：key → (文件, 行, 列数, 行数)
MOTION_OVERRIDES = {'boss_jiuying': ('source-jiuying.png', 0, 4, 2), 'boss_jiuying_fire': ('source-jiuying.png', 1, 4, 2),
                    **{k: ('source-7.png', i, 4, 6) for i, k in enumerate(['en_shiyong', 'en_tengguai', 'en_shuigui', 'en_huoya', 'boss_langyao'])}}
# 墨衡的召唤物：概念图 'l1' 第 6 格，走路是 source-7.png 第 6 行，拍地另出一张 source-puppet-atk.png（4 列 1 行）。
# 两种体型同一套姿势、各自缩放；身体保持浅灰白，运行时按五行染色，脚下金环在 puppetArt 里叠
# 举拳过顶那帧最高，画布往上留空
PUPPETS = [('pp_golem', '石傀儡', 28, 38), ('pp_giant', '巨傀', 52, 68)]
PUPPET_OUTPUT = ROOT / 'public/assets/puppets'
MOTION = STUDY / 'motion-v2'
REFINED = ROOT / 'tools/art/enemies/boss-refine-2026-10-28'
REFINED_BOSSES = {'boss_langyao', 'boss_bifang'}
# key, Chinese name, approved sheet/slot, frame size, special-state profile.
SPECS = [
    ('en_zhushe', '竹叶青', 2, 0, 32, 32, 'sway'),
    ('en_zhangchan', '瘴蟾', 2, 1, 32, 32, 'toad'),
    ('en_tengguai_grove', '藤怪·林泽', 2, 2, 32, 32, 'sway'),
    ('en_shiyong_moss', '苔封石俑', 2, 3, 32, 32, 'step'),
    ('boss_shuyao', '千年树妖', 2, 4, 64, 64, 'sway'),
    ('en_shiyong_rock', '山岩石俑', 3, 0, 32, 32, 'step'),
    ('en_shanxiao', '山魈', 3, 1, 32, 32, 'step'),
    ('en_chuanshan', '穿山甲', 3, 2, 32, 32, 'burrow'),
    ('boss_shanxiao', '山魈王', 3, 5, 56, 48, 'heavy'),
    ('en_huoya_ember', '火鸦·赤焰', 4, 0, 32, 32, 'hover'),
    ('en_chihu', '赤狐', 4, 1, 32, 32, 'step'),
    ('en_huojing', '火精', 4, 2, 32, 32, 'hover'),
    ('en_shiyong_lava', '熔壳石俑', 4, 3, 32, 32, 'step'),
    ('boss_bifang', '毕方', 4, 4, 72, 64, 'hover'),
    ('en_canbing', '残兵', 5, 0, 32, 32, 'corpse'),
    # 铁甲兵横端长枪、比常人宽，放宽画布让身高和残兵、石俑一致；第 1 关起全游戏共用这一版
    ('en_tiejia', '铁甲兵', 5, 1, 40, 34, 'step'),
    ('en_feilian', '飞镰', 5, 2, 32, 32, 'hover'),
    ('en_shiyong_armor', '残甲石俑', 5, 3, 32, 32, 'step'),
    ('en_chuanshan_armor', '穿山甲·兵冢', 5, 4, 32, 32, 'burrow'),
    ('boss_xingtian', '刑天', 5, 5, 56, 56, 'heavy'),
    ('en_shuigui_marsh', '水鬼·云梦', 6, 0, 32, 32, 'hover'),
    ('en_yuyao', '鱼妖', 6, 1, 32, 32, 'hover'),
    ('en_jiao', '蛟', 6, 2, 32, 32, 'sway'),
    ('boss_xiangliu', '相柳', 6, 5, 56, 56, 'sway'),
    ('en_bingcan', '冰蚕', 'a', 0, 32, 32, 'sway'),
    ('en_aoxie', '铁螯蟹', 'a', 1, 32, 32, 'step'),
    ('boss_xuanming', '玄冥', 'a', 2, 72, 72, 'hover'),
    ('en_shaxie', '沙蝎', 'a', 3, 32, 32, 'step'),
    ('en_jinqiang', '金蜣', 'a', 4, 32, 32, 'step'),
    ('boss_hanba', '旱魃', 'a', 5, 60, 72, 'heavy'),
    ('boss_hanba_fire', '旱魃·火', 'b', 0, 60, 72, 'heavy'),
    ('en_yecha', '夜叉', 'b', 1, 32, 32, 'step'),
    ('en_yanshao', '焰蛸', 'b', 2, 32, 32, 'sway'),
    ('boss_jiuying', '九婴', 'j', 0, 80, 80, 'sway'),
    ('boss_jiuying_fire', '九婴·火', 'j', 1, 80, 80, 'sway'),
    ('boss_dijiang', '帝江', 'b', 5, 88, 88, 'hover'),
    ('en_shiyong', '石俑', 'l1', 0, 32, 32, 'step'),
    ('en_tengguai', '藤怪', 'l1', 1, 32, 32, 'sway'),
    ('en_shuigui', '水鬼', 'l1', 2, 32, 32, 'hover'),
    ('en_huoya', '火鸦', 'l1', 3, 32, 32, 'hover'),
    ('boss_langyao', '狼妖', 'l1', 4, 64, 48, 'heavy'),
]
# 第 7–10 关 Boss 逐关加大（72 → 88），和前几关拉开；帝江五相：金、水、木、火从土相（黄囊）的四帧换色得到，动作和土相完全一致
DIJIANG_HUES = {'boss_dijiang_metal': None, 'boss_dijiang_water': .58, 'boss_dijiang_wood': .33, 'boss_dijiang_fire': .01}
# The existing shared palette plus the approved jade/ice/eye colour ramps.
COLORS = PALETTE_HEX + ['28694a', '438c54', '73b964', 'aad984',
                        'f8c640', 'fff1b0', '427ca9', '74acdb', 'd7eff5']
PALETTE = [tuple(bytes.fromhex(h)) for h in COLORS]
# 狼妖只保留银鬃、冷影、赤结、爪子的必要色阶，避免缩图后重新长出碎色。
WOLF_PALETTE = [tuple(bytes.fromhex(h)) for h in [
    '1c1424', '2c2238', '313848', '525c71', '78839a', 'a6afbb', 'd8d9cf', 'f5ead8',
    '412338', '73313e', 'b74436', 'e76a32', 'ffe0a3', '543846', '805440', 'aa754a',
]]
# 个别怪的中间调额外提亮（默认 0.8）：铁甲兵钢甲、藤怪暗绿藤、水鬼深蓝发偏暗，第 1 关地面上明度拉不开
LIFT = {'en_tiejia': .55, 'en_tengguai': .7, 'en_shuigui': .6}

# Four articulated phases at the cadence of the original two-frame cycles.
MOVE_RATES = {
    'en_zhushe': 8, 'en_zhangchan': 6, 'en_tengguai_grove': 8,
    'boss_shuyao': 4, 'en_shanxiao': 8, 'en_chuanshan': 10,
    'boss_shanxiao': 8, 'en_huoya_ember': 12, 'en_chihu': 12,
    'en_huojing': 8, 'boss_bifang': 10, 'en_canbing': 7,
    'en_tiejia': 9, 'en_feilian': 6, 'en_chuanshan_armor': 10,
    'boss_xingtian': 7, 'en_shuigui_marsh': 6, 'en_yuyao': 8,
    'en_jiao': 10, 'boss_xiangliu': 6,
    'en_bingcan': 6, 'en_aoxie': 10, 'boss_xuanming': 8, 'en_shaxie': 10, 'en_jinqiang': 10,
    'boss_hanba': 7, 'boss_hanba_fire': 8, 'en_yecha': 9, 'en_yanshao': 7,
    'boss_jiuying': 6, 'boss_jiuying_fire': 6, 'boss_dijiang': 8,
    'en_shiyong': 6, 'en_tengguai': 7, 'en_shuigui': 6, 'en_huoya': 10, 'boss_langyao': 8,
}


def prepare_motion_sources():
    """Cut isolated poses, using one scale per creature (never fit each pose)."""
    dest = MOTION / 'source96'
    dest.mkdir(exist_ok=True)
    cache = {}

    def subjects(name, cols, rows):
        if name not in cache:
            cache[name] = extract_subjects(Image.open(MOTION / name).convert('RGBA'), cols, rows)
        return cache[name]

    for index, (key, _, _, _, w, h, _) in enumerate(SPECS):
        if key in REFINED_BOSSES:
            continue  # 这两只从原稿一次缩到最终尺寸，不经过 96px 中间图。
        name, row, cols, rows = MOTION_OVERRIDES.get(key, (f'source-{index // 6 + 1}.png', index % 6, 4, 6))
        poses = [subjects(name, cols, rows)[row * cols + i][0] for i in range(4)]
        hop = [0, 1, 3, 0] if key == 'en_zhangchan' else [0] * 4
        save_poses(poses, w, h, hop, dest / f'{key}.png')
    # 傀儡：走路 4 帧 + 拍地 4 帧，共用一个缩放
    walk = [subjects('source-7.png', 4, 6)[5 * 4 + i][0] for i in range(4)]
    atk = [s[0] for s in subjects('source-puppet-atk.png', 4, 1)]
    # 拍地那张画得大：按收势站姿和走路站姿的身高对齐
    k = walk[0].height / atk[3].height
    poses = walk + [a.resize((round(a.width * k), round(a.height * k)), Image.Resampling.LANCZOS) for a in atk]
    for key, _, w, h in PUPPETS:
        save_poses(poses, w, h, [0] * len(poses), dest / f'{key}.png')


def save_poses(poses, w, h, hop, path):
    max_w = max(p.width for p in poses)
    max_h = max(p.height for p in poses)
    ratio = min((w - 4) / max_w, (h - 6 - max(hop)) / max_h)
    # Use the same 96px canvas mapping for every pose and a shared floor.
    sheet = Image.new('RGBA', (96 * len(poses), 96))
    for i, pose in enumerate(poses):
        pw, ph = round(pose.width * ratio * 96 / w), round(pose.height * ratio * 96 / h)
        scaled = pose.convert('RGBa').resize((pw, ph), Image.Resampling.BOX).convert('RGBA')
        x = (96 - pw) // 2
        y = round((h * .9 - 1 - hop[i]) * 96 / h) - ph
        sheet.paste(scaled, (i * 96 + x, y))
    sheet.save(path)


def source_images():
    SOURCES.mkdir(parents=True, exist_ok=True)
    prompts = {}
    for level in range(2, 7):
        path = CONCEPTS / f'level-{level}-source.png'
        if path.exists():
            prompts[str(level)] = Image.open(path).info.get('prompt', '')
    if prompts:
        (STUDY / 'prompts.json').write_text(json.dumps({'mode': 'built-in imagegen', 'prompts': prompts}, ensure_ascii=False, indent=2) + '\n')
    sheets = {}
    for key, _, level, slot, *_ in SPECS:
        path = SOURCES / f'{key}.png'
        if path.exists():
            continue
        if level not in sheets:
            sheets[level] = extract_subjects(Image.open(CONCEPT_FILES[level]).convert('RGBA'), *CONCEPT_GRID.get(level, (3, 2)))
        fit(sheets[level][slot][0], (96, 96), 2).save(path)
    puff = SOURCES / 'en_zhangchan-puff.png'
    if not puff.exists():
        if 2 not in sheets:
            sheets[2] = extract_subjects(Image.open(CONCEPTS / 'level-2-source.png').convert('RGBA'))
        fit(sheets[2][5][0], (96, 96), 2).save(puff)


def body(source, size):
    """Reduce the painting first; palette snapping cannot invent new anatomy."""
    w, h = size
    out = fit(source.crop(source.getbbox()), (w, h - 2), padding=3)
    frame = Image.new('RGBA', size)
    frame.paste(out, (0, 0))
    return palette_snap(frame)


def palette_snap(frame, lift=.8, palette=PALETTE):
    px = frame.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = px[x, y]
            # Keep ink dark; gently lift painted midtones for the dark floors.
            if max(r, g, b) > 64:
                r, g, b = (round(255 * (c / 255) ** lift) for c in (r, g, b))
            px[x, y] = (*nearest_palette_color(r, g, b, palette), 255) if a >= 110 else (0, 0, 0, 0)
    return frame


def refined_boss_frames(key, size):
    """一次采样；飞鸟锁定颈胸，走兽保持落脚基准。只改变这两只的导出。"""
    w, h = size
    if key == 'boss_langyao':
        subjects = extract_subjects(Image.open(REFINED / 'wolf-source.png').convert('RGBA'), 2, 2)
        poses = [p for p, _ in subjects]
        # 每帧共用比例；尾巴和爪子完整保留，两侧留描边安全距离。
        ratio = min((w - 6) / max(p.width for p in poses), (h * .9 - 4) / max(p.height for p in poses))
        anchors = [(p.width / 2, p.height) for p in poses]
        target = (w / 2, round(h * .9) - 1)
        palette, lift = WOLF_PALETTE, 1
    else:
        subjects = extract_subjects(Image.open(MOTION / 'source-3.png').convert('RGBA'), 4, 6)[4:8]
        poses = [p for p, _ in subjects]
        anchors = []
        for pose in poses:
            # 毕方不动的奶白颈胸与红翅、青羽分离，使用其重心校准拍翼。
            points = [(x, y) for y in range(pose.height) for x in range(pose.width)
                      if (lambda c: c[3] >= 128 and min(c[:3]) > 110 and c[0] > 140
                          and c[1] > 140 and abs(c[0] - c[1]) < 45 and c[0] >= c[2])(pose.getpixel((x, y)))]
            if not points:
                raise ValueError('毕方原稿缺少浅色颈胸，需重新校准锚点')
            anchors.append(tuple(sum(p[i] for p in points) / len(points) for i in (0, 1)))
        target = (round(w * .6), round(h * .375))
        # 所有帧一起计算可用空间，预留透明边和 1px 描边；脚落在既有 0.9 原点附近。
        ratio = min(min((target[0] - 3) / ax, (w - 3 - target[0]) / (p.width - ax),
                        (target[1] - 3) / ay, (round(h * .9) - 2 - target[1]) / (p.height - ay))
                    for p, (ax, ay) in zip(poses, anchors))
        palette, lift = PALETTE, .8
    frames = []
    for pose, (ax, ay) in zip(poses, anchors):
        dims = (round(pose.width * ratio), round(pose.height * ratio))
        small = pose.convert('RGBa').resize(dims, Image.Resampling.BOX).convert('RGBA')
        frame = Image.new('RGBA', size)
        frame.paste(small, (round(target[0] - ax * ratio), round(target[1] - ay * ratio)))
        frames.append(selective_outline(palette_snap(frame, lift, palette)))
    return frames


def pose_frames(key, size):
    if key in REFINED_BOSSES:
        return refined_boss_frames(key, size)
    poses = Image.open(MOTION / 'source96' / f'{key}.png').convert('RGBA')
    return [selective_outline(palette_snap(poses.crop((i * 96, 0, (i + 1) * 96, 96)).convert('RGBa').resize(size, Image.Resampling.BOX).convert('RGBA'), LIFT.get(key, .8))) for i in range(poses.width // 96)]


def make_frames(key, size, mode):
    src = Image.open(SOURCES / f'{key}.png').convert('RGBA')
    base = body(src, size)
    frames = pose_frames(key, size)
    if mode == 'burrow':
        for i in (2, 3):
            old = Image.open(STUDY / f'reference/en_chuanshan-{i}.png').convert('RGBA')
            dst = Image.new('RGBA', size)
            dst.paste(old, ((size[0] - old.width) // 2, round((size[1] - old.height) * .9)))
            # The old mound has a translucent element ring; preserve silhouette,
            # but keep the production PNG entirely on the same hard-alpha grid.
            dst.putalpha(dst.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
            frames.insert(i, dst)
    elif mode == 'corpse':
        # Collapse the new soldier painting instead of reverting to the old body.
        fallen = base.crop(base.getbbox()).rotate(82, resample=Image.Resampling.NEAREST, expand=True)
        fallen = fallen.resize((min(size[0] - 4, fallen.width), 10), Image.Resampling.NEAREST)
        dst = Image.new('RGBA', size)
        dst.paste(fallen, (2, round(size[1] * .9) - fallen.height))
        frames.insert(2, selective_outline(dst))
    return frames


def recolor(frame, hue):
    """帝江换相：只动黄囊本体（暖黄、橙），描边和腹下丹红不动；hue 为 None 时褪成冷银"""
    import colorsys
    out = frame.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if not (.09 <= h <= .17 and s > .35):
                continue
            if hue is None:
                # 金相：冷银
                h, s = .6, min(.14, s * .2)
            elif hue < .05:
                # 火相：比土相的暖黄深一截的赤红
                h, s, v = hue, min(1, s * 1.15), v * .88
            else:
                h = hue
            px[x, y] = (*(round(c * 255) for c in colorsys.hsv_to_rgb(h, s, v)), a)
    # 帧已经描过边，换色后只重新吸附色板
    return palette_snap(out)


def preview(items):
    font = next((str(p) for p in [Path('/System/Library/Fonts/STHeiti Light.ttc'), Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')] if p.exists()), None)
    title = ImageFont.truetype(font, 28) if font else ImageFont.load_default(size=28)
    small = ImageFont.truetype(font, 18) if font else ImageFont.load_default(size=18)
    canvas = Image.new('RGB', (1440, 300 * ((len(items) + 5) // 6) + 130), '#1c2326')
    d = ImageDraw.Draw(canvas)
    d.text((28, 20), '五行师 / 已接入的像素怪物', font=title, fill='#f0e6d5')
    d.text((28, 62), '原画切片 → 96px 母图 → 共享色板、硬透明 PNG；统一 3× 放大', font=small, fill='#b6c4c0')
    for i, (name, frame) in enumerate(items):
        x, y = (i % 6) * 240 + 120, (i // 6) * 300 + 120
        enlarged = frame.resize((frame.width * 3, frame.height * 3), Image.Resampling.NEAREST)
        canvas.paste(enlarged, (x - enlarged.width // 2, y + 230 - enlarged.height), enlarged)
        d.text((x, y + 252), name, font=small, fill='#e9e1d0', anchor='mm')
    canvas.save(STUDY / 'contact-sheet.png')


def main():
    source_images()
    prepare_motion_sources()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    items = []
    for key, name, level, slot, w, h, motion in SPECS:
        frames = make_frames(key, (w, h), motion)
        count = len(frames)
        sheet = Image.new('RGBA', (w * count, h))
        for i, frame in enumerate(frames):
            assert set(frame.getchannel('A').tobytes()) <= {0, 255}
            assert frame.getbbox() is not None
            sheet.paste(frame, (w * i, 0))
        colors = save_indexed(sheet, OUTPUT / f'{key}.png')
        move = [0, 1, 4, 5] if motion == 'burrow' else [0, 1, 3, 4] if motion == 'corpse' else [0, 1, 2, 3]
        manifest[key] = {'width': w, 'height': h, 'frames': count, 'move': move, 'rate': MOVE_RATES.get(key, 8), 'grounded': motion != 'hover'}
        items.append((name, frames[0]))
        print(f'{key}: {w}x{h}, {count} frames, {colors} colours')
        if key == 'boss_dijiang':
            for alt, hue in DIJIANG_HUES.items():
                alt_sheet = Image.new('RGBA', (w * count, h))
                for i, frame in enumerate(frames):
                    alt_sheet.paste(recolor(frame, hue), (w * i, 0))
                save_indexed(alt_sheet, OUTPUT / f'{alt}.png')
                manifest[alt] = dict(manifest[key])
    (ROOT / 'src/art/enemySheets.json').write_text(json.dumps(manifest, indent=2) + '\n')
    PUPPET_OUTPUT.mkdir(parents=True, exist_ok=True)
    puppets = {}
    for key, name, w, h in PUPPETS:
        frames = pose_frames(key, (w, h))
        sheet = Image.new('RGBA', (w * len(frames), h))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (w * i, 0))
        save_indexed(sheet, PUPPET_OUTPUT / f'{key}.png')
        puppets[key] = {'width': w, 'height': h, 'frames': len(frames)}
        items.append((name, frames[0]))
        print(f'{key}: {w}x{h}, {len(frames)} frames')
    (ROOT / 'src/art/puppetSheets.json').write_text(json.dumps(puppets, indent=2) + '\n')
    (STUDY / 'palette.json').write_text(json.dumps(COLORS) + '\n')
    preview(items)
    print(f'Saved {len(items)} sheets, {sum(p.stat().st_size for p in OUTPUT.glob("*.png"))} bytes')


if __name__ == '__main__':
    main()
