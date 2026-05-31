import { playwright } from "@vitest/browser-playwright"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solid({ hot: false })],
  // Pre-bundle these so vitest doesn't re-optimize mid-run (which reloads the
  // test and can cause flaky/duplicated runs).
  optimizeDeps: {
    include: ["@solidjs/testing-library", "three"],
  },
  test: {
    include: ["test/oracle/**/*.test.tsx"],
    environment: "node",
    globalSetup: ["./test/oracle/global-setup.ts"],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
        },
      }),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
})
