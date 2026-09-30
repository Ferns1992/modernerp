#!/usr/bin/env python3
"""Generate a self-hosted product image per demo SKU.

No external placeholder service: the receipt, POS grid and inventory table all
render these straight from /demo/products/, so the demo data looks the same
offline and cannot break when a third-party host changes.
"""
import os
import re
import pathlib

# sku -> (label, glyph, top colour, bottom colour)
STYLE = {
    "BEV": ("#0EA5E9", "#0369A1"),
    "FOD": ("#F59E0B", "#B45309"),
    "FRZ": ("#06B6D4", "#0E7490"),
    "CAN": ("#EF4444", "#991B1B"),
    "HOM": ("#10B981", "#047857"),
    "PCA": ("#EC4899", "#9D174D"),
    "ELC": ("#8B5CF6", "#5B21B6"),
}

GLYPH = {
    "cup": '<path d="M52 46h56l-6 40a10 10 0 0 1-10 9H68a10 10 0 0 1-10-9z" fill="#fff" fill-opacity=".92"/><path d="M108 54h10a12 12 0 0 1 0 24h-8" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="7" stroke-linecap="round"/><rect x="44" y="34" width="72" height="12" rx="6" fill="#fff" fill-opacity=".92"/>',
    "bag": '<path d="M44 48h72l-6 44a10 10 0 0 1-10 8H60a10 10 0 0 1-10-8z" fill="#fff" fill-opacity=".92"/><path d="M66 56V44a14 14 0 0 1 28 0v12" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="7" stroke-linecap="round"/><rect x="64" y="66" width="32" height="8" rx="4" fill="#000" fill-opacity=".18"/>',
    "box": '<rect x="42" y="50" width="76" height="46" rx="8" fill="#fff" fill-opacity=".92"/><path d="M42 64h76M80 50v46" stroke="#000" stroke-opacity=".18" stroke-width="6"/><path d="M58 50V38h44v12" fill="none" stroke="#fff" stroke-opacity=".92" stroke-width="7" stroke-linejoin="round"/>',
    "bottle": '<path d="M66 34h28v14l10 12v34a8 8 0 0 1-8 8H64a8 8 0 0 1-8-8V60l10-12z" fill="#fff" fill-opacity=".92"/><rect x="64" y="26" width="32" height="10" rx="5" fill="#fff" fill-opacity=".7"/><rect x="60" y="66" width="40" height="18" rx="4" fill="#000" fill-opacity=".16"/>',
    "can": '<rect x="50" y="52" width="60" height="48" rx="8" fill="#fff" fill-opacity=".92"/><ellipse cx="80" cy="52" rx="30" ry="9" fill="#fff" fill-opacity=".7"/><rect x="60" y="68" width="40" height="7" rx="3.5" fill="#000" fill-opacity=".18"/>',
    "device": '<rect x="40" y="44" width="80" height="52" rx="10" fill="#fff" fill-opacity=".92"/><rect x="52" y="56" width="56" height="22" rx="4" fill="#000" fill-opacity=".18"/><circle cx="80" cy="88" r="4" fill="#000" fill-opacity=".3"/>',
}

BY_WORD = [
    ("coffee", "cup"), ("chai", "cup"), ("juice", "cup"), ("water", "bottle"),
    ("soap", "bottle"), ("bleach", "bottle"), ("liquid", "bottle"),
    ("rice", "bag"), ("paratha", "bag"), ("gyoza", "bag"),
    ("sardines", "can"), ("leche", "can"), ("canton", "box"),
    ("salt", "box"), ("turmeric", "box"), ("combo", "device"),
]


def pick_glyph(name: str) -> str:
    low = name.lower()
    for word, glyph in BY_WORD:
        if word in low:
            return GLYPH[glyph]
    return GLYPH["box"]


def pick_family(sku: str) -> str:
    return sku.split("-")[1] if "-" in sku else "FOD"


def main() -> None:
    root = pathlib.Path(__file__).resolve().parent.parent / "public" / "demo" / "products"
    root.mkdir(parents=True, exist_ok=True)
    src = pathlib.Path(__file__).resolve().parent.parent / "server.ts"
    text = src.read_text()

    # Pull every ["Name", price, cost, stock, "SKU"] tuple out of the demo seed.
    pattern = re.compile(r'\["([^"]+)",\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*"([A-Z]{2}-[A-Z]+-\d+)"\]')
    rows = pattern.findall(text)
    if not rows:
        raise SystemExit("no demo items found in server.ts")

    for name, price, _cost, _stock, sku in rows:
        top, bottom = STYLE.get(pick_family(sku), ("#64748B", "#334155"))
        words = name.split()
        line1 = " ".join(words[:3])
        line2 = " ".join(words[3:6])
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="{name}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{top}"/>
      <stop offset="100%" stop-color="{bottom}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" fill="url(#g)"/>
  <circle cx="130" cy="26" r="44" fill="#fff" fill-opacity=".08"/>
  {pick_glyph(name)}
  <rect x="10" y="112" width="140" height="40" rx="8" fill="#000" fill-opacity=".26"/>
  <text x="80" y="129" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">{line1[:22]}</text>
  <text x="80" y="145" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#fff">{line2[:22]}</text>
</svg>
"""
        (root / f"{sku.lower()}.svg").write_text(svg)
    print(f"wrote {len(rows)} product images to {root}")


if __name__ == "__main__":
    main()
