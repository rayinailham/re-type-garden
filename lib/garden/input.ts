// Peta input type mode. Port 1:1 dari key() & inputDiff() di original-source.txt,
// dipisah jadi fungsi murni (tanpa DOM) supaya bisa diuji di node.

/** Sentinel yang disimpan di field tersembunyi agar Backspace pada field kosong tetap terlapor. */
export const SENT = "​";

/** Subset KeyboardEvent yang dibaca keyAction. */
export type KeyLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  /** tagName target event (mis. "BUTTON"). */
  targetTag?: string;
};

/** Hasil pemetaan satu keydown. prevent = panggil preventDefault. */
export type KeyAction =
  | { kind: "none"; prevent: false }
  | { kind: "save"; svg: boolean; prevent: true }
  | { kind: "backspace"; prevent: true }
  | { kind: "clear"; prevent: true }
  | { kind: "char"; ch: string; prevent: true };

const NONE: KeyAction = { kind: "none", prevent: false };

/** Petakan keydown → aksi. Urutan cek identik dengan source. */
export function keyAction(e: KeyLike): KeyAction {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")
      return { kind: "save", svg: e.shiftKey, prevent: true };
    return NONE;
  }
  // Enter/Space pada tombol = aktivasi tombol, bukan clear/cut taman.
  if (e.targetTag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return NONE;
  if (e.key === "Backspace") return { kind: "backspace", prevent: true };
  if (e.key === "Enter") return { kind: "clear", prevent: true };
  if (e.key.length !== 1) return NONE;
  return { kind: "char", ch: e.key, prevent: true };
}

/**
 * Diff field tersembunyi (keyboard HP/IME): bandingkan mirror `old` dengan nilai `cur`.
 * dels = jumlah huruf yang dihapus (wither), adds = karakter baru (termasuk "\n" = clear).
 * Sentinel bukan huruf: tidak dihitung hapus maupun tambah.
 */
export function diffInput(
  old: string | null,
  cur: string,
): { dels: number; adds: string[] } {
  const o = old == null ? SENT : old;
  let p = 0;
  while (p < o.length && p < cur.length && o[p] === cur[p]) p++;
  let dels = o.length - p;
  if (p === 0 && o[0] === SENT && o.length > 1) dels -= 1;
  const adds: string[] = [];
  for (const ch of cur.slice(p)) if (ch !== SENT) adds.push(ch);
  return { dels, adds };
}
