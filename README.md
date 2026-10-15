# RE: Type Garden

Ketik, dan batang + mawar tumbuh dari huruf. Space memotong batang, backspace melayukan, enter membersihkan.
Mode **Poster** merekam loop 1080×1080 (7 preset, 10 palet) sebagai MP4/WebM atau PNG frames (.zip).

> **Pernyataan jujur.** Ini hasil *reverse engineering* untuk portfolio pribadi — bukan karya orisinal.
> Karya asli: **Type Garden** oleh **Akshat Agarwal** ([x.com/art_akshat](https://x.com/art_akshat)),
> <https://type-garden.vercel.app>. Algoritma, angka, dan timing di sini diport dari source yang dipublikasikan
> author; aset komersial (font GT Ultra, `glyphs.json` turunannya) dan kunci Supabase author **tidak** dipakai.
> Rebuild oleh **Rayina Ilham**. Tidak untuk dipakai komersial tanpa izin tertulis author.

## Jalankan

Path project mengandung `:` → shim `.bin` (`next`, `vitest`) rusak. **Selalu lewat npm script.**

```bash
npm install
npm run dev            # http://localhost:3000   (tambah ?tglocal untuk multiplayer antar-tab)
npm run build && npm start
```

## Uji

| Perintah | Isi |
|---|---|
| `npm test` | vitest: math, layout, growth, engine util, input, fauna, poster, export, live, kontras |
| `npm run test:e2e:type` | type mode: ketik/backspace/enter, mobile `inputDiff`, reduced motion, kupu-kupu, gift |
| `npm run test:e2e:poster` | alur poster di UI |
| `npm run test:e2e:export` | PNG/SVG/zip/video benar-benar dibuka & diverifikasi (xmllint, unzip, ffprobe) |
| `npm run test:e2e:live` | dua tab `?tglocal`: kursor, gift, hidden tab, roster, payload jahat |
| `npm run test:parity` | **oracle**: render source asli vs rebuild, 49 frame poster, selisih piksel (internal) |
| `npm run qa:sweep` | engine × viewport × skenario (`ENGINES=chromium,firefox,webkit`) |
| `npm run audit:leak` | audit kebocoran aset/kunci + uji gigit |

`E2E_ENGINE=firefox|webkit` memilih engine untuk spec e2e. Butuh `npm run build` lebih dulu.
Playwright memakai browser bersama di `~/.cache/ms-playwright` (lihat skill `arch-playwright-provision`).

## Struktur

```
lib/garden/   math · geometry · layout · growth · draw · render   (port 1:1, TS murni)
              engine (TypeState + GardenEngine) · input · fauna · poster · export · export-poster · live
components/garden/   chrome React (tidak ada setState per frame)
tools/        gen-glyphs.py (Playfair → public/glyphs.json) · gen-brand.mjs · leak-audit.mjs
tests/        unit (vitest) · e2e/ · parity/
artifacts/doc dokumen RE (arsitektur, token, komponen, rencana, bukti)
```

## Keputusan & deviasi

Lihat [`DECISIONS.md`](DECISIONS.md). Ringkas: font **Playfair Display** (OFL) + **DM Mono**; live hanya
`?tglocal` (BroadcastChannel) — Supabase remote **tidak aktif** sampai ada project + env milik pemilik;
**tanpa deploy**.

## Lisensi & kredit

- Kode rebuild: © Rayina Ilham (portfolio, non-komersial).
- Desain/algoritma asli: Akshat Agarwal. Font Playfair Display & DM Mono: SIL OFL 1.1 (`tools/fonts/OFL.txt`).
