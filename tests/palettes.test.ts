import { describe, test, expect } from "vitest";
import { PALETTES, contrast, legibleOpacity } from "@/lib/garden/palettes";

describe("kontras UI (a11y ≥ 4.5:1)", () => {
  test("contrast: hitam/putih = 21, sama = 1", () => {
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  test("opasitas .6 dipertahankan bila sudah lolos (Rose noir, Paper, Mono)", () => {
    for (const i of [0, 1, 9]) expect(legibleOpacity(PALETTES[i], 0.6)).toBe(0.6);
  });
  test("palet yang gagal pada .6 dinaikkan seperlunya (Tomato, Butter, Blush)", () => {
    for (const i of [6, 7, 8]) {
      const p = PALETTES[i];
      expect(contrast(p.text, p.bg, 0.6)).toBeLessThan(4.5);
      const o = legibleOpacity(p, 0.6);
      expect(o).toBeGreaterThan(0.6);
      expect(contrast(p.text, p.bg, o)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.text, p.bg, o - 0.01)).toBeLessThan(4.5); // minimal
    }
  });
  test("semua palet, hint & credit: ≥ 4.5:1", () => {
    for (const p of PALETTES) {
      expect(contrast(p.text, p.bg, legibleOpacity(p, 0.6))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.text, p.bg, legibleOpacity(p, 0.7))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
