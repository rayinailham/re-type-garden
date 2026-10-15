"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { GardenEngine } from "@/lib/garden/engine";
import { PALETTES, legibleOpacity } from "@/lib/garden/palettes";
import { savePNG, saveSVG } from "@/lib/garden/export";
import { TypeCanvas } from "@/components/garden/TypeCanvas";
import { ModeToggle, type Mode } from "@/components/garden/ModeToggle";
import { HintBar } from "@/components/garden/HintBar";
import { PaletteSwatches } from "@/components/garden/PaletteSwatches";
import { ExportButtons } from "@/components/garden/ExportButtons";
import { CreditBar } from "@/components/garden/CreditBar";
import type { PosterState } from "@/components/garden/PosterView";

// poster (buildPoster/posterDraw/zip/video) dimuat lazy: type mode = bundle awal minimum
const PosterView = dynamic(() => import("@/components/garden/PosterView").then((m) => m.PosterView), {
  ssr: false,
});

export function Garden() {
  const [mode, setMode] = useState<Mode>("type");
  const [paletteIdx, setPaletteIdx] = useState(0);
  const palette = PALETTES[paletteIdx];
  const engineRef = useRef<GardenEngine | null>(null);
  const [gardeners, setGardeners] = useState(1);
  const [poster, setPoster] = useState<PosterState>({ text: "in bloom", seed: 7, preset: "breathe" });

  // masuk poster membawa teks hidup dari type mode (liveText || teks poster terakhir)
  const pick = useCallback((m: Mode) => {
    if (m === "poster") {
      const live = engineRef.current?.liveText() || "";
      setPoster((p) => ({ ...p, text: live || p.text }));
    }
    setMode(m);
  }, []);
  const pickPalette = useCallback((i: number) => {
    setPaletteIdx(i);
    engineRef.current?.refocus();
  }, []);

  const save = useCallback((kind: "png" | "svg") => {
    const e = engineRef.current;
    if (!e) return;
    if (kind === "png") savePNG(e);
    else void saveSVG(e);
    e.refocus();
  }, []);

  // Ctrl/Cmd+S dari engine → export
  useEffect(() => engineRef.current?.on("save", save), [save]);

  // palet aktif juga diekspos sebagai CSS var (--tg-flower/--tg-stem/--tg-detail)
  useEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--tg-flower", palette.flower);
    s.setProperty("--tg-stem", palette.stem);
    s.setProperty("--tg-detail", palette.line);
  }, [palette]);

  return (
    <main
      data-tg="app"
      style={
        {
          "--tg-bg": palette.bg,
          "--tg-text": palette.text,
          background: palette.bg,
        } as React.CSSProperties
      }
    >
      <h1 className="sr-only">RE: Type Garden</h1>
      <TypeCanvas
        engineRef={engineRef}
        palette={palette}
        active={mode === "type"}
        onCount={setGardeners}
      />

      {mode === "type" && <CreditBar textColor={palette.text} opacity={legibleOpacity(palette, 0.7)} />}
      {mode === "poster" && (
        <PosterView
          engineRef={engineRef}
          poster={poster}
          onPoster={(p) => setPoster((s) => ({ ...s, ...p }))}
          paletteIdx={paletteIdx}
          onPalette={pickPalette}
        />
      )}
      <ModeToggle mode={mode} onChange={pick} />
      {mode === "type" && (
        <HintBar textColor={palette.text} opacity={legibleOpacity(palette, 0.6)} count={gardeners}>
          <PaletteSwatches
            active={paletteIdx}
            onPick={pickPalette}
          />
          <ExportButtons onSave={save} />
        </HintBar>
      )}
    </main>
  );
}
