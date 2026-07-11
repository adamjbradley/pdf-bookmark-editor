#!/usr/bin/env python3
"""Render Chrome Web Store promo tiles.

Chrome Web Store accepts:
  - Small tile (required):    440x280 PNG or JPEG
  - Marquee tile (optional): 1400x560 PNG or JPEG

Both are BRAND graphics, NOT screenshots. We compose the app icon on the
left, product name + tagline on the right, over a subtle gradient.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "store-assets" / "promo-tiles"
OUT.mkdir(parents=True, exist_ok=True)

ICON = ROOT / "icons" / "icon-128.png"


def find_font(size, bold=False):
    """Best-effort locate a system sans font at the requested size."""
    candidates = [
        # Debian/Ubuntu common paths
        "/usr/share/fonts/truetype/dejavu/DejaVu Sans Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in candidates:
        p = Path(c)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def gradient(size, top, bottom):
    w, h = size
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        grad.putpixel((0, y), (r, g, b))
    return grad.resize(size)


def draw_tile(width, height, path, title_size, subtitle_size, icon_size,
              title="PDF Bookmark Editor",
              subtitle="Add, rename, and delete outline bookmarks in any PDF.",
              include_footer=True):
    img = gradient((width, height), top=(47, 111, 235), bottom=(24, 60, 160))

    # Soft glow behind the icon.
    glow_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_r = int(icon_size * 0.9)
    cx = int(width * 0.20)
    cy = int(height * 0.50)
    gd = ImageDraw.Draw(glow_layer)
    gd.ellipse(
        (cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r),
        fill=(255, 255, 255, 45),
    )
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=int(icon_size * 0.15)))
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, glow_layer)

    # Icon.
    icon = Image.open(ICON).convert("RGBA")
    icon = icon.resize((icon_size, icon_size), Image.LANCZOS)
    img.alpha_composite(icon, (cx - icon_size // 2, cy - icon_size // 2))

    # Text.
    d = ImageDraw.Draw(img)
    tx = int(width * 0.36)
    title_font = find_font(title_size, bold=True)
    subtitle_font = find_font(subtitle_size)

    # Title
    ty = int(height * 0.32)
    d.text((tx, ty), title, fill=(255, 255, 255), font=title_font)

    # Wrap subtitle at ~40% width margin.
    max_w = width - tx - int(width * 0.05)
    words = subtitle.split()
    lines = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        bbox = d.textbbox((0, 0), trial, font=subtitle_font)
        tw = bbox[2] - bbox[0]
        if tw <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    sy = ty + int(title_size * 1.25)
    line_h = int(subtitle_size * 1.35)
    for line in lines[:3]:
        d.text((tx, sy), line, fill=(220, 230, 255), font=subtitle_font)
        sy += line_h

    if include_footer:
        footer_font = find_font(max(12, int(subtitle_size * 0.65)))
        d.text(
            (tx, sy + int(subtitle_size * 0.5)),
            "Local-only · No telemetry · Chrome & Edge",
            fill=(180, 200, 240),
            font=footer_font,
        )

    img = img.convert("RGB")
    img.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  ({width}x{height})")


def main():
    draw_tile(
        440, 280,
        OUT / "promo-small-440x280.png",
        title_size=28, subtitle_size=13, icon_size=110,
        include_footer=False,
    )
    draw_tile(
        1400, 560,
        OUT / "promo-marquee-1400x560.png",
        title_size=76, subtitle_size=28, icon_size=280,
    )


if __name__ == "__main__":
    main()
