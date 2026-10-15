// Generate aset brand SENDIRI (bukan milik author asli, L3): apple-touch-icon.png, favicon.ico, og.png.
// favicon.svg ditulis tangan di public/. Butuh server produksi hidup di E2E_URL (default http://localhost:3195).
//   node tools/gen-brand.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const url = process.env.E2E_URL || "http://localhost:3195";
const svg = readFileSync(path.join(pub, "favicon.svg"), "utf8");
const browser = await chromium.launch();
try {
  const shot = async (size) => {
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<body style="margin:0;background:#000">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
    const b = await p.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
    await p.close();
    return b;
  };
  writeFileSync(path.join(pub, "apple-touch-icon.png"), await shot(180));
  // ICO 32×32: header + 1 entri + PNG
  const png = await shot(32);
  const hdr = Buffer.alloc(22);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
  // ICONDIRENTRY @6: w,h,colors,reserved | planes@10 | bitcount@12 | size@14 | offset@18
  hdr[6] = 32; hdr[7] = 32; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12);
  hdr.writeUInt32LE(png.length, 14); hdr.writeUInt32LE(22, 18);
  writeFileSync(path.join(pub, "favicon.ico"), Buffer.concat([hdr, png]));

  // OG 1200×630: frame poster dari engine sendiri + teks
  const app = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await app.goto(url + "/?tgtest");
  await app.waitForFunction(() => window.__tgPoster);
  const frame = await app.evaluate(() => window.__tgPoster({ text: "type garden", seed: 11, preset: "grow", palette: 0, t: 3600, boil: false }));
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(`<body style="margin:0;background:#000;width:1200px;height:630px;overflow:hidden;position:relative">
    <img src="${frame}" style="position:absolute;left:0;top:-250px;width:1200px;height:1200px">
    <div style="position:absolute;left:48px;bottom:40px;font:500 26px 'DM Mono',monospace;color:#fff;letter-spacing:.04em">RE: Type Garden</div>
    <div style="position:absolute;right:48px;bottom:44px;font:400 18px 'DM Mono',monospace;color:#8C8C8C;letter-spacing:.04em">by Rayina Ilham · inspired by Type Garden by Akshat Agarwal</div>
  </body>`);
  await og.waitForTimeout(300);
  writeFileSync(path.join(pub, "og.png"), await og.screenshot());
} finally {
  await browser.close();
}
console.log("brand: apple-touch-icon.png, favicon.ico, og.png → public/");
