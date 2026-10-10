#!/usr/bin/env python3
"""Import the six user-supplied D&D Ability images as local PNGs.

These files are presentation-only; gameplay, stats and HUD geometry are untouched.
"""
from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image

ICONS = {
    "str": "0LszUJq",
    "dex": "OG4jQya",
    "con": "D70m0kz",
    "int": "PghRPyk",
    "wis": "2s3wpy9",
    "cha": "cc7IdxM",
}
OUTPUT = Path("Assets/Icons/stats")
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
        attributes = dict(attrs)
        if (attributes.get("property") or attributes.get("name")) not in {
            "og:image", "twitter:image", "twitter:image:src"
        }:
            return
        image_url = unescape(attributes.get("content", "")).replace("&amp;", "&")
        parsed = urlparse(image_url)
        if parsed.scheme == "https" and parsed.hostname in {
            "i.imgur.com", "imgur.com", "www.imgur.com"
        } and image_url not in self.images:
            self.images.append(image_url)


def download(url: str) -> bytes:
    request = Request(url, headers=HEADERS)
    with urlopen(request, timeout=30) as response:
        data = response.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise ValueError("Image exceeds the 16 MiB limit")
    return data


def preserve_png(data: bytes) -> tuple[bytes, tuple[int, int]]:
    with Image.open(BytesIO(data)) as image:
        image.load()
        dimensions = image.size
        if min(dimensions) < 32 or max(dimensions) > 8192:
            raise ValueError(f"Unexpected icon dimensions: {dimensions}")
        if image.format == "PNG":
            return data, dimensions
        out = BytesIO()
        image.convert("RGBA").save(out, format="PNG")
        return out.getvalue(), dimensions


def image_sources(image_id: str):
    # Both the raw host and the exact page-style URL provided by the user.
    yield f"https://i.imgur.com/{image_id}.png"
    yield f"https://imgur.com/{image_id}.png"
    yield f"https://i.imgur.com/{image_id}.jpg"
    yield f"https://i.imgur.com/{image_id}.webp"
    page_url = f"https://imgur.com/{image_id}"
    try:
        page = download(page_url).decode("utf-8", errors="replace")
        parser = ImgurMetaParser()
        parser.feed(page)
        yield from parser.images
    except Exception as exc:
        print(f"  Metadata unavailable for {page_url}: {exc}")


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for stat, image_id in ICONS.items():
        destination = OUTPUT / f"{stat}.png"
        if destination.exists():
            try:
                preserve_png(destination.read_bytes())
                print(f"EXISTS: {destination}")
                continue
            except Exception:
                print(f"INVALID: replacing {destination}")
        errors = []
        for url in image_sources(image_id):
            try:
                png, dimensions = preserve_png(download(url))
                destination.write_bytes(png)
                print(f"OK: {destination} ({dimensions[0]}x{dimensions[1]}) <- {url}")
                break
            except Exception as exc:
                errors.append(f"{url}: {exc}")
        else:
            missing.append(stat)
            print(f"FAILED: {stat}; " + " | ".join(errors))
    print(f"RESULT: {len(ICONS)-len(missing)}/{len(ICONS)} ability images imported")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
