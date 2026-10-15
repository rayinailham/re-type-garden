# 02 — Design Tokens & Rules

Semua angka di bawah **diambil langsung dari source** (`evidence/original-source.txt` / template decoded), bukan diukur dari screenshot.
Versi mesin-baca: [`tokens.json`](tokens.json).

## 1. Tipografi

| Token | Nilai | Dipakai |
|---|---|---|
| `font.display` | `"GT Ultra","Playfair Display",Georgia,serif` wt 700 → **rebuild: Playfair Display 700** | huruf di canvas, judul "Poster", input Words, "Aa" palet |
| `font.ui` | `'DM Mono', ui-monospace, monospace` 400 / 500 | semua UI |
| `text.ui.xs` | 11px, `letter-spacing .08em`, UPPERCASE | label section panel (WORDS, MOTION…) |
| `text.ui.sm` | 12px, `letter-spacing .04em` (hint bar, tombol) / `.03em` (panel poster) | default UI |
| `text.ui.md` | 13px | label preset |
| `text.display.lg` | 26px | judul "Poster" |
| `text.display.md` | 22px | input Words |
| `text.display.sm` | 18px | "Aa" di kartu palet |
| `text.peer` | 11px (≤600px: 10px), `.04em`, line-height 1 | label kursor peer |

### Aturan ukuran huruf canvas (layoutCore)
- Ukuran dasar `S0 = 0.28·H`; lebar baris maks `0.8·W`; `S = min(S0, maxW / lebarSatuan)`.
- Wrap multi-baris hanya kalau >1 kata **dan** `S < 0.10·H` (hysteresis: tetap wrap selama `S < 0.14·H`).
- Saat wrap: binary search 22 iterasi `S ∈ [0.03H, 0.15H]`, syarat semua baris ≤ maxW dan `baris·2.1·S ≤ 0.82·H`.
- Line height `2.1·S`; baseline `y = H/2 + (k-(n-1)/2)·lh + 0.33·S`; lebar spasi ×1.4.
- Caret: tinggi `0.8·S`, lebar `max(2, 0.03·S)`, offset x `+0.07·S` dari huruf terakhir.
- Stem `lineWidth = 0.022·S` (cabang depth-1 ×0.82); duri panjang `0.045·S`.
- Poster: kanvas 1080², teks ≤ 40 char, seluruh taman di-fit ke margin 6% (`half = 0.44·1080`), skala maks ×1.25.

## 2. Warna

### UI chrome (konstan, tidak ikut palet)
| Token | Hex | Peran |
|---|---|---|
| `ui.bg` | `#000000` | latar pill, panel stage |
| `ui.panel` | `#0A0A0A` | panel poster |
| `ui.selected` | `#161616` | preset aktif |
| `ui.divider` | `#1E1E1E` | border panel / kanvas poster |
| `ui.border` | `#2A2A2A` | pill, input, kartu |
| `ui.border.strong` | `#3A3A3A` | tombol PNG/SVG, swatch ring non-aktif |
| `ui.muted` | `#8C8C8C` | label, sub-teks, status |
| `ui.btn.fg` | `#BDBDBD` | teks tombol ghost |
| `ui.fg` | `#EDEDED` | teks panel |
| `ui.white` | `#FFFFFF` | aktif/hover border, tombol primer |
| `ui.link.hover` | `#FFB4A8` | `a:hover` |
| `error.bg/fg/border` | `#2A1215` / `#FF8A80` / `#5C2B2E` | banner error bundler |

### Palet taman (10) — `[nama, bg, flower(red), stem/leaf(blue), line(detail), text]`
| # | Nama | bg | flower | stem | line | text |
|---|---|---|---|---|---|---|
| 0 | Rose noir *(default)* | `#000000` | `#FF1400` | `#3257FF` | `#FFB4A8` | `#FFFFFF` |
| 1 | Paper | `#F3EEE4` | `#FF3B1F` | `#1C2B8F` | `#FFD2C4` | `#111111` |
| 2 | Midnight | `#0D1B4C` | `#FF5A4E` | `#9FB4FF` | `#FFD6CF` | `#FFFFFF` |
| 3 | Citrus | `#0E1A12` | `#FF8A00` | `#1FA463` | `#FFE2B8` | `#FFF6E8` |
| 4 | Orchid | `#140A1F` | `#E63CFF` | `#2FB8A6` | `#F9D1FF` | `#FFFFFF` |
| 5 | Moss | `#133A2A` | `#FFB7C5` | `#7FD18B` | `#FFFFFF` | `#F6F1E7` |
| 6 | Tomato | `#FF1400` | `#FFF1E0` | `#0B0B0B` | `#FF1400` | `#000000` |
| 7 | Butter | `#FFE9A8` | `#E4002B` | `#0F5132` | `#FFC2C2` | `#1A1A1A` |
| 8 | Blush | `#FAD4D8` | `#C8102E` | `#274690` | `#FFE3E6` | `#1A1A1A` |
| 9 | Mono | `#000000` | `#F2F2F2` | `#6E6E6E` | `#000000` | `#FFFFFF` |

Aturan: `vein` (urat daun) = `bg`. Palet aktif juga diekspos ke CSS var `--tg-flower`, `--tg-stem`, `--tg-detail` (dipakai ikon coffee).
Peer tints: `#FF8A00 #E63CFF #7FD18B #9FB4FF #FFB7C5 #FFE2B8 #2FB8A6 #FFD23F`.
Nama peer: iris, fern, poppy, tulip, violet, clover, daisy, lilac, aster, peony, sorrel, yarrow, thistle, bluebell, foxglove, primrose.

## 3. Spacing, radius, ukuran

| Token | Nilai |
|---|---|
| Skala spacing (px) | 4, 6, 8, 10, 12, 14, 16, 20, 22, 24, 26, 32, 56 |
| Gutter layar | top/right 16 (+safe-area); hint bar left/right 24, bottom 20 (≤600px: 16 / 14) |
| Panel poster | lebar `minmax(280px, 340px)`, padding `24 22 32`, gap section 26, gap dalam 10 |
| Stage poster | padding `56 32 32`; kanvas `min(100%, 100vh − 96px)`, aspect 1:1 |
| Radius | pill `999px`; input & kartu preset `10px`; kartu palet `12px`; preview palet `8px` |
| Tombol pill | padding `7px 14px` (mode), `8px 14px` (PNG/SVG, ≤600px `7px 11px`), primer `12px 14px` |
| Swatch | 22×22, ring 1.5px, dot 10px; ≤600px `--sw: clamp(13px, (100vw − 183px)/10, 22px)`, dot 0.46·sw; aktif scale 1.1, hover 1.15 |
| z-index | peers 4, modes 5, tg-copy 6, thumbnail 9999, loading 10000, error 99999 |
| Hint bar | opacity 0.6, warna = `palette.text` |

## 4. Breakpoints & media query

| Query | Efek |
|---|---|
| `(max-width: 720px)` | Poster: grid → kolom flex, stage di atas (order −1), panel di bawah, fade header sticky 60px |
| `(max-width: 600px)` | Hint bar rapat, ctrls full-width, swatch fluid, label peer kecil, coffee label "Coffee" |
| `(max-width: 380px)` | Coffee jadi ikon saja |
| `(max-width: 349px)` | Padding tombol mode 7px 10px |
| `(pointer: coarse)` | Hint "tap to type / ⌫ withers / return clears"; `html[data-touch]` → app pakai `--tg-top/--tg-h` dari visualViewport |
| `(hover: hover)` | Hover pill & coffee bloom on hover; touch: coffee bloom otomatis 1.2s, 2 iterasi sway |
| `(prefers-reduced-motion: reduce)` | Hanya mematikan animasi coffee (gap A1) |
| `env(safe-area-inset-*)` | Semua elemen tepi; `viewport-fit=cover`, `interactive-widget=resizes-content` |

## 5. Motion

### Primitive
| Nama | Rumus | Catatan |
|---|---|---|
| `spr(t,k,w)` | `1 − e^(−k·t)·cos(w·t)`, t detik | default k=7, w=16 (overshoot/bouncy) |
| `eo(t)` | `1 − (1−t)³` | easeOutCubic, clamp 0..1 |
| smoothing | `x += (target−x)·(1 − e^(−dt/τ))` | layout/kursor τ=80ms; dt clamp 64ms |
| lerp per-frame | 0.07 (lean huruf), 0.09 (rose face-turn), 0.35 (butterfly sit) | frame-dependent (asli) |
| boil | jitter hash berganti tiap **120ms**, amp `max(0.8, 0.01·S)` px, rot ±0.035 rad | efek "gambar tangan" |

### Timing pertumbuhan (type mode)
| Elemen | Mulai (d0) | Durasi / kurva |
|---|---|---|
| Stem atas #1 / #2 | 40ms / 170ms | `max(320, len·620)` ms, `eo` |
| Stem bawah | 160ms | idem |
| Jembatan antar-huruf | 90ms | idem (prob `bridgeP`) |
| Curl kiri (huruf pertama kata) | 120ms | idem |
| Tip (rose/fan/leaf) | `d0 + 0.8·dur` | — |
| Daun | `d0 + dur·u` | `spr(k=7, w=15)` |
| Kelopak rose (6) | stagger **85ms** | `spr(k=8, w=14)` dari pusat bawah (0, 0.5R) |
| Spiral + scallop rose | `6·85 + 80` ms | `eo` 520ms, detail hanya jika R ≥ 12/14 |
| Tendril ujung kata | `tb + 150ms` | `eo` 450ms |
| Space (cut) | — | tendril recoil 150ms, maks `min(0.85, recoil/(0.6S))`, recoil default 20px; `genEnd` 1–3 cabang bunga, stagger 90ms |
| Backspace (wither) | — | 260ms `1−eo` (poster 600ms); dihapus setelah 300ms |
| Birth wobble | t < 2.5s | `0.07S·h·e^(−3.2t)·sin(11t)` |
| Lean ke pointer | radius `max(260, 3.2S)` | smoothstep, huruf condong ke kursor terdekat (lokal/peer) |
| Caret | blink 530ms, solid 500ms setelah ketik, fade-in 600ms saat load | — |

### Fauna & gift
- Butterfly: maks 6; terbang (sayap `|cos(17t)|`) → hinggap rose terdekat (perch setelah rose umur 700ms) → keluar; wander 3.5s jika tak ada perch.
- Rose gift (double-tap < 340ms, < 40px, cooldown 1800ms): hidup 60s, fade 2.2s terakhir, maks 14.

### Poster preset (loop, 30fps, 1080²)
| id | Label | T | Mekanik |
|---|---|---|---|
| breathe | Breathe | 3s | sway sinus, `0.03S·h` |
| grow | Grow & wither | 6s | lahir stagger `min(110, 3000/n)` + 200ms, mati mulai 4200ms |
| typed | Typed | 5s | ketik `min(85, 3600/n)` + 300ms, caret 400ms, kosong ≥ 4400ms |
| wind | Gust | 4s | front angin `−0.35 + 1.9u` menyapu x |
| reach | Reach | 6s | titik cahaya Lissajous (430, 260) menarik stem |
| scatter | Scatter | 6s | lahir acak 150–2550ms, mati 4700ms |
| visit | Visitor | 7s | butterfly: masuk 1.8s → hinggap 1.6s → pindah 1.2s → hinggap 1.2s → keluar 1.2s |

### CSS motion (chrome)
| Elemen | Nilai |
|---|---|
| Live dot `tg-live` | opacity 1↔0.3, 2.4s ease-in-out infinite |
| Peer cursor | `transition: opacity .45s`; opacity 1 (< 8s idle), .35 (< 45s), 0 |
| Copy note | opacity/translateY(−3px) .2s; tampil 2.8s |
| Pill hover | border-color .15s, color .15s |
| Coffee stem | dashoffset .42s `cubic-bezier(.2,.7,.3,1)` |
| Coffee leaves | scale .36s `cubic-bezier(.3,1.6,.5,1)` delay .18s / .26s |
| Coffee bloom | scale .5s `cubic-bezier(.3,1.6,.5,1)` delay .3s; swirl −140°→0 .8s |
| Coffee sway | rotate 0/−4°/3°, 2.8s infinite (touch: 2×) |
| Press | cap scale .95, bloom .84 dalam .1s ease-out |

## 6. Rules turunan (untuk rebuild)

1. Satu sumber kebenaran palet: array 6-tuple → CSS var + konfigurasi canvas.
2. Semua ukuran canvas relatif ke `S` (ukuran huruf), bukan px absolut.
3. Semua waktu animasi dalam ms relatif ke `birth` huruf; tak ada `setTimeout` per elemen.
4. UI chrome monokrom (hitam/abu/putih); warna hanya datang dari palet taman.
5. Pill radius 999px untuk semua kontrol; kartu 10–12px.
6. Hormati `prefers-reduced-motion` (tambahan rebuild): boil off, spring → eo, butterfly off.
