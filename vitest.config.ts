import { playwright } from "@vitest/browser-playwright"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solidPlugin({ hot: false })],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // `vite-plugin-solid` defaults `test.environment` to `'jsdom'` whenever
    // the user doesn't set one, which makes vitest exit 1 because jsdom
    // isn't installed. Set "node" explicitly so the Solid plugin keeps
    // its hands off the env field — actual DOM work happens in the real
    // browser via the `browser` block below.
    environment: "node",
    // Real WebGL contexts are GPU-process-limited (~16 concurrent in Chromium).
    // Running test files in parallel exhausts the cap and hangs the browser.
    fileParallelism: false,
    browser: {
      enabled: true,
      // SwiftShader = software WebGL. Avoids Chromium's tight
      // GPU-process-backed concurrent-context cap (~16) which renderer-heavy
      // suites blow past mid-run. Slower per render but unbounded contexts.
      provider: playwright({
        launchOptions: {
          args: [
            "--use-gl=swiftshader",
            "--enable-unsafe-swiftshader",
            "--enable-features=Vulkan",
          ],
        },
      }),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
})
