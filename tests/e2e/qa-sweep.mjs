// QA sweep (skill qa-sweep): scenario × viewport × engine. Cek: console error, pageerror, HTTP ≥ 400,
// halaman lambat, overflow horizontal, kontrol keluar viewport, elemen interaktif tumpang tindih,
// teks bocor (undefined/NaN/[object Object]), gambar rusak, tombol/link mati, screenshot.
//   ENGINES=chromium,firefox,webkit  SCENARIOS=type,typed,poster  node tests/e2e/qa-sweep.mjs
import { startServer, engines, check, finish, watch, wait, OUT } from "./lib.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const ENG = (process.env.ENGINES || "chromium").split(",");
const SCN = (process.env.SCENARIOS || "type,typed,poster").split(",");
const dir = path.join(OUT, "qa");
mkdirSync(dir, { recursive: true });

const probe = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest('[aria-hidden="true"]');
  };
  const ctl = [...document.querySelectorAll("button, a[href], input:not([data-tg=input])")].filter(vis);
  const label = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 24);
  const rects = ctl.map((el) => ({ l: label(el), r: el.getBoundingClientRect() }));
  const out = rects.filter(({ r }) => r.left < -0.5 || r.right > vw + 0.5).map(({ l }) => l);
  // panel poster boleh scroll vertikal (overflow-y:auto, sama dengan source) → Y diabaikan untuk isinya
  const inScroll = (el) => !!el.closest('[data-tg="panel"]');
  const below = ctl
    .filter((el) => !inScroll(el))
    .map((el) => ({ l: label(el), r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.top < -0.5 || r.bottom > vh + 0.5)
    .map(({ l }) => l);
  // elemen yang tertutup elemen lain di titik tengahnya (klik akan "dicegat")
  const blocked = ctl
    .filter((el) => {
      // elemen inline yang membungkus ke beberapa baris: uji titik tengah kotak pertamanya
      const r = el.getClientRects()[0] || el.getBoundingClientRect();
      if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) return false;
      if (inScroll(el) && (r.top < 0 || r.bottom > vh)) return false;
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && t !== el && !el.contains(t) && !t.contains(el);
    })
    .map(label);
  const overlap = [];
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, b = rects[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) overlap.push(rects[i].l + " × " + rects[j].l);
    }
  const txt = document.body.innerText;
  const leak = (txt.match(/\bundefined\b|\bNaN\b|\[object Object\]|\bError:/g) || []).slice(0, 3);
  return {
    overflowX: document.documentElement.scrollWidth > vw || document.body.scrollWidth > vw,
    outsideX: out, outsideY: below, overlap, leak, blocked,
    brokenImg: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    deadLinks: [...document.querySelectorAll("a")].filter((a) => !a.getAttribute("href") || a.getAttribute("href") === "#").length,
  };
};

const srv = await startServer();
const results = [];
try {
  for (const en of ENG) {
    const browser = await engines[en].launch();
    for (const [vn, vp] of Object.entries(VIEWPORTS)) {
      for (const sc of SCN) {
        const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile && en !== "firefox", hasTouch: vp.hasTouch && en !== "firefox", deviceScaleFactor: vp.deviceScaleFactor || 1 });
        const page = await ctx.newPage();
        const errs = [];
        watch(page, errs);
        const t0 = Date.now();
        await page.goto(srv.url + "/?tglocal", { waitUntil: "networkidle" });
        const loadMs = Date.now() - t0;
        await wait(300);
        if (sc === "typed") {
          await page.locator('[data-tg="app"]').click({ position: { x: 5, y: vp.height / 2 } }).catch(() => {});
          await page.keyboard.type("in bloom", { delay: 30 });
          await wait(1800);
        }
        if (sc === "poster") {
          await page.getByRole("button", { name: "Poster", exact: true }).click();
          await wait(600);
        }
        const p = await page.evaluate(probe);
        // poster mobile/tablet: panel boleh scroll vertikal (≤720px) → Y diabaikan di sana
        const yCheck = !(sc === "poster" && vp.width <= 720);
        const issues = [];
        if (loadMs > 3000) issues.push("lambat " + loadMs + "ms");
        if (p.overflowX) issues.push("overflow horizontal");
        if (p.outsideX.length) issues.push("kontrol keluar viewport (X): " + p.outsideX.join(","));
        if (yCheck && p.outsideY.length) issues.push("kontrol keluar viewport (Y): " + p.outsideY.join(","));
        if (p.blocked.length) issues.push("tertutup elemen lain: " + p.blocked.join(","));
        if (p.overlap.length) issues.push("tumpang tindih: " + p.overlap.slice(0, 4).join(" | "));
        if (p.leak.length) issues.push("teks bocor: " + p.leak.join(","));
        if (p.brokenImg) issues.push("gambar rusak: " + p.brokenImg);
        if (p.deadLinks) issues.push("link mati: " + p.deadLinks);
        for (const e of errs) issues.push(e);
        const shot = `${en}_${vn}_${sc}.png`;
        await page.screenshot({ path: path.join(dir, shot) });
        const key = `${en} · ${vn} ${vp.width}px · ${sc}`;
        check(key, issues.length === 0, issues.join(" ; ") || `load ${loadMs}ms`);
        results.push({ key, engine: en, viewport: vn, scenario: sc, loadMs, issues, probe: p, shot });
        await ctx.close();
      }
    }
    await browser.close();
  }
} finally {
  writeFileSync(path.join(dir, "results.json"), JSON.stringify(results, null, 1));
  await srv.stop();
  finish();
}
