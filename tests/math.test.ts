import { describe, test, expect } from "vitest";
import { rng, eo, spr, h, at } from "@/lib/garden/math";

describe("math.rng (mulberry32)", () => {
  test("determinisme: 5 nilai pertama seed 7 (kontrak)", () => {
    const r = rng(7);
    const got = [r(), r(), r(), r(), r()];
    expect(got).toEqual([
      0.011704753153026104, 0.06195825757458806, 0.97690763277933, 0.6990287057124078,
      0.5214452685322613,
    ]);
  });

  test("seed sama → urutan sama; seed beda → urutan beda", () => {
    const a = rng(7),
      b = rng(7),
      c = rng(8);
    const seqA = Array.from({ length: 6 }, () => a());
    const seqB = Array.from({ length: 6 }, () => b());
    const seqC = Array.from({ length: 6 }, () => c());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  test("rentang 0..1", () => {
    const r = rng(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("math.easing", () => {
  test("eo easeOutCubic clamp", () => {
    expect(eo(-1)).toBe(0);
    expect(eo(0)).toBe(0);
    expect(eo(1)).toBe(1);
    expect(eo(2)).toBe(1);
    expect(eo(0.5)).toBeCloseTo(1 - Math.pow(0.5, 3), 12);
  });

  test("spr(0) = 0, spr naik dari 0", () => {
    expect(spr(0)).toBe(0);
    expect(spr(-1)).toBe(0);
    // di t kecil, spring mulai bergerak (overshoot bisa > 1 nanti)
    expect(spr(0.001)).toBeGreaterThan(0);
  });

  test("h hash 0..1 deterministik", () => {
    expect(h(1)).toBe(h(1));
    const v = h(3.14159);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe("math.at", () => {
  test("titik + tangen horizontal lurus", () => {
    const P: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    const [, ang] = at(P, 0.5);
    expect(ang).toBeCloseTo(0, 12);
  });
});
