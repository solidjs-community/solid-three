import { playwright } from "@vitest/browser-playwright"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solid({ hot: false })],
  optimizeDeps: {
    // Pre-bundle the harness deps plus solid-three's transitive runtime deps,
    // otherwise Vite discovers them mid-run and reloads the test (flaky).
    include: [
      "@solidjs/testing-library",
      "three",
      "solid-three",
      "@solid-primitives/resize-observer",
      "@bigmistqke/solid-whenever",
    ],
  },
  test: {
    globalSetup: ["./test/oracle/global-setup.ts"],
    include: ["test/oracle/**/*.test.tsx"],
    // `vite-plugin-solid` defaults `test.environment` to `'jsdom'` when unset,
    // which makes vitest exit 1 because jsdom isn't installed. Pin "node" so the
    // Solid plugin keeps its hands off the field — DOM work happens in the real
    // browser via the `browser` block below.
    environment: "node",
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
