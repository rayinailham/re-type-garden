"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { GardenEngine } from "@/lib/garden/engine";
import type { Palette } from "@/lib/garden/palettes";
import { PosterPlayer, buildPoster, type Poster, type PresetId } from "@/lib/garden/poster";

/**
 * Kanvas poster 1080² + pemutar loop. Rebuild saat teks/seed/preset berubah atau font siap
 * (palet hanya mengubah warna gambar, tidak perlu rebuild — sama dengan source).
 */
export function PosterStage({
  engineRef,
  posterRef,
  playerRef,
  text,
  seed,
  preset,
  palette,
}: {
  engineRef: MutableRefObject<GardenEngine | null>;
  posterRef: MutableRefObject<Poster | null>;
  playerRef: MutableRefObject<PosterPlayer | null>;
  text: string;
  seed: number;
  preset: PresetId;
  palette: Palette;
}) {
  const cv = useRef<HTMLCanvasElement | null>(null);
  const latest = useRef({ text, seed, preset, palette });
  latest.current = { text, seed, preset, palette };
  const rebuildRef = useRef<(() => void) | null>(null);
  const builtKey = useRef("");

  // player: sekali per mount
  useEffect(() => {
    const canvas = cv.current,
      engine = engineRef.current;
    if (!canvas || !engine) return;
    const player = new PosterPlayer(canvas, () => {
      const p = latest.current.palette;
      return {
        C: { red: p.flower, blue: p.stem, line: p.line, text: p.text, vein: p.bg },
        bg: p.bg,
        // A1: pratinjau hormati reduced motion; export tetap fidelitas penuh
        boil: engine.props.boil && !engine.reduced,
        recoil: engine.props.recoil,
        calm: engine.reduced,
        font: engine.font,
      };
    });
    playerRef.current = player;
    const rebuild = () => {
      const l = latest.current;
      builtKey.current = `${l.text}\u0000${l.seed}\u0000${l.preset}`;
      const P = buildPoster({
        text: l.text,
        seed: l.seed,
        preset: l.preset,
        mw: engine.measure(),
        density: engine.props.density,
      });
      posterRef.current = P;
      player.set(P);
    };
    rebuildRef.current = rebuild;
    rebuild();
    player.start();
    const off = engine.on("fonts", rebuild);
    return () => {
      off();
      player.stop();
      playerRef.current = null;
      posterRef.current = null;
      rebuildRef.current = null;
    };
  }, [engineRef, posterRef, playerRef]);

  // teks/seed/preset berubah → rebuild (lewati bila sudah dibangun oleh effect mount)
  useEffect(() => {
    if (builtKey.current !== `${text}\u0000${seed}\u0000${preset}`) rebuildRef.current?.();
  }, [text, seed, preset]);

  return (
    <div
      data-tg="stage"
      className="flex min-w-0 items-center justify-center px-8 pb-8 pt-14"
    >
      <canvas
        ref={cv}
        data-tg="pcanvas"
        width={1080}
        height={1080}
        role="img"
        aria-label={`Poster preview: ${text || "empty"}`}
        style={{
          width: "min(100%, calc(100vh - 96px))",
          height: "auto",
          aspectRatio: "1 / 1",
          display: "block",
          border: "1px solid var(--color-ui-divider)",
        }}
      />
    </div>
  );
}
