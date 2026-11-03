#!/usr/bin/env python3
"""从 design/logo/emo-logo-new-src.png 生成 App 内 logo 与 Android 启动图标。

为什么不能直接缩放原图：
原图是 RGB 且「圆角方块」外是纯黑，直接缩小会把黑角带进图标里，
所以在缩放的同时按方块的真实几何边界生成圆角遮罩，把外部抠成透明。

原图实测（1254x1254）：
- 方块边界：x 8..1245，y 约 -1..1238（上边缘被裁掉约 1px，可忽略）
- 四角圆弧拟合半径 ≈ 303px，边长 1238px → 约 24.5%（视觉上的「≈22%」偏小）

自适应图标前景的坑（2026-11 修复）：
之前是「#0B0B12 不透明画布 + 80% logo」，系统按 108dp 裁切后画布外圈那层黑会包在
方块外面，原图圆角方块外圈的紫/粉霓虹渐变边整个被吃掉，桌面图标变成「黑底 + 内缩方块」。
现在自适应前景改成**透明画布 + 满幅 logo**：不再铺底色、不再缩放，渐变边直接落到画布
边缘；背景由 @color/ic_launcher_background 提供，圆角/圆形裁切交给系统 mask。

用法：
    python3 design/logo/generate-icons.py                  # 只生成 + 边缘自检
    python3 design/logo/generate-icons.py preview.png      # 额外输出静态预览图
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/logo/emo-logo-new-src.png'
APP_LOGO = ROOT / 'src/resources/images/emo-logo.png'
RES = ROOT / 'android/app/src/main/res'

# 原图里圆角方块的包围盒 (left, top, right, bottom)
ART_BOX = (8, 0, 1246, 1239)
# 圆角半径占边长的比例（对原图四角做圆弧拟合得到 303/1238≈0.245）
RADIUS_RATIO = 0.245

# 自适应前景的安全余量：0 = 满幅。
# 万一某些 ROM 的 mask 把画布最外一圈 AA 切掉，可以调成 0.01~0.02；
# 再大就会在渐变边和 mask 之间露出 背景色 #0B0B12 的一圈，就是「黑边」了。
ADAPTIVE_INSET = 0.0
# 自适应图标背景（values/ic_launcher_background.xml 的 #0B0B12），只用于自检/预览合成
BACKGROUND = (0x0B, 0x0B, 0x12)

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


def _foreground(size: int) -> Image.Image:
    """自适应图标前景：透明画布 + 满幅 logo（ADAPTIVE_INSET>0 时留一点透明余量）。"""
    if ADAPTIVE_INSET <= 0:
        return _art(size)
    logo_size = round(size * (1 - 2 * ADAPTIVE_INSET))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    offset = (size - logo_size) // 2
    canvas.alpha_composite(_art(logo_size), (offset, offset))
    return canvas


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG')
    print(f'  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {img.mode}')


# ────────────────────────── 边缘自检 ──────────────────────────

def _source_edge_colors() -> dict[str, tuple[int, int, int]]:
    """原图四条边外侧 1.5% 带内最亮的渐变边颜色。

    取「带内峰值」而不是最外 1px：原图最外 1px 是辉光的抗锯齿尾巴，偏暗；
    生成时缩小会把更内侧的辉光平均到边缘，所以生成图标的最外圈一般比原图最外 1px 亮。
    """
    img = Image.open(SRC).convert('RGB')
    px = img.load()
    left, top, right, bottom = ART_BOX
    cx, cy = (left + right) // 2, (top + bottom) // 2
    half_side = (right - left) // 6
    band = max(6, round((right - left) * 0.015))

    def peak(x0: int, x1: int, y0: int, y1: int) -> tuple[int, int, int]:
        best = (0, 0, 0)
        for y in range(y0, y1):
            for x in range(x0, x1):
                color = px[x, y]
                if max(color) > max(best):
                    best = color
        return best

    return {
        'L': peak(left, left + band, cy - half_side, cy + half_side),
        'R': peak(right - band, right, cy - half_side, cy + half_side),
        'T': peak(cx - half_side, cx + half_side, top, top + band),
        'B': peak(cx - half_side, cx + half_side, bottom - band, bottom),
    }


def _sample_edge(img: Image.Image) -> dict[str, tuple[int, int, int, int]]:
    """取四条边中点的 RGBA（圆形图标这四个点正好是圆和方块相切的位置）。"""
    s = img.size[0]
    half = s // 2
    return {
        'L': img.getpixel((0, half)),
        'R': img.getpixel((s - 1, half)),
        'T': img.getpixel((half, 0)),
        'B': img.getpixel((half, s - 1)),
    }


def _is_neon(rgb: tuple[int, int, int, int]) -> bool:
    """紫/粉渐变判定：蓝或红明显高于绿，且不是接近黑的背景色。"""
    r, g, b = rgb[:3]
    return max(r, b) - g >= 18 and max(r, b) >= 28


def _color_distance(a: tuple[int, ...], b: tuple[int, ...]) -> int:
    return max(abs(a[i] - b[i]) for i in range(3))


def verify() -> bool:
    print('\n边缘自检（紫/粉渐变 + 四角透明）：')
    src = _source_edge_colors()
    targets = [('App 内 logo 256', APP_LOGO)]
    for density in MIPMAPS:
        targets.append((f'mipmap-{density} 方形', RES / f'mipmap-{density}/ic_launcher.png'))
        targets.append((f'mipmap-{density} 圆形', RES / f'mipmap-{density}/ic_launcher_round.png'))
    for density in DRAWABLES:
        targets.append((f'drawable-{density} 自适应前景', RES / f'drawable-{density}/ic_launcher_emo.png'))

    ok = True
    for label, path in targets:
        img = Image.open(path).convert('RGBA')
        edge = _sample_edge(img)
        neon = [side for side in 'LRTB' if _is_neon(edge[side])]
        corner_alpha = img.getpixel((0, 0))[3]
        # 亮度保留率：生成边缘的峰值亮度 / 原图同一侧渐变带的峰值亮度。
        # 缩小时抗锯齿会拉低边缘亮度，但保留率过低就说明渐变边被黑底吃掉了。
        keep = min(
            max(edge[side][:3]) / max(1, max(src[side])) for side in 'LRTB'
        )
        # 边缘像素也不能等于背景色 #0B0B12（这就是之前「黑底内缩方块」的症状）
        bg_like = [side for side in 'LRTB' if _color_distance(edge[side][:3], BACKGROUND) <= 4]
        # 四边中点至少 3 条边是霓虹色；四角必须透明；亮度保留率 ≥ 40% 且边缘不是背景色
        passed = len(neon) >= 3 and corner_alpha <= 8 and keep >= 0.4 and not bg_like
        ok = ok and passed
        print(
            f'  [{"OK" if passed else "FAIL"}] {label:<24} '
            f'边缘 L{edge["L"][:3]} R{edge["R"][:3]} T{edge["T"][:3]} B{edge["B"][:3]} '
            f'霓虹边 {len(neon)}/4 角alpha {corner_alpha} 亮度保留 {round(keep * 100)}% 背景色边 {len(bg_like)}',
        )
    print('边缘自检：' + ('PASS' if ok else 'FAIL'))
    return ok


# ────────────────────────── 预览图 ──────────────────────────

def _checker(size: int, step: int = 16) -> Image.Image:
    img = Image.new('RGB', (size, size), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    for y in range(0, size, step):
        for x in range(0, size, step):
            if (x // step + y // step) % 2 == 0:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(208, 208, 208))
    return img


def _masked_composite(icon: Image.Image, size: int, mask: Image.Image) -> Image.Image:
    """把透明前景叠到 #0B0B12 背景上，再套一层系统 mask，模拟桌面上的样子。"""
    canvas = Image.new('RGB', (size, size), BACKGROUND)
    fg = icon.resize((size, size), Image.LANCZOS)
    canvas.paste(fg, (0, 0), fg)
    masked = Image.new('RGB', (size, size), (250, 250, 250))
    masked.paste(canvas, (0, 0), mask)
    return masked


def preview(path: Path) -> None:
    cell = 170
    font = ImageFont.load_default(size=12)
    sheet = Image.new('RGB', (cell * 4 + 20, cell * 2 + 40), (250, 250, 250))
    draw = ImageDraw.Draw(sheet)

    fg = Image.open(RES / 'drawable-xxxhdpi/ic_launcher_emo.png').convert('RGBA')
    circle = _circle_mask(cell)
    squircle_mask = Image.new('L', (cell * SUPERSAMPLE, cell * SUPERSAMPLE), 0)
    ImageDraw.Draw(squircle_mask).rounded_rectangle(
        (0, 0, cell * SUPERSAMPLE - 1, cell * SUPERSAMPLE - 1),
        radius=cell * SUPERSAMPLE * 0.38, fill=255,
    )
    squircle = squircle_mask.resize((cell, cell), Image.LANCZOS)

    # 「修复前」：不透明 #0B0B12 画布 + 80% logo（系统遮罩后剩一圈黑底）
    before = Image.new('RGBA', (cell, cell), BACKGROUND + (255,))
    before_logo_size = round(cell * 0.8)
    before.alpha_composite(
        _art(before_logo_size),
        ((cell - before_logo_size) // 2, (cell - before_logo_size) // 2),
    )

    row1 = [
        ('BEFORE: bg + 80%', _masked_composite(before, cell, squircle)),
        ('AFTER: full-bleed (raw)', _masked_composite(fg, cell, Image.new('L', (cell, cell), 255))),
        ('AFTER: circle mask', _masked_composite(fg, cell, circle)),
        ('AFTER: squircle mask', _masked_composite(fg, cell, squircle)),
    ]
    icons = {}
    for density in MIPMAPS:
        icons[f'mipmap-{density}'] = RES / f'mipmap-{density}'
    square = Image.open(icons['mipmap-xxxhdpi'] / 'ic_launcher.png').convert('RGBA')
    round_icon = Image.open(icons['mipmap-xxxhdpi'] / 'ic_launcher_round.png').convert('RGBA')
    app_logo = Image.open(APP_LOGO).convert('RGBA')

    def paste_contained(dst: Image.Image, src: Image.Image, box: int) -> None:
        scale = min(box / src.size[0], box / src.size[1])
        size = (max(1, round(src.size[0] * scale)), max(1, round(src.size[1] * scale)))
        icon = src.resize(size, Image.LANCZOS)
        dst.paste(icon, ((box - size[0]) // 2, (box - size[1]) // 2), icon)

    row2 = [
        ('legacy square 192', square),
        ('legacy round 192', round_icon),
        ('app logo 256', app_logo),
    ]

    for idx, (label, img) in enumerate(row1):
        x = idx * cell + 10
        sheet.paste(img, (x, 20))
        draw.text((x, 4), label, fill=(80, 74, 96), font=font)
    for idx, (label, img) in enumerate(row2):
        x = idx * cell + 10
        y = cell + 40
        bg = _checker(cell)
        if img.size == (cell, cell):
            bg.paste(img, (0, 0), img)
        else:
            paste_contained(bg, img, cell)
        sheet.paste(bg, (x, y))
        draw.text((x, y - 16), label, fill=(80, 74, 96), font=font)

    sheet.save(path, 'PNG')
    print(f'\n预览图已输出：{path}')


def main() -> None:
    print('App 内 logo：')
    _save(_art(256), APP_LOGO)

    print('自适应图标前景（透明画布 + 满幅 logo，渐变边直接到画布边缘）：')
    for density, size in DRAWABLES.items():
        _save(_foreground(size), RES / f'drawable-{density}/ic_launcher_emo.png')

    print('传统启动图标 + 圆形图标（透明外部，保留渐变边）：')
    for density, size in MIPMAPS.items():
        _save(_art(size), RES / f'mipmap-{density}/ic_launcher.png')
        round_icon = _art(size)
        round_icon.putalpha(_circle_mask(size))
        _save(round_icon, RES / f'mipmap-{density}/ic_launcher_round.png')

    passed = verify()
    if len(sys.argv) > 1:
        preview(Path(sys.argv[1]))
    if not passed:
        sys.exit(1)


if __name__ == '__main__':
    main()
