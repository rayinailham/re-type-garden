// ORACLE PARITY (alat uji internal, TIDAK dipublikasi) — Fase 4.
// Harness = class Component dari artifacts/doc/evidence/original-source.txt, dieksekusi apa adanya
// dengan stub DCLogic/React minimal. GT Ultra tidak ada → fallback ke Playfair Display (font yang sama
// dengan rebuild). Untuk (text, seed, preset, palette, t) render frame poster asli vs rebuild lalu
// bandingkan piksel (YIQ seperti pixelmatch, threshold 0.1, tanpa pengecualian anti-alias).
//   node tests/parity/poster-parity.mjs            (butuh npm run build)
import http from "node:http";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startServer, ROOT } from "../e2e/lib.mjs";

const OUT = path.join(ROOT, "tests/parity/out");
mkdirSync(OUT, { recursive: true });
const THRESHOLD = Number(process.env.PARITY_MAX_PCT || 1); // % piksel berbeda
// PARITY_SAVE=1 → simpan pasangan orig/rebuild semua frame (galeri showcase)

// --- harness dari source asli ---
const src = readFileSync(path.join(ROOT, "artifacts/doc/evidence/original-source.txt"), "utf8");
const m = src.match(/<script type="text\/x-dc"[^>]*>\n([\s\S]*?)\n<\/script>/);
if (!m) throw new Error("class Component tidak ditemukan di original-source.txt");
const woff = path.join(ROOT, ".next/static/media");
// subset latin Playfair (unicode-range u+00??) = berkas yang dimuat rebuild untuk ASCII
const css = readFileSync(path.join(ROOT, ".next/static/css", readdirSync(path.join(ROOT, ".next/static/css"))[0]), "utf8");
const latin = css.match(/font-family:Playfair Display;[^}]*src:url\(\/_next\/static\/media\/([^)]+)\)[^}]*unicode-range:u\+00\?\?/);
if (!latin) throw new Error("woff2 latin Playfair tidak ditemukan di CSS build");

const harness = `<!doctype html><meta charset="utf-8"><title>oracle</title>
<style>@font-face{font-family:"Playfair Display";font-weight:700;src:url(/playfair.woff2) format("woff2")}</style>
<script>
class DCLogic { constructor(){ this.props={boil:false,recoil:20,density:1}; this.state={}; }
  setState(p,cb){ Object.assign(this.state,p); if(cb) cb(); } forceUpdate(){} }
const React = { createRef: () => ({ current: null }) };
</script>
<script>${m[1]}</script>
<script>
window.__ready = (async () => {
  await document.fonts.load('700 100px "Playfair Display"');
  const cvT = document.createElement('canvas'), cvP = document.createElement('canvas');
  cvT.width = cvT.height = 100; cvP.width = cvP.height = 1080;
  const c = new Component();
  c.cv.current = cvT; c.pcv.current = cvP;
  c.frame = () => {};
  c.componentDidMount();
  window.__draw = o => {
    c.props = { boil: !!o.boil, recoil: 20, density: 1 };
    c.state = Object.assign({}, c.state, { text: o.text, seed: o.seed, preset: o.preset, palette: o.palette });
    c.cache = {};
    c.buildPoster();
    c.posterDraw(cvP.getContext('2d'), o.t);
    return cvP.toDataURL('image/png');
  };
})();
</script>`;

const server = http
  .createServer((req, res) => {
    if (req.url === "/harness.html") res.writeHead(200, { "content-type": "text/html" }).end(harness);
    else if (req.url === "/playfair.woff2") res.writeHead(200, { "content-type": "font/woff2" }).end(readFileSync(path.join(woff, latin[1])));
    else res.writeHead(404).end();
  })
  .listen(0);
const hport = server.address().port;

const srv = await startServer(3197);
const browser = await chromium.launch();
const results = [];
const bite = [];
try {
  const po = await (await browser.newContext()).newPage();
  await po.goto(`http://localhost:${hport}/harness.html`);
  await po.evaluate(() => window.__ready);

  const pr = await (await browser.newContext()).newPage();
  await pr.goto(srv.url + "/?tgtest&tglocal");
  await pr.waitForFunction(() => window.__tgPoster);

  const cmp = await (await browser.newContext()).newPage();
  await cmp.goto("about:blank");
  await cmp.addScriptTag({
    content: `window.__cmp = async (a, b) => {
      const load = u => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
      const px = async u => { const i = await load(u), c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const A = await px(a), B = await px(b), n = A.width * A.height, max = 35215 * 0.1 * 0.1;
      const out = new ImageData(A.width, A.height); let diff = 0;
      const blend = (c, al) => 255 + (c - 255) * al;
      for (let k = 0; k < n; k++) {
        const o = k * 4, aa = A.data[o+3] / 255, ab = B.data[o+3] / 255;
        const r1 = blend(A.data[o], aa), g1 = blend(A.data[o+1], aa), b1 = blend(A.data[o+2], aa);
        const r2 = blend(B.data[o], ab), g2 = blend(B.data[o+1], ab), b2 = blend(B.data[o+2], ab);
        const y = (r1-r2)*0.29889531 + (g1-g2)*0.58662247 + (b1-b2)*0.11448223;
        const i = (r1-r2)*0.59597799 - (g1-g2)*0.2741761 - (b1-b2)*0.32180189;
        const q = (r1-r2)*0.21147017 - (g1-g2)*0.52261711 + (b1-b2)*0.31114694;
        const d = 0.5053*y*y + 0.299*i*i + 0.1957*q*q;
        if (d > max) { diff++; out.data[o]=255; out.data[o+1]=0; out.data[o+2]=0; out.data[o+3]=255; }
        else { const v = 255 - (255 - A.data[o]) * 0.15; out.data[o]=v; out.data[o+1]=v; out.data[o+2]=v; out.data[o+3]=255; }
      }
      const c = document.createElement('canvas'); c.width = A.width; c.height = A.height; c.getContext('2d').putImageData(out, 0, 0);
      return { pct: diff / n * 100, diff, png: c.toDataURL('image/png') };
    };`,
  });

  const T = { breathe: 3000, grow: 6000, typed: 5000, wind: 4000, reach: 6000, scatter: 6000, visit: 7000 };
  const cases = [];
  for (const preset of Object.keys(T))
    for (const f of [0.25, 0.5, 0.9]) {
      cases.push({ tag: "base", text: "in bloom", seed: 7, preset, palette: 0, t: T[preset] * f, f });
      cases.push({ tag: "alt", text: "type garden wind", seed: 4242, preset, palette: 1, t: T[preset] * f, f });
    }
  for (const preset of Object.keys(T))
    cases.push({ tag: "boil", text: "in bloom", seed: 7, preset, palette: 0, t: T[preset] * 0.5, f: 0.5, boil: true });

  for (const o of cases) {
    const a = await po.evaluate((x) => window.__draw(x), o);
    const b = await pr.evaluate((x) => window.__tgPoster(x), o);
    if (!a?.startsWith("data:image/png") || !b?.startsWith("data:image/png"))
      throw new Error(`frame kosong: orig=${String(a).slice(0, 40)} rebuild=${String(b).slice(0, 40)}`);
    const r = await cmp.evaluate(([x, y]) => window.__cmp(x, y), [a, b]);
    const name = `${o.tag}-${o.preset}-${Math.round(o.f * 100)}`;
    results.push({ name, pct: r.pct, diff: r.diff });
    if (r.pct > 0) writeFileSync(path.join(OUT, name + "-diff.png"), Buffer.from(r.png.split(",")[1], "base64"));
    if (r.pct > THRESHOLD || process.env.PARITY_SAVE) {
      writeFileSync(path.join(OUT, name + "-orig.png"), Buffer.from(a.split(",")[1], "base64"));
      writeFileSync(path.join(OUT, name + "-rebuild.png"), Buffer.from(b.split(",")[1], "base64"));
    }
  }

  // --- uji gigit: oracle harus bisa GAGAL, dan frame tidak boleh kosong ---
  const base = { text: "in bloom", seed: 7, preset: "grow", palette: 0, t: 3000 };
  const good = await po.evaluate((x) => window.__draw(x), base);
  const other = await pr.evaluate((x) => window.__tgPoster(x), { ...base, seed: 8 });
  const blank = await cmp.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 1080;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1080, 1080);
    return c.toDataURL("image/png");
  });
  const seedDiff = await cmp.evaluate(([x, y]) => window.__cmp(x, y), [good, other]);
  const vsBlank = await cmp.evaluate(([x, y]) => window.__cmp(x, y), [good, blank]);
  bite.push({ name: "bite: seed berbeda terdeteksi", ok: seedDiff.pct > THRESHOLD, pct: seedDiff.pct });
  bite.push({ name: "bite: frame bukan kosong", ok: vsBlank.pct > 1, pct: vsBlank.pct });
  writeFileSync(path.join(OUT, "sample-orig-grow-50.png"), Buffer.from(good.split(",")[1], "base64"));
} finally {
  await browser.close();
  await srv.stop();
  server.close();
}

let bad = 0;
for (const r of results) {
  const ok = r.pct <= THRESHOLD;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.name.padEnd(22)} ${r.pct.toFixed(4)}%  (${r.diff} px)`);
}
for (const t of bite) {
  if (!t.ok) bad++;
  console.log(`${t.ok ? "PASS" : "FAIL"}  ${t.name.padEnd(32)} ${t.pct.toFixed(2)}%`);
}
const worst = results.reduce((a, b) => (b.pct > a.pct ? b : a));
console.log(`\n${results.length} frame, ambang ${THRESHOLD}% · terburuk ${worst.name} ${worst.pct.toFixed(4)}% · ${bad} gagal`);
process.exitCode = bad ? 1 : 0;
