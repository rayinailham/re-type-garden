# 01 — Arsitektur (hasil bedah)

Target: `https://type-garden.vercel.app/` · recon 2026-10-13 · karya **Akshat Agarwal** (x.com/art_akshat).
Status bukti: **O** = observed (dilihat langsung di file/runtime), **I** = inferred, **U** = unknown.

## 1. Ringkasan satu paragraf

Satu halaman statis (`/`) di Vercel. HTML 337 KB adalah **export "bundler" Claude Design**: semua aset
(runtime, React, font) di-gzip + base64 di dalam `<script type="__bundler/manifest">`, lalu di-unpack di browser
jadi `blob:` URL dan dokumen di-*swap*. Aplikasinya sendiri = **satu komponen** (`class Component extends DCLogic`)
±1.100 baris JS imperatif yang menggambar semua bunga di **Canvas 2D** via rAF loop. React cuma dipakai
untuk chrome UI (tombol mode, palet, panel poster). Tidak ada REST API. Fitur multiplayer = **Supabase Realtime**
(presence + broadcast) lewat WebSocket.

## 2. Stack (O)

| Lapis | Temuan | Bukti |
|---|---|---|
| Hosting | Vercel static, `x-vercel-cache: HIT`, region `sin1`, HSTS preload | `curl -I` |
| Packaging | Claude Design bundler: `__bundler/manifest` (12 aset gzip+b64), `__bundler/template`, `ext_resources`, `page_order: []` | `index.html` L52–409 |
| Runtime UI | `dc-runtime` (generated dari `dc-runtime/src/*.ts`, bun build) 69 KB — template `<x-dc>`, binding `{{ }}`, `<sc-for>`, `<sc-if>`, event `sc-camel-on-*`, pseudo-state `style-hover`/`style-focus`, props dari `data-props` | `d72da16f….js` header |
| Framework | React 18.3.1 + ReactDOM 18.3.1 (UMD, di-inline, bukan fetch unpkg) | `ext_resources` |
| Render | Canvas 2D (`getContext('2d')`), DPR-aware, **tanpa** WebGL/library animasi | template L254, L466 |
| Animasi | Custom: rAF loop + spring/ease buatan sendiri + "boil" jitter. Tidak ada GSAP/Framer/Lottie | template L287, L390–393 |
| Realtime | `@supabase/supabase-js` **2.117.2** (realtime-js 2.117.2), di-*lazy-load* dari `/vendor-supabase.js` 1,2 s setelah mount | `vendor-supabase.js`, REA ws capture |
| Analytics | Vercel Web Analytics `/_vercel/insights/script.js` | template L1455 |
| Font | DM Mono 400/500 (woff2, UI) · Playfair Display 700 (woff2, fallback) · **GT Ultra** (OTF 24 KB subset, variable 100–900, **komersial**) | `@font-face` L16–89 |

Babel standalone direferensikan di dc-runtime tapi **tidak di-fetch** saat runtime (REA capture: 0 request ke unpkg) (O).

## 3. Urutan boot (O)

1. HTML → thumbnail SVG + "Unpacking N assets…".
2. `DOMContentLoaded`: decode 12 aset (`DecompressionStream('gzip')`) → font jadi `data:` URI, script jadi `blob:`.
3. Ganti UUID di template → `document.documentElement.replaceWith(...)` → re-create `<script>` berurutan.
4. dc-runtime parse `<x-dc>` + `script[data-dc-script]` → mount `Component`.
5. `componentDidMount`: canvas resize, listener keyboard/pointer/visualViewport, rAF loop, `buildPoster()`.
6. +50 ms: fokus hidden `<input>` (desktop saja). +1200 ms: `liveConnect()`. +1500 ms: `fetch('/glyphs.json')`.
7. Script terpisah (luar komponen): tombol **Copy code** fetch `/source.txt`; tombol **Buy me a coffee** animasi CSS.

## 4. Endpoint & network (O — REA `ev_7f2a17003dcc151c…`)

| Kapan | Request | Guna |
|---|---|---|
| load | `GET /` (document) | bundle |
| load | `GET /source.txt` (79 KB) | isi clipboard "Copy code" (brief + source tanpa font komersial) |
| load | `GET /_vercel/insights/script.js` | analytics |
| +1,2 s | `GET /vendor-supabase.js` (218 KB) | supabase-js UMD → `window.supabase` |
| +1,2 s | `WSS wss://yrvohpmmrrlqirjjqnlr.supabase.co/realtime/v1/websocket?apikey=sb_publishable_…&eventsPerSecond=20&vsn=2.0.0` | presence + broadcast |
| +1,5 s | `GET /glyphs.json` (289 KB) | outline glyph untuk export SVG |
| statis | `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, `/og.png` (1200×630) | meta |

`robots.txt` dan `sitemap.xml` → **404** (tak ada larangan). Hanya satu route.
Query flag: `?tgtest` → `window.__tg = this` (hook test), `?tglocal` → realtime via `BroadcastChannel('tg-live')` (tanpa Supabase).

### Protokol realtime (O dari frame WS)

- Channel `realtime:garden`, `private:false`, `broadcast:{self:false, ack:false}`, `presence.key = me.id` (8 char base36).
- Presence `track {n: <nama bunga>, c: <tint hex>}` — nama dari 16 bunga, tint dari 8 warna.
- Broadcast `p` (pointer): `{i, x, y}` (x/y dinormalisasi 0–1, 3 desimal) atau `{i, h:1}` (hidden/keluar).
- Broadcast `r` (rose gift): `{x, y, s}` (s = seed int < 1e6).
- Rate kirim: `iv = clamp(1000·N²/40, 125, 10000)` ms (N = jumlah orang) → total ≈ 40 msg/s per room. Kirim hanya jika ada orang lain, pointer bergerak, tab visible.
- Tab hidden → kirim `{h:1}`, tutup koneksi setelah 60 s; visible lagi → reconnect.
- Guard klien: maks 40 peer disimpan, 24 ditampilkan, 14 gift; koordinat di-clamp; warna divalidasi `/^#[0-9A-Fa-f]{6}$/`.

Saat capture ada ±10 user lain di presence (O). Catatan: capture REA ikut join presence publik sebentar (tanpa kirim pointer); screenshot selanjutnya pakai `?tglocal`.

## 5. Arsitektur modul (dari source, O)

```
Component (DCLogic)
├─ math      h() hash, rng() mulberry32, spr() spring, eo() easeOutCubic, eb() easeOutBack (TIDAK dipakai), bez(), at()
├─ geometry  vine(), curl(), weave() (over/under layer), path() quad-smoothing, strokeRange()
├─ layout    mw() measure+cache, layoutCore() wrap + binary search ukuran, layout()
├─ growth    wordParams(), grow() (stem+leaf+tip rekursif depth 1), gen() per huruf, genEnd() saat space
├─ draw      backend(g) {fill, stroke, rect, text} ← bisa diganti backend SVG
│            leaf(), rose() (6 petal + spiral + scallop), thorn(), butterfly()
├─ render    render() dua layer (0 = di belakang huruf, 1 = di depan), drawStem(), drawEl(), wpt() warp
├─ input     key() keydown, inputDiff() mirror <input> untuk keyboard HP/IME, add(), wither()
├─ live      liveInit/Connect/Local/Close/Send/Presence/Peer/Step, near() (pointer terdekat), liveRose()
├─ fauna     spawnFly(), drawFlies() (fly/sit/wander/leave), posterFly()
├─ poster    buildPoster() seeded, posterDraw() 7 preset, bars()
├─ export    savePNG(), saveSVG() (glyphs.json → path), exportVideo() MediaRecorder, exportFrames() + zip() STORE manual + CRC32
└─ renderVals() → binding template (mode, palet, preset, status)
```

Pola penting:
- **Backend abstraction**: semua gambar lewat `B.fill/stroke/rect/text` → satu kode render untuk Canvas & SVG.
- **Deterministik**: poster pakai `rng(seed*7919+1)` → frame poster bisa direproduksi persis (dasar oracle parity).
- **Frame-rate independent smoothing**: `k = 1 - exp(-dt/80)`, `dt` di-clamp 64 ms.
- **Tidak ada state per-frame di React**: rAF imperatif; React hanya re-render saat `setState` UI.

## 6. Risiko & catatan legal (wajib dibaca sebelum coding)

| # | Isu | Konsekuensi untuk rebuild |
|---|---|---|
| L1 | **GT Ultra = font komersial** (Grilli Type). `glyphs.json` face 0 adalah outline turunan font itu. | Jangan pakai OTF maupun `glyphs.json` asli. Pakai Playfair Display (OFL) → generate `glyphs.json` sendiri. |
| L2 | Tidak ada LICENSE di situs. Author *mengundang* "make your own version" lewat `/source.txt`, tapi itu bukan lisensi formal. | Personal/portfolio OK dengan kredit. Untuk komersial/klien → minta izin author dulu. |
| L3 | Brand "Type Garden", tombol coffee, credit link milik author. | Ganti nama & branding; cantumkan "inspired by Type Garden by Akshat Agarwal". |
| L4 | Supabase key di source = project author (publishable, by design). | Pakai project Supabase sendiri. Jangan pakai key author. |
| S1 | Channel realtime publik tanpa auth; siapa pun bisa spam `r`/`p`. | Pertahankan guard klien + pertimbangkan rate-limit/Realtime Authorization. |
| A1 | `prefers-reduced-motion` hanya dihormati tombol coffee; canvas tetap animasi penuh. | Perbaiki di rebuild (matikan boil, perpendek spring). |
| A2 | Canvas tanpa teks alternatif; teks hanya ada di hidden input. | Tambah `aria-live` region yang membacakan kata yang tumbuh. |
