// Poster mode: buildPoster (seeded) + posterDraw (7 preset) + bars + PosterPlayer.
// Port 1:1 dari blok `// ---------- poster ----------` di original-source.txt.
// Deterministik: rng(seed*7919+1) → frame poster reproducible (dasar oracle parity).

import type { Letter, Pt, Rand } from "./types";
import type { Backend, Colors } from "./draw";
import { canvasBackend, butterfly } from "./draw";
import { render, type Perch, type RenderState } from "./render";
import { gen, genEnd, type GenCtx } from "./growth";
import { layoutCore, FONT, type Measure } from "./layout";
import { rng, eo } from "./math";
import { LAYOUT, MOTION } from "./palettes";

export type PresetId =
  | "breathe"
  | "grow"
  | "typed"
  | "wind"
  | "reach"
  | "scatter"
  | "visit";

export type Preset = { id: PresetId; label: string; sub: string; T: number };

/** 7 preset (T dari tokens). */
export const PRESETS: Preset[] = [
  { id: "breathe", label: "Breathe", sub: "Slow sway · 3s", T: 3000 },
  { id: "grow", label: "Grow & wither", sub: "Bloom, then back · 6s", T: 6000 },
  { id: "typed", label: "Typed", sub: "Type, cut, repeat · 5s", T: 5000 },
  { id: "wind", label: "Gust", sub: "Wind sweeps through · 4s", T: 4000 },
  { id: "reach", label: "Reach", sub: "Stems follow a light · 6s", T: 6000 },
  { id: "scatter", label: "Scatter", sub: "Random bloom, fade · 6s", T: 6000 },
  { id: "visit", label: "Visitor", sub: "Butterfly drops by · 7s", T: 7000 },
];

export const presetOf = (id: string): Preset =>
  PRESETS.find((p) => p.id === id) || PRESETS[0];

/** Hasil buildPoster. preset 'reference' hanya dikenali oleh source asli (tak ada di UI). */
export type Poster = {
  letters: Letter[];
  /** ukuran huruf efektif (S*k). */
  S: number;
  T: number;
  preset: PresetId | "reference";
};

export type BuildOpts = {
  text: string;
  seed: number;
  preset: PresetId;
  mw: Measure;
  density?: number;
};

const Z = LAYOUT.posterSize;

/** Bangun taman poster: seeded, teks ≤ 40, fit ke margin 6%, skala ≤ 1.25. */
export function buildPoster(o: BuildOpts): Poster {
  const pr = presetOf(o.preset),
    text = (o.text || "").slice(0, LAYOUT.posterMaxChars) || " ";
  const rand: Rand = rng(o.seed * 7919 + 1);
  const ctx: GenCtx = { rand, density: o.density ?? 1, mw: o.mw };
  const L: Letter[] = [];
  let prev: Letter | null = null,
    uid = 1;
  for (const ch of text) {
    if (ch === " ") {
      const sp: Letter = { ch: " ", id: 9000 + uid++, ws: 0, wi: 0, els: [] };
      L.push(sp);
      prev = sp;
      continue;
    }
    const same = !!prev && prev.ch !== " ";
    const l: Letter = {
      ch,
      id: 9000 + uid++,
      ws: same ? (prev as Letter).ws : Math.floor(rand() * 1e9),
      wi: same ? (prev as Letter).wi + 1 : 0,
      prev: same ? prev : null,
      els: [],
    };
    gen(l, ctx);
    L.push(l);
    prev = l;
  }
  const n = L.length;
  const isRef = (pr.id as string) === "reference";
  const step = isRef
    ? 30
    : pr.id === "grow"
      ? Math.min(110, 3000 / n)
      : pr.id === "typed"
        ? Math.min(85, 3600 / n)
        : 0;
  const off = pr.id === "grow" ? 200 : pr.id === "typed" ? 300 : 0;
  L.forEach((l, i) => {
    l.b = off + i * step;
  });
  if (pr.id === "scatter") {
    const r = rng(o.seed * 31 + 5);
    L.forEach((l) => {
      l.b = 150 + r() * 2400;
    });
  }
  const wd = Math.min(60, 900 / n);
  L.forEach((l, i) => {
    l.d = pr.id === "scatter" ? 4700 + i * 8 : 4200 + (n - 1 - i) * wd;
    const nx = L[i + 1];
    l.cutRel = null;
    if (pr.id !== "scatter" && l.ch !== " " && nx && nx.ch === " ") {
      l.cutRel = Math.max(30, (nx.b as number) - (l.b as number));
      genEnd(l, l.cutRel, ctx);
    }
  });
  const res = layoutCore(L, Z, Z, false, o.mw);
  // fit seluruh taman (bukan hanya huruf) di dalam margin 6%
  const S = res.S;
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  const addP = (l: Letter, x: number, y: number, r = 0) => {
    const X = (l.tx as number) + x * S,
      Y = (l.ty as number) + y * S,
      R = r * S;
    x0 = Math.min(x0, X - R);
    x1 = Math.max(x1, X + R);
    y0 = Math.min(y0, Y - R);
    y1 = Math.max(y1, Y + R);
  };
  for (const l of L) {
    if (l.ch === " ") continue;
    const tw = l.tw as number;
    addP(l, -tw / S / 2, -0.75);
    addP(l, tw / S / 2, 0.1);
    for (const e of [...l.els, ...(l.endEls || [])]) {
      if (e.t === "stem") e.pts.forEach((q) => addP(l, q[0], q[1], 0.02));
      else if (e.t === "leaf") addP(l, e.x, e.y, e.L);
      else addP(l, e.x, e.y, e.R * 1.15);
    }
  }
  // pusatkan pada huruf; kecilkan secukupnya agar taman lolos margin di semua sisi
  let tx0 = 1e9,
    tx1 = -1e9,
    ty0 = 1e9,
    ty1 = -1e9;
  for (const l of L)
    if (l.ch !== " ") {
      const tx = l.tx as number,
        tw = l.tw as number,
        ty = l.ty as number;
      tx0 = Math.min(tx0, tx - tw / 2);
      tx1 = Math.max(tx1, tx + tw / 2);
      ty0 = Math.min(ty0, ty - 0.72 * S);
      ty1 = Math.max(ty1, ty);
    }
  const half = Z * LAYOUT.posterHalf,
    bcx = (tx0 + tx1) / 2,
    bcy = (ty0 + ty1) / 2;
  const k = Math.min(
    LAYOUT.posterMaxScale,
    half / Math.max(1, bcx - x0, x1 - bcx),
    half / Math.max(1, bcy - y0, y1 - bcy),
  );
  L.forEach((l) => {
    l.tx = Z / 2 + ((l.tx as number) - bcx) * k;
    l.ty = Z / 2 + ((l.ty as number) - bcy) * k;
    l.tw = (l.tw as number) * k;
    l.x = l.tx;
    l.y = l.ty;
  });
  return { letters: L, S: S * k, T: pr.T, preset: pr.id };
}

/** Kupu-kupu poster: A → s1 → s2 → E dengan hinggap (perch dari render). */
function posterFly(B: Backend, tt: number, P: Poster, C: Colors, perch: Perch[]): void {
  const ps = perch.slice().sort((a, b) => a.x - b.x);
  if (!ps.length) return;
  const p1 = ps[Math.floor(ps.length * 0.25)],
    p2 = ps[Math.min(ps.length - 1, Math.floor(ps.length * 0.75))];
  const A: Pt = [-80, 300],
    s1: Pt = [p1.x, p1.y - p1.R * 0.55],
    s2: Pt = [p2.x, p2.y - p2.R * 0.55],
    E: Pt = [1160, 260];
  const sz = Math.max(12, P.S * 0.09),
    t = tt / 1000,
    ez = (v: number) => eo(Math.max(0, Math.min(1, v)));
  const leg = (a: Pt, b: Pt, u: number, lift: number): Pt => {
    const e = ez(u);
    return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e - Math.sin(e * Math.PI) * lift];
  };
  let p: Pt,
    flying = true,
    vx = 0;
  if (t < 1.8) {
    p = leg(A, s1, t / 1.8, 160);
    vx = 1;
  } else if (t < 3.4) {
    p = s1;
    flying = false;
  } else if (t < 4.6) {
    p = leg(s1, s2, (t - 3.4) / 1.2, 140);
    vx = s2[0] > s1[0] ? 1 : -1;
  } else if (t < 5.8) {
    p = s2;
    flying = false;
  } else {
    p = leg(s2, E, (t - 5.8) / 1.2, 60);
    vx = 1;
  }
  let o: number, ang: number;
  if (flying) {
    o = Math.abs(Math.cos(t * 17));
    p = [p[0] + Math.sin(t * 7) * 6, p[1] + Math.sin(t * 13) * 4];
    ang = vx * 0.3;
  } else {
    const burst = (t > 2.4 && t < 2.8) || (t > 5 && t < 5.3);
    o = burst ? 0.2 + 0.8 * Math.abs(Math.cos(t * 9)) : 0.3 + 0.1 * Math.sin(t * 3);
    ang = 0;
  }
  butterfly(B, p[0], p[1], sz, ang, o, C);
}

/** Dua bar vertikal mengapit tiap baris (hanya dipakai preset 'reference', tak ada di UI). */
export function bars(B: Backend, P: Poster, st: RenderState, spread: number, hf: number): void {
  const S = P.S,
    byLine: Record<number, { a: number; z: number; y: number }> = {};
  for (const l of P.letters) {
    if (l.ch === " ") continue;
    const ln = l.line as number,
      tx = l.tx as number,
      tw = l.tw as number;
    const b = byLine[ln] || (byLine[ln] = { a: 1e9, z: -1e9, y: l.ty as number });
    b.a = Math.min(b.a, tx - tw / 2);
    b.z = Math.max(b.z, tx + tw / 2);
  }
  const w = Math.max(2, S * 0.035),
    h = 1.0 * S * hf;
  for (const k in byLine) {
    const b = byLine[k],
      cx = (b.a + b.z) / 2,
      half = (b.z - b.a) / 2 + 0.14 * S,
      cy = b.y - 0.33 * S;
    B.rect(cx - half * spread - w / 2, cy - h / 2, w, h, st.C.text);
    B.rect(cx + half * spread - w / 2, cy - h / 2, w, h, st.C.text);
  }
}

export type DrawOpts = {
  /** warna palet aktif (vein = bg). */
  C: Colors;
  bg: string;
  boil: boolean;
  recoil: number;
  /** reduced motion: spring → eo. */
  calm?: boolean;
  /** font-family canvas (hasil resolve next/font). */
  font?: string;
};

/** Gambar frame poster pada waktu t (ms, di-mod T) ke g (1080×1080). */
export function posterDraw(
  g: CanvasRenderingContext2D,
  P: Poster,
  t: number,
  o: DrawOpts,
): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = o.bg;
  g.fillRect(0, 0, Z, Z);
  const tt = ((t % P.T) + P.T) % P.T,
    L = P.letters,
    B = canvasBackend(g, o.font || FONT);
  const st: RenderState = {
    letters: L,
    S: P.S,
    C: o.C,
    boil: o.boil,
    recoil: o.recoil,
    speed: 1,
    wither: MOTION.witherMs.poster,
    textAll: true,
    calm: o.calm,
  };
  L.forEach((l) => {
    l.x = l.tx;
    l.y = l.ty;
    l.dead = null;
  });
  const set = (base: number) =>
    L.forEach((l) => {
      l.birth = base + (l.b as number);
      l.tb = l.birth;
      l.cut = l.cutRel != null ? l.birth + l.cutRel : null;
    });
  const perch: Perch[] = [];
  let barsV: number | null = null;
  let light: Pt | null = null;
  const id = P.preset;
  if (id === "reference") {
    // dead di source (tak terjangkau dari UI) — dipertahankan agar bars() tidak yatim.
    if (tt < 1950) {
      set(-1e5);
      barsV = 1;
    } else if (tt < 2050) return;
    else if (tt < 2600) {
      bars(B, P, st, 0, eo((tt - 2050) / 550));
      return;
    } else {
      const e = eo((tt - 2600) / 400);
      const lc: Record<number, [number, number]> = {};
      L.forEach((l) => {
        if (l.ch === " ") return;
        const ln = l.line as number,
          b = lc[ln] || (lc[ln] = [1e9, -1e9]);
        b[0] = Math.min(b[0], (l.tx as number) - (l.tw as number) / 2);
        b[1] = Math.max(b[1], (l.tx as number) + (l.tw as number) / 2);
      });
      L.forEach((l) => {
        const b = lc[l.line as number],
          c = b ? (b[0] + b[1]) / 2 : 540;
        l.x = c + ((l.tx as number) - c) * e;
      });
      set(3000);
      st.speed = 2.2;
      barsV = e;
    }
  } else if (id === "breathe") {
    set(-1e5);
    const ph = (tt / P.T) * Math.PI * 2,
      S = P.S;
    st.warp = (x, y, l) => {
      const h = Math.max(0, ((l.y as number) - y) / S);
      return [
        x + Math.sin(ph + (l.x as number) * 0.004 + h * 1.1) * S * 0.03 * h,
        y + Math.cos(ph + x * 0.003) * S * 0.008 * h,
      ];
    };
    st.rotw = (e) => Math.sin(ph + e.id * 0.7) * 0.12;
  } else if (id === "grow" || id === "scatter") {
    set(0);
    L.forEach((l) => {
      if (tt >= (l.d as number)) l.dead = l.d;
    });
  } else if (id === "wind") {
    set(-1e5);
    const S = P.S,
      u = tt / P.T,
      front = -0.35 + u * 1.9;
    st.warp = (x, y, l) => {
      const hh = Math.max(0, ((l.y as number) - y) / S),
        d = (l.x as number) / Z - front;
      const gg = d < 0 ? Math.exp(d * 2.2) * Math.cos(-d * 9) : Math.exp(-d * d * 30);
      const idle = Math.sin((tt / 1000) * 1.6 + (l.x as number) * 0.01) * 0.012;
      return [
        x + (gg * 0.13 + idle) * S * hh * hh * 0.6 + (gg * 0.13 + idle) * S * hh * 0.4,
        y + Math.abs(gg) * 0.02 * S * hh,
      ];
    };
    st.rotw = (e) => {
      const d = e.x / Z - front;
      return (d < 0 ? Math.exp(d * 2.2) * Math.cos(-d * 9) : Math.exp(-d * d * 30)) * 0.35;
    };
  } else if (id === "reach") {
    set(-1e5);
    const S = P.S,
      ph = (tt / P.T) * Math.PI * 2,
      lx = 540 + Math.sin(ph) * 430,
      ly = 540 + Math.sin(ph * 2) * 260;
    light = [lx, ly];
    st.warp = (x, y, l) => {
      const dx = lx - (l.x as number),
        dy = ly - ((l.y as number) - S * 0.6),
        d = Math.hypot(dx, dy) || 1,
        w = Math.max(0, 1 - d / 560),
        s = w * w * (3 - 2 * w);
      const hh = Math.min(2.5, Math.max(0, ((l.y as number) - y) / S)),
        f = hh * hh * 0.5 + hh * 0.5;
      return [x + (dx / d) * s * S * 0.12 * f, y + (dy / d) * s * S * 0.06 * f];
    };
    st.rotw = (e) => Math.sin(Math.atan2(ly - e.y, lx - e.x)) * 0.15;
  } else if (id === "visit") {
    set(-1e5);
    st.perchOn = true;
    const ph = (tt / P.T) * Math.PI * 2;
    st.warp = (x, y, l) => {
      const hh = Math.max(0, ((l.y as number) - y) / P.S);
      return [x + Math.sin(ph + (l.x as number) * 0.004 + hh) * P.S * 0.015 * hh, y];
    };
  } else {
    // typed
    if (tt >= 4400) return;
    set(0);
    st.letters = L.filter((l) => tt >= (l.birth as number));
    st.textAll = false;
  }
  render(B, tt, st, { perch });
  if (barsV != null) bars(B, P, st, barsV, 1);
  if (id === "reach" && light) {
    const [lx, ly] = light,
      r = P.S * 0.09,
      pts: Pt[] = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      pts.push([lx + Math.cos(a) * r, ly + Math.sin(a) * r]);
    }
    B.fill(pts, st.C.line);
  }
  if (id === "visit") posterFly(B, tt, P, st.C, perch);
  if (id === "typed") {
    const born = st.letters,
      last = born[born.length - 1],
      S = P.S;
    if (Math.floor(tt / 400) % 2 === 0 || (last && tt - (last.birth as number) < 300)) {
      const x = last ? (last.tx as number) + (last.tw as number) / 2 + 0.07 * S : 540,
        y = last ? (last.ty as number) - 0.33 * S : 540,
        w = Math.max(2, S * 0.03),
        h = 0.8 * S;
      B.rect(x - w / 2, y - h / 2, w, h, st.C.text);
    }
  }
}

/** Pemutar loop poster di canvas (rAF). Dijeda saat export berjalan. */
export class PosterPlayer {
  poster: Poster | null = null;
  paused = false;
  private t0 = 0;
  private raf = 0;
  private g: CanvasRenderingContext2D;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: () => DrawOpts,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("PosterPlayer: canvas 2D tidak tersedia");
    this.g = g;
  }

  /** Ganti poster & mulai ulang loop dari t=0. */
  set(P: Poster): void {
    this.poster = P;
    this.t0 = performance.now();
  }

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.poster && !this.paused)
        posterDraw(this.g, this.poster, performance.now() - this.t0, this.opts());
    };
    loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
