"use client";

import type { Preset } from "@/lib/garden/poster";

/** Kartu preset gerak (grid 2 kolom): aktif bg #161616 + border putih. */
export function PresetCard({
  preset,
  selected,
  onPick,
}: {
  preset: Preset;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className="flex cursor-pointer flex-col gap-1 rounded-input p-0 px-3 py-[10px] text-left text-white"
      style={{
        background: selected ? "var(--color-ui-selected)" : "transparent",
        border: `1px solid ${selected ? "#FFFFFF" : "var(--color-ui-border)"}`,
      }}
    >
      <span className="text-[13px]">{preset.label}</span>
      <span className="text-[11px] text-ui-muted">{preset.sub}</span>
    </button>
  );
}
