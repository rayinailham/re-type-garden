// Fauna & rose gift. Port 1:1 dari spawnFly/flyOff/drawFlies/liveRose di original-source.txt.
// Kupu-kupu (maks 6): fly → sit → leave, atau wander 3.5s → leave. Rose gift hidup 60s.

import type { Rand } from "./types";
import type { Backend, Colors } from "./draw";
import type { Perch } from "./render";
import { butterfly, rose } from "./draw";
import { rng, eo } from "./math";
import { MOTION } from "./palettes";

export type FlyState = "fly" | "sit" | "wander" | "leave";

export type Fly = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  st: FlyState;
  pid: number | null;
  hx: number;
  hy: number;
  t0: number;
  ph: number;
  sz: number;
  seed: number;
  ang: number;
  open?: number;
  ex?: number;
  ey?: number;
};

/** Rose gift yang ditanam (lokal atau dari peer). x,y dinormalisasi 0..1. */
export type Gift = {
  x: number;
  y: number;
  t0: number;
  rot: number;
  e: { ph1: number; ph2: number; turns: number };
};

/** Payload gift mentah (r {x,y,s}). */
export type GiftPayload = { x: number; y: number; s: number };

/**
 * Validasi + clamp payload gift (S1). Tolak non-objek / non-finite; clamp x,y ke 0..1;
 * seed dipaksa int (0 → 1, sama dengan `(g.s|0) || 1` di source).
 */
export function sanitizeGift(g: unknown): GiftPayload | null {
  if (!g || typeof g !== "object") return null;
  const o = g as Record<string, unknown>;
  if (typeof o.x !== "number" || typeof o.y !== "number") return null;
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return null;
  const s = typeof o.s === "number" && Number.isFinite(o.s) ? o.s : 0;
  return {
    x: Math.min(1, Math.max(0, o.x)),
    y: Math.min(1, Math.max(0, o.y)),
    s: (s | 0) || 1,
  };
}

export class Fauna {
  flies: Fly[] = [];
  /** Titik hinggap — diisi render() lewat hooks.perch. */
  perch: Perch[] = [];
  gifts: Gift[] = [];
  private lastDraw?: number;

  /** Munculkan kupu-kupu menuju perch terdekat dari (cx,cy). */
  spawn(
    cx: number,
    cy: number,
    W: number,
    H: number,
    Sd: number,
    now: number,
    rand: Rand = Math.random,
  ): void {
    if (this.flies.length >= MOTION.butterflyMax) {
      const o = this.flies.find((f) => f.st !== "leave");
      if (o) this.flyOff(o, W, H);
    }
    const taken = new Set(this.flies.filter((f) => f.st !== "leave").map((f) => f.pid));
    let best: Perch | null = null,
      bd = 1e9;
    for (const p of this.perch) {
      if (taken.has(p.id)) continue;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const left = cx < W / 2,
      sz = Math.max(9, Sd * 0.09);
    this.flies.push({
      x: left ? -40 : W + 40,
      y: cy + (rand() - 0.5) * H * 0.4,
      vx: 0,
      vy: 0,
      st: best ? "fly" : "wander",
      pid: best ? best.id : null,
      hx: cx,
      hy: cy,
      t0: now,
      ph: rand() * 6,
      sz,
      seed: rand() * 100,
      ang: 0,
    });
  }

  flyOff(f: Fly, W: number, H: number): void {
    f.st = "leave";
    f.pid = null;
    f.ex = f.x < W / 2 ? -80 : W + 80;
    f.ey = f.y - H * 0.3;
  }

  drawFlies(B: Backend, now: number, C: Colors, W: number, H: number): void {
    const dt = Math.min(48, now - (this.lastDraw ?? now));
    this.lastDraw = now;
    const byId: Record<number, Perch> = {};
    for (const p of this.perch) byId[p.id] = p;
    this.flies = this.flies.filter((f) => {
      const t = (now - f.t0) / 1000;
      let tx = 0,
        ty = 0;
      if (f.st === "sit" || f.st === "fly") {
        const p = byId[f.pid as number];
        if (!p) this.flyOff(f, W, H);
        else {
          tx = p.x + p.R * 0.05;
          ty = p.y - p.R * 0.55;
        }
      }
      if (f.st === "wander") {
        tx = f.hx + Math.sin(t * 1.3 + f.seed) * 70;
        ty = f.hy + Math.sin(t * 2.1 + f.seed) * 40;
        if (t > 3.5) this.flyOff(f, W, H);
      }
      if (f.st === "leave") {
        tx = f.ex as number;
        ty = f.ey as number;
      }
      if (f.st === "sit") {
        f.x += (tx - f.x) * 0.35;
        f.y += (ty - f.y) * 0.35;
        f.ang *= 0.85;
        f.ph += dt * 0.004;
        const burst = Math.sin((now / 1000) * 0.9 + f.seed) > 0.75;
        f.open = burst
          ? 0.2 + 0.8 * Math.abs(Math.cos((now / 1000) * 9 + f.seed))
          : 0.25 + 0.15 * Math.sin(f.ph);
      } else {
        const dx = tx - f.x,
          dy = ty - f.y,
          d = Math.hypot(dx, dy) || 1,
          sp = f.st === "leave" ? 0.42 : Math.min(0.34, 0.06 + d * 0.0016);
        const flut = Math.sin(t * 7 + f.seed) * 0.12,
          wob = Math.cos(t * 4.3 + f.seed) * 0.1;
        const ax = (dx / d) * sp + wob - f.vx,
          ay = (dy / d) * sp + flut - f.vy;
        f.vx += (ax * 0.06 * dt) / 16;
        f.vy += (ay * 0.06 * dt) / 16;
        f.x += f.vx * dt;
        f.y += f.vy * dt + Math.sin(t * 13 + f.seed) * 0.6;
        f.ang += (Math.max(-0.5, Math.min(0.5, f.vx * 1.4)) - f.ang) * 0.1;
        f.open = Math.abs(Math.cos(t * 17 + f.seed));
        if (f.st === "fly" && d < 5) {
          f.st = "sit";
          f.ph = 0;
        }
        if (f.st === "leave" && (f.x < -60 || f.x > W + 60 || f.y < -60)) return false;
      }
      butterfly(B, f.x, f.y, f.sz, f.ang, f.open ?? 0, C);
      return true;
    });
  }

  /** Tanam gift dari payload yang SUDAH tervalidasi (lihat sanitizeGift). */
  addGift(g: GiftPayload, now: number): void {
    const r = rng(g.s || 1);
    this.gifts.push({
      x: g.x,
      y: g.y,
      t0: now,
      rot: (r() - 0.5) * 0.8,
      e: { ph1: r() * 6.283, ph2: r() * 6.283, turns: 1.4 + r() * 0.5 },
    });
    if (this.gifts.length > MOTION.gift.max) this.gifts.shift();
  }

  drawGifts(
    g: CanvasRenderingContext2D,
    B: Backend,
    now: number,
    W: number,
    H: number,
    Sd: number,
    C: Colors,
    calm = false,
  ): void {
    const LIFE = MOTION.gift.lifeMs,
      FADE = MOTION.gift.fadeMs;
    this.gifts = this.gifts.filter((gf) => now - gf.t0 < LIFE);
    for (const gf of this.gifts) {
      const age = now - gf.t0,
        w = 1 - eo((age - (LIFE - FADE)) / FADE);
      g.globalAlpha = Math.max(0, w);
      rose(
        B,
        gf.x * W,
        gf.y * H + (1 - w) * Sd * 0.3,
        Sd * 0.24 * (0.65 + 0.35 * w),
        gf.rot + (1 - w) * 0.6,
        gf.e,
        age,
        null,
        C,
        calm,
      );
    }
    g.globalAlpha = 1;
  }
}
