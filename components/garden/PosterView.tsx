"use client";

import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { GardenEngine } from "@/lib/garden/engine";
import { PALETTES } from "@/lib/garden/palettes";
import { exportFrames, exportVideo, pickVideoMime } from "@/lib/garden/export-poster";
import { presetOf, type Poster, type PosterPlayer, type PresetId } from "@/lib/garden/poster";
import { PosterPanel } from "@/components/garden/PosterPanel";
import { PosterStage } from "@/components/garden/PosterStage";

export type PosterState = { text: string; seed: number; preset: PresetId };

/** Mode poster: panel + stage + export. State teks/seed/preset dimiliki Garden (bertahan antar-mode). */
export function PosterView({
  engineRef,
  poster,
  onPoster,
  paletteIdx,
  onPalette,
}: {
  engineRef: MutableRefObject<GardenEngine | null>;
  poster: PosterState;
  onPoster: (p: Partial<PosterState>) => void;
  paletteIdx: number;
  onPalette: (i: number) => void;
}) {
  const posterRef = useRef<Poster | null>(null);
  const playerRef = useRef<PosterPlayer | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mime] = useState<string | null>(() => pickVideoMime());
  const pal = PALETTES[paletteIdx];
  const pr = presetOf(poster.preset);

  const run = useCallback(
    async (kind: "video" | "frames") => {
      const P = posterRef.current,
        eng = engineRef.current;
      if (!P || !eng || busy) return;
      if (kind === "video" && !mime) {
        setStatus("Video export isn’t supported in this browser — use PNG frames.");
        return;
      }
      setBusy(true);
      if (playerRef.current) playerRef.current.paused = true;
      const x = {
        poster: P,
        // export = fidelitas penuh (boil sesuai props), tak ikut preferensi reduced motion preview
        draw: {
          C: { red: pal.flower, blue: pal.stem, line: pal.line, text: pal.text, vein: pal.bg },
          bg: pal.bg,
          boil: eng.props.boil,
          recoil: eng.props.recoil,
          font: eng.font,
        },
        text: poster.text,
        preset: poster.preset,
        onStatus: setStatus,
      };
      try {
        if (kind === "video") await exportVideo(x, mime as string);
        else await exportFrames(x);
      } catch (e) {
        setStatus("Export failed: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (playerRef.current) playerRef.current.paused = false;
        setBusy(false);
      }
    },
    [busy, engineRef, mime, pal, poster.preset, poster.text],
  );

  return (
    <div
      data-tg="poster"
      className="absolute inset-0 grid cursor-default bg-black text-[12px] tracking-[0.03em] text-ui-fg"
      style={{ gridTemplateColumns: "minmax(280px, 340px) minmax(0, 1fr)" }}
    >
      <PosterPanel
        info={`1:1 · ${pr.T / 1000}s loop · 30 fps`}
        text={poster.text}
        onText={(text) => onPoster({ text })}
        onRegrow={() => onPoster({ seed: Math.floor(Math.random() * 1e6) })}
        preset={poster.preset}
        onPreset={(preset) => onPoster({ preset })}
        paletteIdx={paletteIdx}
        onPalette={onPalette}
        videoLabel={
          mime
            ? busy
              ? "Exporting…"
              : `Export ${mime.includes("mp4") ? "MP4" : "WebM"} loop`
            : "Video export unavailable"
        }
        canVideo={!!mime}
        busy={busy}
        status={status}
        onVideo={() => void run("video")}
        onFrames={() => void run("frames")}
      />
      <PosterStage
        engineRef={engineRef}
        posterRef={posterRef}
        playerRef={playerRef}
        text={poster.text}
        seed={poster.seed}
        preset={poster.preset}
        palette={pal}
      />
    </div>
  );
}
