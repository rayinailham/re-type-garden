"use client";

export type Mode = "type" | "poster";

const LABEL: Record<Mode, string> = { type: "Type", poster: "Poster" };

/** Pill segmented kanan-atas: aktif bg putih/teks hitam, non-aktif transparan/#BDBDBD. */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      data-tg="modes"
      role="group"
      aria-label="Mode"
      className="absolute z-[5] flex gap-1 rounded-pill border border-ui-border bg-black p-1"
    >
      {(["type", "poster"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(m)}
            className="cursor-pointer rounded-pill border-0 px-[14px] py-[7px] text-[12px] tracking-[0.04em] transition-colors duration-150"
            style={{
              background: active ? "var(--color-ui-white)" : "transparent",
              color: active ? "#000000" : "var(--color-ui-btn-fg)",
            }}
          >
            {LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
