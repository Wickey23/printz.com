from __future__ import annotations

import math
import textwrap
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "digital-products" / "modern-teacher-desk-quote-poster-pack"
PNG_DIR = OUT / "png"
PDF_DIR = OUT / "pdf"

POSTERS = [
    {
        "slug": "small-steps",
        "headline": "Small Steps",
        "subhead": "Every Day",
        "caption": "Growth is built one choice at a time.",
        "accent": (246, 196, 83),
    },
    {
        "slug": "mistakes-help",
        "headline": "Mistakes",
        "subhead": "Help Us Learn",
        "caption": "Try again. Try differently. Keep going.",
        "accent": (132, 178, 158),
    },
    {
        "slug": "kind-words",
        "headline": "Kind Words",
        "subhead": "Build Strong Minds",
        "caption": "Speak with care. Listen with respect.",
        "accent": (204, 151, 122),
    },
    {
        "slug": "read-think-wonder",
        "headline": "Read",
        "subhead": "Think. Wonder.",
        "caption": "Questions are where learning begins.",
        "accent": (128, 159, 190),
    },
    {
        "slug": "progress",
        "headline": "Progress",
        "subhead": "Over Perfection",
        "caption": "Better is better, even when it is not perfect.",
        "accent": (176, 151, 197),
    },
    {
        "slug": "ideas-matter",
        "headline": "Your Ideas",
        "subhead": "Matter",
        "caption": "This classroom is better because you are here.",
        "accent": (224, 152, 146),
    },
    {
        "slug": "fresh-start",
        "headline": "Today Is",
        "subhead": "A Fresh Start",
        "caption": "Begin again with courage and curiosity.",
        "accent": (119, 166, 181),
    },
    {
        "slug": "brave-questions",
        "headline": "Ask Brave",
        "subhead": "Questions",
        "caption": "Wondering out loud is part of learning.",
        "accent": (199, 169, 103),
    },
    {
        "slug": "choose-kindness",
        "headline": "Choose",
        "subhead": "Kindness",
        "caption": "The words we use shape the room we share.",
        "accent": (154, 181, 139),
    },
    {
        "slug": "focus-growth",
        "headline": "Focus On",
        "subhead": "Growth",
        "caption": "You do not have to be finished to be improving.",
        "accent": (178, 134, 158),
    },
]

SIZES = {
    "5x7": (1500, 2100),
    "8x10": (2400, 3000),
    "letter": (2550, 3300),  # 8.5 x 11 at 300 DPI
    "11x14": (3300, 4200),
    "a4": (2480, 3508),  # A4 at 300 DPI
    "16x20": (4800, 6000),
}

COLORS = {
    "paper": (247, 243, 235),
    "ink": (31, 31, 28),
    "muted": (98, 92, 82),
    "line": (213, 205, 190),
    "soft": (239, 232, 218),
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "bold": [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/segoeuib.ttf",
        ],
        "regular": [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
        ],
        "serif": [
            "C:/Windows/Fonts/georgiab.ttf",
            "C:/Windows/Fonts/georgia.ttf",
        ],
    }

    for path in candidates[name]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)

    return ImageFont.load_default(size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def fit_font(draw: ImageDraw.ImageDraw, name: str, text: str, start_size: int, max_width: int, min_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size >= min_size:
        candidate = font(name, size)
        if text_size(draw, text, candidate)[0] <= max_width:
            return candidate
        size -= 4
    return font(name, min_size)


def centered(draw: ImageDraw.ImageDraw, y: int, text: str, fnt: ImageFont.ImageFont, fill, width: int) -> int:
    tw, th = text_size(draw, text, fnt)
    draw.text(((width - tw) / 2, y), text, font=fnt, fill=fill)
    return y + th


def wrap_centered(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    fnt: ImageFont.ImageFont,
    fill,
    width: int,
    max_width: int,
    line_gap: int,
) -> int:
    avg_char = max(text_size(draw, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", fnt)[0] / 26, 1)
    chars = max(10, math.floor(max_width / avg_char))
    lines = textwrap.wrap(text, width=chars)
    for line in lines:
        y = centered(draw, y, line, fnt, fill, width) + line_gap
    return y


def draw_poster(spec: dict, size: tuple[int, int]) -> Image.Image:
    width, height = size
    img = Image.new("RGB", size, COLORS["paper"])
    draw = ImageDraw.Draw(img)

    scale = width / 2550
    margin = int(190 * scale)
    accent = spec["accent"]

    # Border and soft offset panels.
    draw.rounded_rectangle(
        [margin, margin, width - margin, height - margin],
        radius=int(34 * scale),
        outline=COLORS["line"],
        width=max(4, int(6 * scale)),
    )
    draw.rounded_rectangle(
        [margin + int(55 * scale), margin + int(55 * scale), width - margin - int(55 * scale), height - margin - int(55 * scale)],
        radius=int(28 * scale),
        outline=(229, 221, 205),
        width=max(2, int(3 * scale)),
    )

    # Top marker.
    top_y = int(height * 0.18)
    pill_w = int(width * 0.24)
    pill_h = int(58 * scale)
    draw.rounded_rectangle(
        [(width - pill_w) / 2, top_y, (width + pill_w) / 2, top_y + pill_h],
        radius=pill_h // 2,
        fill=accent,
    )

    # Decorative classroom desk marks.
    for offset in [0.18, 0.5, 0.82]:
        x = int(width * offset)
        draw.line([(x - int(38 * scale), height - margin - int(140 * scale)), (x + int(38 * scale), height - margin - int(140 * scale))], fill=accent, width=max(4, int(6 * scale)))

    max_text_width = int(width * 0.72)
    headline_font = fit_font(draw, "bold", spec["headline"].upper(), int(190 * scale), max_text_width, int(96 * scale))
    subhead_font = fit_font(draw, "serif", spec["subhead"], int(132 * scale), max_text_width, int(76 * scale))
    caption_font = font("regular", int(54 * scale))
    brand_font = font("bold", int(34 * scale))

    y = int(height * 0.35)
    y = centered(draw, y, spec["headline"].upper(), headline_font, COLORS["ink"], width)
    y += int(18 * scale)
    y = centered(draw, y, spec["subhead"], subhead_font, COLORS["ink"], width)
    y += int(80 * scale)
    wrap_centered(draw, y, spec["caption"], caption_font, COLORS["muted"], width, int(width * 0.66), int(18 * scale))

    brand = "PRINTZ BY KHAN"
    bw, bh = text_size(draw, brand, brand_font)
    draw.text(((width - bw) / 2, height - margin - int(88 * scale)), brand, font=brand_font, fill=COLORS["muted"])

    return img


def save_pdf(images: list[Image.Image], out_path: Path) -> None:
    first, rest = images[0], images[1:]
    first.save(out_path, "PDF", resolution=300.0, save_all=True, append_images=rest)


def create_preview(letter_images: list[Image.Image]) -> Image.Image:
    card_w, card_h = 520, 672
    preview = Image.new("RGB", (2400, 1600), (235, 229, 216))
    draw = ImageDraw.Draw(preview)
    title_font = font("bold", 82)
    sub_font = font("regular", 38)

    draw.text((120, 90), "Modern Teacher Desk Quote Poster Pack", font=title_font, fill=COLORS["ink"])
    draw.text((124, 190), "10 printable classroom posters - 6 sizes, PDFs, and PNG files", font=sub_font, fill=COLORS["muted"])

    positions = [(140, 340), (715, 340), (1290, 340), (140, 1020), (715, 1020), (1290, 1020)]
    for img, (x, y) in zip(letter_images, positions):
        thumb = img.resize((card_w, card_h), Image.Resampling.LANCZOS)
        shadow = Image.new("RGBA", (card_w + 34, card_h + 34), (0, 0, 0, 0))
        sdraw = ImageDraw.Draw(shadow)
        sdraw.rounded_rectangle([20, 20, card_w + 20, card_h + 20], radius=24, fill=(0, 0, 0, 54))
        preview.paste(shadow, (x - 10, y - 5), shadow)
        preview.paste(thumb, (x, y))

    badge_font = font("bold", 44)
    draw.rounded_rectangle([1840, 355, 2265, 515], radius=30, fill=(31, 31, 28))
    draw.text((1890, 382), "Instant", font=badge_font, fill=(247, 243, 235))
    draw.text((1890, 438), "Download", font=badge_font, fill=(246, 196, 83))

    return preview


def main() -> None:
    PNG_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)

    rendered: dict[str, list[Image.Image]] = {key: [] for key in SIZES}

    for size_name, size in SIZES.items():
        for index, spec in enumerate(POSTERS, start=1):
            img = draw_poster(spec, size)
            rendered[size_name].append(img)
            img.save(PNG_DIR / f"{index:02d}-{spec['slug']}-{size_name}.png", "PNG")

    for size_name, images in rendered.items():
        save_pdf(images, PDF_DIR / f"PRINTZ-modern-teacher-desk-quote-poster-pack-{size_name}.pdf")

    preview = create_preview(rendered["letter"])
    preview.save(OUT / "etsy-preview-modern-teacher-desk-quote-poster-pack.png", "PNG")

    readme = OUT / "etsy-listing-copy.txt"
    readme.write_text(
        """TITLE
Modern Teacher Desk Quote Poster Pack | 10 Printable Classroom Decor Prints | Neutral Teacher Wall Art | Digital Download

PRICE
$5.99

DESCRIPTION
Printable modern classroom poster pack for teachers, classroom corners, teacher desks, and back-to-school setup.

This digital download includes 10 clean, neutral classroom quote posters designed for a modern classroom look. Print at home, at school, or through a local/online print shop.

Included:
- 10 poster designs
- 6 PDF size packs: 5x7, 8x10, Letter, 11x14, A4, and 16x20
- 60 high-resolution PNG files, one for every poster and size
- Neutral modern classroom style

Poster phrases:
- Small Steps Every Day
- Mistakes Help Us Learn
- Kind Words Build Strong Minds
- Read. Think. Wonder.
- Progress Over Perfection
- Your Ideas Matter
- Today Is A Fresh Start
- Ask Brave Questions
- Choose Kindness
- Focus On Growth

Suggested uses:
- Teacher desk decor
- Classroom wall decor
- Reading corner
- Calm corner
- Back-to-school classroom setup
- Teacher appreciation gift

This is a digital download. No physical product will be shipped. Colors may vary slightly based on printer, paper, and screen settings.

TAGS
teacher poster, classroom decor, teacher printable, classroom poster, teacher desk decor, neutral classroom, digital download, teacher wall art, classroom quotes, printable poster, back to school, teacher gift, school decor

FILES TO UPLOAD TO ETSY
1. PRINTZ-modern-teacher-desk-quote-poster-pack.zip
2. Use etsy-preview-modern-teacher-desk-quote-poster-pack.png as the main listing image.
""",
        encoding="utf-8",
    )

    zip_path = OUT / "PRINTZ-modern-teacher-desk-quote-poster-pack.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(PNG_DIR.glob("*.png")):
            zf.write(path, path.relative_to(OUT))
        for path in sorted(PDF_DIR.glob("*.pdf")):
            zf.write(path, path.relative_to(OUT))
        zf.write(readme, readme.relative_to(OUT))

    print(f"Created {zip_path}")


if __name__ == "__main__":
    main()
