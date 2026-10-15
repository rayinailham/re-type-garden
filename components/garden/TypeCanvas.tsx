"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { GardenEngine } from "@/lib/garden/engine";
import { FONT } from "@/lib/garden/layout";
import { PALETTES, type Palette } from "@/lib/garden/palettes";
import type { PresetId } from "@/lib/garden/poster";
import type { LiveRoom } from "@/lib/garden/live";

/** font-family canvas: nama keluarga hasil next/font (di-hash) dibaca dari CSS var. */
export function resolveFont(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-playfair").trim();
  return v ? `${v}, Georgia, serif` : FONT;
}

/**
 * Type mode: mount GardenEngine (rAF + canvas imperatif) ke canvas + hidden input.
 * React hanya memegang elemen; tidak ada setState per frame.
 */
export function TypeCanvas({
  engineRef,
  palette,
  active,
  onCount,
}: {
  engineRef: MutableRefObject<GardenEngine | null>;
  palette: Palette;
  active: boolean;
  /** Jumlah tukang kebun termasuk diri sendiri (live). */
  onCount?: (n: number) => void;
}) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const inp = useRef<HTMLInputElement | null>(null);
  const live = useRef<HTMLDivElement | null>(null);
  const peers = useRef<HTMLDivElement | null>(null);
  const init = useRef({ palette, active });
  const countCb = useRef(onCount);
  countCb.current = onCount;

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;
    const engine = new GardenEngine({
      canvas,
      root: canvas.closest<HTMLElement>('[data-tg="app"]'),
      input: inp.current,
      palette: init.current.palette,
      font: resolveFont(),
    });
    engine.setActive(init.current.active);
    engine.mount();
    engineRef.current = engine;
    // hook uji (?tgtest) — padanan window.__tg = this di source asli
    if (/[?&]tgtest/.test(location.search)) {
      const w = window as unknown as { __tg?: unknown; __tgPoster?: unknown };
      w.__tg = engine;
      // oracle parity: satu frame poster deterministik (text, seed, preset, palette, t) → PNG dataURL
      w.__tgPoster = async (o: {
        text: string;
        seed: number;
        preset: PresetId;
        palette: number;
        t: number;
        boil?: boolean;
      }) => {
        await engine.fontReady();
        const { buildPoster, posterDraw } = await import("@/lib/garden/poster");
        const c = document.createElement("canvas");
        c.width = c.height = 1080;
        const p = PALETTES[o.palette],
          P = buildPoster({ text: o.text, seed: o.seed, preset: o.preset, mw: engine.measure() });
        posterDraw(c.getContext("2d") as CanvasRenderingContext2D, P, o.t, {
          C: { red: p.flower, blue: p.stem, line: p.line, text: p.text, vein: p.bg },
          bg: p.bg,
          boil: !!o.boil,
          recoil: 20,
          font: engine.font,
        });
        return c.toDataURL("image/png");
      };
    }

    // A2: aria-live membacakan kata berjalan (debounce agar pembaca layar tak kebanjiran).
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = engine.on("text", (text) => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (live.current) live.current.textContent = text;
      }, 350);
    });
    // live (?tglocal → BroadcastChannel; Supabase remote tidak aktif, D6). Modul live dimuat
    // lazy hanya bila ada transport yang relevan → bundle awal type mode tak membawanya.
    const env = {
      url: process.env.NEXT_PUBLIC_TG_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_TG_SUPABASE_KEY,
    };
    let room: LiveRoom | null = null,
      gone = false;
    if (/[?&]tglocal/.test(location.search) || (env.url && env.key))
      void import("@/lib/garden/live").then(({ LiveRoom, chooseTransport }) => {
        const factory = chooseTransport(location.search, env);
        if (gone || !factory) return;
        room = new LiveRoom({
          engine,
          layer: peers.current,
          factory,
          onCount: (n) => countCb.current?.(n),
        });
        room.start();
      });
    return () => {
      gone = true;
      room?.dispose();
      clearTimeout(t);
      off();
      engine.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [engineRef]);

  useEffect(() => {
    engineRef.current?.setPalette(palette);
  }, [engineRef, palette]);

  useEffect(() => {
    engineRef.current?.setActive(active);
  }, [engineRef, active]);

  const show = active ? "block" : "none";
  return (
    <>
      <canvas
        ref={cv}
        data-tg="cv"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: show }}
      />
      <div
        ref={peers}
        data-tg="peers"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 4,
          display: show,
        }}
      />
      <input
        ref={inp}
        data-tg="input"
        aria-label="Type to grow a garden"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          margin: 0,
          padding: 0,
          border: 0,
          opacity: 0,
          fontSize: 16,
          color: "transparent",
          background: "transparent",
          caretColor: "transparent",
          pointerEvents: "none",
        }}
      />
      <div ref={live} className="sr-only" aria-live="polite" role="status" />
    </>
  );
}
