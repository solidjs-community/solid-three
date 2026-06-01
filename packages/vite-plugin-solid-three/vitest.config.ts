import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/oracle/**"],
    environment: "node",
    // real vite builds in fixtures are heavy; serialize and give headroom.
    fileParallelism: false,
    testTimeout: 60_000,
  },
})
