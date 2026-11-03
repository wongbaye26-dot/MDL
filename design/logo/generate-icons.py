#!/usr/bin/env python3
"""从 design/logo/emo-logo-new-src.png 生成 App 内 logo 与 Android 启动图标。

为什么不能直接缩放原图：
原图是 RGB 且「圆角方块」外是纯黑，直接缩小会把黑角带进图标里，
所以在缩放的同时按方块的真实几何边界生成圆角遮罩，把外部抠成透明。

原图实测（1254x1254）：
- 方块边界：x 8..1245，y 约 -1..1238（上边缘被裁掉约 1px，可忽略）
- 四角圆弧拟合半径 ≈ 303px，边长 1238px → 约 24.5%（视觉上的「≈22%」偏小）
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/logo/emo-logo-new-src.png'
APP_LOGO = ROOT / 'src/resources/images/emo-logo.png'
RES = ROOT / 'android/app/src/main/res'

# 原图里圆角方块的包围盒 (left, top, right, bottom)
ART_BOX = (8, 0, 1246, 1239)
# 圆角半径占边长的比例（对原图四角做圆弧拟合得到 303/1238≈0.245）
RADIUS_RATIO = 0.245

# 自适应图标前景画布颜色，与 values/ic_launcher_background.xml 的 #0B0B12 保持一致
BG = (0x0B, 0x0B, 0x12)
# 自适应图标会被系统裁切：logo 缩到 80% 居中，保证中间的波形不被切掉
FOREGROUND_SCALE = 0.8

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


def _save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG')
    print(f'  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {img.mode}')


def main() -> None:
    print('App 内 logo：')
    _save(_art(256), APP_LOGO)

    print('自适应图标前景（#0B0B12 画布 + 80% logo）：')
    for density, size in DRAWABLES.items():
        canvas = Image.new('RGBA', (size, size), BG + (255,))
        logo_size = round(size * FOREGROUND_SCALE)
        logo = _art(logo_size)
        offset = (size - logo_size) // 2
        canvas.alpha_composite(logo, (offset, offset))
        _save(canvas, RES / f'drawable-{density}/ic_launcher_emo.png')

    print('传统启动图标 + 圆形图标：')
    for density, size in MIPMAPS.items():
        _save(_art(size), RES / f'mipmap-{density}/ic_launcher.png')
        round_icon = _art(size)
        round_icon.putalpha(_circle_mask(size))
        _save(round_icon, RES / f'mipmap-{density}/ic_launcher_round.png')


if __name__ == '__main__':
    main()
