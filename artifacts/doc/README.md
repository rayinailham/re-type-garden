# Type Garden — Recon & Rebuild Spec

Sesi scouting/RE (tanpa coding) atas `https://type-garden.vercel.app/` · 2026-10-13.
Karya asli: **Akshat Agarwal** ([x.com/art_akshat](https://x.com/art_akshat)). Dokumen ini untuk rebuild versi sendiri.

## Isi

| File | Isi |
|---|---|
| [01-architecture.md](01-architecture.md) | Stack, urutan boot, endpoint + protokol realtime, peta modul, risiko legal/security/a11y |
| [02-design-tokens.md](02-design-tokens.md) | Font, warna (UI + 10 palet), spacing, radius, breakpoints, motion timing |
| [tokens.json](tokens.json) | Token versi mesin-baca |
| [03-components-interactions.md](03-components-interactions.md) | DOM tree, daftar komponen, model data, peta input, 7 state machine, daftar aset |
| [04-plan.md](04-plan.md) | Struktur target + 8 fase (0–7) dengan checklist & acceptance, open questions |
| [recon.json](recon.json) | Output format web-recon |
| `evidence/` | `original-source.txt` (yang author publikasikan di `/source.txt`), `sha256.txt`, `screens/*.png` |

## Temuan inti (5 baris)

1. Bukan Next/Vite: **export bundler Claude Design** — satu HTML 337 KB berisi aset gzip+base64, di-unpack di browser.
2. App = **satu komponen ±1.100 baris**, semua visual **procedural di Canvas 2D** (tanpa GSAP/WebGL/gambar).
3. Tidak ada REST API; satu-satunya backend = **Supabase Realtime** (presence + broadcast pointer/rose).
4. Motion = spring `1−e^(−kt)cos(wt)` + easeOutCubic + "boil" jitter 120ms; semua relatif ke ukuran huruf `S`.
5. Source lengkap terbaca; **font GT Ultra komersial** + `glyphs.json` turunannya **tidak boleh** dipakai ulang.

## Metode & bukti

- web-recon: robots/sitemap (404), header, HTML statis → decode manifest offline (`python -I`, scratchpad).
- REA `capture_browser_scenario` (Chromium 1243 headless): load → ketik → Poster; network + WS frame. Evidence `ev_7f2a17003dcc151c…`.
- Playwright screenshot 12 state (desktop + mobile) dengan `?tglocal` agar tidak join channel publik.
- Beban ke server: ±25 request total, ≤1 req/s untuk fetch manual.

Label bukti di dokumen: O = observed, I = inferred, U = unknown. Hampir semua klaim O karena source tersedia penuh.
