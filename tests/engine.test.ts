import { describe, test, expect } from "vitest";
import { TypeState, clampDt, smoothK } from "@/lib/garden/engine";
import { rng } from "@/lib/garden/math";

const mw = () => 0.6;
const mk = () => {
  const s = new TypeState({ mw, rand: rng(42), density: () => 1 });
  s.resize(1000, 800);
  return s;
};

describe("engine util: smoothing & dt", () => {
  test("smoothK = 1 − e^(−dt/τ), τ=80ms", () => {
    expect(smoothK(80)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(smoothK(16)).toBeCloseTo(1 - Math.exp(-0.2), 12);
    expect(smoothK(0)).toBe(0);
    expect(smoothK(1e6)).toBeCloseTo(1, 12);
  });

  test("clampDt: maks 64ms, frame pertama 0", () => {
    expect(clampDt(1000, 900)).toBe(64);
    expect(clampDt(1000, 990)).toBe(10);
    expect(clampDt(1000, undefined)).toBe(0);
  });

  test("step() menggeser Sd/caret ke target dengan koefisien smoothK", () => {
    const s = mk();
    s.add("a", 0);
    s.Sd = 100;
    s.St = 200;
    s.cx = 0;
    s.tcx = 100;
    s.step(16, 16);
    const k = smoothK(16);
    expect(s.Sd).toBeCloseTo(100 + 100 * k, 9);
    expect(s.cx).toBeCloseTo(100 * k, 9);
  });
});

describe("TypeState: add / cut / wither / clear", () => {
  test("huruf tumbuh dalam satu kata (ws sama, wi naik)", () => {
    const s = mk();
    s.add("h", 10);
    s.add("i", 20);
    const [a, b] = s.live;
    expect(b.ws).toBe(a.ws);
    expect(a.wi).toBe(0);
    expect(b.wi).toBe(1);
    expect(b.prev).toBe(a);
    expect(a.els.length).toBeGreaterThan(0);
    expect(s.text()).toBe("hi");
  });

  test("space: huruf terakhir di-cut + endEls mekar, spasi didorong", () => {
    const s = mk();
    s.add("h", 10);
    s.add("i", 20);
    s.add(" ", 500);
    const i = s.live[1];
    expect(i.cut).toBe(500);
    expect(i.endEls && i.endEls.length).toBeGreaterThan(0);
    expect(s.live[2].ch).toBe(" ");
    // kata baru → ws baru
    s.add("x", 600);
    expect(s.live[3].wi).toBe(0);
    expect(s.live[3].ws).not.toBe(i.ws);
  });

  test("space ganda / di awal tidak meng-cut apa pun", () => {
    const s = mk();
    s.add(" ", 0);
    expect(s.live.length).toBe(1);
    s.add("a", 5);
    s.add(" ", 10);
    s.add(" ", 20);
    expect(s.live[1].cut).toBe(10);
  });

  test("wither: huruf terakhir dead=now; sebelumnya (bukan spasi) tendril tumbuh lagi", () => {
    const s = mk();
    s.add("a", 0);
    s.add("b", 10);
    s.add(" ", 100);
    const a = s.live[0],
      b = s.live[1];
    expect(b.cut).toBe(100);
    s.wither(200); // spasi layu
    expect(s.live.length).toBe(2);
    s.wither(300); // b layu → a tendril lagi
    expect(b.dead).toBe(300);
    expect(a.cut).toBeNull();
    expect(a.endEls).toBeNull();
    expect(a.tb).toBe(300);
    expect(s.text()).toBe("a");
  });

  test("backspace di atas spasi: huruf sebelumnya spasi → tak diutak-atik", () => {
    const s = mk();
    s.add("a", 0);
    s.add(" ", 10);
    s.add("b", 20);
    const sp = s.live[1];
    s.wither(30); // b layu, pv = spasi
    expect(sp.cut).toBeUndefined();
  });

  test("step membuang huruf mati > 300ms, mengembalikan yang dibuang", () => {
    const s = mk();
    s.add("a", 0);
    s.add("b", 0);
    s.wither(1000);
    expect(s.step(1200, 16)).toHaveLength(0);
    expect(s.letters).toHaveLength(2);
    const removed = s.step(1301, 16);
    expect(removed.map((l) => l.ch)).toEqual(["b"]);
    expect(s.letters).toHaveLength(1);
  });

  test("clear: hapus semua seketika", () => {
    const s = mk();
    "garden".split("").forEach((c, i) => s.add(c, i));
    s.clear();
    expect(s.letters).toHaveLength(0);
    expect(s.text()).toBe("");
  });

  test("layout: caret target di kanan huruf terakhir (+0.07S), naik 0.33S", () => {
    const s = mk();
    s.add("a", 0);
    const l = s.live[0];
    expect(s.tcx).toBeCloseTo((l.tx as number) + (l.tw as number) / 2 + 0.07 * s.St, 9);
    expect(s.tcy).toBeCloseTo((l.ty as number) - 0.33 * s.St, 9);
  });
});
