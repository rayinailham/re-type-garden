"use client";

const cls =
  "cursor-pointer rounded-pill border border-ui-border-strong bg-transparent px-[14px] py-2 text-[#BDBDBD] transition-colors duration-150 hover:border-white hover:text-white";

/** Ghost pill PNG / SVG (juga Ctrl/Cmd+S dan +Shift). */
export function ExportButtons({ onSave }: { onSave: (kind: "png" | "svg") => void }) {
  return (
    <>
      <button type="button" data-tg="btn" className={cls} onClick={() => onSave("png")}>
        PNG
      </button>
      <button type="button" data-tg="btn" className={cls} onClick={() => onSave("svg")}>
        SVG
      </button>
    </>
  );
}
