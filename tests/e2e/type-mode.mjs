// E2E Fase 2: type mode hidup. Jalankan: npm run test:e2e:type  (butuh npm run build)
import { startServer, engines, check, finish, watch, wait, OUT } from "./lib.mjs";
import { devices } from "playwright";
import path from "node:path";

const eng = process.env.E2E_ENGINE || "chromium";
const srv = await startServer();
const browser = await engines[eng].launch();
const errors = [];
const st = (page) => page.evaluate(() => {
  const g = window.__tg;
  const live = g.state.live;
  return {
    letters: live.length,
    text: g.liveText(),
    stems: live.reduce((n, l) => n + l.els.filter((e) => e.t === "stem").length, 0),
    flies: g.fauna.flies.filter((f) => f.st !== "leave").length,
    gifts: g.fauna.gifts.length,
    reduced: g.reduced,
    boil: g.mainState().boil,
    calm: g.mainState().calm,
  };
});

try {
  // ---- desktop ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(srv.url + "/?tgtest&tglocal");
    await page.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
    await page.keyboard.type("type garden", { delay: 45 });
    await wait(4000);
    let s = await st(page);
    check("ketik 'type garden' → 11 huruf", s.letters === 11, JSON.stringify({ letters: s.letters, text: s.text }));
    check("stroke > 0", s.stems > 0, "stems=" + s.stems);
    await page.screenshot({ path: path.join(OUT, `type-${eng}-grown.png`) });

    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await wait(450);
    s = await st(page);
    check("backspace 2× → 9 huruf", s.letters === 9 && s.text === "type gard", JSON.stringify({ letters: s.letters, text: s.text }));
    await page.screenshot({ path: path.join(OUT, `type-${eng}-backspaced.png`) });

    await wait(350);
    check("aria-live membacakan kata berjalan (A2)", (await page.locator('[role="status"]').textContent()) === "type gard");

    // pointer: butterfly (klik canvas) + rose gift (double-click)
    await page.mouse.click(400, 300);
    s = await st(page);
    check("klik canvas → kupu-kupu", s.flies === 1, "flies=" + s.flies);
    for (let i = 0; i < 8; i++) await page.mouse.click(300 + i * 90, 250, { delay: 5 }), await wait(450);
    s = await st(page);
    check("kupu-kupu aktif ≤ 6 (+yang sedang pergi diabaikan)", s.flies <= 7, "flies=" + s.flies);
    await page.mouse.dblclick(700, 650);
    await wait(50);
    s = await st(page);
    check("double-tap → rose gift lokal", s.gifts === 1, "gifts=" + s.gifts);
    await page.mouse.dblclick(702, 652);
    await wait(50);
    s = await st(page);
    check("cooldown gift 1800ms (tap kedua cepat tak menanam)", s.gifts === 1, "gifts=" + s.gifts);

    await page.keyboard.press("Enter");
    await wait(50);
    s = await st(page);
    check("enter → kosong", s.letters === 0 && s.text === "", JSON.stringify(s));
    await ctx.close();
  }

  // ---- mobile (iPhone emulation): field tersembunyi → inputDiff ----
  {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(srv.url + "/?tgtest&tglocal");
    await page.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
    const inp = page.locator('[data-tg="input"]');
    await inp.fill("​hi");
    let s = await st(page);
    check("mobile fill('hi') → inputDiff menambah 2 huruf", s.letters === 2 && s.text === "hi", JSON.stringify({ l: s.letters, t: s.text }));
    check("field di-reset ke sentinel", (await inp.inputValue()) === "​");
    await inp.fill("");
    s = await st(page);
    check("backspace di field kosong → wither", (await page.evaluate(() => window.__tg.state.live.length)) === 1, "live=" + (await page.evaluate(() => window.__tg.state.live.length)));
    await page.evaluate(() => { const f = document.querySelector('[data-tg="input"]'); f.focus(); });
    await page.keyboard.insertText("ok");
    s = await st(page);
    check("insertText (IME-style) → huruf bertambah", s.text === "hok", s.text);
    await ctx.close();
  }

  // ---- reduced motion (A1) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    watch(page, errors);
    await page.goto(srv.url + "/?tgtest&tglocal");
    await page.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
    await page.keyboard.type("calm");
    await page.mouse.click(300, 300);
    const s = await st(page);
    check("reduced motion: boil off, spring→eo, butterfly off", s.reduced && !s.boil && s.calm && s.flies === 0, JSON.stringify(s));
    await ctx.close();
  }

  check("0 error console/pageerror/4xx", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await srv.stop();
  finish();
}
