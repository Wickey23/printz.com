from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "output" / "digital-products" / "modern-teacher-desk-quote-poster-pack"
PNG_DIR = BASE / "png"
OUT = BASE / "etsy-listing-images"

COLORS = {
    "paper": (247, 243, 235),
    "bg": (235, 229, 216),
    "ink": (31, 31, 28),
    "muted": (93, 88, 78),
    "gold": (246, 196, 83),
    "green": (132, 178, 158),
    "blue": (128, 159, 190),
    "clay": (204, 151, 122),
    "white": (255, 255, 255),
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "bold": ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"],
        "regular": ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf"],
        "serif": ["C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/georgia.ttf"],
    }
    for path in candidates[name]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def shadowed_paste(canvas: Image.Image, item: Image.Image, xy: tuple[int, int], shadow_offset=(18, 22)) -> None:
    x, y = xy
    shadow = Image.new("RGBA", (item.width + 80, item.height + 80), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle(
        [40 + shadow_offset[0], 40 + shadow_offset[1], item.width + 40 + shadow_offset[0], item.height + 40 + shadow_offset[1]],
        radius=18,
        fill=(0, 0, 0, 55),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    canvas.paste(shadow, (x - 40, y - 40), shadow)
    canvas.paste(item, xy)


def poster(path: str, size: tuple[int, int]) -> Image.Image:
    return Image.open(PNG_DIR / path).convert("RGB").resize(size, Image.Resampling.LANCZOS)


def draw_title(draw: ImageDraw.ImageDraw, title: str, subtitle: str = "") -> None:
    draw.text((92, 86), title, font=font("bold", 86), fill=COLORS["ink"])
    if subtitle:
        draw.text((96, 188), subtitle, font=font("regular", 38), fill=COLORS["muted"])


def create_main_zoom() -> Image.Image:
    img = Image.new("RGB", (2000, 2000), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    draw_title(draw, "Teacher Desk Quote Poster Pack", "10 printable posters for a calm, modern classroom")
    p1 = poster("01-small-steps-letter.png", (640, 828))
    p2 = poster("02-mistakes-help-letter.png", (640, 828))
    p3 = poster("03-kind-words-letter.png", (640, 828))
    shadowed_paste(img, p1, (120, 520))
    shadowed_paste(img, p2, (680, 430))
    shadowed_paste(img, p3, (1240, 520))
    draw.rounded_rectangle([1210, 260, 1850, 390], radius=28, fill=COLORS["ink"])
    draw.text((1260, 290), "PDF + PNG", font=font("bold", 48), fill=COLORS["white"])
    draw.text((1522, 290), "Files", font=font("bold", 48), fill=COLORS["gold"])
    return img


def create_whats_included() -> Image.Image:
    img = Image.new("RGB", (2000, 2000), COLORS["paper"])
    draw = ImageDraw.Draw(img)
    draw_title(draw, "What's Included", "Everything ready to upload as a digital Etsy product")

    items = [
        ("10", "Poster designs"),
        ("6", "Print sizes"),
        ("60", "High-resolution PNG files"),
        ("6", "Multi-page PDF packs"),
    ]
    colors = [COLORS["gold"], COLORS["green"], COLORS["blue"], COLORS["clay"]]
    for i, ((num, label), color) in enumerate(zip(items, colors)):
        x = 160 + (i % 2) * 850
        y = 430 + (i // 2) * 430
        draw.rounded_rectangle([x, y, x + 700, y + 300], radius=34, fill=(255, 255, 255), outline=(217, 209, 194), width=4)
        draw.rounded_rectangle([x + 44, y + 48, x + 172, y + 176], radius=28, fill=color)
        draw.text((x + 78, y + 72), num, font=font("bold", 56), fill=COLORS["ink"])
        draw.text((x + 220, y + 82), label, font=font("bold", 40), fill=COLORS["ink"])
        draw.text((x + 220, y + 145), "Instant digital download", font=font("regular", 30), fill=COLORS["muted"])

    draw.rounded_rectangle([220, 1410, 1780, 1605], radius=38, fill=COLORS["ink"])
    draw.text((305, 1460), "No physical item will be shipped.", font=font("bold", 58), fill=COLORS["white"])
    return img


def create_digital_notice() -> Image.Image:
    img = Image.new("RGB", (2000, 2000), COLORS["bg"])
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([150, 180, 1850, 1820], radius=54, fill=COLORS["paper"], outline=(215, 206, 190), width=6)
    draw.text((330, 420), "DIGITAL", font=font("bold", 150), fill=COLORS["ink"])
    draw.text((330, 585), "DOWNLOAD", font=font("bold", 150), fill=COLORS["gold"])
    draw.text((340, 820), "No physical product will be shipped.", font=font("bold", 58), fill=COLORS["ink"])
    lines = [
        "Download after purchase",
        "Print at home, school, or local print shop",
        "Includes 6 PDF sizes and 60 PNG files",
        "For personal classroom use",
    ]
    for idx, line in enumerate(lines):
        y = 1030 + idx * 130
        draw.ellipse([340, y + 12, 380, y + 52], fill=COLORS["green"])
        draw.text((420, y), line, font=font("regular", 46), fill=COLORS["muted"])
    return img


def create_classroom_mockup() -> Image.Image:
    img = Image.new("RGB", (2000, 2000), (226, 219, 204))
    draw = ImageDraw.Draw(img)
    # wall and desk
    draw.rectangle([0, 0, 2000, 1380], fill=(238, 233, 224))
    draw.rectangle([0, 1380, 2000, 2000], fill=(160, 126, 91))
    draw.rectangle([0, 1365, 2000, 1405], fill=(118, 91, 66))

    p1 = poster("01-small-steps-letter.png", (360, 466))
    p2 = poster("02-mistakes-help-letter.png", (360, 466))
    p3 = poster("05-progress-letter.png", (360, 466))
    shadowed_paste(img, p1, (330, 350), (12, 18))
    shadowed_paste(img, p2, (820, 300), (12, 18))
    shadowed_paste(img, p3, (1310, 350), (12, 18))

    # simple desk objects
    draw.rounded_rectangle([250, 1510, 620, 1710], radius=32, fill=(31, 31, 28))
    draw.rectangle([300, 1450, 340, 1585], fill=COLORS["gold"])
    draw.rectangle([360, 1435, 400, 1585], fill=COLORS["green"])
    draw.rectangle([420, 1460, 460, 1585], fill=COLORS["blue"])
    draw.rounded_rectangle([1350, 1510, 1700, 1650], radius=30, fill=(247, 243, 235), outline=(213, 205, 190), width=4)
    draw.text((1395, 1552), "Teacher Desk", font=font("bold", 42), fill=COLORS["ink"])

    draw.text((170, 110), "Style them on a classroom wall", font=font("bold", 74), fill=COLORS["ink"])
    draw.text((174, 205), "Neutral, modern printables for teacher spaces", font=font("regular", 38), fill=COLORS["muted"])
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    assets = {
        "01-main-preview-zoomed.png": create_main_zoom(),
        "02-whats-included.png": create_whats_included(),
        "03-digital-download-notice.png": create_digital_notice(),
        "04-classroom-wall-mockup.png": create_classroom_mockup(),
    }
    for name, image in assets.items():
        image.save(OUT / name, "PNG")
        print(OUT / name)


if __name__ == "__main__":
    main()
