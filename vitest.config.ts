import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // Monte Carlo and exhaustive-oracle tests are CPU-bound; the 5 s default is too tight under parallel load.
    testTimeout: 30_000,
  },
});
