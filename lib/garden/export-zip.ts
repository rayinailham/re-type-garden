// ZIP STORE (tanpa kompresi) + CRC32. Port 1:1 dari zip() di original-source.txt.
// Dipakai export PNG frames (Fase 5); CRC32 known-vector diuji di Fase 1.

/** File untuk di-zip. */
export type ZipFile = { name: string; data: Uint8Array };

let crcTable: Uint32Array | null = null;

/** Tabel CRC32 (poly 0xEDB88320), lazy. */
function table(): Uint32Array {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (crcTable = t);
}

/** CRC32 dari byte array. */
export function crc32(d: Uint8Array): number {
  const t = table();
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = t[(c ^ d[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Rakit arsip ZIP (metode STORE) 1:1 dengan source.
 * Local header sig 0x04034b50, central 0x02014b50, EOCD 0x06054b50.
 */
export function zip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name),
      cr = crc32(f.data),
      sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(8, 0, true);
    h.setUint16(12, 33, true);
    h.setUint32(14, cr, true);
    h.setUint32(18, sz, true);
    h.setUint32(22, sz, true);
    h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, cr, true);
    c.setUint32(20, sz, true);
    c.setUint32(24, sz, true);
    c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const cs = cen.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cs, true);
  e.setUint32(16, off, true);
  // gabungkan semua potongan
  const all = [...parts, ...cen, new Uint8Array(e.buffer)];
  const total = all.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of all) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
