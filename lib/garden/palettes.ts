// Palet taman + token numerik. Port 1:1 dari artifacts/doc/tokens.json.
// Satu sumber kebenaran: dipakai engine canvas DAN diekspos ke CSS var.

/** [name, bg, flower(red), stem/leaf(blue), line(detail), text] */
export type Palette = {
  name: string;
  bg: string;
  flower: string;
  stem: string;
  line: string;
  text: string;
};

const RAW: [string, string, string, string, string, string][] = [
  ["Rose noir", "#000000", "#FF1400", "#3257FF", "#FFB4A8", "#FFFFFF"],
  ["Paper", "#F3EEE4", "#FF3B1F", "#1C2B8F", "#FFD2C4", "#111111"],
  ["Midnight", "#0D1B4C", "#FF5A4E", "#9FB4FF", "#FFD6CF", "#FFFFFF"],
  ["Citrus", "#0E1A12", "#FF8A00", "#1FA463", "#FFE2B8", "#FFF6E8"],
  ["Orchid", "#140A1F", "#E63CFF", "#2FB8A6", "#F9D1FF", "#FFFFFF"],
  ["Moss", "#133A2A", "#FFB7C5", "#7FD18B", "#FFFFFF", "#F6F1E7"],
  ["Tomato", "#FF1400", "#FFF1E0", "#0B0B0B", "#FF1400", "#000000"],
  ["Butter", "#FFE9A8", "#E4002B", "#0F5132", "#FFC2C2", "#1A1A1A"],
  ["Blush", "#FAD4D8", "#C8102E", "#274690", "#FFE3E6", "#1A1A1A"],
  ["Mono", "#000000", "#F2F2F2", "#6E6E6E", "#000000", "#FFFFFF"],
];

export const PALETTES: Palette[] = RAW.map(([name, bg, flower, stem, line, text]) => ({
  name,
  bg,
  flower,
  stem,
  line,
  text,
}));

/** vein (urat daun) = bg palet aktif. */
export const veinColor = (p: Palette): string => p.bg;

/** Peer tints (live cursor). */
export const PEER_TINTS = [
  "#FF8A00",
  "#E63CFF",
  "#7FD18B",
  "#9FB4FF",
  "#FFB7C5",
  "#FFE2B8",
  "#2FB8A6",
  "#FFD23F",
] as const;

/** Nama bunga untuk peer presence. */
export const FLOWER_NAMES = [
  "iris", "fern", "poppy", "tulip", "violet", "clover", "daisy", "lilac",
  "aster", "peony", "sorrel", "yarrow", "thistle", "bluebell", "foxglove", "primrose",
] as const;

/** Token layout canvas (relatif ke H/W/S). Dari tokens.json .layout. */
export const LAYOUT = {
  S0: 0.28,
  maxW: 0.8,
  lineHeight: 2.1,
  wrapBelow: 0.1,
  wrapHysteresis: 0.14,
  wrapRange: [0.03, 0.15] as [number, number],
  wrapMaxH: 0.82,
  baselineOffset: 0.33,
  spaceScale: 1.4,
  stemWidth: 0.022,
  posterSize: 1080,
  posterHalf: 0.44,
  posterMaxScale: 1.25,
  posterMaxChars: 40,
} as const;

/** Token motion. Dari tokens.json .motion. */
export const MOTION = {
  spring: {
    default: { k: 7, w: 16 },
    petal: { k: 8, w: 14, staggerMs: 85 },
    leaf: { k: 7, w: 15 },
  },
  smoothTauMs: 80,
  dtClampMs: 64,
  boil: { stepMs: 120, ampMinPx: 0.8, ampS: 0.01, rotRad: 0.035 },
  stemDurMs: { min: 320, perLen: 620 },
  roseDetailMs: { delayAfterPetals: 80, dur: 520 },
  tendril: { delayMs: 150, durMs: 450, recoilMs: 150, recoilPx: 20, recoilMax: 0.85 },
  witherMs: { type: 260, poster: 600, removeAfter: 300 },
  caret: { blinkMs: 530, solidAfterKeyMs: 500, fadeInMs: 600 },
  gift: { doubleTapMs: 340, doubleTapPx: 40, cooldownMs: 1800, lifeMs: 60000, fadeMs: 2200, max: 14 },
  butterflyMax: 6,
  presets: {
    breathe: 3000, grow: 6000, typed: 5000, wind: 4000, reach: 6000, scatter: 6000, visit: 7000,
  },
  export: { fps: 30, size: 1080, bitrate: 14000000 },
} as const;

// ---------- kontras UI (a11y) ----------

const rgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const lum = ([r, g, b]: number[]): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** Rasio kontras WCAG antara teks (alpha a) dan latar. */
export function contrast(text: string, bg: string, a = 1): number {
  const T = rgb(text),
    B = rgb(bg);
  const m = T.map((v, i) => v * a + B[i] * (1 - a));
  const [hi, lo] = [lum(m), lum(B)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Opasitas teks UI (hint/credit) agar kontras ≥ 4.5:1 terhadap latar palet. Mulai dari `base`
 * (source: .6) dan hanya naik bila perlu — Tomato/Butter/Blush gagal pada .6 (3.35/4.30/4.11).
 */
export function legibleOpacity(p: Palette, base = 0.6, min = 4.5): number {
  for (let a = Math.round(base * 100); a < 100; a++)
    if (contrast(p.text, p.bg, a / 100) >= min) return a / 100;
  return 1;
}
