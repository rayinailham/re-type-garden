# 03 — Komponen, Interaksi, State Machine, Aset

Screenshot referensi: `evidence/screens/` (`d-*` desktop 1440×900, `m-*` mobile 390×844 @2x, semua dengan `?tglocal`).

## 1. Struktur DOM (O)

```
html[data-touch?][data-kb?]  (--tg-top, --tg-h, --tg-flower, --tg-stem, --tg-detail)
└─ body
   ├─ div[data-tg=app]  fixed inset-0, bg=palette.bg, cursor:text, font DM Mono
   │  ├─ canvas (type mode, full-screen, DPR)                 ← SEMUA bunga + huruf
   │  ├─ div[data-tg=peers] aria-hidden, z4                   ← .tg-peer (svg kursor + span nama)
   │  ├─ input[data-tg=input] 1×1px opacity 0, font-size 16px ← sumber keyboard (anti-zoom iOS)
   │  ├─ div[data-tg=modes] pill kanan-atas: [Type][Poster]
   │  ├─ sc-if showTypeHint → div[data-tg=bar] bawah
   │  │   ├─ div[data-tg=hints]: fine|coarse spans + span[data-tg=count] ("N gardeners here")
   │  │   └─ div[data-tg=ctrls]: div[data-tg=pal] (10× button[data-tg=sw] > span[data-tg=dot]) · [PNG] · [SVG]
   │  └─ sc-if isPoster → div[data-tg=poster] grid 2 kolom
   │      ├─ div[data-tg=panel]: "Poster" + infoLabel · WORDS (input + Regrow) · MOTION (7 preset 2-kolom)
   │      │                      · PALETTE (10 kartu 2-kolom) · EXPORT (video primer, PNG frames, status)
   │      └─ div[data-tg=stage] > canvas[data-tg=pcanvas] 1080×1080
   └─ div#tg-copy kiri-atas (disembunyikan saat poster): [Copy code] [☕ Buy me a coffee] .note · .by (credit)
```

## 2. Daftar komponen untuk rebuild

| Komponen | Tipe | Props/State | Catatan |
|---|---|---|---|
| `GardenEngine` | class TS murni (bukan React) | canvas, palette, props {boil, recoil, density} | rAF, input, render, export. Ekspos `subscribe()` untuk UI. |
| `TypeCanvas` | React client | ref canvas + hidden input | mount/unmount engine |
| `ModeToggle` | React | mode | pill segmented 2 tombol |
| `HintBar` | React | palette, gardenersCount, pointer coarse/fine | teks bergantung `(pointer:coarse)` (CSS saja) |
| `PaletteSwatches` | React | palettes, active | 22px dot, ring aktif, `stopPropagation` agar tak memicu focus canvas |
| `ExportButtons` | React | — | PNG / SVG; Ctrl/Cmd+S = PNG, +Shift = SVG |
| `PeerCursors` | DOM imperatif (engine) | peers Map | jangan lewat React (update tiap frame) |
| `PosterPanel` | React | text, seed, preset, palette, busy, status | `onChange` text (bukan per keystroke) |
| `PresetCard` / `PaletteCard` | React | selected | |
| `PosterStage` | React + engine poster renderer | 1080² canvas | |
| `CreditBar` | React | — | ganti "Copy code/coffee" author dengan credit milik sendiri + "inspired by" |

## 3. Model data (O)

```ts
type Letter = {
  ch: string; id: number; birth: number; tb?: number;      // tb = waktu mulai tendril
  ws: number; wi: number; prev?: Letter;                    // word seed, index dalam kata
  els: El[]; endEls?: El[] | null; tend?: Stem[];           // elemen, bunga akhir kata, tendril
  cut?: number | null; dead?: number;                       // waktu space / backspace
  x, y, tx, ty, tw: number; line: number; lean?: [number, number];
};
type El =
  | { t: 'stem'; id; pts: [x,y][]; segs: {u0,u1,layer}[]; d0; dur; w; thorns: {u,s}[] }
  | { t: 'leaf'; id; x; y; a; L; bend; layer; d0 }
  | { t: 'rose'; id; x; y; R; rot; ph1; ph2; turns; layer; d0 };
// koordinat elemen dalam satuan S (ukuran huruf), relatif ke titik baseline-tengah huruf
```

`wordParams(ws)` (seeded per kata): `roseP 0.3–0.6`, `leafy (0.6–1.4)·density`, `lean ±0.3`, `big 0.85–1.3`, `curvy 0.8–1.4`, `bridgeP min(0.95,(0.45–0.8)·density)`.
Tip stem: rose (p=roseP) → fan (0.45) → leaf (0.6) → curl. Huruf pertama kata selalu rose di stem pertama. Cabang depth-1 30%.
`weave()`: 1–3 potongan, layer bergantian 0/1 → stem menganyam di depan/belakang huruf. Rose di atas badan huruf 78% ke belakang (legibility).

## 4. Peta input

| Input | Kondisi | Aksi |
|---|---|---|
| Karakter (keydown `e.key.length===1`) | mode type, tanpa meta/ctrl/alt | `add(ch)` → gen elemen, layout ulang |
| Space | — | huruf terakhir `cut` → `genEnd` (bunga akhir) + tendril recoil; push spasi |
| Backspace | — | huruf terakhir `dead` (wither 260ms); huruf sebelumnya tendril tumbuh lagi |
| Enter | — | hapus semua huruf seketika |
| Ctrl/Cmd+S (+Shift) | — | PNG (SVG) |
| `input` event | HP/IME (keydown tak andal) | `inputDiff`: diff prefix vs mirror (sentinel `​`) → wither + add; composition-aware |
| pointermove | — | `mx,my` → lean huruf & rose; broadcast `p` |
| pointerdown di canvas | type mode | fokus input (mouse) + **spawn butterfly** di titik klik |
| click/tap canvas | touch | fokus input (buka keyboard) |
| double-tap canvas | < 340ms, < 40px, cooldown 1.8s | tanam **rose gift** lokal + broadcast `r` |
| pointerup/cancel (non-mouse) | — | `mx = null` (rose rileks) |
| mouseout ke luar window | — | broadcast `{h:1}` |
| visibilitychange hidden | — | `{h:1}`, tutup realtime 60s kemudian |
| visualViewport resize/scroll | touch | set `--tg-top/--tg-h`, deteksi keyboard (>120px), blur jika keyboard ditutup |
| Enter/Space di tombol Copy/Coffee | — | `stopPropagation` (tak boleh clear/cut taman) |

## 5. State machine

### 5.1 App mode
```
            pick Poster (text := liveText || text)        
  ┌──────┐ ─────────────────────────────────────────▶ ┌────────┐
  │ type │                                             │ poster │──┐ upd(text|seed|preset) → buildPoster()
  └──────┘ ◀───────────────────────────────────────── └────────┘◀─┘
     ▲  pick Type → resize() + focus input                │ exportVideo/exportFrames
     │                                                    ▼
     │                                              ┌───────────┐ progress setState tiap 15/10 frame
     │                                              │ busy      │────▶ status "Saved …"  → poster
                                                    └───────────┘
```
rAF loop sama untuk dua mode; poster draw di-skip saat `busy` (export menggambar ke canvas offscreen sendiri).

### 5.2 Siklus hidup huruf
```
 add ──▶ GROWING ──(age > d0+dur semua)──▶ GROWN ──space──▶ CUT (endEls mekar, tendril recoil)
            │                                │                 │
            └────────── backspace ───────────┴─────────────────┴──▶ WITHERING (260ms) ──▶ removed (300ms)
 enter: semua → removed (instan, tanpa animasi)
 backspace pada huruf setelah CUT: huruf sebelumnya cut=null, tb=now → tendril tumbuh lagi
```

### 5.3 Realtime
```
 idle ─1.2s─▶ loading-lib ─onload─▶ subscribing ─SUBSCRIBED─▶ live (track {n,c})
   ▲               │onerror               │CHANNEL_ERROR/TIMED_OUT → presence {} (sendiri)
   │               ▼                      ▼
   └──── visible ◀── closed ◀─60s─ hidden (kirim {h:1})
 ?tglocal → local (BroadcastChannel, heartbeat 1s, roster expiry 3.5s)
```

### 5.4 Peer cursor
`unseen → visible(op 1, idle<8s) → dim(op .35, <45s) → hidden(op 0)`; `h:1` → hidden; hilang dari presence → `peerDrop` (DOM dihapus).

### 5.5 Butterfly
`fly(→perch) → sit(burst kepak periodik) → leave` · `wander(3.5s) → leave` · perch hilang → `leave` · >6 → yang tertua `leave` · keluar layar → dibuang.

### 5.6 Rose gift
`planted(t0) → blooming (spr kelopak) → idle → fading(last 2.2s: alpha↓, turun 0.3S, menyusut) → removed (60s)`.

### 5.7 Copy code / Coffee (chrome)
Copy: `idle → copied|failed (note 2.8s) → idle`, fallback `navigator.clipboard → ClipboardItem(promise) → execCommand`.
Coffee: `rest ⇄ on (hover/focus-visible; touch: auto 1.2s)`, `down` saat ditekan.

## 6. Daftar aset

| Aset | Ukuran | Sumber | Rebuild |
|---|---|---|---|
| DM Mono 400/500 latin + latin-ext (4 woff2) | 5.7–8.7 KB | Google Fonts (OFL) | `next/font/google` |
| Playfair Display 700 (cyrillic, vietnamese, latin-ext, latin) | 5.7–23 KB | Google Fonts (OFL) | `next/font/google` (jadi font utama) |
| GT Ultra OTF subset | 24 KB | **komersial** | ❌ jangan dipakai |
| `glyphs.json` (2 face, upm 1000, 271 + 312 glyph: `[advance, "M L C Q Z" path y-up]`) | 289 KB | turunan GT Ultra + fallback | ✅ generate ulang dari Playfair via fonttools |
| `vendor-supabase.js` (supabase-js 2.117.2 UMD) | 218 KB | npm | `@supabase/supabase-js` dynamic import |
| `og.png` 1200×630 | 177 KB | author | buat baru |
| `favicon.svg` (553 B), `favicon.ico` 32px, `apple-touch-icon.png` | — | author | buat baru (motif mawar + stem) |
| Thumbnail SVG loading (path stem `#3257FF`) | inline | author | opsional |
| Ikon kursor peer (SVG path 18×20) | inline | author | gambar sendiri / pakai bentuk panah generik |
| Ikon coffee-planter (SVG animasi) | inline | author | tidak dipakai (branding author) |
| **Semua bunga/daun/kupu-kupu** | procedural | kode | port algoritma |

Tidak ada gambar raster dalam app; semua visual taman procedural.
