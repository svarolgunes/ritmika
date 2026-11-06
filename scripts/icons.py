"""Draws the app icon, splash and adaptive icon layers (needs Pillow).

Run once with `python3 scripts/icons.py`; the PNGs are committed.
"""

import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
PURPLE = (123, 108, 246, 255)
ORANGE = (255, 138, 91, 255)
CREAM = (255, 248, 238, 255)
INK = (43, 35, 64, 255)


def draw_notes(d, size, ink, scale=1.0, cx=0.5, cy=0.5):
    """Two beamed eighth notes, the universal sign for rhythm."""
    s = size * scale
    ox = size * cx - s / 2
    oy = size * cy - s / 2

    def P(x, y):
        return (ox + x * s, oy + y * s)

    head_w, head_h = 0.22 * 1.0, 0.16
    for hx in (0.18, 0.62):
        x0, y0 = P(hx, 0.66)
        x1, y1 = P(hx + head_w, 0.66 + head_h)
        d.ellipse([x0, y0, x1, y1], fill=ink)
    stem_w = 0.045 * s
    for sx in (0.18 + head_w - 0.045, 0.62 + head_w - 0.045):
        x0, y0 = P(sx, 0.2)
        _, y1 = P(sx, 0.74)
        d.rectangle([x0, y0, x0 + stem_w, y1], fill=ink)
    # Beam
    a = P(0.18 + head_w - 0.045, 0.2)
    b = P(0.62 + head_w, 0.2)
    d.polygon([a, b, (b[0], b[1] + 0.1 * s), (a[0], a[1] + 0.1 * s)], fill=ink)


def icon():
    size = 1024
    img = Image.new('RGBA', (size, size), PURPLE)
    d = ImageDraw.Draw(img)
    d.ellipse([size * 0.12, size * 0.12, size * 0.88, size * 0.88], fill=ORANGE)
    draw_notes(d, size, (255, 255, 255, 255), scale=0.55)
    img.save(os.path.join(OUT, 'icon.png'))
    img.resize((48, 48), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'))


def splash():
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([size * 0.1, size * 0.1, size * 0.9, size * 0.9], fill=PURPLE)
    draw_notes(d, size, (255, 255, 255, 255), scale=0.55)
    img.save(os.path.join(OUT, 'splash-icon.png'))


def adaptive():
    size = 1024
    Image.new('RGBA', (size, size), PURPLE).save(os.path.join(OUT, 'android-icon-background.png'))
    fg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    d.ellipse([size * 0.25, size * 0.25, size * 0.75, size * 0.75], fill=ORANGE)
    draw_notes(d, size, (255, 255, 255, 255), scale=0.36)
    fg.save(os.path.join(OUT, 'android-icon-foreground.png'))
    mono = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw_notes(ImageDraw.Draw(mono), size, (0, 0, 0, 255), scale=0.4)
    mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))


if __name__ == '__main__':
    icon()
    splash()
    adaptive()
