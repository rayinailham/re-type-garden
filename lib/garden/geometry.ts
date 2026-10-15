// Geometri kurva taman. Port 1:1 dari blok `// ---------- geometry ----------`
// (dan path()/strokeRange() yang menyebar di source). Angka = kontrak.

import type { Pt, Seg, Rand } from "./types";
import type { Backend } from "./draw";

/** Target gambar path (ctx canvas atau path-builder SVG). */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  closePath(): void;
}

/** Batang bergelombang: polyline n+1 titik dari base ke arah dir. */
export function vine(
  base: Pt,
  dir: number,
  len: number,
  amp: number,
  waves: number,
  ph: number,
  bend: number,
  n?: number,
): Pt[] {
  n = n || 40;
  const P: Pt[] = [[base[0], base[1]]];
  const step = len / n;
  let x = base[0],
    y = base[1];
  for (let i = 1; i <= n; i++) {
    const u = i / n,
      a = dir + bend * u + amp * Math.sin(u * Math.PI * waves + ph) * Math.min(1, u * 3);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    P.push([x, y]);
  }
  return P;
}

/** Lanjutkan polyline P dengan lengkungan sulur (curl) di ujung. Mutasi & kembalikan P. */
export function curl(P: Pt[], sign: number, rad: number): Pt[] {
  const n = P.length,
    e = P[n - 1],
    a = Math.atan2(e[1] - P[n - 2][1], e[0] - P[n - 2][0]);
  const c: Pt = [e[0] - Math.sin(a) * sign * rad, e[1] + Math.cos(a) * sign * rad];
  const a0 = Math.atan2(e[1] - c[1], e[0] - c[0]);
  for (let i = 1; i <= 14; i++) {
    const u = i / 14,
      t = a0 + sign * u * Math.PI * 1.6,
      rr = rad * (1 - 0.5 * u);
    P.push([c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr]);
  }
  return P;
}

/** Potong stem jadi 1-3 segmen layer bergantian (anyam depan/belakang huruf). */
export function weave(r: Rand, startLayer: number): Seg[] {
  const cuts: number[] = [];
  const nc = 1 + Math.floor(r() * 3);
  for (let i = 0; i < nc; i++) cuts.push(0.15 + r() * 0.7);
  cuts.sort((a, b) => a - b);
  const segs: Seg[] = [];
  let u0 = 0,
    layer = startLayer;
  for (const c of cuts) {
    if (c <= u0) continue;
    segs.push({ u0, u1: c, layer });
    if (r() < 0.3) {
      const g = 0.02 + r() * 0.03;
      u0 = Math.min(0.98, c + g);
    } else u0 = c;
    layer = 1 - layer;
  }
  segs.push({ u0, u1: 1, layer });
  return segs;
}

/** Layer pada posisi u di sepanjang segmen weave. */
export function layerAt(segs: Seg[], u: number): number {
  for (const s of segs) if (u >= s.u0 && u <= s.u1) return s.layer;
  return segs[segs.length - 1].layer;
}

/** Gambar polyline p sebagai kurva quad-smoothing ke sink c. */
export function path(c: PathSink, p: Pt[], closed: boolean): void {
  const n = p.length;
  if (n < 2) return;
  const m = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    const s = m(p[n - 1], p[0]);
    c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const q = m(p[i], p[(i + 1) % n]);
      c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]);
    }
    c.closePath();
  } else {
    c.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const q = m(p[i], p[i + 1]);
      c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]);
    }
    c.lineTo(p[n - 1][0], p[n - 1][1]);
  }
}

/** Stroke hanya sub-rentang [a,b] (0..1) dari polyline P melalui Backend. */
export function strokeRange(
  B: Backend,
  P: Pt[],
  a: number,
  b: number,
  col: string,
  w: number,
): void {
  const n = P.length - 1,
    ia = a * n,
    ib = b * n;
  const lerp = (t: number): Pt => {
    const i = Math.min(n - 1, Math.floor(t)),
      f = t - i;
    return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f];
  };
  const pts: Pt[] = [lerp(ia)];
  for (let i = Math.floor(ia) + 1; i < ib; i++) pts.push(P[i]);
  pts.push(lerp(ib));
  if (pts.length >= 2) B.stroke(pts, col, w);
}
