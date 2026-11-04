#!/usr/bin/env python3
"""从 design/logo/emo-logo-new-src.png 生成 App 内 logo 与 Android 启动图标。

为什么不能直接缩放原图：
原图是 RGB 且「圆角方块」外是纯黑，直接缩小会把黑角带进图标里，
所以在缩放的同时按方块的真实几何边界生成圆角遮罩，把外部抠成透明。

原图实测（1254x1254）：
- 方块边界：x 8..1245，y 约 -1..1238（上边缘被裁掉约 1px，可忽略）
- 四角圆弧拟合半径 ≈ 303px，边长 1238px → 约 24.5%（视觉上的「≈22%」偏小）

霓虹描边（2026-11 第二轮修复）：
原图那圈边缘渐变辉光缩到 48~192dp 后基本看不见，加上系统 mask 还会裁/缩自适应前景，
真机桌面只剩「深色圆角方块 + 霓虹横条」。这里在生成时**主动沿图标边缘画一圈明显的
紫→粉渐变描边 + 内发光**（颜色取自原图/指定色：左上 #6D28D9~#8B5CF6、右下 #EC4899~#F472B6），
核心亮边长约图标 1.6%、连内发光约 7%，保证各尺寸都能看到颜色边。
关键：Android 自适应图标 **108dp 画布只有中心 72dp 可见**（其余 18dp×2 被系统用于遮罩/视差），
所以「logo 占图标 92~96%」必须按可见区换算：72/108 × 0.95 ≈ 0.63，即 logo（连同描边）
只占画布 63%，落在中心 72dp 可视区内；之前直接铺满 108dp 画布，描边必然被裁掉。
- 自适应前景：透明画布，logo/描边位于中心可视区，画布外圈透明、由 @color/ic_launcher_background 兜底；
- 传统 mipmap 方形/圆形：同样带描边，圆形裁切时描边跟随圆边；
- App 内 256 logo：同步加强描边，圆角外仍透明。

用法：
    python3 design/logo/generate-icons.py                  # 生成 + 边缘采样自检
    python3 design/logo/generate-icons.py preview.png      # 额外输出预览拼图
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/logo/emo-logo-new-src.png'
APP_LOGO = ROOT / 'src/resources/images/emo-logo.png'
RES = ROOT / 'android/app/src/main/res'
# 自适应图标背景色（values/ic_launcher_background.xml），用于自检/预览合成
BACKGROUND = (0x0B, 0x0B, 0x12)

# 原图里圆角方块的包围盒 (left, top, right, bottom)
ART_BOX = (8, 0, 1246, 1239)
# 圆角半径占边长的比例（对原图四角做圆弧拟合得到 303/1238≈0.245）
RADIUS_RATIO = 0.245

# Android 自适应图标：108dp 画布只有中心 72dp 可见（官方规范），其余 18dp×2 是给系统
# 遮罩/视差留的。任务里的「logo 占 92~96%」按**可见区**算才是有效尺寸：
#   72/108 × 0.95 ≈ 0.63  → 描边落在可见区内、尽量贴可见区边缘。
# 直接把 0.95 铺到 108dp 画布上，描边会落在 72dp 可视区之外，真机依旧看不见（前两版就是这么失败的）。
VISIBLE_CANVAS_RATIO = 72 / 108
ADAPTIVE_LOGO_RATIO = VISIBLE_CANVAS_RATIO * 0.95

# 霓虹描边颜色：从左上紫到右下粉（对应原图边缘渐变的取色）
RIM_STOPS = (
    (0.00, (0x6D, 0x28, 0xD9)),
    (0.38, (0x8B, 0x5C, 0xF6)),
    (0.62, (0xEC, 0x48, 0x99)),
    (1.00, (0xF4, 0x72, 0xB6)),
)
# 描边分层：(向内比例, 向外比例, 模糊比例, 不透明度)，比例都相对图标边长。
# 第一层是约 1.6% 的核心亮边（视觉宽度约 icon 2~3%），后两层是向内的辉光。
RIM_LAYERS = (
    (0.016, 0.006, 0.0035, 0.95),
    (0.042, 0.016, 0.0100, 0.52),
    (0.078, 0.030, 0.0200, 0.22),
)

# 传统启动图标：48dp 基准 × 各密度
MIPMAPS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
# 自适应图标前景：108dp 基准 × 各密度
DRAWABLES = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}

SUPERSAMPLE = 4


def _rounded_mask(size: int, radius: float) -> Image.Image:
    """圆角矩形遮罩：先在 4 倍画布上画，再缩小获得抗锯齿边缘。"""
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=radius * SUPERSAMPLE, fill=255,
    )
    return mask.resize((size, size), Image.LANCZOS)


def _circle_mask(size: int) -> Image.Image:
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


_SOURCE = Image.open(SRC).convert('RGB').crop(ART_BOX)


def _art(size: int) -> Image.Image:
    """取方块内容并缩放到 size，外部透明（圆角遮罩）。"""
    art = _SOURCE.resize((size, size), Image.LANCZOS).convert('RGBA')
    art.putalpha(_rounded_mask(size, size * RADIUS_RATIO))
    return art


# ────────────────────────── 渐变霓虹描边 ──────────────────────────

def _shape_mask(size: int, circular: bool) -> Image.Image:
    return _circle_mask(size) if circular else _rounded_mask(size, size * RADIUS_RATIO)


def _centered_shape_mask(canvas_size: int, shape_size: int, circular: bool) -> Image.Image:
    """在 canvas_size 画布上居中画一个 shape_size 的圆角方块/圆形遮罩（允许超出画布）。"""
    shape_size = max(4, shape_size)
    shape = _shape_mask(shape_size, circular)
    if shape_size == canvas_size:
        return shape
    mask = Image.new('L', (canvas_size, canvas_size), 0)
    offset = (canvas_size - shape_size) // 2
    mask.paste(shape, (offset, offset))
    return mask


def _ring(canvas_size: int, shape_size: int, inward: int, outward: int, circular: bool) -> Image.Image:
    """沿图形边缘的环形遮罩：从「外扩 outward」到「内缩 inward」的那一圈。"""
    outer = _centered_shape_mask(canvas_size, shape_size + 2 * outward, circular)
    inner = _centered_shape_mask(canvas_size, shape_size - 2 * inward, circular)
    return ImageChops.subtract(outer, inner)


def _diagonal_gradient(size: int) -> Image.Image:
    """左上 → 右下 的多段紫→粉渐变：t = (x + y) / (2(size-1))。"""
    coords = np.arange(size, dtype=np.float32)
    t = (coords[:, None] + coords[None, :]) / (2 * max(1, size - 1))
    positions = [stop[0] for stop in RIM_STOPS]
    channels = [
        np.interp(t, positions, [stop[1][ch] for stop in RIM_STOPS])
        for ch in range(3)
    ]
    rgb = np.stack(channels, axis=-1).round().clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgb, 'RGB')


def _neon_rim(canvas_size: int, shape_size: int, circular: bool = False) -> Image.Image:
    """沿图形边缘的紫/粉渐变描边 + 内发光（RGBA，画布大小；外圈可有一点外发光）。"""
    alpha = Image.new('L', (canvas_size, canvas_size), 0)
    for inward, outward, blur, opacity in RIM_LAYERS:
        band = _ring(
            canvas_size,
            shape_size,
            max(1, round(canvas_size * inward)),
            max(1, round(canvas_size * outward)),
            circular,
        )
        band = band.filter(ImageFilter.GaussianBlur(max(0.35, canvas_size * blur)))
        band = band.point(lambda value, o=opacity: round(value * o))
        alpha = ImageChops.add(alpha, band)
    rim = _diagonal_gradient(canvas_size).convert('RGBA')
    rim.putalpha(alpha)
    return rim


def _decorated(size: int, logo_ratio: float = 1.0, circular: bool = False) -> Image.Image:
    """logo（可内缩）+ 渐变霓虹描边；画布其余部分透明。"""
    logo_size = max(8, round(size * logo_ratio))
    logo = _art(logo_size)
    if circular:
        logo.putalpha(_circle_mask(logo_size))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset = (size - logo_size) // 2
    canvas.alpha_composite(logo, (offset, offset))
    canvas.alpha_composite(_neon_rim(size, logo_size, circular))
    return canvas


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG')
    print(f'  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {img.mode}')


# ────────────────────────── 边缘采样自检 ──────────────────────────

def _sample_rim(img: Image.Image, shape_size: int, circular: bool = False) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    """采样描边的紫色侧（左上）和粉色侧（右下）颜色。"""
    size = img.size[0]
    px = img.load()
    margin = (size - shape_size) // 2
    inset = max(1, round(size * 0.012))
    if circular:
        radius = shape_size / 2 - inset
        cx = cy = size / 2
        purple = (round(cx + radius * math.cos(math.radians(225))), round(cy + radius * math.sin(math.radians(225))))
        pink = (round(cx + radius * math.cos(math.radians(45))), round(cy + radius * math.sin(math.radians(45))))
    else:
        x0 = y0 = margin
        x1 = margin + shape_size - 1
        purple = (round(x0 + shape_size * 0.30), y0 + inset)
        pink = (round(x1 - shape_size * 0.02), round(y0 + shape_size * 0.70))
    choose = lambda p: (min(max(p[0], 0), size - 1), min(max(p[1], 0), size - 1))
    return px[choose(purple)][:3], px[choose(pink)][:3]


def verify() -> bool:
    print('\n霓虹描边自检（边缘采样 RGB，看紫/粉分量）：')
    targets = [('App 内 logo 256', APP_LOGO, 256, 256, False, False)]
    for density, size in MIPMAPS.items():
        targets.append((f'mipmap-{density} 方形', RES / f'mipmap-{density}/ic_launcher.png', size, size, False, False))
        targets.append((f'mipmap-{density} 圆形', RES / f'mipmap-{density}/ic_launcher_round.png', size, size, True, False))
    for density, size in DRAWABLES.items():
        targets.append((
            f'drawable-{density} 自适应前景',
            RES / f'drawable-{density}/ic_launcher_emo.png',
            size,
            round(size * ADAPTIVE_LOGO_RATIO),
            False,
            True,
        ))

    ok = True
    for label, path, canvas, shape, circular, transparent_margin in targets:
        img = Image.open(path).convert('RGBA')
        purple, pink = _sample_rim(img, shape, circular)
        corner_alpha = img.getpixel((0, 0))[3]
        edge_alpha = img.getpixel((canvas // 2, 0))[3]
        purple_ok = purple[2] - purple[1] >= 25 and purple[2] >= 55
        pink_ok = pink[0] - pink[1] >= 35 and pink[0] >= 80
        # 右下明显比左上更红，说明渐变方向（紫→粉）是对的
        gradient_ok = pink[0] - purple[0] >= 20
        # 自适应前景：画布外圈必须是透明的（描边整体在中心 72dp 可视区里）；
        # 传统图标/App logo 是满幅的，边缘中点应该就是描边（接近不透明）
        if transparent_margin:
            edge_ok = edge_alpha <= 30
            # 核心描边外缘必须落在 72dp 可视区内，否则真机裁完还是看不见
            rim_outer = (shape + 2 * canvas * RIM_LAYERS[0][1]) / canvas
            visible_ok = rim_outer <= VISIBLE_CANVAS_RATIO
            rim_note = f' 描边外缘={round(rim_outer * 100)}%画布(可视区≤{round(VISIBLE_CANVAS_RATIO * 100)}%)'
        else:
            edge_ok = edge_alpha >= 160
            visible_ok = True
            rim_note = ''
        passed = purple_ok and pink_ok and gradient_ok and edge_ok and visible_ok and corner_alpha <= 8
        ok = ok and passed
        print(
            f'  [{"OK" if passed else "FAIL"}] {label:<24} '
            f'紫 {purple} (B-G={purple[2] - purple[1]})  '
            f'粉 {pink} (R-G={pink[0] - pink[1]})  '
            f'角alpha={corner_alpha} 边中点alpha={edge_alpha}{rim_note}',
        )
    print('霓虹描边自检：' + ('PASS' if ok else 'FAIL'))
    return ok


# ────────────────────────── 预览拼图 ──────────────────────────

def _squircle_mask(size: int) -> Image.Image:
    big = size * SUPERSAMPLE
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=big * 0.32, fill=255,
    )
    return mask.resize((size, size), Image.LANCZOS)


def _visible_crop(icon: Image.Image) -> Image.Image:
    """按 Android 规范裁出中心 72/108 的可视区：预览要按真机看到的范围来。"""
    size = icon.size[0]
    side = round(size * VISIBLE_CANVAS_RATIO)
    offset = (size - side) // 2
    return icon.crop((offset, offset, offset + side, offset + side))


def _fit(img: Image.Image, box: int) -> Image.Image:
    """等比缩放到 box 内；放大小图用 NEAREST 方便看清像素边缘。"""
    scale = box / img.size[0]
    resample = Image.NEAREST if scale >= 1.5 else Image.LANCZOS
    size = (max(1, round(img.size[0] * scale)), max(1, round(img.size[1] * scale)))
    return img.resize(size, resample)


def preview(path: Path) -> None:
    cell = 150
    label_h = 18
    row_h = cell + label_h
    font = ImageFont.load_default(size=11)
    sheet = Image.new('RGB', (cell * 5 + 20, row_h * 3 + 30), (250, 250, 250))
    draw = ImageDraw.Draw(sheet)

    sizes = [MIPMAPS['mdpi'], MIPMAPS['hdpi'], MIPMAPS['xhdpi'], MIPMAPS['xxhdpi'], MIPMAPS['xxxhdpi']]
    densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
    squircle = _squircle_mask(cell)

    def cell_img(img: Image.Image, mask: Image.Image | None, background=(0x0B, 0x0B, 0x12)) -> Image.Image:
        fitted = _fit(img, cell)
        base = Image.new('RGB', (cell, cell), background)
        base.paste(fitted, ((cell - fitted.size[0]) // 2, (cell - fitted.size[1]) // 2), fitted)
        if mask is None:
            return base
        out = Image.new('RGB', (cell, cell), (250, 250, 250))
        out.paste(base, (0, 0), mask)
        return out

    # 第一行：自适应前景（squircle / 圆形遮罩模拟）+ 传统 192 方形/圆形 + App 内 logo
    adaptive = Image.open(RES / 'drawable-xxxhdpi/ic_launcher_emo.png').convert('RGBA')
    square192 = Image.open(RES / 'mipmap-xxxhdpi/ic_launcher.png').convert('RGBA')
    round192 = Image.open(RES / 'mipmap-xxxhdpi/ic_launcher_round.png').convert('RGBA')
    app_logo = Image.open(APP_LOGO).convert('RGBA')
    first_row = [
        ('adaptive visible / squircle', cell_img(_visible_crop(adaptive), squircle, BACKGROUND)),
        ('adaptive visible / circle', cell_img(_visible_crop(adaptive), _circle_mask(cell), BACKGROUND)),
        ('legacy square 192', cell_img(square192, None, (240, 240, 240))),
        ('legacy round 192', cell_img(round192, None, (240, 240, 240))),
        ('app logo 256', cell_img(app_logo, None, (240, 240, 240))),
    ]
    for idx, (label, img) in enumerate(first_row):
        x = 10 + idx * cell
        sheet.paste(img, (x, 18))
        draw.text((x + 2, 3), label, fill=(80, 74, 96), font=font)

    # 第二、三行：48/72/96/144/192 的 squircle / 圆形预览
    for row, (kind, mask_fn) in enumerate((
        ('squircle', lambda: squircle),
        ('circle', lambda: _circle_mask(cell)),
    )):
        y = 18 + row_h * (row + 1)
        for idx, density in enumerate(densities):
            icon = Image.open(RES / f'mipmap-{density}/ic_launcher.png').convert('RGBA') \
                if kind == 'squircle' else Image.open(RES / f'mipmap-{density}/ic_launcher_round.png').convert('RGBA')
            if kind == 'squircle':
                img = cell_img(icon, mask_fn())
            else:
                img = cell_img(icon, None)
            x = 10 + idx * cell
            sheet.paste(img, (x, y))
            draw.text((x + 2, y - label_h + 3), f'{sizes[idx]} {kind}', fill=(80, 74, 96), font=font)

    sheet.save(path, 'PNG')
    print(f'\n预览图已输出：{path}')


def main() -> None:
    print('App 内 logo（叠加渐变霓虹描边）：')
    _save(_decorated(256), APP_LOGO)

    print('自适应图标前景（透明画布；logo 占可见区 95% ≈ 画布 63%，边缘渐变霓虹描边）：')
    for density, size in DRAWABLES.items():
        _save(_decorated(size, logo_ratio=ADAPTIVE_LOGO_RATIO), RES / f'drawable-{density}/ic_launcher_emo.png')

    print('传统启动图标 + 圆形图标（带渐变霓虹描边）：')
    for density, size in MIPMAPS.items():
        _save(_decorated(size), RES / f'mipmap-{density}/ic_launcher.png')
        _save(_decorated(size, circular=True), RES / f'mipmap-{density}/ic_launcher_round.png')

    passed = verify()
    if len(sys.argv) > 1:
        preview(Path(sys.argv[1]))
    if not passed:
        sys.exit(1)


if __name__ == '__main__':
    main()
