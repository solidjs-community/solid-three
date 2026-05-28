import { playwright } from "@vitest/browser-playwright"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  mode: "development",
  plugins: [solidPlugin({ dev: true })],
  resolve: {
    conditions: ["development", "browser", "module", "import"],
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    // Real WebGL contexts are GPU-process-limited (~16 concurrent in Chromium).
    // Running test files in parallel exhausts the cap and hangs the browser.
    fileParallelism: false,
    browser: {
      enabled: true,
      // SwiftShader = software WebGL. Avoids Chromium's tight GPU-process-backed
      // concurrent-context cap (~16) which recreate-renderer tests blow past
      // mid-run. Slower per render but unbounded contexts.
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
