// Tipe inti engine taman. Port 1:1 dari model data source asli
// (lihat artifacts/doc/03-components-interactions.md §3 dan original-source.txt).
// Koordinat elemen dalam satuan S (ukuran huruf), relatif ke titik baseline-tengah huruf.

/** Titik [x, y]. */
export type Pt = [number, number];

/** Fungsi acak 0..1 (hasil rng() atau Math.random). */
export type Rand = () => number;

/** Segmen weave: potongan stem dengan layer 0 (belakang huruf) / 1 (depan). */
export type Seg = { u0: number; u1: number; layer: number };

/** Duri pada stem di posisi u, arah s (±1). */
export type Thorn = { u: number; s: number };

/** Elemen stem (batang). pts dalam satuan S relatif ke huruf. */
export type StemEl = {
  t: "stem";
  id: number;
  pts: Pt[];
  segs: Seg[];
  d0: number;
  dur: number;
  w: number;
  thorns: Thorn[];
};

/** Elemen daun. */
export type LeafEl = {
  t: "leaf";
  id: number;
  x: number;
  y: number;
  a: number;
  L: number;
  bend: number;
  layer: number;
  d0: number;
};

/** Elemen mawar. */
export type RoseEl = {
  t: "rose";
  id: number;
  x: number;
  y: number;
  R: number;
  rot: number;
  ph1: number;
  ph2: number;
  turns: number;
  layer: number;
  d0: number;
};

export type El = StemEl | LeafEl | RoseEl;

/** Parameter per-kata (seeded dari ws). */
export type WordParams = {
  roseP: number;
  leafy: number;
  dens: number;
  lean: number;
  big: number;
  curvy: number;
  bridgeP: number;
  w: number;
};

/** Satu huruf hidup di taman. */
export type Letter = {
  ch: string;
  id: number;
  birth?: number;
  tb?: number;
  ws: number;
  wi: number;
  prev?: Letter | null;
  els: El[];
  endEls?: El[] | null;
  tend?: StemEl[];
  cut?: number | null;
  dead?: number | null;
  // posisi (diisi layout)
  x?: number;
  y?: number;
  tx?: number;
  ty?: number;
  tw?: number;
  line?: number;
  lean?: [number, number];
  // poster-only
  b?: number;
  d?: number;
  cutRel?: number | null;
};
