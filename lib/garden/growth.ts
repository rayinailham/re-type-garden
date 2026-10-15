// Pertumbuhan taman. Port 1:1 dari blok `// ---------- growth ----------`.
// URUTAN pemanggilan r() HARUS identik source asli agar seed sama → bentuk sama.
//
// Catatan determinisme: di source, gen() mencampur `Math.floor(this.rand()*1e6)` ke seed
// (this.rand = Math.random di type mode, atau rng(seed*7919+1) di poster). Agar engine
// bisa diuji & deterministik, `rand` dan `density` di-inject lewat GenCtx.

import type { El, StemEl, Letter, Rand, WordParams } from "./types";
import type { Measure } from "./layout";
import { rng, bez, at } from "./math";
import { vine, curl, weave, layerAt } from "./geometry";

/** Konteks generasi: sumber acak non-seeded, kerapatan, pengukur huruf. */
export type GenCtx = {
  /** Padanan this.rand (Math.random type mode / rng seeded poster). */
  rand: Rand;
  /** props.density (default 1). */
  density: number;
  /** Pengukur lebar huruf. */
  mw: Measure;
};

/** Opsi satu panggilan grow(). */
type GrowOpts = {
  tip?: string | null;
  pts?: [number, number][];
  base?: [number, number];
  dir?: number;
  len?: number;
  d0: number;
  depth?: number;
  layer0?: number | null;
};

/** Parameter per-kata (seeded dari ws). dens dari ctx.density (bukan r()). */
export function wordParams(ws: number, density: number): WordParams {
  const r = rng(ws * 7 + 13),
    dens = density ?? 1;
  return {
    roseP: 0.3 + r() * 0.3,
    leafy: (0.6 + r() * 0.8) * dens,
    dens,
    lean: (r() - 0.5) * 0.6,
    big: 0.85 + r() * 0.45,
    curvy: 0.8 + r() * 0.6,
    bridgeP: Math.min(0.95, (0.45 + r() * 0.35) * dens),
    w: 0.5,
  };
}

/** Tumbuhkan satu stem (+daun, tip, cabang depth-1 rekursif). Push ke E; kembalikan polyline P. */
export function grow(
  r: Rand,
  E: El[],
  nid: () => number,
  p: WordParams,
  o: GrowOpts,
): [number, number][] {
  const tip =
    o.tip || (r() < p.roseP ? "rose" : r() < 0.45 ? "fan" : r() < 0.6 ? "leaf" : "curl");
  let P =
    o.pts ||
    vine(
      o.base as [number, number],
      o.dir as number,
      o.len as number,
      (0.35 + r() * 0.45) * p.curvy,
      1 + r() * 1.6,
      r() * 6.28,
      (r() - 0.5) * 1.2,
      40,
    );
  if (tip === "curl") P = curl(P, r() < 0.5 ? -1 : 1, 0.05 + r() * 0.05);
  const segs = weave(r, o.layer0 != null ? o.layer0 : r() < 0.5 ? 0 : 1);
  const dur = Math.max(320, (o.len || 0.8) * 620);
  const thorns: { u: number; s: number }[] = [];
  const nt = Math.floor(r() * 2.5);
  for (let i = 0; i < nt; i++) thorns.push({ u: 0.15 + r() * 0.65, s: r() < 0.5 ? -1 : 1 });
  E.push({ t: "stem", id: nid(), pts: P, segs, d0: o.d0, dur, w: o.depth ? 0.82 : 1, thorns });
  const nl = Math.floor(r() * 2.8 * p.leafy);
  let sd = r() < 0.5 ? -1 : 1;
  for (let i = 0; i < nl; i++) {
    const u = 0.25 + r() * 0.6,
      [q, a] = at(P, u);
    sd = -sd;
    E.push({
      t: "leaf",
      id: nid(),
      x: q[0],
      y: q[1],
      a: a + sd * (0.55 + r() * 0.5),
      L: (0.14 + r() * 0.2) * (o.depth ? 0.8 : 1),
      bend: (r() - 0.5) * 1.2,
      layer: layerAt(segs, u),
      d0: o.d0 + dur * u,
    });
  }
  const [tp, ta] = at(P, 1),
    td = o.d0 + dur * 0.8,
    tl = layerAt(segs, 1);
  if (tip === "rose") {
    const R = (0.13 + r() * 0.15) * p.big * (o.depth ? 0.75 : 1);
    // legibility: mawar di atas badan huruf mayoritas ke belakang
    const over = tp[1] > -0.78 && tp[1] < 0.05 && Math.abs(tp[0]) < p.w * 0.5;
    const layer = over ? (r() < 0.22 ? 1 : 0) : r() < 0.6 ? 1 : tl;
    E.push({
      t: "rose",
      id: nid(),
      x: tp[0],
      y: tp[1],
      R,
      rot: (r() - 0.5) * 1.0,
      ph1: r() * 6.28,
      ph2: r() * 6.28,
      turns: 1.8 + r() * 1,
      layer,
      d0: td,
    });
    if (r() < 0.2) {
      const oo = ta + (r() < 0.5 ? 1 : -1) * 1.3;
      E.push({
        t: "rose",
        id: nid(),
        x: tp[0] + Math.cos(oo) * R * 1.4,
        y: tp[1] + Math.sin(oo) * R * 1.4,
        R: R * (0.6 + r() * 0.3),
        rot: (r() - 0.5) * 1.2,
        ph1: r() * 6.28,
        ph2: r() * 6.28,
        turns: 1.8 + r(),
        layer,
        d0: td + 120,
      });
    }
  } else if (tip === "fan") {
    const spread = 0.6 + r() * 0.3;
    for (let j = 0; j < 2; j++)
      E.push({
        t: "leaf",
        id: nid(),
        x: tp[0],
        y: tp[1],
        a: ta + (j - 0.5) * spread,
        L: 0.2 + r() * 0.2,
        bend: (j - 0.5) * 0.8,
        layer: tl,
        d0: td + j * 60,
      });
  } else if (tip === "leaf") {
    E.push({
      t: "leaf",
      id: nid(),
      x: tp[0],
      y: tp[1],
      a: ta + (r() - 0.5) * 0.3,
      L: 0.16 + r() * 0.16,
      bend: r() - 0.5,
      layer: tl,
      d0: td,
    });
  }
  if (!o.depth && r() < 0.3) {
    const u = 0.35 + r() * 0.35,
      [q, a] = at(P, u);
    grow(r, E, nid, p, {
      base: q,
      dir: a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4),
      len: (o.len || 0.8) * (0.35 + r() * 0.2),
      d0: o.d0 + dur * u,
      depth: 1,
      layer0: layerAt(segs, u),
    });
  }
  return P;
}

/** Generasi elemen satu huruf (mutasi l.els / l.endEls / l.tend). */
export function gen(l: Letter, ctx: GenCtx): void {
  const r = rng((l.ws ^ Math.imul(l.wi + 1, 2654435761)) + Math.floor(ctx.rand() * 1e6));
  const p = wordParams(l.ws, ctx.density),
    E: El[] = [];
  let k0 = 0;
  const nid = () => l.id * 100 + k0++;
  const w = ctx.mw(l.ch),
    inX = () => (r() - 0.5) * w * 0.7;
  p.w = w;
  const nUp = 1 + (r() < 0.45 * p.dens ? 1 : 0);
  for (let i = 0; i < nUp; i++) {
    grow(r, E, nid, p, {
      base: [inX(), -r() * 0.3],
      dir: -Math.PI / 2 + p.lean * 0.5 + (r() - 0.5) * 0.7,
      len: 0.6 + r() * 0.5,
      d0: 40 + i * 130,
      tip: l.wi === 0 && i === 0 ? "rose" : null,
    });
  }
  if (r() < 0.4 * p.dens)
    grow(r, E, nid, p, {
      base: [inX(), -0.1 - r() * 0.35],
      dir: Math.PI / 2 + (r() - 0.5) * 0.8,
      len: 0.35 + r() * 0.35,
      d0: 160,
    });
  if (l.prev && r() < p.bridgeP) {
    const px = -(ctx.mw(l.prev.ch) + w) / 2;
    const a: [number, number] = [inX(), -0.05 - r() * 0.55],
      b: [number, number] = [px + (r() - 0.5) * 0.25, -0.05 - r() * 0.55];
    const bulge = (r() < 0.55 ? -1 : 1) * (0.4 + r() * 0.4),
      dx = b[0] - a[0];
    let P = bez(a, [a[0] + dx * 0.15, a[1] + bulge], [b[0] - dx * 0.15, b[1] + bulge * 0.9], b, 40);
    if (r() < 0.45) P = P.slice(0, Math.floor(P.length * (0.7 + r() * 0.2)));
    grow(r, E, nid, p, {
      pts: P,
      len: Math.abs(dx) + Math.abs(bulge),
      d0: 90,
      tip: r() < 0.5 ? "curl" : r() < 0.5 ? "leaf" : "rose",
    });
  }
  if (l.wi === 0)
    grow(r, E, nid, p, {
      base: [-w * 0.3, -0.15 - r() * 0.4],
      dir: Math.PI + (r() - 0.5) * 1.2,
      len: 0.45 + r() * 0.3,
      d0: 120,
      tip: "curl",
    });
  l.els = E;
  l.endEls = null;
  const T: El[] = [],
    tr = rng(l.id * 977 + Math.floor(ctx.rand() * 1e6));
  grow(tr, T, () => l.id * 100 + 90 + T.length, p, {
    base: [w * 0.25, -0.1 - tr() * 0.45],
    dir: (tr() - 0.5) * 1.4,
    len: 0.45 + tr() * 0.25,
    d0: 0,
    tip: "curl",
    depth: 1,
  });
  l.tend = T.filter((e): e is StemEl => e.t === "stem").slice(0, 1);
}

/** Bunga akhir kata (saat space/cut). mutasi l.endEls. rel = waktu relatif terhadap birth. */
export function genEnd(l: Letter, rel: number, ctx: GenCtx): void {
  const r = rng(l.ws + l.wi * 31 + Math.floor(ctx.rand() * 1e6)),
    p = wordParams(l.ws, ctx.density),
    E: El[] = [];
  let k0 = 50;
  const nid = () => l.id * 100 + k0++;
  const w = ctx.mw(l.ch),
    n = 1 + Math.floor(r() * 2.5);
  p.w = w;
  for (let i = 0; i < n; i++) {
    const dir = -Math.PI / 2 + 0.6 + (i - (n - 1) / 2) * 0.9 + (r() - 0.5) * 0.4;
    grow(r, E, nid, p, {
      base: [(r() - 0.2) * w * 0.6, -r() * 0.5],
      dir,
      len: 0.4 + r() * 0.45,
      d0: rel + 40 + i * 90,
      depth: 1,
      tip: i === 0 || r() < 0.5 ? "rose" : "fan",
    });
  }
  l.endEls = E;
}
