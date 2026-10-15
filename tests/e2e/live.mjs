// E2E Fase 6: dua tab ?tglocal (BroadcastChannel hanya lintas-halaman dalam SATU context) saling lihat
// kursor & gift; hidden tab; roster kedaluwarsa; payload jahat ditolak (S1). Supabase remote tidak disentuh (D6).
import { startServer, engines, check, finish, watch, wait, OUT } from "./lib.mjs";
import path from "node:path";

const eng = process.env.E2E_ENGINE || "chromium";
const srv = await startServer();
const browser = await engines[eng].launch();
const errors = [];
const count = (p) => p.locator('[data-tg="count"]').textContent();
const peerState = (p) =>
  p.evaluate(() => [...document.querySelectorAll(".tg-peer")].map((e) => ({
    op: e.style.opacity, tf: e.style.transform, name: e.querySelector("span")?.textContent, bg: e.querySelector("span")?.style.background,
  })));
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } });
  const A = await ctx.newPage(), B = await ctx.newPage();
  watch(A, errors); watch(B, errors);
  for (const p of [A, B]) {
    await p.goto(srv.url + "/?tgtest&tglocal");
    await p.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
  }
  await A.bringToFront();
  await A.waitForFunction(() => document.querySelector('[data-tg="count"]')?.textContent.includes("2 gardeners here"), null, { timeout: 8000 });
  await B.waitForFunction(() => document.querySelector('[data-tg="count"]')?.textContent.includes("2 gardeners here"), null, { timeout: 8000 });
  check('hint "2 gardeners here" di kedua tab', (await count(A)).includes("2 gardeners here") && (await count(B)).includes("2 gardeners here"));

  // kursor: gerak di A → muncul di B
  await A.keyboard.type("hi", { delay: 30 });
  for (let i = 0; i < 12; i++) { await A.mouse.move(300 + i * 40, 300 + i * 10); await wait(60); }
  await wait(900);
  const peers = await peerState(B);
  check("B melihat kursor peer A (opacity 1, transform)", peers.length === 1 && peers[0].op === "1" && /translate\(/.test(peers[0].tf), JSON.stringify(peers));
  check("label peer = nama bunga, warna tervalidasi", peers.length === 1 && /^[a-z]+$/.test(peers[0].name) && /^rgb\(/.test(peers[0].bg), JSON.stringify(peers));

  // near(): B tanpa pointer sendiri tetap punya target (kursor peer) → huruf/mawar B condong ke peer
  const nearB = await B.evaluate(() => { window.__tg.mx = null; return window.__tg.near(600, 380); });
  check("near() di B memakai kursor peer", Array.isArray(nearB), JSON.stringify(nearB));
  await B.bringToFront();
  await B.keyboard.type("yo", { delay: 30 });
  await wait(600);
  const lean = await B.evaluate(() => window.__tg.state.live.map((l) => l.lean && Math.hypot(l.lean[0], l.lean[1])));
  check("huruf B condong (lean ≠ 0) ke kursor peer", lean.some((v) => v > 0.001), JSON.stringify(lean));

  // gift: double-click di A → muncul di B
  await A.bringToFront();
  await A.mouse.dblclick(800, 600);
  await wait(500);
  const gifts = await B.evaluate(() => window.__tg.fauna.gifts.length);
  check("rose gift dari A tampil di B", gifts === 1, "gifts=" + gifts);
  await B.screenshot({ path: path.join(OUT, `live-${eng}-B.png`) });

  // S1: payload jahat lewat BroadcastChannel ditolak/di-clamp
  await B.evaluate(() => {
    const bc = new BroadcastChannel("tg-live");
    bc.postMessage({ k: "r", payload: { x: NaN, y: 0.5, s: 1 } });
    bc.postMessage({ k: "r", payload: { x: "a", y: 0.5 } });
    bc.postMessage({ k: "r", payload: { x: 9, y: -9, s: 1e12 } }); // valid tapi di-clamp
    bc.postMessage({ k: "p", payload: { i: "evil", x: NaN, y: 1 } });
    bc.postMessage({ k: "p", payload: { i: "evil2", x: 5, y: 5 } });
    bc.postMessage({ k: "hello", id: "evil2", n: "<img src=x onerror=alert(1)>", c: "url(javascript:1)" });
    bc.close();
  });
  await wait(400);
  const g2 = await A.evaluate(() => window.__tg.fauna.gifts.map((g) => [g.x, g.y]));
  check("gift NaN/non-number ditolak; gift valid di-clamp ke 0..1", g2.length === 2 && g2.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1 && Number.isFinite(x)), JSON.stringify(g2));
  const pa = await peerState(A);
  const evil = pa.find((p) => /img/.test(p.name || ""));
  check("nama berbahaya tampil sebagai teks, bukan HTML", !(await A.locator(".tg-peer img").count()) , JSON.stringify(pa.map((p) => p.name)));
  check("warna presence tak valid → putih", !evil || /rgb\(255, 255, 255\)/.test(evil.bg), JSON.stringify(evil));

  // hidden tab: B menggerakkan pointer (tampil di A) lalu hidden → kursor B hilang di A (h:1)
  const real = (ps) => ps.filter((p) => !/img/.test(p.name || ""));
  await B.bringToFront();
  for (let i = 0; i < 12; i++) { await B.mouse.move(200 + i * 30, 500 - i * 10); await wait(60); }
  await wait(900);
  check("A melihat kursor B sebelum hidden", real(await peerState(A)).filter((p) => p.op === "1").length === 1, JSON.stringify(real(await peerState(A))));
  await B.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await wait(500);
  const gone = real(await peerState(A)).filter((p) => p.op === "1").length;
  check("tab B hidden → kursornya hilang di A (h:1)", gone === 0, "visiblePeers=" + gone);

  // roster: tutup B → A kembali sendiri dalam ≤ 5s (expiry 3.5s)
  await B.close();
  await A.waitForFunction(() => document.querySelector('[data-tg="count"]')?.textContent === "", null, { timeout: 7000 });
  check("B ditutup → hint kosong (roster kedaluwarsa)", (await count(A)) === "");
  check("0 error console/pageerror/4xx", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await srv.stop();
  finish();
}
