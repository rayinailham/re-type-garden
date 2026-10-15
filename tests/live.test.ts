import { describe, test, expect } from "vitest";
import {
  chooseTransport,
  localTransport,
  pointerInterval,
  safeName,
  safeTint,
  sanitizePeerMsg,
  supabaseTransport,
  type PresenceMeta,
} from "@/lib/garden/live";

describe("pointerInterval: clamp(1000·N²/40, 125, 10000)", () => {
  test("N=1,2,5,10,20,50", () => {
    expect(pointerInterval(1)).toBe(125); // 25 → naik ke min
    expect(pointerInterval(2)).toBe(125); // 100 → min
    expect(pointerInterval(5)).toBe(625);
    expect(pointerInterval(10)).toBe(2500);
    expect(pointerInterval(20)).toBe(10000);
    expect(pointerInterval(50)).toBe(10000); // 62500 → maks
  });
});

describe("guard S1", () => {
  test("sanitizePeerMsg: skema ketat, clamp, tolak diri sendiri / non-finite", () => {
    expect(sanitizePeerMsg({ i: "abc", x: 0.5, y: 2 }, "me")).toEqual({ i: "abc", x: 0.5, y: 1.02 });
    expect(sanitizePeerMsg({ i: "abc", x: -5, y: 0 }, "me")).toEqual({ i: "abc", x: -0.02, y: 0 });
    expect(sanitizePeerMsg({ i: "abc", h: 1 }, "me")).toEqual({ i: "abc", h: true });
    expect(sanitizePeerMsg({ i: "me", x: 0, y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg({ i: "abc", x: NaN, y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg({ i: "abc", x: Infinity, y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg({ i: "abc", x: "1", y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg({ i: 7, x: 0, y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg({ i: "x".repeat(99), x: 0, y: 0 }, "me")).toBeNull();
    expect(sanitizePeerMsg(null, "me")).toBeNull();
    expect(sanitizePeerMsg("p", "me")).toBeNull();
  });
  test("safeTint hanya #RRGGBB; safeName dipotong 24", () => {
    expect(safeTint("#FF8A00")).toBe("#FF8A00");
    expect(safeTint("red")).toBe("#FFFFFF");
    expect(safeTint("#GG0000")).toBe("#FFFFFF");
    expect(safeTint("url(javascript:1)")).toBe("#FFFFFF");
    expect(safeTint(5)).toBe("#FFFFFF");
    expect(safeName("iris")).toBe("iris");
    expect(safeName("  ")).toBe("visitor");
    expect(safeName(undefined)).toBe("visitor");
    expect(safeName("x".repeat(80))).toHaveLength(24);
  });
});

describe("chooseTransport (D6: supabase remote tidak aktif)", () => {
  test("?tglocal → local; tanpa env → none; env lengkap → stub supabase (null)", () => {
    expect(chooseTransport("?tglocal")).toBe(localTransport);
    expect(chooseTransport("?x=1&tglocal")).toBe(localTransport);
    expect(chooseTransport("")).toBeNull();
    expect(chooseTransport("", { url: "https://x" })).toBeNull();
    const f = chooseTransport("", { url: "https://x", key: "k" });
    expect(f).not.toBeNull();
    expect(f!({ id: "a", n: "iris", c: "#FFFFFF" }, { onPeer() {}, onGift() {}, onPresence() {} })).toBeNull();
    expect(supabaseTransport({ url: "u", key: "k" })).toBeTypeOf("function");
  });
});

describe("localTransport (BroadcastChannel tg-live)", () => {
  const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

  test("presence dua arah, pointer & gift diteruskan, bye menghapus", async () => {
    const seenA: Record<string, PresenceMeta>[] = [];
    const msgsA: unknown[] = [];
    const giftsA: unknown[] = [];
    const A = localTransport({ id: "A", n: "iris", c: "#FF8A00" }, {
      onPeer: (p) => msgsA.push(p),
      onGift: (g) => giftsA.push(g),
      onPresence: (m) => seenA.push(m),
    })!;
    const B = localTransport({ id: "B", n: "fern", c: "#7FD18B" }, { onPeer() {}, onGift() {}, onPresence() {} })!;
    await tick();
    const last = () => seenA[seenA.length - 1];
    expect(Object.keys(last()).sort()).toEqual(["A", "B"]);
    expect(last().B).toEqual({ n: "fern", c: "#7FD18B" });

    B.send("p", { i: "B", x: 0.25, y: 0.75 });
    B.send("r", { x: 0.1, y: 0.2, s: 9 });
    await tick();
    expect(msgsA).toEqual([{ i: "B", x: 0.25, y: 0.75 }]);
    expect(giftsA).toEqual([{ x: 0.1, y: 0.2, s: 9 }]);

    B.close();
    await tick();
    expect(Object.keys(last())).toEqual(["A"]);
    A.close();
  });
});
