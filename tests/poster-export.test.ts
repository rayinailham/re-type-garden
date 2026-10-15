import { describe, test, expect } from "vitest";
import { buildPoster, presetOf, PRESETS } from "@/lib/garden/poster";
import { glyphPath, svgBackend, svgDocument, type Glyphs } from "@/lib/garden/export";
import { fileBase, frameCount } from "@/lib/garden/export-poster";

const mw = (ch: string) => (ch === " " ? 0.3 : 0.6);

describe("buildPoster", () => {
  test("deterministik: text+seed+preset sama → bentuk sama", () => {
    const a = buildPoster({ text: "in bloom", seed: 7, preset: "grow", mw });
    const b = buildPoster({ text: "in bloom", seed: 7, preset: "grow", mw });
    expect(a.S).toBe(b.S);
    expect(a.letters.map((l) => [l.tx, l.ty, l.els.length])).toEqual(
      b.letters.map((l) => [l.tx, l.ty, l.els.length]),
    );
    const c = buildPoster({ text: "in bloom", seed: 8, preset: "grow", mw });
    expect(c.letters.map((l) => l.els.length)).not.toEqual(a.letters.map((l) => l.els.length));
  });

  test("teks dipotong 40 karakter; kosong → satu spasi", () => {
    const long = buildPoster({ text: "x".repeat(55), seed: 1, preset: "breathe", mw });
    expect(long.letters).toHaveLength(40);
    expect(buildPoster({ text: "", seed: 1, preset: "breathe", mw }).letters).toHaveLength(1);
  });

  test("seluruh taman di dalam margin 6% (half = 0.44·1080) dan skala ≤ 1.25", () => {
    for (const text of ["in bloom", "a", "type garden wind"]) {
      const P = buildPoster({ text, seed: 7, preset: "breathe", mw });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const l of P.letters) {
        if (l.ch === " ") continue;
        for (const e of [...l.els, ...(l.endEls || [])]) {
          const pts = e.t === "stem" ? e.pts.map((q) => [q[0], q[1], 0.02]) : [[e.x, e.y, e.t === "leaf" ? e.L : e.R * 1.15]];
          for (const [x, y, r] of pts) {
            const X = (l.tx as number) + x * P.S, Y = (l.ty as number) + y * P.S, R = r * P.S;
            x0 = Math.min(x0, X - R); x1 = Math.max(x1, X + R); y0 = Math.min(y0, Y - R); y1 = Math.max(y1, Y + R);
          }
        }
      }
      const m = 1080 * 0.06 - 1; // toleransi 1px
      expect(x0).toBeGreaterThanOrEqual(m);
      expect(y0).toBeGreaterThanOrEqual(m);
      expect(x1).toBeLessThanOrEqual(1080 - m);
      expect(y1).toBeLessThanOrEqual(1080 - m);
    }
  });

  test("7 preset dengan T dari tokens", () => {
    expect(PRESETS.map((p) => [p.id, p.T])).toEqual([
      ["breathe", 3000], ["grow", 6000], ["typed", 5000], ["wind", 4000],
      ["reach", 6000], ["scatter", 6000], ["visit", 7000],
    ]);
    expect(presetOf("nope").id).toBe("breathe");
  });

  test("jadwal lahir: grow min(110,3000/n)+200, typed min(85,3600/n)+300, scatter 150–2550", () => {
    const n = 8;
    const g = buildPoster({ text: "in bloom", seed: 7, preset: "grow", mw });
    expect(g.letters[0].b).toBe(200);
    expect(g.letters[1].b).toBeCloseTo(200 + Math.min(110, 3000 / n), 9);
    const t = buildPoster({ text: "in bloom", seed: 7, preset: "typed", mw });
    expect(t.letters[1].b).toBeCloseTo(300 + Math.min(85, 3600 / n), 9);
    const s = buildPoster({ text: "in bloom", seed: 7, preset: "scatter", mw });
    for (const l of s.letters) {
      expect(l.b).toBeGreaterThanOrEqual(150);
      expect(l.b).toBeLessThan(2550);
    }
  });
});

describe("export util", () => {
  test("frameCount = round(T/1000·30)", () => {
    expect(frameCount(3000)).toBe(90);
    expect(frameCount(7000)).toBe(210);
  });
  test("fileBase: slug ≤ 24, huruf kecil, preset", () => {
    expect(fileBase("In Bloom!", "grow")).toBe("garden-in-bloom--grow");
    expect(fileBase("", "typed")).toBe("garden-loop-typed");
    expect(fileBase("a".repeat(40), "wind")).toBe("garden-" + "a".repeat(24) + "-wind");
  });
});

describe("SVG", () => {
  const gl: Glyphs = { faces: [{ upm: 1000, g: { a: [500, "M0 0L100 0Q150 50 100 100Z"], e: [400, "M0 0L50 0Z"] } }] };

  test("glyphPath: skala S/upm, center di x, flip y (baseline y)", () => {
    // S=1000 → k=1; x0 = 100 − 500/2 = −150
    expect(glyphPath(gl, "a", 100, 200, 1000)).toBe("M-150 200L-50 200Q0 150 -50 100Z");
    expect(glyphPath(gl, "?", 0, 0, 10)).toBeNull();
    expect(glyphPath(null, "a", 0, 0, 10)).toBeNull();
  });

  test("id huruf unik (e, e-2, digit-1, glyph), fallback <text> aman XML & tanpa GT Ultra", () => {
    const { B, parts } = svgBackend(gl);
    B.text("e", 0, 0, 100, "#fff");
    B.text("e", 0, 0, 100, "#fff");
    B.text("1", 0, 0, 100, "#fff");
    B.text("<&\u0001>", 0, 0, 100, "#fff");
    const s = parts.join("");
    expect(s).toContain('<path id="e"');
    expect(s).toContain('<path id="e-2"');
    expect(s).toContain("<text");
    expect(s).toContain("&lt;&amp;&gt;");
    expect(s).not.toContain("\u0001");
    expect(s).not.toMatch(/GT Ultra/i);
  });

  test("stroke/fill → path SVG; dokumen berisi rect latar", () => {
    const { B, parts } = svgBackend(null);
    B.fill([[0, 0], [10, 0], [10, 10]], "#f00");
    B.stroke([[0, 0], [10, 10], [20, 0]], "#00f", 2.345);
    const doc = svgDocument(parts, 100, 50, "#000");
    expect(doc).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="100" height="50"/);
    expect(doc).toContain('stroke-width="2.35"');
    expect(doc).toContain('<rect width="100%" height="100%" fill="#000"/>');
  });
});
