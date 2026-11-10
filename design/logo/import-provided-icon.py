#!/usr/bin/env python3
"""把用户提供的最终 LOGO 转成 Android 各尺寸图标（不再做二次设计）。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/logo/source-provided.png'
SS = 4


def load_square() -> Image.Image:
    im = Image.open(SRC).convert('RGBA')
    w, h = im.size
    px = im.load()
    alpha = Image.new('L', im.size, 0)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            m = min(r, g, b)
            # 只去掉纯白底；黑色方块、青色/紫色渐变条和边缘辉光保留
            ap[x, y] = 0 if m >= 244 else 255 if m <= 232 else int((244 - m) * 255 / 12)
    im.putalpha(alpha)
    bbox = im.getbbox()
    im = im.crop(bbox)
    # 补成正方形，保留一点呼吸空间
    side = max(im.size)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas


def circle_mask(size):
    m = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def rounded_mask(size, radius):
    m = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size * SS - 1, size * SS - 1), radius=radius * SS, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


def main():
    art = load_square()
    res = ROOT / 'android/app/src/main/res'

    # 传统方形/圆形图标
    for density, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        square = art.resize((px, px), Image.LANCZOS)
        square.putalpha(ImageChops.multiply(square.getchannel('A'), rounded_mask(px, int(px * 0.22))))
        save(square, res / f'mipmap-{density}/ic_launcher.png')

        rnd = art.resize((px, px), Image.LANCZOS)
        rnd.putalpha(ImageChops.multiply(rnd.getchannel('A'), circle_mask(px)))
        save(rnd, res / f'mipmap-{density}/ic_launcher_round.png')

    # 自适应前景：内容缩到 66dp 安全区，背景保持深色
    for density, px in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)]:
        canvas = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        side = int(px * 66 / 108)
        fg = art.resize((side, side), Image.LANCZOS)
        canvas.alpha_composite(fg, ((px - side) // 2, (px - side) // 2))
        save(canvas, res / f'drawable-{density}/ic_launcher_emo.png')

    # 1024 主视觉与圆形/自适应预览
    save(art.resize((1024, 1024), Image.LANCZOS), ROOT / 'design/icon-1024.png')
    rnd = art.resize((1024, 1024), Image.LANCZOS)
    rnd.putalpha(ImageChops.multiply(rnd.getchannel('A'), circle_mask(1024)))
    save(rnd, ROOT / 'design/icon-round.png')
    save(art.resize((1024, 1024), Image.LANCZOS), ROOT / 'design/icon-squircle.png')
    save(art.resize((256, 256), Image.LANCZOS), ROOT / 'src/resources/images/emo-logo.png')

    # 预览图
    from PIL import ImageFont
    f = ImageFont.load_default(size=15)
    sheet = Image.new('RGB', (1240, 680), (246, 245, 250))
    d = ImageDraw.Draw(sheet)
    main = art.resize((360, 360), Image.LANCZOS)
    card = Image.new('RGB', (420, 440), (255, 255, 255)); cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, 419, 439), radius=26, fill=(255, 255, 255), outline=(228, 226, 238))
    card.paste(main, (30, 30), main); cd.text((30, 408), '1024 x 1024', font=f, fill=(60, 55, 75))
    sheet.paste(card, (36, 36))
    def darkcard(img, label, x, w=240, h=220):
        c = Image.new('RGB', (w, h), (19, 17, 26)); im = img.copy(); im.thumbnail((160, 160), Image.LANCZOS)
        c.paste(im, ((w - im.size[0]) // 2, 24), im); ImageDraw.Draw(c).text((16, h - 34), label, font=f, fill=(212, 206, 228))
        sheet.paste(c, (x, 36))
    darkcard(Image.open(ROOT / 'design/icon-round.png').convert('RGBA'), 'round 1024', 492)
    darkcard(Image.open(ROOT / 'src/resources/images/emo-logo.png').convert('RGBA'), 'in-app 256', 742)
    for i, (label, path) in enumerate([('192 x 192', 'mipmap-xxxhdpi/ic_launcher.png'), ('96 x 96', 'mipmap-xhdpi/ic_launcher.png'), ('48 x 48', 'mipmap-mdpi/ic_launcher.png')]):
        im = Image.open(res / path).convert('RGBA'); im.thumbnail((140, 140), Image.LANCZOS)
        c = Image.new('RGB', (190, 210), (255, 255, 255)); cd = ImageDraw.Draw(c)
        cd.rounded_rectangle((0, 0, 189, 209), radius=18, fill=(255, 255, 255), outline=(228, 226, 238))
        c.paste(im, ((190 - im.size[0]) // 2, 24), im); cd.text((18, 176), label, font=f, fill=(60, 55, 75))
        sheet.paste(c, (492 + i * 200, 290))
    fg = Image.open(res / 'drawable-xxxhdpi/ic_launcher_emo.png').convert('RGBA').resize((720, 720), Image.LANCZOS)
    sim = Image.new('RGBA', (720, 720), (11, 11, 18, 255)); sim.alpha_composite(fg, (0, 0))
    mask = Image.new('L', (720, 720), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, 719, 719), radius=162, fill=255)
    sim.putalpha(mask); sim = sim.resize((150, 150), Image.LANCZOS)
    c = Image.new('RGB', (190, 210), (255, 255, 255)); c.paste(sim, (20, 20), sim)
    cd = ImageDraw.Draw(c); cd.text((18, 176), 'adaptive 108dp', font=f, fill=(60, 55, 75))
    sheet.paste(c, (1092, 290))
    sheet.save(ROOT / 'design/icon-preview.png')
    print('provided logo imported')


if __name__ == '__main__':
    main()
