"use client";

/**
 * Kredit milik sendiri (pengganti Copy code / Buy me a coffee author, D3/D8):
 * brand RE: Type Garden + pernyataan jujur "reverse-engineered by" + "inspired by" author asli.
 */
export function CreditBar({ textColor, opacity = 0.7 }: { textColor: string; opacity?: number }) {
  return (
    <div data-tg="credit" className="pointer-events-none absolute z-[6] flex flex-col gap-1">
      <div
        className="w-fit rounded-pill px-[14px] py-[7px] text-[12px] tracking-[0.04em]"
        style={{ border: "1px solid var(--color-ui-border)", color: textColor }}
      >
        RE: Type Garden
      </div>
      <div className="text-[11px] tracking-[0.04em]" style={{ color: textColor, opacity }}>
        reverse-engineered by Rayina Ilham ·{" "}
        <a
          href="https://x.com/art_akshat"
          target="_blank"
          rel="noreferrer noopener"
          className="pointer-events-auto underline underline-offset-2"
          style={{ color: "inherit" }}
        >
          inspired by Type Garden by Akshat Agarwal
        </a>
      </div>
    </div>
  );
}
