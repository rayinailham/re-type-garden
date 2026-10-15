"use client";

import type { ReactNode } from "react";

/**
 * Bar bawah type mode: hint (fine/coarse lewat @media pointer:coarse di CSS) + "N gardeners here"
 * + kontrol (palet, PNG/SVG) sebagai children. opacity .6, warna = teks palet.
 */
export function HintBar({
  textColor,
  opacity = 0.6,
  count,
  children,
}: {
  textColor: string;
  /** default .6 (source); dinaikkan per-palet agar kontras ≥ 4.5:1. */
  opacity?: number;
  /** Jumlah tukang kebun (termasuk diri sendiri). Kosong bila ≤ 1. */
  count: number;
  children: ReactNode;
}) {
  return (
    <div
      data-tg="bar"
      className="absolute z-[5] flex flex-wrap items-center justify-between gap-4 text-[12px] tracking-[0.04em]"
      style={{ color: textColor, opacity }}
    >
      <div data-tg="hints" className="flex flex-wrap gap-5">
        <span data-tg="fine">type to grow</span>
        <span data-tg="coarse">tap to type</span>
        <span>space cuts</span>
        <span data-tg="fine">backspace withers</span>
        <span data-tg="coarse">⌫ withers</span>
        <span data-tg="fine">enter clears</span>
        <span data-tg="coarse">return clears</span>
        <span data-tg="count">{count > 1 ? `${count} gardeners here` : ""}</span>
      </div>
      <div data-tg="ctrls" className="flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}
