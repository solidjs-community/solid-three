import { playwright } from "@vitest/browser-playwright"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solidPlugin({ hot: false })],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // Real WebGL contexts are GPU-process-limited (~16 concurrent in Chromium).
    // Running test files in parallel exhausts the cap and hangs the browser.
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: "chromium",
          // SwiftShader = software WebGL. Avoids Chromium's tight
          // GPU-process-backed concurrent-context cap (~16) which our
          // recreate-renderer tests blow past mid-run. Slower per render but
          // unbounded contexts.
          launch: {
            args: [
              "--use-gl=swiftshader",
              "--enable-unsafe-swiftshader",
              "--enable-features=Vulkan",
            ],
          },
        },
      ],
    },
  },
})
