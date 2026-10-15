import { describe, test, expect } from "vitest";
import { SENT, diffInput, keyAction, type KeyLike } from "@/lib/garden/input";
import { Fauna, sanitizeGift } from "@/lib/garden/fauna";

const k = (key: string, o: Partial<KeyLike> = {}): KeyLike => ({
  key,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...o,
});

describe("keyAction (peta input)", () => {
  test("karakter, space, backspace, enter", () => {
    expect(keyAction(k("a"))).toEqual({ kind: "char", ch: "a", prevent: true });
    expect(keyAction(k(" "))).toEqual({ kind: "char", ch: " ", prevent: true });
    expect(keyAction(k("Backspace"))).toEqual({ kind: "backspace", prevent: true });
    expect(keyAction(k("Enter"))).toEqual({ kind: "clear", prevent: true });
  });
  test("Ctrl/Cmd+S = PNG, +Shift = SVG; kombinasi lain diabaikan tanpa preventDefault", () => {
    expect(keyAction(k("s", { ctrlKey: true }))).toEqual({ kind: "save", svg: false, prevent: true });
    expect(keyAction(k("S", { metaKey: true, shiftKey: true }))).toEqual({ kind: "save", svg: true, prevent: true });
    expect(keyAction(k("a", { ctrlKey: true }))).toEqual({ kind: "none", prevent: false });
    expect(keyAction(k("s", { altKey: true }))).toEqual({ kind: "none", prevent: false });
  });
  test("tombol non-karakter diabaikan; Enter/Space pada BUTTON = aktivasi tombol", () => {
    expect(keyAction(k("ArrowLeft")).kind).toBe("none");
    expect(keyAction(k("Shift")).kind).toBe("none");
    expect(keyAction(k("Enter", { targetTag: "BUTTON" })).kind).toBe("none");
    expect(keyAction(k(" ", { targetTag: "BUTTON" })).kind).toBe("none");
    expect(keyAction(k("a", { targetTag: "BUTTON" })).kind).toBe("char");
  });
});

describe("diffInput (keyboard HP / IME)", () => {
  test("ketik: sentinel + huruf baru", () => {
    expect(diffInput(SENT, SENT + "a")).toEqual({ dels: 0, adds: ["a"] });
    // quirk source: field yang kehilangan sentinel dihitung 1 hapus (p=0, old.length=1)
    expect(diffInput(SENT, "a")).toEqual({ dels: 1, adds: ["a"] });
  });
  test("backspace pada field kosong (hanya sentinel) tetap terlapor", () => {
    expect(diffInput(SENT, "")).toEqual({ dels: 1, adds: [] });
  });
  test("prediksi menulis ulang kata: diff prefix → hapus + tambah", () => {
    expect(diffInput(SENT + "helo", SENT + "hello")).toEqual({ dels: 1, adds: ["l", "o"] });
    expect(diffInput(SENT + "abc", "xyz")).toEqual({ dels: 3, adds: ["x", "y", "z"] });
  });
  test("sentinel bukan huruf: tidak dihitung hapus maupun tambah", () => {
    expect(diffInput(SENT + "ab", SENT + "a")).toEqual({ dels: 1, adds: [] });
    expect(diffInput(null, SENT + "q")).toEqual({ dels: 0, adds: ["q"] });
    expect(diffInput(SENT, SENT + SENT + "z").adds).toEqual(["z"]);
  });
  test("newline diteruskan (engine = clear); code point di luar BMP utuh", () => {
    expect(diffInput(SENT, SENT + "a\n").adds).toEqual(["a", "\n"]);
    expect(diffInput(SENT, SENT + "🌹").adds).toEqual(["🌹"]);
  });
});

describe("gift & fauna", () => {
  test("sanitizeGift: clamp 0..1, seed int, tolak non-finite / bukan objek (S1)", () => {
    expect(sanitizeGift({ x: 2, y: -1, s: 12.7 })).toEqual({ x: 1, y: 0, s: 12 });
    expect(sanitizeGift({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5, s: 1 });
    expect(sanitizeGift({ x: NaN, y: 0 })).toBeNull();
    expect(sanitizeGift({ x: Infinity, y: 0 })).toBeNull();
    expect(sanitizeGift({ x: "1", y: 0 })).toBeNull();
    expect(sanitizeGift(null)).toBeNull();
    expect(sanitizeGift("x")).toBeNull();
  });
  test("gift maks 14 (yang tertua dibuang)", () => {
    const f = new Fauna();
    for (let i = 0; i < 20; i++) f.addGift({ x: 0.5, y: 0.5, s: i + 1 }, i);
    expect(f.gifts).toHaveLength(14);
    expect(f.gifts[0].t0).toBe(6);
  });
  test("kupu-kupu: tanpa perch = wander; dengan perch = fly ke perch terdekat; yang ke-7 mengusir tertua", () => {
    const f = new Fauna();
    f.spawn(100, 100, 800, 600, 100, 0, () => 0.5);
    expect(f.flies[0].st).toBe("wander");
    f.perch.push({ id: 1, x: 120, y: 100, R: 10 }, { id: 2, x: 700, y: 500, R: 10 });
    f.spawn(110, 100, 800, 600, 100, 0, () => 0.5);
    expect(f.flies[1].st).toBe("fly");
    expect(f.flies[1].pid).toBe(1);
    for (let i = 0; i < 6; i++) f.spawn(400, 300, 800, 600, 100, 0, () => 0.5);
    expect(f.flies.some((x) => x.st === "leave")).toBe(true);
  });
});
