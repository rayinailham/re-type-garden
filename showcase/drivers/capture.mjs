// Take showcase via CDP screencast (fallback: wf-recorder user-space rusak vs ffmpeg 9).
// Chromium headless, tanpa jendela/desktop. Skrip aksi identik untuk situs asli & rebuild.
//   node capture.mjs <url> <type|poster> <out-dir>   → out-dir/NNNN.jpg @30fps CFR + info.json
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
const require = createRequire("/home/rayin/Projects/RE:type-garden/package.json");
const { chromium } = require("playwright");

const [url, scenario, out] = process.argv.slice(2);
const FPS = 30, W = 1080, H = 540, DSF = 2;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--hide-scrollbars", "--disable-features=Translate"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await wait(1500);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async (f) => {
  frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DSF, maxHeight: H * DSF });
await wait(800);
const t0 = Date.now();
const type = async (s) => page.keyboard.type(s, { delay: 140 });

if (scenario === "type") {
  await page.locator("textarea, input").first().focus();
  await type("in bloom");
  await wait(2600);
  await page.keyboard.press("Space");
  await wait(1200);
  await type("garden");
  await wait(2200);
  for (let i = 0; i < 3; i++) { await page.keyboard.press("Backspace"); await wait(260); }
  await wait(900);
  await type("den");
  await wait(2500);
} else {
  await page.getByRole("button", { name: "Poster" }).click();
  await wait(3500);
  await page.getByRole("button", { name: /Grow & wither/ }).click();
  await wait(4500);
  await page.getByRole("button", { name: /Visitor/ }).click();
  await wait(3500);
  await page.getByRole("button", { name: "Midnight" }).last().click();
  await wait(3500);
}
const t1 = Date.now();
await cdp.send("Page.stopScreencast");
await browser.close();

// screencast hanya kirim frame saat berubah → sampel CFR: frame terakhir ≤ t
if (!frames.length) throw new Error("screencast kosong");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const start = t0 - 800, n = Math.round(((t1 - start) / 1000) * FPS);
let k = 0;
for (let i = 0; i < n; i++) {
  const t = start + (i * 1000) / FPS;
  while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
  writeFileSync(`${out}/${String(i + 1).padStart(4, "0")}.jpg`, Buffer.from(frames[k].data, "base64"));
}
const info = { url, scenario, fps: FPS, n, size: [W, H], dsf: DSF, unique_frames: frames.length, mark_s: 0.8 };
writeFileSync(`${out}/info.json`, JSON.stringify(info, null, 2));
console.log(JSON.stringify(info));
