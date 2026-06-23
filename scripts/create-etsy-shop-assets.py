from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "etsy-shop-assets"

COLORS = {
    "bg": (247, 243, 235),
    "ink": (31, 31, 28),
    "muted": (91, 86, 76),
    "gold": (246, 196, 83),
    "green": (132, 178, 158),
    "line": (216, 207, 190),
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "bold": ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"],
        "regular": ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/segoeui.ttf"],
    }
    for path in candidates[name]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def create_receipt_banner() -> None:
    img = Image.new("RGB", (760, 100), COLORS["bg"])
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, 760, 100], fill=COLORS["bg"])
    draw.rectangle([0, 0, 760, 4], fill=COLORS["gold"])
    draw.rectangle([0, 96, 760, 100], fill=COLORS["green"])

    draw.rounded_rectangle([24, 22, 78, 76], radius=12, fill=COLORS["ink"])
    draw.rounded_rectangle([36, 34, 66, 64], radius=6, outline=COLORS["gold"], width=3)
    draw.line([42, 34, 52, 24, 62, 34], fill=COLORS["gold"], width=3)

    draw.text((96, 21), "PRINTZ By Khan", font=font("bold", 30), fill=COLORS["ink"])
    draw.text((98, 58), "Modern printable classroom decor + custom 3D prints", font=font("regular", 18), fill=COLORS["muted"])

    draw.rounded_rectangle([560, 28, 724, 72], radius=18, fill=COLORS["ink"])
    draw.text((583, 40), "Thank you", font=font("bold", 18), fill=COLORS["gold"])

    img.save(OUT / "printz-order-receipt-banner-760x100.png", "PNG")


def create_shop_icon() -> None:
    scale = 4
    img = Image.new("RGB", (500 * scale, 500 * scale), COLORS["ink"])
    draw = ImageDraw.Draw(img)

    def s(box: list[int]) -> list[int]:
        return [value * scale for value in box]

    # Premium dark tile with a warm print-bed surface.
    draw.rounded_rectangle(s([36, 36, 464, 464]), radius=92 * scale, fill=(255, 204, 64))
    draw.rounded_rectangle(s([70, 70, 430, 430]), radius=62 * scale, outline=(31, 31, 28), width=10 * scale)

    # Abstract 3D print / package mark. It stays recognizable when Etsy crops it small.
    top = [(250 * scale, 105 * scale), (346 * scale, 158 * scale), (250 * scale, 212 * scale), (154 * scale, 158 * scale)]
    left = [(154 * scale, 158 * scale), (250 * scale, 212 * scale), (250 * scale, 326 * scale), (154 * scale, 272 * scale)]
    right = [(346 * scale, 158 * scale), (250 * scale, 212 * scale), (250 * scale, 326 * scale), (346 * scale, 272 * scale)]
    draw.polygon(top, fill=(31, 31, 28))
    draw.polygon(left, fill=(49, 49, 44))
    draw.polygon(right, fill=(69, 67, 58))

    # Negative-space P for PRINTZ.
    draw.rounded_rectangle(s([202, 154, 280, 286]), radius=18 * scale, fill=(255, 204, 64))
    draw.rounded_rectangle(s([226, 176, 303, 224]), radius=18 * scale, fill=(255, 204, 64))
    draw.rectangle(s([262, 224, 303, 248]), fill=(31, 31, 28))

    # Small filament/nozzle cue.
    draw.rounded_rectangle(s([215, 350, 285, 364]), radius=7 * scale, fill=(31, 31, 28))
    draw.rounded_rectangle(s([235, 374, 265, 404]), radius=8 * scale, fill=(31, 31, 28))
    draw.rectangle(s([246, 404, 254, 424]), fill=(31, 31, 28))

    img = img.resize((500, 500), Image.Resampling.LANCZOS)
    img.save(OUT / "printz-shop-icon-500x500.png", "PNG")
    img.resize((1000, 1000), Image.Resampling.LANCZOS).save(OUT / "printz-shop-icon-1000x1000.png", "PNG")


def create_copy_doc() -> None:
    (OUT / "etsy-shop-info-copy.txt").write_text(
        """SHOP TITLE
Printable classroom decor, digital posters, and custom 3D printed gifts

SHOP ANNOUNCEMENT
Welcome to PRINTZ By Khan. We create modern printable classroom decor, digital poster packs, and practical 3D printed gifts made for clean spaces, thoughtful gifting, and everyday use.

New digital downloads are added regularly. Digital files are available after purchase through your Etsy account. No physical item is shipped for digital listings.

MESSAGE TO BUYERS
Thank you for supporting PRINTZ By Khan. Your order helps us keep creating useful, clean, modern designs for classrooms, desks, homes, and gifts.

If you purchased a physical product, we will prepare it carefully and keep you updated through Etsy. If you have a question about your order, send us a message anytime through Etsy.

MESSAGE TO BUYERS FOR DIGITAL ITEMS
Thank you for your digital download purchase from PRINTZ By Khan.

Your files are available through your Etsy account under Purchases and Reviews. For guest checkout, Etsy will email a download link to the email used at purchase.

No physical product will be shipped for digital listings. Colors may vary slightly depending on your screen, printer, paper, and print settings. For best results, print on high-quality paper or use a local/online print shop.

RECEIPT BANNER FILE
printz-order-receipt-banner-760x100.png

SHOP ICON FILE
printz-shop-icon-500x500.png
""",
        encoding="utf-8",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    create_receipt_banner()
    create_shop_icon()
    create_copy_doc()
    print(OUT)


if __name__ == "__main__":
    main()
