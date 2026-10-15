#!/usr/bin/env python3
"""Generate public/glyphs.json dari Playfair Display 700 (SIL OFL 1.1) — BUKAN glyphs.json milik
author asli (turunan font komersial GT Ultra, lihat DECISIONS D7 / risiko L1).

Format keluaran (dibaca lib/garden/export.ts glyphPath):
  {"faces":[{"upm":1000,"g":{"a":[advance,"M x y L x y Q cx cy x y C ... Z"], ...}}]}
y-up (koordinat font); export.ts yang flip ke y-down.

Pakai:
  python3 tools/gen-glyphs.py                       # default font di tools/fonts, wght 700
  python3 tools/gen-glyphs.py --font X.ttf --out Y.json
Butuh: fonttools (pip). Tanpa brotli (input TTF, bukan woff2).
"""
import argparse
import json
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent

# latin + latin-ext + tanda baca umum (hanya yang ada di cmap font)
RANGES = [
    (0x0021, 0x007E),  # Basic Latin (tanpa spasi — tak punya outline)
    (0x00A1, 0x024F),  # Latin-1 Supplement, Latin Extended-A/B
    (0x02BB, 0x02BC),
    (0x02C6, 0x02C6),
    (0x02DA, 0x02DC),
    (0x1E00, 0x1EFF),  # Latin Extended Additional
    (0x2010, 0x2027),  # tanda baca umum
    (0x2030, 0x203A),
    (0x20AC, 0x20AC),
    (0x2116, 0x2116),
    (0x2122, 0x2122),
    (0x2190, 0x2193),
    (0x2212, 0x2212),
]


class PathPen(BasePen):
    """Rekam kontur jadi token "M L Q C Z" dengan koordinat int."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.t = []

    @staticmethod
    def _n(v):
        r = round(v)
        return str(int(r))

    def _pt(self, p):
        return f"{self._n(p[0])} {self._n(p[1])}"

    def _moveTo(self, p):
        self.t.append("M" + self._pt(p))

    def _lineTo(self, p):
        self.t.append("L" + self._pt(p))

    def _curveToOne(self, a, b, c):
        self.t.append(f"C{self._pt(a)} {self._pt(b)} {self._pt(c)}")

    def _qCurveToOne(self, a, b):
        self.t.append(f"Q{self._pt(a)} {self._pt(b)}")

    def _closePath(self):
        self.t.append("Z")

    def _endPath(self):
        self.t.append("Z")


def build(font_path: Path, wght: float):
    font = TTFont(str(font_path))
    if "fvar" in font:
        font = instancer.instantiateVariableFont(font, {"wght": wght}, inplace=False)
    upm = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    out = {}
    for lo, hi in RANGES:
        for cp in range(lo, hi + 1):
            name = cmap.get(cp)
            if not name:
                continue
            pen = PathPen(gs)
            gs[name].draw(pen)
            d = "".join(pen.t)
            if not d:
                continue
            out[chr(cp)] = [int(round(hmtx[name][0])), d]
    return {"faces": [{"upm": upm, "g": out}]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--font", default=str(ROOT / "tools/fonts/PlayfairDisplay[wght].ttf"))
    ap.add_argument("--wght", type=float, default=700)
    ap.add_argument("--out", default=str(ROOT / "public/glyphs.json"))
    a = ap.parse_args()
    data = build(Path(a.font), a.wght)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n = len(data["faces"][0]["g"])
    size = Path(a.out).stat().st_size
    print(f"glyphs: {n} · upm {data['faces'][0]['upm']} · {size/1024:.0f} KB → {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
