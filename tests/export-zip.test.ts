import { describe, test, expect } from "vitest";
import { crc32, zip } from "@/lib/garden/export-zip";

const enc = (s: string) => new TextEncoder().encode(s);

describe("export-zip.crc32 (known vectors)", () => {
  test('crc32("123456789") = 0xCBF43926', () => {
    expect(crc32(enc("123456789")) >>> 0).toBe(0xcbf43926);
  });

  test('crc32("The quick brown fox jumps over the lazy dog") = 0x414FA339', () => {
    expect(crc32(enc("The quick brown fox jumps over the lazy dog")) >>> 0).toBe(0x414fa339);
  });

  test("crc32 string kosong = 0", () => {
    expect(crc32(new Uint8Array(0)) >>> 0).toBe(0);
  });
});

describe("export-zip.zip (STORE)", () => {
  test("header lokal + EOCD signature benar", () => {
    const out = zip([{ name: "a.txt", data: enc("hello") }]);
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    // local file header sig
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    // metode STORE (0)
    expect(dv.getUint16(8, true)).toBe(0);
    // CRC32 field = crc("hello")
    expect(dv.getUint32(14, true) >>> 0).toBe(crc32(enc("hello")) >>> 0);
    // EOCD sig di 22 byte terakhir
    const eocd = out.byteLength - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    // jumlah entri = 1
    expect(dv.getUint16(eocd + 8, true)).toBe(1);
    expect(dv.getUint16(eocd + 10, true)).toBe(1);
  });

  test("dua file: ukuran stored == data mentah (tanpa kompresi)", () => {
    const f1 = enc("frame-one");
    const f2 = enc("frame-two-longer");
    const out = zip([
      { name: "frame_0001.png", data: f1 },
      { name: "frame_0002.png", data: f2 },
    ]);
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    const eocd = out.byteLength - 22;
    expect(dv.getUint16(eocd + 8, true)).toBe(2);
    // compressed size == uncompressed size untuk file pertama
    expect(dv.getUint32(18, true)).toBe(f1.length);
    expect(dv.getUint32(22, true)).toBe(f1.length);
  });
});
