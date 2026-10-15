// E2E Fase 5: export benar-benar dibuka & diverifikasi (bukan diklaim).
// PNG: signature + dimensi · SVG: xmllint + <path id> huruf · frames: zip utuh + jumlah = round(T/1000·30) · video: ffprobe durasi.
import { startServer, engines, check, finish, watch, wait, OUT } from "./lib.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const eng = process.env.E2E_ENGINE || "chromium";
const srv = await startServer();
const browser = await engines[eng].launch();
const errors = [];
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" });

function pngInfo(file) {
  const b = readFileSync(file);
  const sig = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { sig, w: b.readUInt32BE(16), h: b.readUInt32BE(20), size: b.length };
}
const save = async (page, trigger, name) => {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), trigger()]);
  const file = path.join(OUT, `${eng}-${name}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename() };
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  watch(page, errors);
  await page.goto(srv.url + "/?tgtest&tglocal");
  await page.waitForFunction(() => window.__tg && window.__tg.state.W > 0);
  await page.keyboard.type("type garden", { delay: 40 });
  await wait(3500);

  // ---- PNG: tombol + Ctrl+S ----
  let r = await save(page, () => page.getByRole("button", { name: "PNG", exact: true }).click(), "png-btn");
  let info = pngInfo(r.file);
  check("PNG (tombol) → garden.png valid", r.name === "garden.png" && info.sig && info.w > 0, JSON.stringify(info));
  r = await save(page, () => page.keyboard.press("Control+s"), "png-key");
  check("Ctrl+S → garden.png valid", r.name === "garden.png" && pngInfo(r.file).sig);
  const expectedW = await page.evaluate(() => Math.round(window.__tg.state.W * window.__tg.dpr));
  check("PNG selebar canvas × DPR", pngInfo(r.file).w === expectedW, `png=${pngInfo(r.file).w} canvas=${expectedW}`);

  // ---- SVG: Ctrl+Shift+S & tombol ----
  r = await save(page, () => page.keyboard.press("Control+Shift+S"), "svg");
  check("Ctrl+Shift+S → garden.svg", r.name === "garden.svg");
  let xml = "";
  try { sh("xmllint", ["--noout", r.file]); xml = readFileSync(r.file, "utf8"); check("SVG valid (xmllint)", true); }
  catch (e) { check("SVG valid (xmllint)", false, String(e.stderr || e).slice(0, 200)); xml = readFileSync(r.file, "utf8"); }
  const ids = [...xml.matchAll(/<path id="([^"]+)"/g)].map((m) => m[1]);
  check("huruf sebagai <path id> (10 huruf)", ids.length === 10, `ids=${ids.join(",")}`);
  check("tanpa <text> fallback", !/<text/.test(xml));
  check("tanpa 'GT Ultra' di SVG", !/GT Ultra/i.test(xml));
  const svgPage = await ctx.newPage();
  await svgPage.goto("file://" + r.file);
  await svgPage.screenshot({ path: path.join(OUT, `${eng}-svg-raster.png`) });
  await svgPage.close();

  // ---- Poster: frames + video ----
  await page.getByRole("button", { name: "Poster", exact: true }).click();
  await page.getByRole("button", { name: /^Breathe/ }).click();
  await wait(500);
  const T = 3000, N = Math.round((T / 1000) * 30);
  r = await save(page, () => page.getByRole("button", { name: "PNG frames (.zip)" }).click(), "frames");
  check("nama zip = garden-<slug>-<preset>-frames.zip", /^garden-type-garden-breathe-frames\.zip$/.test(r.name), r.name);
  const py = `import zipfile,sys,struct
z=zipfile.ZipFile(sys.argv[1]); bad=z.testzip(); n=z.namelist()
d=z.read(n[0]); w,h=struct.unpack('>II',d[16:24])
print(bad, len(n), n[0], n[-1], w, h, d[:8]==bytes([137,80,78,71,13,10,26,10]), all(i.compress_type==0 for i in z.infolist()))`;
  const out = sh("python3", ["-I", "-c", py, r.file]).trim().split(" ");
  check("zip utuh (testzip) + STORE", out[0] === "None" && out[7] === "True", out.join(" "));
  check(`zip berisi ${N} frame`, Number(out[1]) === N && out[2] === "frame_0001.png" && out[3] === `frame_${String(N).padStart(4, "0")}.png`, `n=${out[1]} ${out[2]}..${out[3]}`);
  check("frame 1080×1080 PNG valid", out[4] === "1080" && out[5] === "1080" && out[6] === "True");
  check("zip via unzip -t", /No errors detected/.test(sh("unzip", ["-t", r.file])));

  await wait(300);
  const vbtn = page.getByRole("button", { name: /^Export (MP4|WebM) loop$/ });
  const hasVideo = (await vbtn.count()) > 0;
  if (hasVideo) {
    const label = await vbtn.textContent();
    r = await save(page, () => vbtn.click(), "video");
    const probe = JSON.parse(sh("ffprobe", ["-v", "error", "-print_format", "json", "-count_packets", "-show_entries", "format=duration:stream=width,height,codec_name,nb_read_packets", r.file]));
    const s = probe.streams[0];
    // MediaRecorder WebM kerap tanpa header durasi → durasi = pts paket terakhir + 1 frame
    let dur = Number(probe.format.duration);
    if (!Number.isFinite(dur) || dur <= 0) {
      const pts = sh("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time", "-of", "csv=p=0", r.file]).trim().split("\n").map(Number);
      dur = Math.max(...pts) + 1 / 30;
    }
    check("video berisi ≥ 80% frame loop (bukan slideshow)", Number(s.nb_read_packets) >= N * 0.8, `packets=${s.nb_read_packets} dari ${N}`);
    check(`video (${label}) 1080×1080`, s.width === 1080 && s.height === 1080, `${s.codec_name} ${s.width}x${s.height}`);
    check("durasi video ≈ T (±0.5s)", Math.abs(dur - T / 1000) < 0.5 && dur > 0, `duration=${dur}s T=${T / 1000}s size=${statSync(r.file).size}`);
  } else {
    const txt = await page.getByText(/Video export unavailable/).count();
    check("video tak didukung → pesan fallback tampil", txt > 0);
  }
  check("0 error console/pageerror/4xx", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  await srv.stop();
  finish();
}
