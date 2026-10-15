import { describe, test, expect } from "vitest";
import { gen, genEnd, wordParams, type GenCtx } from "@/lib/garden/growth";
import { rng } from "@/lib/garden/math";
import type { Letter } from "@/lib/garden/types";

/** Pengukur stub konstan 0.6. */
const mw = () => 0.6;

/** Konteks deterministik: this.rand diganti rng seeded (bukan Math.random). */
function ctx(seedForRand: number, density = 1): GenCtx {
  return { rand: rng(seedForRand), density, mw };
}

/** Huruf baru minimal. */
function letter(ch: string, id: number, ws: number, wi: number, prev?: Letter): Letter {
  return { ch, id, ws, wi, prev: prev ?? null, els: [] };
}

describe("growth.wordParams", () => {
  test("deterministik per ws; rentang sesuai kontrak", () => {
    const p1 = wordParams(42, 1);
    const p2 = wordParams(42, 1);
    expect(p1).toEqual(p2);
    expect(p1.roseP).toBeGreaterThanOrEqual(0.3);
    expect(p1.roseP).toBeLessThanOrEqual(0.6);
    expect(p1.bridgeP).toBeLessThanOrEqual(0.95);
  });

  test("density menskalakan leafy & bridgeP", () => {
    const a = wordParams(42, 1);
    const b = wordParams(42, 2);
    expect(b.leafy).toBeCloseTo(a.leafy * 2, 12);
    expect(b.dens).toBe(2);
  });
});

describe("growth.gen determinisme (seed sama → bentuk sama)", () => {
  test("rand + ws + wi identik → els identik byte-per-byte", () => {
    const a = letter("a", 1, 12345, 0);
    const b = letter("a", 1, 12345, 0);
    gen(a, ctx(999));
    gen(b, ctx(999));
    expect(a.els).toEqual(b.els);
    expect(a.tend).toEqual(b.tend);
    // huruf pertama kata (wi=0, stem pertama) selalu rose
    const firstStem = a.els.find((e) => e.t === "stem");
    expect(firstStem).toBeDefined();
    const hasRose = a.els.some((e) => e.t === "rose");
    expect(hasRose).toBe(true);
  });

  test("rand berbeda → bentuk berbeda (seed Math.random dicampur)", () => {
    const a = letter("a", 1, 12345, 0);
    const b = letter("a", 1, 12345, 0);
    gen(a, ctx(1));
    gen(b, ctx(2));
    expect(a.els).not.toEqual(b.els);
  });

  test("jumlah elemen gen() stabil untuk seed tetap (snapshot kontrak)", () => {
    const l = letter("g", 1, 7, 0);
    gen(l, ctx(7));
    const counts = {
      total: l.els.length,
      stem: l.els.filter((e) => e.t === "stem").length,
      leaf: l.els.filter((e) => e.t === "leaf").length,
      rose: l.els.filter((e) => e.t === "rose").length,
      tend: l.tend?.length ?? 0,
    };
    // Nilai dikunci setelah observasi run pertama (lihat GOLDEN di bawah).
    expect(counts).toEqual(GOLDEN_G_WS7);
  });
});

describe("growth.genEnd", () => {
  test("menghasilkan endEls, deterministik untuk rand+ws+wi sama", () => {
    const a = letter("a", 5, 100, 2);
    const b = letter("a", 5, 100, 2);
    genEnd(a, 300, ctx(55));
    genEnd(b, 300, ctx(55));
    expect(a.endEls).toEqual(b.endEls);
    expect((a.endEls?.length ?? 0)).toBeGreaterThan(0);
  });
});

// Dikunci dari run pertama (gen huruf "g", ws=7, wi=0, rand=rng(7), density=1).
const GOLDEN_G_WS7 = { total: 4, stem: 2, leaf: 1, rose: 1, tend: 1 };
