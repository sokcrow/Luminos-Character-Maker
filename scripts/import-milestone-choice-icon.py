#!/usr/bin/env python3
"""Download the Stat or Trait milestone choice icon from Imgur, keeping local PNG assets."""
from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image

ICONS = {
    "stat-or-trait": "GDTFckz",
}
OUTPUT = Path("Assets/Icons/milestones")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}


class ImgurMetaParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        attrs = dict(attrs)
        if (attrs.get("property") or attrs.get("name")) in {
            "og:image", "twitter:image", "twitter:image:src"
        }:
            url = unescape(attrs.get("content", "")).replace("&amp;", "&")
            parsed = urlparse(url)
            if parsed.scheme == "https" and parsed.hostname in {
                "i.imgur.com", "imgur.com", "www.imgur.com"
            } and url not in self.images:
                self.images.append(url)


def download(url: str) -> bytes:
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=25) as response:
        data = response.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise ValueError("Image is larger than 16 MiB")
    return data


def normalize_png(data: bytes) -> tuple[bytes, tuple[int, int]]:
    with Image.open(BytesIO(data)) as img:
        img.load()
        dimensions = img.size
        if img.width < 64 or img.height < 64:
            raise ValueError(f"Image too small: {dimensions}")
        if img.format == "PNG":
            return data, dimensions  # Preserve original PNG and transparency.
        buffer = BytesIO()
        img.convert("RGBA").save(buffer, format="PNG")
        return buffer.getvalue(), dimensions


def candidates(image_id: str):
    # Direct image URLs first; fall back to the extensionless Imgur page.
    yield f"https://i.imgur.com/{image_id}.png"
    yield f"https://i.imgur.com/{image_id}.jpg"
    yield f"https://i.imgur.com/{image_id}.webp"
    page_url = f"https://imgur.com/{image_id}"
    try:
        page = download(page_url).decode("utf-8", errors="replace")
        parser = ImgurMetaParser()
        parser.feed(page)
        yield from parser.images
    except Exception as exc:
        print(f"  Page metadata unavailable for {page_url}: {exc}")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for name, image_id in ICONS.items():
        dest = OUTPUT / f"{name}.png"
        if dest.exists():
            try:
                normalize_png(dest.read_bytes())
                print(f"EXISTS: {dest}")
                continue
            except Exception:
                print(f"REPLACING INVALID: {dest}")
        errors = []
        for url in candidates(image_id):
            try:
                data, dimensions = normalize_png(download(url))
                dest.write_bytes(data)
                print(f"OK: {dest} ({dimensions[0]}x{dimensions[1]}) <- {url}")
                break
            except Exception as exc:
                errors.append(f"{url}: {exc}")
        else:
            missing.append(name)
            print(f"FAILED: {name}; " + " | ".join(errors))
    total = len(ICONS) - len(missing)
    print(f"RESULT: {total}/{len(ICONS)} milestone choice icons available")
    if missing:
        print("MISSING: " + ", ".join(missing))
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
