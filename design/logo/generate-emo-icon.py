#!/usr/bin/env python3
"""EmoMusic 第三版图标：液态玻璃花瓣 + 白色八分音符。

设计目标：
- 延续用户给的「黑色圆角方块 + 半透明紫色花瓣 + 白音符」构图；
- 结合项目现有紫→粉渐变、暗色底、玻璃质感；
- 花瓣做成三层叠加的半透明玻璃，有边缘高光和柔和内发光，缩到 48dp 仍能读出层次；
- 音符重新绘制，比例更稳、旗子更利落；
- 同时生成传统 mipmap、圆形 mipmap、自适应前景、App 内 logo 与预览图。
"""
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
RES = ROOT / 'android/app/src/main/res'
DESIGN = ROOT / 'design'
APP_LOGO = ROOT / 'src/resources/images/emo-logo.png'

SS = 2                     # 绘制超采样
BASE = 1024
RADIUS = 230               # 圆角约 22.5%

MIPMAPS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
DRAWABLES = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
# 自适应前景：中心 72dp 可见区再留 6% 余量
ADAPTIVE_CONTENT_RATIO = (72 / 108) * 0.94


# ───────────────────────── 基础工具 ─────────────────────────

def _rounded_mask(size, radius, ss=SS):
    big = size * ss
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * ss, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def _circle_mask(size, ss=SS):
    big = size * ss
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def _diag_gradient(size, stops, horizontal=0.62):
    """多段渐变；t = x*horizontal + y*(1-horizontal)，归一化。"""
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    t = (xs * horizontal + ys * (1 - horizontal)) / (size - 1)
    positions = [p for p, _ in stops]
    rgba = np.zeros((size, size, 4), dtype=np.float32)
    for ch in range(4):
        rgba[..., ch] = np.interp(t, positions, [c[ch] for _, c in stops])
    return Image.fromarray(rgba.round().clip(0, 255).astype(np.uint8), 'RGBA')


def _rotated_rounded_layer(size, box, radius, angle, fill):
    """在透明画布上画一个带渐变的旋转圆角矩形（超采样 + 旋转）。"""
    big = size * SS
    x0, y0, x1, y1 = [v * SS for v in box]
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((x0, y0, x1, y1), radius=radius * SS, fill=255)
    if angle:
        mask = mask.rotate(angle, resample=Image.BICUBIC, center=(big / 2, big / 2))
    mask = mask.resize((size, size), Image.LANCZOS)
    layer = fill.copy()
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), mask))
    return layer


def _blur_alpha(layer, radius):
    if radius <= 0:
        return layer
    a = layer.getchannel('A').filter(ImageFilter.GaussianBlur(radius))
    out = layer.copy()
    out.putalpha(a)
    return out


def _petal(size, box, radius, angle, gradient, blur=10):
    layer = _rotated_rounded_layer(size, box, radius, angle, gradient)
    layer = _blur_alpha(layer, blur)
    return layer


def _glass_highlight(size, box, radius, angle, inset=10, width=3, alpha=46, blur=2.0):
    """沿花瓣内缘的一条高光，让玻璃有厚度。"""
    big = size * SS
    x0, y0, x1, y1 = [v * SS for v in box]
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (x0 + inset * SS, y0 + inset * SS, x1 - inset * SS, y1 - inset * SS),
        radius=max(2, (radius - inset)) * SS, outline=255, width=width * SS,
    )
    if angle:
        mask = mask.rotate(angle, resample=Image.BICUBIC, center=(big / 2, big / 2))
    mask = mask.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    mask = mask.point(lambda v: round(v * alpha / 255))
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    out.putalpha(mask)
    return out


def _cubic(points, steps=48):
    """二次贝塞尔采样，用于音符旗子的柔和曲线。"""
    (x0, y0), (x1, y1), (x2, y2) = points
    result = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        result.append((mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
                       mt * mt * y0 + 2 * mt * t * y1 + t * t * y2))
    return result


# ───────────────────────── 图标艺术 ─────────────────────────

def _background(size):
    """黑色圆角方块底：深紫黑对角渐变 + 中心柔光 + 边缘细描边。"""
    bg = _diag_gradient(size, [
        (0.00, (26, 19, 42, 255)),
        (0.46, (14, 12, 22, 255)),
        (1.00, (7, 6, 12, 255)),
    ], horizontal=0.45)

    # 中心紫色柔光
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy, r = size * 0.50, size * 0.50, size * 0.58
    for i in range(18, 0, -1):
        a = int(9 * (i / 18) ** 1.7)
        rr = r * i / 18
        gd.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(109, 40, 217, a))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    bg.alpha_composite(glow)

    # 左上冷光，避免纯黑发闷
    sheen = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    grad = _diag_gradient(size, [
        (0.00, (255, 255, 255, 28)),
        (0.55, (255, 255, 255, 0)),
        (1.00, (255, 255, 255, 0)),
    ], horizontal=0.25)
    sheen.paste(grad, (0, 0), grad)
    bg.alpha_composite(sheen)

    return bg


def _soft_sheen(size, box, radius, angle, alpha=34):
    """花瓣里的柔和反光：不是描边，而是从左上到右下渐隐的一层光。"""
    mask = _rotated_rounded_layer(size, box, radius, angle, Image.new('RGBA', (size, size), (255, 255, 255, 255))).getchannel('A')
    mask = mask.filter(ImageFilter.GaussianBlur(size * 0.012))
    grad = _diag_gradient(size, [
        (0.00, (255, 255, 255, alpha)),
        (0.48, (255, 255, 255, 0)),
        (1.00, (255, 255, 255, 0)),
    ], 0.25)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.putalpha(ImageChops.multiply(mask, grad.getchannel('A')))
    return out


def _edge_glint(size, box, radius, angle, alpha=42):
    """花瓣边缘的一线玻璃反光，宽度很窄但保留柔边。"""
    mask = Image.new('L', (size * SS, size * SS), 0)
    x0, y0, x1, y1 = [v * SS for v in box]
    ImageDraw.Draw(mask).rounded_rectangle(
        (x0 + 2 * SS, y0 + 2 * SS, x1 - 2 * SS, y1 - 2 * SS),
        radius=max(2, radius - 2) * SS, outline=255, width=2 * SS,
    )
    if angle:
        mask = mask.rotate(angle, resample=Image.BICUBIC, center=(size * SS / 2, size * SS / 2))
    mask = mask.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    mask = mask.point(lambda v: round(v * alpha / 255))
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    out.putalpha(mask)
    return out


def _play_mask(size):
    """圆角播放三角，用作花瓣的裁切轮廓。"""
    s = size / 1024.0
    m = Image.new('L', (size * SS, size * SS), 0)
    d = ImageDraw.Draw(m)
    pts = [(180 * s * SS, 150 * s * SS), (180 * s * SS, 874 * s * SS), (872 * s * SS, 512 * s * SS)]
    d.polygon(pts, fill=255)
    r = 46 * s * SS
    for x, y in pts:
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return m.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(max(0.4, 0.7 * s)))


def _glass_flower(size):
    """三层半透明玻璃花瓣：软边、叠色、柔和高光，像用户参考图里的液态玻璃。"""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    s = size / 1024.0

    def petal(box, radius, angle, stops, blur, sheen_alpha):
        box = tuple(v * s for v in box)
        radius = max(6, int(radius * s))
        layer = _petal(size, box, radius, angle, _diag_gradient(size, stops, 0.35), blur)
        # 花瓣外侧的柔光，让它浮在深色底上
        halo = _blur_alpha(layer, max(2, int(16 * s)))
        ha = halo.getchannel('A').point(lambda v: round(v * 0.22))
        halo.putalpha(ha)
        canvas.alpha_composite(halo)
        canvas.alpha_composite(layer)
        canvas.alpha_composite(_soft_sheen(size, box, radius, angle, sheen_alpha))
        canvas.alpha_composite(_edge_glint(size, box, radius, angle, 36))

    # 三角构图：左上、右侧尖端、左下三片花瓣叠成一个指向右的「播放」三角
    petal((205, 180, 600, 585), 132, 26, [
        (0.00, (139, 92, 246, 172)),
        (0.52, (124, 58, 237, 140)),
        (1.00, (91, 33, 182, 36)),
    ], 2, 30)
    # 右侧尖端：让三片花瓣的轮廓收在右侧，读成播放三角
    petal((455, 285, 825, 735), 150, 76, [
        (0.00, (168, 85, 247, 168)),
        (0.52, (147, 51, 234, 132)),
        (1.00, (109, 40, 217, 34)),
    ], 2, 28)
    # 前层左下：压住中心，和上方花瓣形成三角底边
    petal((205, 435, 605, 850), 132, -24, [
        (0.00, (196, 181, 253, 136)),
        (0.50, (168, 85, 247, 116)),
        (1.00, (236, 72, 153, 46)),
    ], 2, 24)

    # 叠层中心柔光，避免花瓣交接处发脏
    bloom = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse(
        (size * 0.33, size * 0.33, size * 0.67, size * 0.67), fill=(196, 181, 253, 26))
    bloom = bloom.filter(ImageFilter.GaussianBlur(size * 0.075))
    canvas.alpha_composite(bloom)
    return canvas


def _note_layer(size):
    """白色八分音符：比较克制的尺寸，头/干/旗重新定比例。"""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    # 音符投影：让白音符从玻璃上浮起来
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse((size * 0.40, size * 0.60, size * 0.61, size * 0.74), fill=(0, 0, 0, 80))
    sd.rounded_rectangle((size * 0.515, size * 0.285, size * 0.55, size * 0.69),
                         radius=size * 0.018, fill=(0, 0, 0, 60))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.022))
    canvas.alpha_composite(shadow)

    note = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(note)

    # 符干
    stem_w = size * 0.039
    stem_x = size * 0.528
    stem_top = size * 0.285
    stem_bottom = size * 0.655
    d.rounded_rectangle((stem_x, stem_top, stem_x + stem_w, stem_bottom),
                        radius=stem_w / 2, fill=(255, 255, 255, 255))

    # 旗子：从符干顶部向右抛出，收成柔和的月牙形飘带
    flag = [(stem_x + stem_w * 0.55, stem_top)]
    flag += _cubic([(size * 0.560, size * 0.282), (size * 0.700, size * 0.330), (size * 0.716, size * 0.424)], 44)
    flag += _cubic([(size * 0.704, size * 0.446), (size * 0.684, size * 0.462), (size * 0.660, size * 0.472)], 20)
    flag += _cubic([(size * 0.644, size * 0.402), (size * 0.606, size * 0.354), (stem_x + stem_w * 0.42, size * 0.338)], 40)
    d.polygon(flag, fill=(255, 255, 255, 255))

    # 符头：旋转椭圆，中心对齐符干末端
    hw, hh = int(size * 0.182), int(size * 0.140)
    head = Image.new('RGBA', (hw, hh), (0, 0, 0, 0))
    hd = ImageDraw.Draw(head)
    hd.ellipse((0, 0, hw - 1, hh - 1), fill=(255, 255, 255, 255))
    head = head.rotate(-21, resample=Image.BICUBIC, expand=True)
    hx = int(size * 0.405)
    hy = int(size * 0.588)
    note.alpha_composite(head, (hx, hy))

    # 轻微冷白渐变，避免纯白死板
    grad = _diag_gradient(size, [
        (0.00, (255, 255, 255, 255)),
        (0.55, (255, 255, 255, 255)),
        (1.00, (248, 240, 255, 255)),
    ], 0.3)
    note.putalpha(ImageChops.multiply(note.getchannel('A'), grad.getchannel('A')))
    canvas.alpha_composite(note)
    return canvas


def _rim(size, radius, circular=False):
    """紫→粉渐变边缘描边 + 内发光。"""
    mask = _circle_mask(size) if circular else _rounded_mask(size, radius)
    inner = _circle_mask(size, ss=SS) if circular else _rounded_mask(size, radius - size * 0.012)
    if circular:
        inner = _circle_mask(int(size * 0.976))
        inner = ImageOps_pad(inner, size)
    ring = ImageChops.subtract(mask, inner)
    ring = ring.filter(ImageFilter.GaussianBlur(size * 0.0025))
    alpha = ring.point(lambda v: round(v * 0.95))
    rim = _diag_gradient(size, [
        (0.00, (124, 58, 237, 255)),
        (0.45, (168, 85, 247, 255)),
        (0.72, (236, 72, 153, 255)),
        (1.00, (244, 114, 182, 255)),
    ], 0.5)
    rim.putalpha(alpha)
    return rim


def ImageOps_pad(img, size):
    out = Image.new('L', (size, size), 0)
    out.paste(img, ((size - img.size[0]) // 2, (size - img.size[1]) // 2))
    return out


def _art(size, with_bg=True, circular=False):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    if with_bg:
        bg = _background(size)
        if circular:
            bg.putalpha(_circle_mask(size))
        canvas.alpha_composite(bg)
    flower = _glass_flower(size)
    flower.putalpha(ImageChops.multiply(flower.getchannel('A'), _play_mask(size)))
    canvas.alpha_composite(flower)
    # 音符略微上移、左移，落在播放三角的视觉中心，符头不压到三角下边缘
    note = _note_layer(size * SS).resize((size, size), Image.LANCZOS)
    shifted = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shifted.alpha_composite(note, (-int(size * 0.035), -int(size * 0.030)))
    canvas.alpha_composite(shifted)
    if with_bg:
        if not circular:
            canvas.alpha_composite(_rim(size, RADIUS, circular))
        mask = _circle_mask(size) if circular else _rounded_mask(size, RADIUS)
        canvas.putalpha(ImageChops.multiply(canvas.getchannel('A'), mask))
    return canvas


# ───────────────────────── 输出 ─────────────────────────

def _save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, 'PNG')
    print(f'  {path.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {img.mode}')


def _fit(img, box, bg=(255, 255, 255)):
    base = Image.new('RGB', (box, box), bg)
    scale = box / img.size[0]
    resized = img.resize((box, box), Image.LANCZOS)
    base.paste(resized, (0, 0), resized)
    return base


def preview(path):
    cell = 170
    label_h = 18
    sheet = Image.new('RGB', (cell * 5 + 24, (cell + label_h) * 2 + 30), (247, 246, 250))
    font = ImageFont.load_default(size=11)
    draw = ImageDraw.Draw(sheet)
    labels = ['1024', '192', '96', '48', 'in-app 256']
    images = [
        _fit(_art(1024), cell),
        _fit(_art(192), cell),
        _fit(_art(96), cell),
        _fit(_art(48), cell),
        _fit(_art(256), cell),
    ]
    for i, (label, img) in enumerate(zip(labels, images)):
        x = 12 + i * cell
        sheet.paste(img, (x, 22))
        draw.text((x, 73 + cell), label, fill=(80, 74, 96), font=font)

    # 圆形 + 自适应可见区模拟
    round_img = _fit(_art(256, circular=True), cell)
    adaptive = _art(1024, with_bg=False)
    side = round(1024 * ADAPTIVE_CONTENT_RATIO)
    adaptive = adaptive.crop(((1024 - side) // 2, (1024 - side) // 2, (1024 + side) // 2, (1024 + side) // 2))
    adaptive_bg = Image.new('RGBA', (1024, 1024), (11, 11, 18, 255))
    offset = (1024 - side) // 2
    adaptive_bg.alpha_composite(adaptive, (offset, offset))
    adaptive_bg.putalpha(_rounded_mask(1024, RADIUS))
    adaptive_img = _fit(adaptive_bg, cell)
    sheet.paste(round_img, (12, 22 + cell + 26))
    sheet.paste(adaptive_img, (12 + cell, 22 + cell + 26))
    draw.text((12, 73 + cell * 2 + 14), 'round', fill=(80, 74, 96), font=font)
    draw.text((12 + cell, 73 + cell * 2 + 14), 'adaptive (preview)', fill=(80, 74, 96), font=font)
    sheet.save(path, 'PNG')
    print(f'  preview -> {path}')


def main():
    print('生成 1024 主视觉：')
    master = _art(1024)
    _save(master, DESIGN / 'icon-1024.png')
    _save(_art(1024, circular=True), DESIGN / 'icon-round.png')
    _save(master, DESIGN / 'icon-squircle.png')

    print('生成传统 mipmap：')
    for density, size in MIPMAPS.items():
        _save(_art(size), RES / f'mipmap-{density}/ic_launcher.png')
        _save(_art(size, circular=True), RES / f'mipmap-{density}/ic_launcher_round.png')

    print('生成自适应前景（透明画布，内容占中心可视区 94%）：')
    for density, size in DRAWABLES.items():
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        content = round(size * ADAPTIVE_CONTENT_RATIO)
        art = _art(content, with_bg=False)
        offset = (size - content) // 2
        canvas.alpha_composite(art, (offset, offset))
        _save(canvas, RES / f'drawable-{density}/ic_launcher_emo.png')

    print('生成 App 内 logo：')
    _save(_art(256), APP_LOGO)

    if len(sys.argv) > 1:
        preview(Path(sys.argv[1]))


if __name__ == '__main__':
    main()
