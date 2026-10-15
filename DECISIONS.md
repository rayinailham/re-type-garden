# DECISIONS — RE: Type Garden

Catatan keputusan Fase 0 (gerbang). Sumber: sesi scouting/RE di `artifacts/doc/`.
Karya asli: **Type Garden** oleh **Akshat Agarwal** (x.com/art_akshat).

| # | Keputusan | Nilai | Alasan / konsekuensi |
|---|---|---|---|
| D1 | Stack | **Next.js (App Router) + TypeScript + Tailwind CSS v4** | Default dokumen `04-plan.md`. Engine taman = TS murni tanpa framework. |
| D2 | Tujuan | **Portfolio pribadi**, lokal saja, **tanpa deploy** | Non-komersial → L2 cukup kredit "inspired by", tidak perlu izin tertulis author. |
| D3 | Brand / nama | **RE: Type Garden** | Jujur: ini hasil reverse engineering, bukan diklaim orisinal. Tidak memakai nama "Type Garden" polos, tombol coffee author, atau credit author sebagai milik sendiri. |
| D4 | Author | **Rayina Ilham** | Metadata, CreditBar, package author. |
| D5 | Tujuan copy | **Sepersis mungkin** dengan web asli (angka & kurva = kontrak di `02-design-tokens.md`) | Port, bukan redesign. |
| D6 | Live multiplayer | **Supabase remote: SKIP. Mode `?tglocal` (BroadcastChannel): IKUT** | Persis tanpa langgar L4 (tidak pakai key/project Supabase author). Supabase remote butuh project + env milik Milord → ditunda sampai diminta. |
| D7 | Font | DM Mono + Playfair Display (keduanya OFL via `next/font/google`). **GT Ultra & `glyphs.json` asli: TIDAK dipakai** (L1 komersial) | `glyphs.json` di-generate ulang dari Playfair saat Fase 5. |
| D8 | Legal | Cantumkan kredit "inspired by Type Garden by Akshat Agarwal" + pernyataan jujur RE di CreditBar & README | L2, L3. |

## Perbaikan rebuild (dari risiko di `01-architecture.md`)
- A1: hormati `prefers-reduced-motion` di canvas (boil off, spring → eo, butterfly off).
- A2: `aria-live` region bacakan kata berjalan.
- S1: pertahankan guard klien realtime (validasi skema, clamp, batas peer).

## Status gerbang
Fase 0 keputusan: **SELESAI** (2026-10-13). Lanjut scaffold.

## Deviasi dari source (Fase 2–7, 2026-10-13) — semuanya terukur
| # | Deviasi | Alasan / bukti |
|---|---|---|
| V1 | Caret solid (tanpa kedip) saat `prefers-reduced-motion`; birth wobble ikut mati | A1; konsisten dengan spring → eo |
| V2 | Export video: `captureStream(FPS×2)` + pacing 30fps, **tanpa** `requestFrame` | Firefox: `captureStream(0)+requestFrame` = 3/90 paket, `captureStream(30)` = 51/90, `(60)` = 90/90 |
| V3 | Export (video/PNG frames) selalu fidelitas penuh; hanya *pratinjau* poster mengikuti reduced motion | export = artefak eksplisit |
| V4 | Opasitas hint/credit dinaikkan per-palet seperlunya (Tomato .78, Butter .62, Blush .64) | kontras ≥ 4.5:1; .6 gagal 3.35/4.30/4.11 |
| V5 | Words poster dikomit saat blur/Enter (semantik event `change`), draft lokal per ketukan | source: `sc-camel-on-change` |
| V6 | Gift: validasi `Number.isFinite`, seed int, maks 14; presence: nama ≤ 24, id ≤ 24, tint `#RRGGBB` | S1 |
| V7 | Cache face-turn per elemen dibersihkan saat huruf dihapus (source tak pernah membuang) | kebocoran memori sesi panjang |
| V8 | Branch `reference` + `bars()` diport tetapi tak terjangkau dari UI | dead di source (preset tak ada di daftar) |
| V9 | `<meta viewport>` tanpa `maximum-scale/user-scalable=no`; `interactive-widget=resizes-content` dipertahankan | zoom pengguna (a11y); WebKit mencatat pesan ignored (allowlist di sweep) |
| V10 | Font canvas: `"Playfair Display",Georgia,serif` (tanpa "GT Ultra" di daftar family) | D7; mencegah pemakaian font terpasang lokal |
| V11 | `document.fonts.load` hanya untuk family utama | face fallback `local()` bisa menolak promise → ukuran tak di-refresh |

## Status fase
- Fase 1–7: **SELESAI** (lihat laporan sesi). Deploy: **tidak** (D2).
