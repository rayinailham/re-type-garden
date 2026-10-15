// Primitif matematika engine. Port 1:1 dari blok `// ---------- math ----------`
// di original-source.txt. Angka = kontrak; jangan diubah tanpa keputusan tercatat.
//
// Catatan: `eb` (easeOutBack) adalah dead code di source asli (tidak pernah dipanggil),
// jadi tidak diport (lihat 01-architecture.md §5).

import type { Pt } from "./types";

/** Hash deterministik 0..1 dari satu angka (dasar jitter "boil"). */
export function h(n: number): number {
  const x = Math.sin(n) * 43758.5453;
  return x - Math.floor(x);
}

/** Spring overshoot. t detik. default k=7, w=16 (bouncy). */
export function spr(t: number, k = 7, w = 16): number {
  if (t <= 0) return 0;
  return 1 - Math.exp(-t * k) * Math.cos(t * w);
}

/**
 * Spring tanpa overshoot untuk prefers-reduced-motion (A1: spring → eo).
 * Selesai ≈ 3.5/k detik — durasi setara spring asli, tanpa osilasi.
 */
export function sprCalm(t: number, k = 7): number {
  return eo((t * k) / 3.5);
}

/** easeOutCubic, clamp 0..1. */
export function eo(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

/** mulberry32 PRNG. Kembalikan generator 0..1 deterministik dari seed. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kurva Bezier kubik → n+1 titik. */
export function bez(a: Pt, b: Pt, c: Pt, d: Pt, n: number): Pt[] {
  const P: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    P.push([
      u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
      u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
    ]);
  }
  return P;
}

/** Titik + tangen pada polyline P di posisi u (0..1). Kembalikan [titik, sudut]. */
export function at(P: Pt[], u: number): [Pt, number] {
  const n = P.length;
  const i = Math.min(n - 2, Math.max(1, Math.round(u * (n - 1))));
  return [P[i], Math.atan2(P[i + 1][1] - P[i - 1][1], P[i + 1][0] - P[i - 1][0])];
}

/** Jitter "boil" deterministik untuk elemen id pada frame f. [dx, dy, drot]. */
export function jit(id: number, f: number, amp: number): [number, number, number] {
  if (!amp) return [0, 0, 0];
  return [
    (h(id * 1.37 + f * 7.13) * 2 - 1) * amp,
    (h(id * 2.71 + f * 3.11) * 2 - 1) * amp,
    (h(id * 5.3 + f * 1.7) * 2 - 1) * 0.035,
  ];
}
