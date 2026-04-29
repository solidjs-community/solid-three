import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  mode: "development",
  plugins: [solidPlugin({ dev: true })],
  resolve: {
    conditions: ["development", "browser", "module", "import"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
  },
})
