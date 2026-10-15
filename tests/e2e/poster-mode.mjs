// E2E Fase 4: alur poster di UI (teks dibawa dari type, preset, palet, regrow, kembali ke type).
import { startServer, engines, check, finish, watch, wait } from "./lib.mjs";

const eng = process.env.E2E_ENGINE || "chromium";
const srv = await startServer();
const browser = await engines[eng].launch();
const errors = [];
const ink = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-tg="pcanvas"]'), g = c.getContext("2d");
    const d = g.getImageData(0, 0, 1080, 1080).data, bg = [d[0], d[1], d[2]];
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) if (d[i] !== bg[0] || d[i + 1] !== bg[1] || d[i + 2] !== bg[2]) n++;
    return { n, bg: bg.join(",") };
  });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  watch(page, errors);
  await page.goto(srv.url + "/?tgtest&tglocal");
  await page.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
  await page.keyboard.type("hello", { delay: 30 });
  await wait(300);
  await page.getByRole("button", { name: "Poster", exact: true }).click();
  await wait(400);
  check("masuk poster membawa teks hidup", (await page.getByLabel("Words").inputValue()) === "hello");
  check("info label Breathe: 1:1 · 3s loop · 30 fps", await page.getByText("1:1 · 3s loop · 30 fps").isVisible());
  let s = await ink(page);
  check("kanvas poster berisi gambar", s.n > 500, JSON.stringify(s));

  await page.getByRole("button", { name: /^Grow & wither/ }).click();
  await wait(200);
  check("preset Grow: 6s loop + aria-pressed", (await page.getByText("1:1 · 6s loop · 30 fps").isVisible()) &&
    (await page.getByRole("button", { name: /^Grow & wither/ }).getAttribute("aria-pressed")) === "true");

  await page.getByRole("button", { name: "Paper", exact: true }).click();
  await wait(250);
  s = await ink(page);
  check("palet Paper → latar #F3EEE4", s.bg === "243,238,228", s.bg);

  // teks dikomit saat Enter (bukan per ketukan)
  const words = page.getByLabel("Words");
  await words.fill("garden");
  await words.press("Enter");
  await wait(300);
  check("Enter di Words → teks poster berubah", (await words.inputValue()) === "garden");
  check("Enter di Words TIDAK menghapus taman type mode", (await page.evaluate(() => window.__tg.liveText())) === "hello");

  await page.getByRole("button", { name: "Regrow garden" }).click();
  await wait(200);
  s = await ink(page);
  check("regrow tetap menggambar", s.n > 500, JSON.stringify(s));

  await page.getByRole("button", { name: "Type", exact: true }).click();
  await wait(400);
  check("kembali ke type: huruf tetap ada", (await page.evaluate(() => window.__tg.liveText())) === "hello");
  await page.keyboard.type("!");
  await wait(100);
  check("type mode aktif lagi (ketik berfungsi)", (await page.evaluate(() => window.__tg.liveText())) === "hello!");
  check("0 error console/pageerror/4xx", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await srv.stop();
  finish();
}
