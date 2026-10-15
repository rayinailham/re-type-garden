// Export poster: video (MediaRecorder) + PNG frames (zip STORE). Dipisah dari export.ts agar
// bundle awal type mode tidak membawa poster/zip (dimuat lazy bersama PosterView).

import { posterDraw, type DrawOpts, type Poster } from "./poster";
import { zip } from "./export-zip";
import { MOTION } from "./palettes";
import { download } from "./export";

// ---------- poster: video + PNG frames ----------

const { fps: FPS, size: SIZE, bitrate: BITRATE } = MOTION.export;

/** Kandidat MIME video (urutan prioritas: mp4/avc1 → webm/vp9). */
const VIDEO_MIMES = [
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
];

/** MIME video yang didukung MediaRecorder browser ini, atau null. */
export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return VIDEO_MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || null;
}

/** Nama dasar berkas: garden-<slug>-<preset>. */
export function fileBase(text: string, preset: string): string {
  return (
    "garden-" +
    (text || "loop")
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 24) +
    "-" +
    preset
  );
}

/** Jumlah frame loop: round(T/1000 × 30). */
export const frameCount = (T: number): number => Math.round((T / 1000) * FPS);

export type ExportCtx = {
  poster: Poster;
  draw: DrawOpts;
  text: string;
  preset: string;
  onStatus: (s: string) => void;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function offscreen(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2D tidak tersedia");
  return { c, g };
}

/**
 * Rekam loop poster jadi video (MediaRecorder, 1080², 30fps, 14 Mbps).
 * Deviasi dari source (captureStream(0)+requestFrame), terukur di Firefox untuk 90 frame:
 *   captureStream(0)+requestFrame → 3 paket · captureStream(30) → 51 · captureStream(60) → 90.
 * Digambar tiap 1/30 detik (real-time), disampel 2× lebih cepat agar tak ada frame terlewat.
 */
export async function exportVideo(x: ExportCtx, mime: string): Promise<void> {
  const { c, g } = offscreen();
  const stream = c.captureStream(FPS * 2);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: BITRATE }),
    chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => {
    rec.onstop = () => r();
  });
  x.onStatus("Recording…");
  posterDraw(g, x.poster, 0, x.draw);
  rec.start();
  const N = frameCount(x.poster.T),
    t0 = performance.now();
  for (let i = 0; i < N; i++) {
    posterDraw(g, x.poster, (i * 1000) / FPS, x.draw);
    if (i % 15 === 0) x.onStatus(`Recording ${Math.round((i / N) * 100)}%`);
    const target = t0 + ((i + 1) * 1000) / FPS;
    await wait(Math.max(0, target - performance.now()));
  }
  rec.stop();
  await done;
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type: mime.split(";")[0] }), `${fileBase(x.text, x.preset)}.${ext}`);
  x.onStatus(`Saved ${ext.toUpperCase()} · ${N} frames`);
}

/** Render semua frame loop ke PNG → zip STORE (garden-<slug>-<preset>-frames.zip). */
export async function exportFrames(x: ExportCtx): Promise<void> {
  const { c, g } = offscreen(),
    N = frameCount(x.poster.T),
    files: { name: string; data: Uint8Array }[] = [];
  x.onStatus("Rendering frames…");
  for (let i = 0; i < N; i++) {
    posterDraw(g, x.poster, (i * 1000) / FPS, x.draw);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!b) throw new Error("toBlob gagal pada frame " + (i + 1));
    files.push({
      name: `frame_${String(i + 1).padStart(4, "0")}.png`,
      data: new Uint8Array(await b.arrayBuffer()),
    });
    if (i % 10 === 0) x.onStatus(`Rendering ${Math.round((i / N) * 100)}%`);
  }
  const bytes = zip(files);
  download(
    new Blob([bytes as BlobPart], { type: "application/zip" }),
    `${fileBase(x.text, x.preset)}-frames.zip`,
  );
  x.onStatus(`Saved ${N} PNG frames · ${FPS} fps`);
}
