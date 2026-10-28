"""Genera íconos PROVISIONALES de la app a partir de la paleta de packages/brand.

Uso: python3 tools/brand-assets/generate_icons.py
Reemplazar por el logotipo definitivo cuando se defina la marca (decisión D-17).
"""
from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (11, 37, 69, 255)      # brand.palettes.light.primary  #0B2545
TURQUOISE = (25, 195, 184, 255)  # brand.palettes.light.accent #19C3B8
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parents[2] / "apps" / "mobile" / "assets" / "images"
SIZE = 1024


def glyph(draw: ImageDraw.ImageDraw, cx: float, cy: float, scale: float, body, accent) -> None:
    """Silueta abstracta de un implante: corona, cuerpo roscado y ápice."""
    s = scale
    # Corona (pilar)
    draw.rounded_rectangle([cx - 150 * s, cy - 330 * s, cx + 150 * s, cy - 200 * s], radius=40 * s, fill=accent)
    # Cuerpo
    draw.polygon(
        [(cx - 120 * s, cy - 170 * s), (cx + 120 * s, cy - 170 * s), (cx + 85 * s, cy + 240 * s),
         (cx, cy + 330 * s), (cx - 85 * s, cy + 240 * s)],
        fill=body,
    )
    # Roscas
    for i, y in enumerate(range(-110, 220, 75)):
        half = 150 - i * 12
        draw.rounded_rectangle([cx - half * s, cy + (y - 16) * s, cx + half * s, cy + (y + 16) * s],
                               radius=16 * s, fill=body)


def make(name: str, size: int, bg, body, accent, scale: float) -> None:
    img = Image.new("RGBA", (size, size), bg)
    glyph(ImageDraw.Draw(img), size / 2, size / 2, scale * size / SIZE, body, accent)
    img.save(OUT / name)


OUT.mkdir(parents=True, exist_ok=True)
make("icon.png", SIZE, NAVY, WHITE, TURQUOISE, 1.0)
make("android-icon-foreground.png", SIZE, (0, 0, 0, 0), WHITE, TURQUOISE, 0.62)
Image.new("RGBA", (SIZE, SIZE), NAVY).save(OUT / "android-icon-background.png")
make("android-icon-monochrome.png", SIZE, (0, 0, 0, 0), WHITE, WHITE, 0.62)
make("splash-icon.png", SIZE, (0, 0, 0, 0), WHITE, TURQUOISE, 0.9)
make("favicon.png", 48, NAVY, WHITE, TURQUOISE, 1.0)
print("Íconos provisionales generados en", OUT)
