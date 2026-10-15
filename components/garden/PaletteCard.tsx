"use client";

import type { Palette } from "@/lib/garden/palettes";

/** Kartu palet (grid 2 kolom): preview bunga + batang + "Aa" tipe. */
export function PaletteCard({
  palette,
  selected,
  onPick,
}: {
  palette: Palette;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={palette.name}
      aria-pressed={selected}
      onClick={onPick}
      className="flex cursor-pointer flex-col items-stretch gap-2 rounded-card bg-transparent px-[6px] pb-2 pt-[6px] text-left text-ui-fg hover:!border-ui-muted"
      style={{ border: `1px solid ${selected ? "#FFFFFF" : "var(--color-ui-border)"}` }}
    >
      <span
        className="flex h-[44px] items-center justify-center rounded-preview"
        style={{ background: palette.bg }}
      >
        <span className="h-[18px] w-[18px] rounded-full" style={{ background: palette.flower }} />
        <span
          className="ml-[-4px] h-[12px] w-[12px] rounded-full"
          style={{ background: palette.stem }}
        />
        <span
          className="ml-2 text-[18px] font-bold"
          style={{ fontFamily: "var(--font-display)", color: palette.text }}
        >
          Aa
        </span>
      </span>
      <span className="px-1" aria-hidden="true">
        {palette.name}
      </span>
    </button>
  );
}
