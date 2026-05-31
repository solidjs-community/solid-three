import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/oracle/**"],
    environment: "node",
    // ts-morph builds a full language service per fixture; running many in
    // parallel starves CPU and trips the per-test timeout. Serialize files.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
