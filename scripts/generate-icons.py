#!/usr/bin/env python3
"""Render extension icons at Chrome/Edge required sizes.

The icon is a rounded blue square with a stylized "bookmark ribbon" over a
page. All sizes are rendered from a single 512px master to keep them visually
consistent.
"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

MASTER = 512
SIZES = [16, 32, 48, 128]

BG = (47, 111, 235)          # accent blue
BG2 = (30, 82, 196)          # gradient bottom
PAGE = (255, 255, 255)
PAGE_LINE = (210, 214, 222)
RIBBON = (220, 60, 60)
RIBBON_SHADOW = (160, 30, 30)


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_master() -> Image.Image:
    size = MASTER
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Background gradient inside a rounded square.
    bg = Image.new("RGB", (size, size), BG)
    grad = Image.new("L", (1, size))
    for y in range(size):
        grad.putpixel((0, y), int(255 * (y / size)))
    grad = grad.resize((size, size))
    overlay = Image.new("RGB", (size, size), BG2)
    bg = Image.composite(overlay, bg, grad)
    bg.putalpha(rounded_rect_mask(size, radius=int(size * 0.22)))
    img.alpha_composite(bg)

    d = ImageDraw.Draw(img)

    # Page with a folded corner.
    m = int(size * 0.16)
    right = size - m
    bottom = size - m
    fold = int(size * 0.16)
    page = [
        (m, m),
        (right - fold, m),
        (right, m + fold),
        (right, bottom),
        (m, bottom),
    ]
    d.polygon(page, fill=PAGE)
    # Folded corner triangle.
    d.polygon(
        [(right - fold, m), (right - fold, m + fold), (right, m + fold)],
        fill=(230, 232, 236),
    )
    # Fold outline.
    d.line([(right - fold, m), (right - fold, m + fold), (right, m + fold)], fill=PAGE_LINE, width=int(size * 0.006))

    # Text lines on the page.
    line_h = int(size * 0.028)
    gap = int(size * 0.055)
    y = m + int(size * 0.20)
    left = m + int(size * 0.08)
    line_end = right - int(size * 0.10)
    for i in range(5):
        end = line_end if i % 2 == 0 else line_end - int(size * 0.14)
        d.rectangle((left, y, end, y + line_h), fill=PAGE_LINE)
        y += gap

    # Bookmark ribbon over the page.
    r_x = int(size * 0.62)
    r_y = int(size * 0.10)
    r_w = int(size * 0.14)
    r_h = int(size * 0.34)
    notch = int(size * 0.06)
    ribbon = [
        (r_x, r_y),
        (r_x + r_w, r_y),
        (r_x + r_w, r_y + r_h),
        (r_x + r_w // 2, r_y + r_h - notch),
        (r_x, r_y + r_h),
    ]
    d.polygon(ribbon, fill=RIBBON)
    # Ribbon left edge shadow.
    d.polygon(
        [(r_x, r_y), (r_x + int(size * 0.03), r_y), (r_x + int(size * 0.03), r_y + r_h - int(notch * 0.6)), (r_x, r_y + r_h)],
        fill=RIBBON_SHADOW,
    )
    return img


def main():
    master = draw_master()
    for s in SIZES:
        img = master.resize((s, s), Image.LANCZOS)
        path = OUT / f"icon-{s}.png"
        img.save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(ROOT)}  ({s}x{s})")


if __name__ == "__main__":
    main()
