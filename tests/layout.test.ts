import { describe, test, expect } from "vitest";
import { layoutCore, type Measure } from "@/lib/garden/layout";
import type { Letter } from "@/lib/garden/types";

/** Pengukur stub: setiap karakter lebar 0.6 (konstan), supaya wrap bisa dikontrol via W/H. */
const measure: Measure = () => 0.6;

/** Bangun deretan Letter dari string (hanya field yang dipakai layoutCore). */
function letters(s: string): Letter[] {
  return [...s].map((ch, i) => ({ ch, id: i, ws: 0, wi: i, els: [] }) as Letter);
}

describe("layoutCore", () => {
  test("satu kata: tidak pernah wrap, S clamp ke S0 (0.28H) kalau muat", () => {
    const A = letters("ab");
    const res = layoutCore(A, 1000, 1000, false, measure);
    expect(res.wrapped).toBe(false);
    expect(res.n).toBe(1);
    // unit=1.2 → maxW/unit=666 > S0=280 → S=280
    expect(res.S).toBeCloseTo(280, 6);
    // posisi terisi
    expect(A[0].tx).toBeTypeOf("number");
    expect(A[0].line).toBe(0);
  });

  test("dua kata panjang: wrap aktif (S < 0.10H)", () => {
    // "aaaaaaa aaaaaaa" = 7+1+7 = 15 char * 0.6 = 9 unit → S≈88.9 < 100 → wrap
    const A = letters("aaaaaaa aaaaaaa");
    const res = layoutCore(A, 1000, 1000, false, measure);
    expect(res.wrapped).toBe(true);
    expect(res.n).toBeGreaterThanOrEqual(2);
    // semua baris ≤ maxW dan tinggi total ≤ 0.82H
    expect(res.n * 2.1 * res.S).toBeLessThanOrEqual(1000 * 0.82 + 1e-6);
  });

  test("dua kata pendek: tidak wrap (S cukup besar)", () => {
    // "ab cd" = 5 char *0.6=3 unit → S=min(280,800/3=266)=266 > 100 → no wrap
    const A = letters("ab cd");
    const res = layoutCore(A, 1000, 1000, false, measure);
    expect(res.wrapped).toBe(false);
  });

  test("hysteresis: S di zona 0.10H–0.14H, prevWrapped menentukan", () => {
    // "aaaaa aaaaa" = 5+1+5=11 char *0.6=6.6 unit → S=800/6.6≈121.2 ∈ [100,140)
    const A1 = letters("aaaaa aaaaa");
    const cold = layoutCore(A1, 1000, 1000, false, measure);
    expect(cold.wrapped).toBe(false); // 121 ≥ 100 → tanpa riwayat, tak wrap

    const A2 = letters("aaaaa aaaaa");
    const warm = layoutCore(A2, 1000, 1000, true, measure);
    expect(warm.wrapped).toBe(true); // prevWrapped → ambang 0.14H, 121 < 140 → wrap
  });
});
