// Pembangun taman deterministik untuk hook uji (?tgtest) & snapshot.
// Mengikuti pola buildPoster() source: this.rand = rng(seed*7919+1) → bentuk reproducible
// untuk kata + seed tetap. Dipakai halaman uji statis dan window.__tg.

import type { Letter } from "./types";
import { rng } from "./math";
import { gen, type GenCtx } from "./growth";
import { layoutCore, makeMeasure, type Measure } from "./layout";

/** Snapshot ringkas satu huruf (buat perbandingan oracle / assert). */
export type LetterSnapshot = {
  ch: string;
  id: number;
  ws: number;
  wi: number;
  total: number;
  stem: number;
  leaf: number;
  rose: number;
  tend: number;
};

/** Hasil build taman deterministik. */
export type TestGarden = {
  text: string;
  seed: number;
  letters: Letter[];
  S: number;
  wrapped: boolean;
};

/**
 * Bangun taman untuk `text` + `seed` secara deterministik.
 * @param mw pengukur huruf (canvas measureText; stub di test).
 */
export function buildTestGarden(
  text: string,
  seed: number,
  W: number,
  H: number,
  mw: Measure,
  density = 1,
): TestGarden {
  const rand = rng(seed * 7919 + 1);
  const ctx: GenCtx = { rand, density, mw };
  const L: Letter[] = [];
  let prev: Letter | null = null;
  let uid = 1;
  for (const ch of text) {
    if (ch === " ") {
      const sp: Letter = { ch: " ", id: 9000 + uid++, ws: 0, wi: 0, els: [], prev: null };
      L.push(sp);
      prev = sp;
      continue;
    }
    const same = !!prev && prev.ch !== " ";
    const l: Letter = {
      ch,
      id: 9000 + uid++,
      ws: same ? (prev as Letter).ws : Math.floor(rand() * 1e9),
      wi: same ? (prev as Letter).wi + 1 : 0,
      prev: same ? prev : null,
      els: [],
    };
    gen(l, ctx);
    L.push(l);
    prev = l;
  }
  const res = layoutCore(L, W, H, false, mw);
  L.forEach((l) => {
    l.x = l.tx;
    l.y = l.ty;
    l.birth = 0;
    l.tb = 0;
  });
  return { text, seed, letters: L, S: res.S, wrapped: res.wrapped };
}

/** Snapshot elemen gen() per huruf — padanan hook window.__tg di source (?tgtest). */
export function snapshot(g: TestGarden): LetterSnapshot[] {
  return g.letters
    .filter((l) => l.ch !== " ")
    .map((l) => ({
      ch: l.ch,
      id: l.id,
      ws: l.ws,
      wi: l.wi,
      total: l.els.length,
      stem: l.els.filter((e) => e.t === "stem").length,
      leaf: l.els.filter((e) => e.t === "leaf").length,
      rose: l.els.filter((e) => e.t === "rose").length,
      tend: l.tend?.length ?? 0,
    }));
}

/** Buat pengukur dari context 2D (helper untuk halaman uji). */
export function measureFromCtx(
  g: Pick<CanvasRenderingContext2D, "font" | "measureText">,
): Measure {
  return makeMeasure(g, {});
}
