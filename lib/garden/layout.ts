// Layout huruf. Port 1:1 dari blok `// ---------- layout ----------`.
// S0 0.28 / maxW 0.8 / LH 2.1 / wrap 0.10-0.14 hysteresis / binary search 22 iter.
// Angka = kontrak.

import type { Letter } from "./types";

/** Pengukur lebar huruf (satuan: lebar per 1px font). Hasil cache per karakter. */
export type Measure = (ch: string) => number;

/** Font display engine: Playfair Display 700 (OFL). Font komersial asli tidak dipakai (D7). */
export const FONT = '"Playfair Display",Georgia,serif';

/**
 * Buat pengukur dari CanvasRenderingContext2D + cache object.
 * mw(ch) = measureText(ch).width / 100 pada font 700 100px; spasi ×1.4.
 */
export function makeMeasure(
  g: Pick<CanvasRenderingContext2D, "font" | "measureText">,
  cache: Record<string, number>,
  font = FONT,
): Measure {
  return (ch: string): number => {
    if (cache[ch] != null) return cache[ch];
    g.font = `700 100px ${font}`;
    let w = g.measureText(ch).width / 100;
    if (ch === " ") w *= 1.4;
    return (cache[ch] = w);
  };
}

/** Hasil layoutCore. */
export type LayoutResult = { S: number; wrapped: boolean; n: number };

/**
 * Hitung ukuran huruf S + posisi tx/ty/tw/line tiap huruf (mutasi A).
 * Menyisakan ruang taman di atas & bawah type.
 */
export function layoutCore(
  A: Letter[],
  W: number,
  H: number,
  prevWrapped: boolean,
  mw: Measure,
): LayoutResult {
  const maxW = W * 0.8,
    S0 = H * 0.28,
    LH = 2.1;
  const ws = A.map((l) => mw(l.ch));
  const words: { sp?: boolean; idx: number[] }[] = [];
  let cur: { idx: number[] } | null = null;
  A.forEach((l, i) => {
    if (l.ch === " ") {
      if (cur) {
        words.push(cur);
        cur = null;
      }
      words.push({ sp: true, idx: [i] });
    } else {
      if (!cur) cur = { idx: [] };
      cur.idx.push(i);
    }
  });
  if (cur) words.push(cur);
  const lineW = (li: number[], S: number): number => {
    let e = li.length;
    while (e > 0 && A[li[e - 1]].ch === " ") e--;
    let w = 0;
    for (let k = 0; k < e; k++) w += ws[li[k]];
    return w * S;
  };
  const wrap = (S: number): number[][] => {
    const lines: number[][] = [[]];
    let lw = 0;
    for (const w of words) {
      const ww = w.idx.reduce((s, i) => s + ws[i], 0) * S;
      if (!w.sp && lw > 0 && lw + ww > maxW) {
        lines.push([]);
        lw = 0;
      }
      lines[lines.length - 1].push(...w.idx);
      lw += ww;
    }
    return lines;
  };
  let lines: number[][] = [A.map((_, i) => i)];
  const unit = lineW(lines[0], 1);
  let S = unit > 0 ? Math.min(S0, maxW / unit) : S0;
  const multi = words.filter((w) => !w.sp).length > 1;
  let wrapped = multi && (S < H * 0.1 || (prevWrapped && S < H * 0.14));
  if (wrapped) {
    let lo = H * 0.03,
      hi = H * 0.15;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2,
        ls = wrap(mid);
      const ok =
        ls.every((li) => lineW(li, mid) <= maxW) && ls.length * LH * mid <= H * 0.82;
      if (ok) lo = mid;
      else hi = mid;
    }
    S = lo;
    lines = wrap(S);
    if (lines.length < 2) wrapped = false;
  }
  const n = lines.length,
    lh = LH * S;
  lines.forEach((li, k) => {
    let x = W / 2 - lineW(li, S) / 2;
    const y = H / 2 + (k - (n - 1) / 2) * lh + 0.33 * S;
    li.forEach((i) => {
      const l = A[i],
        w = ws[i] * S;
      l.tx = x + w / 2;
      l.ty = y;
      l.tw = w;
      l.line = k;
      x += w;
    });
  });
  return { S, wrapped, n };
}
