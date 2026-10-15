"use client";

import { useEffect, useId, useState } from "react";
import { PALETTES } from "@/lib/garden/palettes";
import { PRESETS, type PresetId } from "@/lib/garden/poster";
import { PresetCard } from "@/components/garden/PresetCard";
import { PaletteCard } from "@/components/garden/PaletteCard";

const label = "text-[11px] uppercase tracking-[0.08em] text-ui-muted";

/** Panel kiri poster: Words, Motion, Palette, Export. */
export function PosterPanel({
  info,
  text,
  onText,
  onRegrow,
  preset,
  onPreset,
  paletteIdx,
  onPalette,
  videoLabel,
  canVideo,
  busy,
  status,
  onVideo,
  onFrames,
}: {
  info: string;
  text: string;
  onText: (t: string) => void;
  onRegrow: () => void;
  preset: PresetId;
  onPreset: (p: PresetId) => void;
  paletteIdx: number;
  onPalette: (i: number) => void;
  videoLabel: string;
  canVideo: boolean;
  busy: boolean;
  status: string;
  onVideo: () => void;
  onFrames: () => void;
}) {
  const id = useId();
  // draft lokal: rebuild poster hanya saat commit (blur/Enter), bukan per ketukan — seperti event `change` di source
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const commit = () => draft !== text && onText(draft);

  return (
    <div
      data-tg="panel"
      className="flex flex-col gap-[26px] overflow-y-auto overflow-x-hidden border-r border-ui-divider bg-ui-panel px-[22px] pb-8 pt-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="m-0 text-[26px] font-bold tracking-normal text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Poster
        </h2>
        <div className="text-ui-muted">{info}</div>
      </div>

      <div className="flex flex-col gap-[10px]">
        <label htmlFor={id} className={label}>
          Words
        </label>
        <input
          id={id}
          value={draft}
          maxLength={40}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="rounded-input border border-ui-border bg-black px-3 py-[10px] text-[22px] font-bold text-white outline-none focus:border-white"
          style={{ fontFamily: "var(--font-display)" }}
        />
        <button
          type="button"
          onClick={onRegrow}
          className="cursor-pointer self-start rounded-pill border border-ui-border bg-transparent px-3 py-2 text-ui-fg hover:border-white"
        >
          Regrow garden
        </button>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className={label}>Motion</div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <PresetCard key={p.id} preset={p} selected={preset === p.id} onPick={() => onPreset(p.id)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[10px]">
        <div className={label}>Palette</div>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p, i) => (
            <PaletteCard key={p.name} palette={p} selected={paletteIdx === i} onPick={() => onPalette(i)} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-[10px] border-t border-ui-divider pt-5">
        <div className={label}>Export · 1080 × 1080 loop</div>
        <button
          type="button"
          onClick={onVideo}
          disabled={busy || !canVideo}
          className="cursor-pointer rounded-pill border-0 bg-white px-[14px] py-3 font-medium text-black disabled:cursor-default disabled:opacity-60"
        >
          {videoLabel}
        </button>
        <button
          type="button"
          onClick={onFrames}
          disabled={busy}
          className="cursor-pointer rounded-pill border border-ui-border-strong bg-transparent px-[14px] py-[11px] text-ui-fg hover:border-white disabled:cursor-default disabled:opacity-60"
        >
          PNG frames (.zip)
        </button>
        <div className="min-h-4 text-ui-muted" role="status" aria-live="polite">
          {status}
        </div>
      </div>

      <div className="text-[11px] leading-relaxed text-ui-muted">
        RE: Type Garden · reverse-engineered by Rayina Ilham ·{" "}
        <a
          href="https://x.com/art_akshat"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
          style={{ color: "inherit" }}
        >
          inspired by Type Garden by Akshat Agarwal
        </a>
      </div>
    </div>
  );
}
