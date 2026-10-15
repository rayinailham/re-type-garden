// Leak audit (evidence-guard): tak ada aset/kunci komersial atau milik author yang bocor ke permukaan
// yang dikirim (app, components, lib, public, build .next). Disertai UJI GIGIT: pola ditanam di folder
// sementara dan harus tertangkap — audit yang memindai nol berkas selalu "lulus", jadi dijaga.
//   node tools/leak-audit.mjs   (jalankan setelah npm run build)
import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEXT = /\.(ts|tsx|js|mjs|css|json|html|rsc|svg|txt|map|md)$/i;

// kind: build = tanpa komentar; src = baris komentar boleh menyebut nama (kredit/penjelasan)
const RULES = [
  { id: "gt-ultra", re: /GT\s*Ultra/i, why: "font komersial GT Ultra (L1)", commentOk: true },
  { id: "author-supabase-key", re: /sb_publishable_[A-Za-z0-9_-]{8,}/, why: "kunci Supabase author (L4)" },
  { id: "author-supabase-ref", re: /yrvohpmmrrlqirjjqnlr/, why: "project Supabase author (L4)" },
  { id: "author-supabase-host", re: /[a-z0-9]{20}\.supabase\.co/i, why: "host Supabase milik pihak lain" },
  { id: "abs-path", re: /\/home\/[a-z0-9_-]+\//i, why: "path absolut mesin" },
  { id: "author-branding", re: /Buy me a coffee|buymeacoffee|Copy code/i, why: "branding author (L3)", commentOk: true },
  { id: "supabase-bundle", re: /@supabase\/supabase-js|vendor-supabase/, why: "supabase tidak boleh masuk bundle (D6)" },
];

function* walk(dir, skip = () => false) {
  if (!existsSync(dir)) return;
  for (const n of readdirSync(dir)) {
    const f = path.join(dir, n);
    if (skip(f)) continue;
    const st = statSync(f);
    if (st.isDirectory()) yield* walk(f, skip);
    else yield f;
  }
}

export function scan(roots, { build, only }) {
  const out = [];
  let files = 0;
  for (const r of roots)
    for (const f of walk(r)) {
      if (only && !only.test(f)) continue;
      const base = path.basename(f);
      // berkas font mentah di public/ = aset yang dikirim
      if (/\.(otf|ttf|woff2?)$/i.test(base) && !build) out.push({ id: "font-file", file: f, line: 0, why: "berkas font di permukaan kirim" });
      if (!TEXT.test(f) || statSync(f).size > 4e6) continue;
      files++;
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((ln, i) => {
        for (const r2 of RULES) {
          if (!r2.re.test(ln)) continue;
          const isComment = /^\s*(\/\/|\*|\/\*|#)/.test(ln);
          if (r2.commentOk && isComment && !build) continue;
          out.push({ id: r2.id, file: f, line: i + 1, why: r2.why });
        }
      });
    }
  return { findings: out, files };
}

// ---- uji gigit ----
const tmp = mkdtempSync(path.join(tmpdir(), "leak-bite-"));
mkdirSync(path.join(tmp, "lib"));
const plants = {
  "gt-ultra": 'const f = "GT Ultra, serif";',
  "author-supabase-key": 'const k = "sb_publishable_AbCdEf123456";',
  "author-supabase-ref": 'const u = "https://yrvohpmmrrlqirjjqnlr.supabase.co";',
  "abs-path": 'const p = "/home/someone/secret/file.txt";',
  "author-branding": 'const t = "Buy me a coffee";',
  "supabase-bundle": 'import x from "@supabase/supabase-js";',
};
writeFileSync(path.join(tmp, "lib/plant.ts"), Object.values(plants).join("\n") + "\n");
writeFileSync(path.join(tmp, "lib/ok.ts"), "// credit: GT Ultra mention in a comment is fine in src\nexport const a = 1;\n");
const bite = scan([tmp], { build: false });
let bad = 0;
for (const id of Object.keys(plants)) {
  const hit = bite.findings.some((f) => f.id === id);
  console.log(`${hit ? "PASS" : "FAIL"}  uji gigit: ${id} tertangkap`);
  if (!hit) bad++;
}
const okHit = bite.findings.some((f) => f.file.endsWith("ok.ts"));
console.log(`${!okHit ? "PASS" : "FAIL"}  uji gigit: komentar di src tidak false-positive`);
if (okHit) bad++;
const buildBite = scan([tmp], { build: true });
const bc = buildBite.findings.some((f) => f.file.endsWith("ok.ts") && f.id === "gt-ultra");
console.log(`${bc ? "PASS" : "FAIL"}  uji gigit: di build, komentar tetap ditandai`);
if (!bc) bad++;

// ---- audit nyata ----
const srcRoots = ["app", "components", "lib", "public"].map((d) => path.join(ROOT, d));
// permukaan yang DILAYANI ke browser: .next/static (+ HTML/RSC prerender). .next/server/**/*.js hanya
// dipakai server; Next menanam path direktori build di manifest-nya — bukan dikirim ke klien.
const S = scan(srcRoots, { build: false });
const B1 = scan([path.join(ROOT, ".next/static")], { build: true });
const B2 = scan([path.join(ROOT, ".next/server/app")], { build: true, only: /\.(html|rsc)$/ });
const B = { findings: [...B1.findings, ...B2.findings], files: B1.files + B2.files };
console.log(`\nterpindai: src ${S.files} berkas, build ${B.files} berkas`);
if (S.files < 20 || B.files < 5) {
  console.log("FAIL  jumlah berkas terpindai terlalu sedikit (jalankan npm run build dulu?)");
  bad++;
}
for (const f of [...S.findings, ...B.findings]) {
  console.log(`FAIL  ${f.id}: ${path.relative(ROOT, f.file)}:${f.line} — ${f.why}`);
  bad++;
}

// glyphs.json milik kita: 1 face, turunan Playfair (bukan 2 face 271+312 glyph milik author)
const gp = path.join(ROOT, "public/glyphs.json");
if (existsSync(gp)) {
  const j = JSON.parse(readFileSync(gp, "utf8"));
  const n = j.faces.map((f) => Object.keys(f.g).length);
  const ours = j.faces.length === 1 && j.faces[0].upm === 1000 && !(n.includes(271) && n.includes(312));
  console.log(`${ours ? "PASS" : "FAIL"}  glyphs.json = hasil generate sendiri (faces=${j.faces.length}, glyph=${n.join("+")})`);
  if (!ours) bad++;
}
console.log(bad ? `\n${bad} TEMUAN` : "\nbersih: 0 temuan");
process.exitCode = bad ? 1 : 0;
