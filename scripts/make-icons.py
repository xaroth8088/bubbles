"""Render our original vector-like app mark. Optional; generated PNGs ship with the game."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "icons"
SCALE = 3

def draw_icon(size, maskable=False):
    canvas = Image.new("RGB", (512 * SCALE, 512 * SCALE), "#e4efdc")
    draw = ImageDraw.Draw(canvas)
    def ellipse(box, fill):
        draw.ellipse(tuple(round(v * SCALE) for v in box), fill=fill, outline="#346551", width=9 * SCALE)
    # The complete mark fits inside the central 80% maskable safe region.
    ellipse((88, 181, 324, 417), "#96c5b2")
    ellipse((267, 123, 427, 283), "#cce0b0")
    ellipse((132, 82, 230, 180), "#f8f7e9")
    draw.arc(tuple(v * SCALE for v in (130, 221, 279, 365)), 195, 270, fill="#f5f8ed", width=12 * SCALE)
    draw.arc(tuple(v * SCALE for v in (303, 157, 390, 248)), 195, 270, fill="#f5f8ed", width=10 * SCALE)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)

ROOT.mkdir(exist_ok=True)
draw_icon(192).save(ROOT / "icon-192.png")
draw_icon(512).save(ROOT / "icon-512.png")
draw_icon(512, True).save(ROOT / "maskable-512.png")
print("Rendered 192px, 512px, and maskable app icons.")
