// Backend gambar + primitif bunga. Port 1:1 dari blok `// ---------- draw ----------`.
// Backend abstraction: satu kode render untuk Canvas (& nanti SVG di Fase 5).

import type { Pt } from "./types";
import { path, strokeRange } from "./geometry";
import { spr, sprCalm, eo, at } from "./math";

/** Warna aktif palet taman (dari pal().C). vein = bg palet. */
export type Colors = {
  red: string;
  blue: string;
  line: string;
  text: string;
  vein: string;
};

/** Backend gambar — bisa canvas atau SVG. */
export interface Backend {
  fill(p: Pt[], col: string): void;
  stroke(p: Pt[], col: string, w: number): void;
  rect(x: number, y: number, w: number, h: number, col: string): void;
  text(ch: string, x: number, y: number, S: number, col: string): void;
}

/** Backend canvas 2D. font = Playfair Display 700 (font komersial asli tidak dipakai, D7). */
export function canvasBackend(
  g: CanvasRenderingContext2D,
  font = '"Playfair Display",Georgia,serif',
): Backend {
  return {
    fill: (p, col) => {
      g.beginPath();
      path(g, p, true);
      g.fillStyle = col;
      g.fill();
    },
    stroke: (p, col, w) => {
      g.beginPath();
      path(g, p, false);
      g.strokeStyle = col;
      g.lineWidth = w;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.stroke();
    },
    rect: (x, y, w, h, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
    },
    text: (ch, x, y, S, col) => {
      g.font = `700 ${S}px ${font}`;
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = col;
      g.fillText(ch, x, y);
    },
  };
}

/** Duri pada stem di posisi u. */
export function thorn(B: Backend, P: Pt[], u: number, s: number, S: number, C: Colors): void {
  const [p, a] = at(P, u),
    d = a + s * 2.3,
    L = S * 0.045;
  B.stroke([p, [p[0] + Math.cos(d) * L, p[1] + Math.sin(d) * L]], C.blue, S * 0.022);
}

/** Daun. L dalam px. */
export function leaf(
  B: Backend,
  bx: number,
  by: number,
  a: number,
  L: number,
  bend: number,
  C: Colors,
): void {
  if (L < 0.5) return;
  const ca = Math.cos(a),
    sa = Math.sin(a),
    px = -sa,
    py = ca;
  const ax = (u: number): Pt => {
    const b = Math.sin(Math.PI * u) * bend * 0.15 * L;
    return [bx + ca * u * L + px * b, by + sa * u * L + py * b];
  };
  const hw = (u: number): number => L * 0.18 * Math.sin(Math.PI * Math.pow(u, 0.8));
  const N = 12,
    s1: Pt[] = [],
    s2: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N,
      c = ax(u),
      w = hw(u);
    s1.push([c[0] + px * w, c[1] + py * w]);
    s2.push([c[0] - px * w, c[1] - py * w]);
  }
  const tip = ax(1),
    base = ax(0);
  B.fill([base, ...s1.slice(1, N), tip, tip, ...s2.slice(1, N).reverse(), base], C.blue);
  if (L > 6) {
    const v: Pt[] = [];
    for (let i = 0; i <= 8; i++) v.push(ax(0.08 + (0.72 * i) / 8));
    B.stroke(v, C.vein, Math.max(0.8, L * 0.03));
  }
}

/** Parameter varian bunga (ph1/ph2/turns). */
export type RoseVar = { ph1: number; ph2: number; turns: number };

/** Mawar: 6 kelopak (back→front) + spiral + scallop. a = umur ms. tl = arah lean (face-turn) atau null. */
export function rose(
  B: Backend,
  cx: number,
  cy: number,
  R: number,
  rot: number,
  e: RoseVar,
  a: number,
  tl: Pt | null,
  C: Colors,
  calm = false,
): void {
  const cr = Math.cos(rot),
    sr = Math.sin(rot);
  const tm = tl ? Math.hypot(tl[0], tl[1]) : 0,
    ux = tm ? (tl as Pt)[0] / tm : 0,
    uy = tm ? (tl as Pt)[1] / tm : 0,
    sq = -0.28 * tm;
  const T = (x: number, y: number, z = 0): Pt => {
    let dx = x * cr - y * sr,
      dy = x * sr + y * cr;
    if (tm) {
      const k = (dx * ux + dy * uy) * sq;
      dx += k * ux + (tl as Pt)[0] * R * z;
      dy += k * uy + (tl as Pt)[1] * R * z;
    }
    return [cx + dx, cy + dy];
  };
  // kelopak back→front: [cx, cy, rx, ry, angle, depth, edge]
  const P = [
    [0, -0.36, 0.56, 0.54, 0, 0, 0],
    [-0.5, -0.06, 0.6, 0.6, -0.35, 0, 0],
    [0.52, -0.06, 0.6, 0.6, 0.35, 0, 0],
    [-0.42, 0.3, 0.62, 0.48, 0.2, 0.12, 1],
    [0.47, 0.3, 0.62, 0.48, -0.2, 0.12, 1],
    [0.05, 0.42, 0.56, 0.38, 0, 0.14, 0],
  ];
  const ax0 = 0,
    ay0 = 0.5,
    lw = Math.max(0.8, R * 0.045),
    st = 85;
  P.forEach((q, i) => {
    const s = calm ? sprCalm((a - i * st) / 1000, 8) : spr((a - i * st) / 1000, 8, 14);
    if (s <= 0.001) return;
    const open = (1 - Math.min(1, s)) * (q[0] < 0 ? 0.5 : -0.5),
      ang = q[4] + open,
      ca = Math.cos(ang),
      sa = Math.sin(ang);
    const pt = (th: number): Pt => {
      const rr = 1 + 0.08 * Math.sin(3 * th + e.ph1 + i) + 0.04 * Math.sin(5 * th + e.ph2);
      const lx = Math.cos(th) * q[2] * rr,
        ly = Math.sin(th) * q[3] * rr;
      const pxp = q[0] + lx * ca - ly * sa,
        pyp = q[1] + lx * sa + ly * ca;
      return T((ax0 + (pxp - ax0) * s) * R, (ay0 + (pyp - ay0) * s) * R, q[5]);
    };
    const pts: Pt[] = [];
    for (let k = 0; k < 26; k++) pts.push(pt((k / 26) * Math.PI * 2));
    B.fill(pts, C.red);
    if (q[6] && R >= 12 && s > 0.4) {
      const arc: Pt[] = [];
      for (let k = 0; k <= 14; k++) arc.push(pt(Math.PI * (1.18 + (0.64 * k) / 14)));
      strokeRange(B, arc, 0, Math.min(1, (s - 0.4) / 0.5), C.line, lw * 0.8);
    }
  });
  const fr = eo((a - P.length * st - 80) / 520);
  if (fr > 0 && R > 3) {
    const sp: Pt[] = [],
      scl: Pt[] = [];
    const turns = R < 20 ? Math.min(e.turns, 1.3) : R < 32 ? e.turns * 0.8 : e.turns;
    for (let i = 0; i <= 70; i++) {
      const u = i / 70,
        th = e.ph1 + u * turns * Math.PI * 2,
        rr = R * (0.08 + 0.57 * u);
      sp.push(T(Math.cos(th) * rr * 1.05, Math.sin(th) * rr * 0.72 - 0.12 * R, 0.34 - 0.24 * u));
    }
    strokeRange(B, sp, 0, fr, C.line, lw);
    if (R >= 14) {
      for (let i = 0; i <= 36; i++) {
        const u = i / 36;
        scl.push(
          T((-0.72 + 1.5 * u) * R, 0.36 * R + 0.16 * R * Math.abs(Math.sin(u * Math.PI * 3)), 0.18),
        );
      }
      strokeRange(B, scl, 0, fr, C.line, lw);
    }
  }
}

/** Kupu-kupu. s = ukuran, ang = sudut, o = buka sayap 0..1. */
export function butterfly(
  B: Backend,
  x: number,
  y: number,
  s: number,
  ang: number,
  o: number,
  C: Colors,
): void {
  const ca = Math.cos(ang),
    sa = Math.sin(ang),
    T = (px: number, py: number): Pt => [
      x + (px * ca - py * sa) * s,
      y + (px * sa + py * ca) * s,
    ];
  const wing = (cx: number, cy: number, rx: number, ry: number, aa: number, side: number): Pt[] => {
    const pts: Pt[] = [],
      c = Math.cos(aa),
      sn = Math.sin(aa);
    for (let k = 0; k < 22; k++) {
      const th = (k / 22) * Math.PI * 2,
        r = 1 + 0.08 * Math.sin(th * 3),
        lx = Math.cos(th) * rx * r,
        ly = Math.sin(th) * ry * r;
      pts.push(T(side * (cx + lx * c - ly * sn) * (0.12 + 0.88 * o), cy + lx * sn + ly * c));
    }
    return pts;
  };
  for (const sd of [-1, 1]) {
    B.fill(wing(0.46, 0.28, 0.36, 0.3, 0.5 * sd * sd, sd), C.text);
    B.fill(wing(0.55, -0.32, 0.55, 0.36, -0.55, sd), C.text);
    if (o > 0.35) B.fill(wing(0.66, -0.4, 0.13, 0.11, 0, sd), C.red);
  }
  const body: Pt[] = [];
  for (let k = 0; k < 18; k++) {
    const th = (k / 18) * Math.PI * 2;
    body.push(T(Math.cos(th) * 0.08, Math.sin(th) * 0.48));
  }
  B.fill(body, C.blue);
  const lw = Math.max(0.8, s * 0.05);
  B.stroke([T(0, -0.42), T(-0.14, -0.72), T(-0.24, -0.86)], C.blue, lw);
  B.stroke([T(0, -0.42), T(0.14, -0.72), T(0.24, -0.86)], C.blue, lw);
}
