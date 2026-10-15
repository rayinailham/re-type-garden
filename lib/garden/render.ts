// Render taman. Port 1:1 dari blok `// ---------- render ----------`.
// Dua layer: 0 (di belakang huruf) lalu teks huruf lalu 1 (di depan). Boil jitter 120ms.
//
// near()/faceTurn() adalah hook interaksi (pointer lean, face-turn mawar) yang baru
// aktif di Fase 2; di Fase 1 default no-op sehingga render statik tetap 1:1 strukturnya.

import type { El, LeafEl, Letter, Pt, RoseEl } from "./types";
import type { Backend, Colors } from "./draw";
import { eo, spr, sprCalm, jit } from "./math";
import { layerAt, strokeRange } from "./geometry";
import { thorn, leaf, rose } from "./draw";

/** Titik perch (tempat kupu-kupu hinggap) — diisi saat render mawar. */
export type Perch = { id: number; x: number; y: number; R: number };

/** State render (padanan mainState()/st poster). */
export type RenderState = {
  letters: Letter[];
  S: number;
  C: Colors;
  boil: boolean;
  recoil: number;
  speed?: number;
  wither: number;
  face?: boolean;
  /** A1 reduced-motion: spring → eo, tanpa birth wobble. */
  calm?: boolean;
  textAll?: boolean;
  perchOn?: boolean;
  /** warp per-elemen (poster wind/reach/breathe). */
  warp?: (x: number, y: number, l: Letter) => Pt;
  /** rotasi tambahan per-elemen (poster). */
  rotw?: (e: LeafEl | RoseEl) => number;
};

/** Hook interaksi opsional (Fase 2). */
export type RenderHooks = {
  /** Pointer terdekat ke (x,y) → [px,py] atau null. */
  near?: (x: number, y: number) => Pt | null;
  /** Face-turn mawar: cache lean per elemen → [dx,dy]. */
  faceTurn?: (e: El, x: number, y: number) => Pt;
  /** Array perch yang di-reset & diisi saat render (fauna). */
  perch?: Perch[];
  /** Waktu now (ms) — dipakai wpt untuk birth wobble. */
  nowRef?: { now: number };
};

const defaultHooks: Required<Pick<RenderHooks, "near" | "faceTurn">> = {
  near: () => null,
  faceTurn: () => [0, 0],
};

/** Warp posisi titik: birth wobble + lean + st.warp. */
export function wpt(
  st: RenderState,
  l: Letter,
  x: number,
  y: number,
  now: number,
): Pt {
  if (l.birth != null && now != null && !st.calm) {
    const t = ((now - l.birth) * (st.speed || 1)) / 1000;
    if (t > 0 && t < 2.5) {
      const hh = Math.max(0, ((l.y as number) - y) / st.S),
        dmp = Math.exp(-t * 3.2),
        dir = l.id % 2 ? 1 : -1;
      x += st.S * 0.07 * hh * dmp * Math.sin(t * 11) * dir;
      y += st.S * 0.035 * hh * dmp * Math.sin(t * 11 + 1.2);
    }
  }
  if (st.face && l.lean) {
    const hh = Math.min(2.5, Math.max(0, ((l.y as number) - y) / st.S)),
      f = hh * hh * 0.5 + hh * 0.5;
    x += l.lean[0] * st.S * 0.1 * f;
    y += l.lean[1] * st.S * 0.05 * f;
  }
  return st.warp ? st.warp(x, y, l) : [x, y];
}

function drawStem(
  B: Backend,
  e: Extract<El, { t: "stem" }>,
  l: Letter,
  age: number,
  kk: number,
  st: RenderState,
  f: number,
  amp: number,
  layer: number,
  now: number,
  frO?: number,
): void {
  const S = st.S,
    fr = frO != null ? frO : eo((age - e.d0) / e.dur) * kk;
  if (fr <= 0) return;
  const j = jit(e.id, f, amp);
  const P = e.pts.map((p) =>
    wpt(st, l, (l.x as number) + p[0] * S + j[0], (l.y as number) + p[1] * S + j[1], now),
  );
  for (const sg of e.segs) {
    if (sg.layer !== layer) continue;
    const b = Math.min(sg.u1, fr);
    if (b <= sg.u0) continue;
    strokeRange(B, P, sg.u0, b, st.C.blue, S * 0.022 * (e.w || 1));
  }
  for (const th of e.thorns)
    if (fr > th.u && layerAt(e.segs, th.u) === layer) thorn(B, P, th.u, th.s, S, st.C);
}

function drawEl(
  B: Backend,
  e: LeafEl | RoseEl,
  l: Letter,
  age: number,
  kk: number,
  st: RenderState,
  f: number,
  amp: number,
  now: number,
  hooks: RenderHooks,
): void {
  const S = st.S,
    j = jit(e.id, f, amp),
    wx = (x: number, y: number): Pt =>
      wpt(st, l, (l.x as number) + x * S + j[0], (l.y as number) + y * S + j[1], now);
  const rw = st.rotw ? st.rotw(e) : 0;
  if (e.t === "leaf") {
    const sc = (st.calm ? sprCalm((age - e.d0) / 1000, 7) : spr((age - e.d0) / 1000, 7, 15)) * kk;
    if (sc <= 0) return;
    const p = wx(e.x, e.y);
    leaf(B, p[0], p[1], e.a + j[2] + rw, e.L * S * sc, e.bend, st.C);
  } else if (e.t === "rose") {
    const a = age - e.d0;
    if (a < 0) return;
    if (kk <= 0.001) return;
    const p = wx(e.x, e.y),
      ft = hooks.faceTurn || defaultHooks.faceTurn,
      tl = st.face ? ft(e, p[0], p[1]) : null;
    if ((st.face || st.perchOn) && !l.dead && a > 700 && hooks.perch)
      hooks.perch.push({ id: e.id, x: p[0], y: p[1], R: e.R * S * kk });
    rose(
      B,
      p[0],
      p[1],
      e.R * S * kk,
      e.rot + j[2] + rw + (tl ? tl[0] * 0.22 : 0),
      e,
      a,
      tl,
      st.C,
      st.calm,
    );
  }
}

/** Render satu frame taman ke Backend B. now = performance.now() (ms). */
export function render(
  B: Backend,
  now: number,
  st: RenderState,
  hooks: RenderHooks = {},
): void {
  const S = st.S,
    L = st.letters,
    act = L.filter((l) => !l.dead),
    sp = st.speed || 1;
  const near = hooks.near || defaultHooks.near;
  if (st.face && hooks.perch) hooks.perch.length = 0;
  if (st.face)
    for (const l of L) {
      let tx = 0,
        ty = 0;
      const A =
        !l.dead && l.ch !== " " ? near(l.x as number, (l.y as number) - S * 0.6) : null;
      if (A) {
        const dx = A[0] - (l.x as number),
          dy = A[1] - ((l.y as number) - S * 0.6),
          d = Math.hypot(dx, dy),
          reach = Math.max(260, S * 3.2);
        if (d < reach && d > 1) {
          const w = 1 - d / reach,
            s = w * w * (3 - 2 * w);
          tx = (dx / d) * s;
          ty = (dy / d) * s;
        }
      }
      const c = l.lean || (l.lean = [0, 0]);
      c[0] += (tx - c[0]) * 0.07;
      c[1] += (ty - c[1]) * 0.07;
    }
  const f = st.boil ? Math.floor(now / 120) : 0,
    amp = st.boil ? Math.max(0.8, S * 0.01) : 0;
  const kd = (l: Letter): number => (l.dead ? 1 - eo((now - l.dead) / st.wither) : 1);
  const draw = (layer: number) => {
    for (const l of L) {
      if (l.ch === " " || !l.els) continue;
      const age = (now - (l.birth as number)) * sp,
        kk = kd(l);
      const each = (e: El) => {
        if (e.t === "stem") drawStem(B, e, l, age, kk, st, f, amp, layer, now);
        else if (e.layer === layer) drawEl(B, e, l, age, kk, st, f, amp, now, hooks);
      };
      l.els.forEach(each);
      if (l.endEls) l.endEls.forEach(each);
      const i = act.indexOf(l),
        nx = i >= 0 ? act[i + 1] : null;
      if (l.tend && (l.dead || !nx || nx.ch === " ")) {
        let fr = eo((((now - (l.tb as number)) * sp - 150) / 450));
        if (l.cut != null)
          fr *= 1 - eo(((now - l.cut) * sp) / 150) * Math.min(0.85, st.recoil / (0.6 * S));
        for (const e of l.tend) drawStem(B, e, l, age, kk, st, f, amp, layer, now, fr * kk);
      }
    }
  };
  draw(0);
  for (const l of L)
    if (l.ch !== " " && (st.textAll || !l.dead))
      B.text(l.ch, l.x as number, l.y as number, S, st.C.text);
  draw(1);
}
