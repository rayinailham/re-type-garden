"use client";

import { PALETTES } from "@/lib/garden/palettes";

/** 10 swatch 22px, ring 1.5px, scale 1.1 aktif / 1.15 hover. stopPropagation: tap swatch tak membuka keyboard. */
export function PaletteSwatches({
  active,
  onPick,
}: {
  active: number;
  onPick: (i: number) => void;
}) {
  const cur = PALETTES[active];
  return (
    <div
      data-tg="pal"
      role="group"
      aria-label="Palette"
      className="flex items-center gap-[6px] rounded-pill px-[6px] py-1"
      style={{ border: "1px solid var(--color-ui-border-strong)", background: cur.bg }}
    >
      {PALETTES.map((p, i) => {
        const sel = i === active;
        return (
          <button
            key={p.name}
            type="button"
            data-tg="sw"
            aria-label={p.name}
            aria-pressed={sel}
            title={p.name}
            onClick={(e) => {
              e.stopPropagation();
              onPick(i);
            }}
            className="flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full p-0 transition-transform duration-150 hover:scale-[1.15]"
            style={{
              background: p.bg,
              border: `1.5px solid ${sel ? cur.text : p.bg === cur.bg ? "#3A3A3A" : "transparent"}`,
              transform: sel ? "scale(1.1)" : undefined,
            }}
          >
            <span
              data-tg="dot"
              className="block h-[10px] w-[10px] rounded-full"
              style={{ background: p.flower }}
            />
          </button>
        );
      })}
    </div>
  );
}
