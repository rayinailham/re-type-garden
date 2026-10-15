# 04 — Rebuild Plan & Spec (checklist per fase)

**Target stack (asumsi, konfirmasi di Fase 0):** Next.js (App Router) + TypeScript + Tailwind CSS v4.
Engine taman = **TS murni tanpa framework** → kalau pindah ke Vue/Svelte cukup ganti shell UI (Fase 3), engine tak berubah.

## Prinsip

- **Port, bukan redesign.** Angka & kurva di `02-design-tokens.md` adalah kontrak; ubah hanya lewat keputusan tercatat.
- **Engine imperatif, UI deklaratif.** rAF + canvas di class `GardenEngine`; React hanya chrome. Tidak ada `setState` per frame.
- **Dependensi minimal:** `@supabase/supabase-js` (lazy). Zip, CRC32, easing, rng → port 1:1 (≤ 30 baris masing-masing).
- **Bukti, bukan klaim:** tiap fase punya acceptance yang bisa dicek otomatis.
- **Legal dulu:** lihat Risiko L1–L4 di `01-architecture.md`.

## Struktur target

```
app/
  layout.tsx            fonts (DM Mono, Playfair Display), metadata/OG, analytics
  page.tsx              <Garden/> (client)
  globals.css           @theme tokens + media query dari 02
components/garden/      TypeCanvas, ModeToggle, HintBar, PaletteSwatches, ExportButtons,
                        PosterPanel, PresetCard, PaletteCard, PosterStage, CreditBar
lib/garden/
  math.ts               h, rng (mulberry32), spr, eo, bez, at, jit
  geometry.ts           vine, curl, weave, layerAt, path, strokeRange
  layout.ts             measure cache, layoutCore (wrap + binary search)
  growth.ts             wordParams, grow, gen, genEnd
  draw.ts               Backend interface + canvasBackend + svgBackend; leaf, rose, thorn, butterfly
  render.ts             render (2 layer), drawStem, drawEl, wpt
  input.ts              keydown map + inputDiff (IME/mobile)
  fauna.ts              flies + gift roses
  poster.ts             buildPoster, posterDraw, 7 presets, bars
  export.ts             png, svg (glyphs), video (MediaRecorder), frames + zip
  live.ts               Transport: supabase | broadcastchannel | none; presence, peers, rate formula
  engine.ts             GardenEngine: state, rAF, subscribe(), dispose()
  palettes.ts           10 palet + peer tints/nama (dari tokens.json)
public/glyphs.json      digenerate dari Playfair Display (script di tools/)
tools/gen-glyphs.py     fonttools → format [advance, path] upm 1000
tests/                  vitest unit + playwright e2e/parity
```

---

## Fase 0 — Gerbang keputusan & setup
- [ ] Konfirmasi target stack (Next+Tailwind vs Vue) dan tujuan (portfolio pribadi vs klien/komersial).
- [ ] Jika komersial: minta izin tertulis ke Akshat Agarwal (L2). Jika tidak: siapkan kredit "inspired by".
- [ ] Tetapkan nama & branding baru (L3); tidak memakai "Type Garden", coffee link, atau credit author sebagai milik sendiri.
- [ ] Putuskan fitur live (ya/tidak). Jika ya: buat project Supabase sendiri, simpan URL + publishable key di env (L4).
- [ ] Scaffold Next.js + TS + Tailwind v4, ESLint, Vitest, Playwright. Pilih akun GitHub (kerja/personal) sebelum `git init` remote.
- [ ] Copy `tokens.json` → `lib/garden/palettes.ts` + `@theme` di `globals.css`.

**Acceptance:** `pnpm dev` jalan, halaman hitam dengan font DM Mono + Playfair termuat; keputusan dicatat di `DECISIONS.md`.

## Fase 1 — Engine core (math → growth → render)
- [ ] Port `math.ts` 1:1 (rng mulberry32, spr, eo, hash `h`). `eb` tidak perlu (dead code).
- [ ] Port `geometry.ts` (vine, curl, weave, path quad-smoothing, strokeRange).
- [ ] Port `layout.ts` `layoutCore` dengan konstanta S0 0.28 / maxW 0.8 / LH 2.1 / wrap 0.10–0.14.
- [ ] Port `growth.ts` (wordParams, grow rekursif, gen, genEnd) — urutan pemanggilan `r()` **harus identik** agar seed sama → bentuk sama.
- [ ] `draw.ts`: interface `Backend {fill, stroke, rect, text}`; canvas backend; leaf/rose/thorn/butterfly.
- [ ] `render.ts`: dua layer (0 belakang huruf, 1 depan), boil jitter 120ms, warp `wpt`.
- [ ] Unit test: rng determinisme (5 nilai pertama seed 7), layoutCore (wrap on/off, hysteresis), gen() jumlah elemen untuk seed tetap, zip CRC32 known vector.

**Acceptance:** halaman uji statis merender kata tetap dengan seed tetap; snapshot elemen `gen()` cocok dengan output asli (ambil via `?tgtest` → `window.__tg`).

## Fase 2 — Type mode (interaksi)
- [ ] `GardenEngine` + rAF loop, DPR resize, smoothing τ 80ms, dt clamp 64ms.
- [ ] Keyboard map (char/space/backspace/enter/Ctrl+S) + hidden input 1×1 font-size 16px.
- [ ] `inputDiff` untuk keyboard HP & IME (sentinel `​`, compositionstart/end).
- [ ] Caret (blink 530 / solid 500 / fade-in 600).
- [ ] Cut (space) → genEnd + tendril recoil; wither 260ms → hapus 300ms; enter clear.
- [ ] Lean huruf & rose ke pointer (radius max(260, 3.2S)); birth wobble.
- [ ] Butterfly (klik) maks 6; rose gift (double-tap) lokal.
- [ ] `prefers-reduced-motion`: boil off, butterfly off, spring → eo (perbaikan A1).
- [ ] `aria-live="polite"` membacakan kata saat ini (perbaikan A2).

**Acceptance:** Playwright: ketik "type garden" → screenshot setelah 4s mirip `evidence/screens/d-03` (cek visual manual + jumlah stroke > 0); backspace 2× mengurangi huruf; enter mengosongkan; mobile emulation: input lewat `fill` memicu inputDiff.

## Fase 3 — UI chrome (Next + Tailwind)
- [ ] `ModeToggle` pill kanan-atas (aktif: bg putih/teks hitam; non-aktif: transparan/#BDBDBD).
- [ ] `HintBar` (opacity .6, warna = palette.text, varian fine/coarse lewat `@media (pointer:coarse)`), count "N gardeners here" + dot pulse 2.4s.
- [ ] `PaletteSwatches` 10× (22px, ring, scale 1.1 aktif / 1.15 hover, fluid ≤600px).
- [ ] `ExportButtons` PNG / SVG ghost pill.
- [ ] Safe-area insets, `viewport-fit=cover`, `interactive-widget=resizes-content`, visualViewport sync (`--tg-top/--tg-h`, data-kb).
- [ ] `CreditBar` milik sendiri (pengganti Copy code/coffee).
- [ ] Breakpoints 720 / 600 / 380 / 349 sesuai `02`.

**Acceptance:** qa-sweep 3 viewport (1440, 768, 390) tanpa overflow horizontal; kontrol tetap di dalam safe-area di emulasi iPhone.

## Fase 4 — Poster mode
- [ ] `PosterPanel` (Words input onChange, Regrow → seed acak, 7 preset grid 2 kolom, 10 kartu palet, export section).
- [ ] `buildPoster` seeded `rng(seed*7919+1)`, teks ≤ 40, fit taman ke margin 6%, skala ≤ 1.25.
- [ ] 7 preset `posterDraw` (breathe, grow, typed, wind, reach, scatter, visit) dengan T dari tokens.
- [ ] Masuk poster membawa teks hidup dari type mode; label info `1:1 · Ns loop · 30 fps`.
- [ ] Layout ≤720px: stage di atas, panel di bawah, header fade sticky.
- [ ] **Oracle parity:** harness lokal = HTML asli yang di-decode dengan GT Ultra dihapus (fallback Playfair) + `?tgtest`; render frame poster (text, seed, preset, palette, t) di asli vs rebuild → pixelmatch. Ini alat uji internal saja, tidak dipublikasi.

**Acceptance:** untuk 7 preset × 3 waktu (0.25T, 0.5T, 0.9T) selisih piksel < 1% (atau threshold yang disepakati), boil dimatikan saat uji.

## Fase 5 — Export
- [ ] PNG (canvas `toBlob`, `garden.png`).
- [ ] `tools/gen-glyphs.py`: Playfair Display 700 → `public/glyphs.json` (format `{faces:[{upm:1000, g:{ch:[adv, path]}}]}`), set karakter = latin + latin-ext + tanda baca.
- [ ] SVG: svgBackend, huruf sebagai `<path id=…>`, fallback `<text>`; nama `garden.svg`.
- [ ] Video: MediaRecorder `captureStream(0)` + `requestFrame`, 1080², 30fps, 14 Mbps, prioritas mp4/avc1 → webm/vp9; pesan fallback jika tak didukung.
- [ ] PNG frames → zip STORE (port `zip()` + CRC32), nama `garden-<slug>-<preset>-frames.zip`.

**Acceptance:** file hasil dibuka: PNG valid, SVG valid (xmllint) dengan path huruf, zip berisi `T/1000·30` frame, video berdurasi ≈ T.

## Fase 6 — Live (opsional, tergantung Fase 0)
- [ ] `Transport` interface; impl `supabase` (dynamic import, channel `garden`, presence key = id, broadcast self:false) & `local` (BroadcastChannel, `?local`).
- [ ] Pointer broadcast dengan rate `clamp(1000·N²/40, 125, 10000)`; kirim hanya jika berubah & ada orang lain.
- [ ] Peer cursor DOM imperatif (maks 40 simpan / 24 tampil, opacity 1/.35/0, transisi .45s).
- [ ] Rose gift broadcast `r {x,y,s}` + validasi & clamp di penerima.
- [ ] Hidden tab → `{h:1}` + tutup 60s; reconnect saat visible.
- [ ] Keamanan (S1): validasi skema payload ketat, batas ukuran, pertimbangkan Realtime Authorization / private channel.

**Acceptance:** dua tab `?local` saling lihat kursor & gift; dua browser ke Supabase sendiri: count "2 gardeners here".

## Fase 7 — Polish, QA, rilis
- [ ] Metadata: title, description, OG 1200×630 baru, favicon SVG/ICO, apple-touch-icon, theme-color #000.
- [ ] Analytics (opsional): Vercel Web Analytics.
- [ ] Perf budget: JS awal ≤ 120 KB gzip (supabase lazy), 60fps di laptop dengan 40 huruf; ukur dengan Performance trace.
- [ ] a11y: fokus terlihat semua tombol, label aria palet, reduced motion, kontras teks UI ≥ 4.5:1 (#8C8C8C di #000 ≈ 6.2:1 ✓).
- [ ] qa-sweep (chromium/firefox/webkit × desktop/tablet/mobile).
- [ ] evidence-guard sebelum publish (tidak ada key/aset komersial bocor).
- [ ] Deploy Vercel **hanya atas permintaan eksplisit** Milord.

**Acceptance:** qa-sweep 0 error console/4xx; Lighthouse a11y ≥ 95; leak audit bersih (tak ada GT Ultra, tak ada key author).

---

## Open questions (perlu jawaban Milord)
1. Target stack final: Next.js + Tailwind (asumsi dokumen ini) atau Vue?
2. Tujuan: portfolio pribadi atau proyek klien/komersial? (menentukan perlu izin author)
3. Fitur multiplayer live: ikut atau skip?
4. Nama/brand pengganti untuk versi Milord?
