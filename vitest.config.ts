import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Engine core (lib/garden) adalah TS murni; test jalan di environment node.
// Catatan: path project mengandung ":" sehingga shim `vitest` di PATH gagal —
// jalankan lewat `npm test` (memanggil node ./node_modules/vitest/vitest.mjs).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
