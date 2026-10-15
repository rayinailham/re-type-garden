"use client";

// Halaman uji statis Fase 1 (?tgtest / /tgtest).
// Merender kata TETAP + seed TETAP secara deterministik, dan mengekspos
// window.__tg untuk mengambil snapshot elemen gen() (acceptance Fase 1).

import { useEffect, useRef, useState } from "react";
import { PALETTES, veinColor } from "@/lib/garden/palettes";
import { canvasBackend, type Colors } from "@/lib/garden/draw";
import { render, type RenderState } from "@/lib/garden/render";
import { buildTestGarden, snapshot, measureFromCtx } from "@/lib/garden/testgarden";

const TEXT = "in bloom";
const SEED = 7;
const SIZE = 720;

declare global {
  interface Window {
    __tg?: {
      text: string;
      seed: number;
      snapshot: ReturnType<typeof snapshot>;
      letters: unknown;
      S: number;
      wrapped: boolean;
    };
  }
}

export default function TgTestPage() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [snap, setSnap] = useState<ReturnType<typeof snapshot>>([]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pal = PALETTES[0];
    const C: Colors = {
      red: pal.flower,
      blue: pal.stem,
      line: pal.line,
      text: pal.text,
      vein: veinColor(pal),
    };

    const mw = measureFromCtx(g);
    const garden = buildTestGarden(TEXT, SEED, SIZE, SIZE, mw);
    const snap = snapshot(garden);

    // Render deterministik: boil OFF, now=birth → bentuk akhir stabil (bukan tengah animasi).
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, SIZE, SIZE);
    const st: RenderState = {
      letters: garden.letters,
      S: garden.S,
      C,
      boil: false,
      recoil: 20,
      speed: 1,
      wither: 260,
      textAll: true,
    };
    // now besar agar semua elemen (d0+dur) tumbuh penuh
    render(canvasBackend(g), 1e6, st);

    // Hook ?tgtest: snapshot elemen gen() untuk oracle/parity & e2e.
    window.__tg = {
      text: TEXT,
      seed: SEED,
      snapshot: snap,
      letters: garden.letters,
      S: garden.S,
      wrapped: garden.wrapped,
    };
    setSnap(snap);

    return () => {
      delete window.__tg;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#EDEDED",
        fontFamily: "var(--font-dm-mono), monospace",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.04em", color: "#8C8C8C" }}>
        tgtest · text=&quot;{TEXT}&quot; · seed={SEED} · deterministic (boil off) ·
        window.__tg ready
      </div>
      <canvas
        ref={ref}
        data-tgtest="canvas"
        style={{
          width: SIZE,
          height: SIZE,
          maxWidth: "100%",
          border: "1px solid #1E1E1E",
          display: "block",
        }}
      />
      <pre
        data-tgtest="snapshot"
        style={{
          fontSize: 11,
          lineHeight: 1.5,
          color: "#BDBDBD",
          background: "#0A0A0A",
          border: "1px solid #1E1E1E",
          borderRadius: 8,
          padding: 12,
          overflowX: "auto",
          maxWidth: "100%",
        }}
      >
        {JSON.stringify(snap, null, 2)}
      </pre>
    </main>
  );
}
