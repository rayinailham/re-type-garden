// Helper e2e: server `next start` (butuh `npm run build`), runner assertion sederhana, artefak ke tests/e2e/out.
// Path project mengandung ":" → shim .bin rusak; panggil next lewat node langsung.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT = path.join(ROOT, "tests/e2e/out");
mkdirSync(OUT, { recursive: true });
export const engines = { chromium, firefox, webkit };

/** Jalankan server produksi. Kembalikan {url, stop}. E2E_URL memakai server yang sudah hidup. */
export async function startServer(port = 3199) {
  if (process.env.E2E_URL) return { url: process.env.E2E_URL, stop: async () => {} };
  const next = path.join(ROOT, "node_modules/next/dist/bin/next");
  const p = spawn(process.execPath, [next, "start", "-p", String(port)], { cwd: ROOT, stdio: "ignore" });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return { url, stop: async () => void p.kill() };
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  p.kill();
  throw new Error("server tidak siap");
}

let failed = 0;
export function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failed++;
}
export function finish() {
  console.log(failed ? `\n${failed} GAGAL` : "\nsemua lulus");
  process.exitCode = failed ? 1 : 0;
}

// Allowlist EKSPLISIT (didokumentasikan di laporan): WebKit mencatat pesan ini sebagai console.error
// untuk meta viewport `interactive-widget` (didukung Chromium; WebKit mengabaikannya, syncVV menutupi).
const KNOWN = [/Viewport argument key "interactive-widget" not recognized and ignored/];

/** Kumpulkan error console/pageerror/4xx-5xx. */
export function watch(page, sink) {
  page.on("pageerror", (e) => sink.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error" || KNOWN.some((r) => r.test(m.text()))) return;
    sink.push("console.error: " + m.text());
  });
  page.on("response", (r) => r.status() >= 400 && sink.push(`HTTP ${r.status()} ${r.url()}`));
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
