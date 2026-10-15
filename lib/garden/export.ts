// Export: PNG, SVG (huruf sebagai <path> dari glyphs.json hasil generate sendiri), video, PNG frames.
// Port dari blok `// ---------- export ----------` + `// ---------- SVG ----------` di
// original-source.txt. glyphs.json = turunan Playfair Display (OFL) via tools/gen-glyphs.py —
// BUKAN glyphs.json milik author (turunan font komersial GT Ultra, L1).

import type { Pt } from "./types";
import type { Backend } from "./draw";
import { path, type PathSink } from "./geometry";
import type { GardenEngine } from "./engine";

// ---------- util ----------

/** Unduh Blob lewat <a download>. */
export function download(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- PNG ----------

/** Export PNG: paint tanpa caret & gift (sama dengan source), lalu toBlob. */
export function savePNG(engine: GardenEngine): void {
  engine.paint(performance.now(), false);
  engine.canvas.toBlob((b) => b && download(b, "garden.png"));
}

// ---------- SVG ----------

/** Format glyphs.json: tiap face = upm + peta karakter → [advance, path "M L C Q Z" y-up]. */
export type GlyphFace = { upm: number; g: Record<string, [number, string]> };
export type Glyphs = { faces: GlyphFace[] };

let glyphsP: Promise<Glyphs | null> | null = null;

/** Muat /glyphs.json sekali (null jika tak ada → fallback <text>). */
export function loadGlyphs(url = "/glyphs.json"): Promise<Glyphs | null> {
  return (glyphsP ||= fetch(url)
    .then((r) => (r.ok ? (r.json() as Promise<Glyphs>) : null))
    .catch(() => null));
}

const n2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Huruf sebagai outline, ditempatkan seperti canvas fillText (textAlign center, baseline alfabetik).
 * Koordinat glyph y-up diskalakan S/upm lalu di-flip ke y-down.
 */
export function glyphPath(
  gl: Glyphs | null,
  ch: string,
  x: number,
  y: number,
  S: number,
): string | null {
  const F = (gl && gl.faces) || [],
    f = F.find((o) => o.g[ch]),
    g = f && f.g[ch];
  if (!f || !g) return null;
  const k = S / f.upm,
    x0 = x - (g[0] * k) / 2;
  let d = "",
    px: number | null = null,
    sep = "";
  for (const tok of g[1].match(/[MLCQZ]|-?[0-9.]+/g) || []) {
    if (tok >= "A") {
      // huruf perintah urut setelah digit, '-' dan '.'
      d += tok;
      sep = "";
      continue;
    }
    const v = +tok;
    if (px === null) {
      px = v;
      continue;
    }
    d += sep + n2(x0 + px * k) + " " + n2(y - v * k);
    sep = " ";
    px = null;
  }
  return d;
}

const esc = (s: string): string =>
  s
    // karakter di luar rentang XML 1.0 membuat dokumen invalid
    .replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Backend SVG: mengumpulkan elemen ke `parts`. Huruf = <path id> bila ada glyph, kalau tidak <text>. */
export function svgBackend(gl: Glyphs | null): { B: Backend; parts: string[] } {
  const parts: string[] = [];
  const seen: Record<string, number> = {};
  const lid = (ch: string): string => {
    const b =
      ch.toLowerCase() !== ch.toUpperCase() ? ch : /[0-9]/.test(ch) ? "digit-" + ch : "glyph";
    seen[b] = (seen[b] || 0) + 1;
    return seen[b] > 1 ? b + "-" + seen[b] : b;
  };
  const pb = (): PathSink & { d: string } => ({
    d: "",
    moveTo(x, y) {
      this.d += `M${n2(x)} ${n2(y)}`;
    },
    lineTo(x, y) {
      this.d += `L${n2(x)} ${n2(y)}`;
    },
    quadraticCurveTo(a, b, x, y) {
      this.d += `Q${n2(a)} ${n2(b)} ${n2(x)} ${n2(y)}`;
    },
    closePath() {
      this.d += "Z";
    },
  });
  const B: Backend = {
    fill: (p: Pt[], col) => {
      const b = pb();
      path(b, p, true);
      parts.push(`<path d="${b.d}" fill="${col}"/>`);
    },
    stroke: (p: Pt[], col, w) => {
      const b = pb();
      path(b, p, false);
      parts.push(
        `<path d="${b.d}" fill="none" stroke="${col}" stroke-width="${n2(w)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    },
    rect: () => {},
    text: (ch, x, y, S, col) => {
      const d = glyphPath(gl, ch, x, y, S);
      if (d) parts.push(`<path id="${lid(ch)}" d="${d}" fill="${col}"/>`);
      else
        parts.push(
          `<text x="${n2(x)}" y="${n2(y)}" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-weight="700" font-size="${n2(S)}" fill="${col}">${esc(ch)}</text>`,
        );
    },
  };
  return { B, parts };
}

/** Bungkus parts jadi dokumen SVG W×H dengan latar bg. */
export function svgDocument(parts: string[], W: number, H: number, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(W)}" height="${n2(H)}" viewBox="0 0 ${n2(W)} ${n2(H)}"><rect width="100%" height="100%" fill="${bg}"/>${parts.join("")}</svg>`;
}

/** Bangun string SVG taman saat ini (tanpa mengunduh). */
export async function buildGardenSvg(engine: GardenEngine): Promise<string> {
  const gl = await loadGlyphs();
  const { B, parts } = svgBackend(gl);
  engine.renderTo(B, performance.now());
  return svgDocument(parts, engine.state.W, engine.state.H, engine.palette.bg);
}

export async function saveSVG(engine: GardenEngine): Promise<void> {
  const svg = await buildGardenSvg(engine);
  download(new Blob([svg], { type: "image/svg+xml" }), "garden.svg");
}
