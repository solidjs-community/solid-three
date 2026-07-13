import { playwright } from "@vitest/browser-playwright"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

/**
 * The packaging-boundary suite: `tests/published`, run against the BUILT package.
 *
 * Separate from `vitest.config.ts` — which owns every other suite — because these two
 * configs deliberately disagree about what `solid-three` means. Everything else imports
 * `src/` directly and needs no resolution at all; `tests/published` imports the bare
 * specifiers `solid-three` and `solid-three/events` and must resolve them through the
 * `exports` map onto `dist/`, exactly as a dependent does. So: no path aliases here, and
 * nothing that would quietly redirect those specifiers back to source. `tests/published`
 * is excluded from the main config for the same reason.
 *
 * (The suite is not called `tests/dist`, which is what it tests, because the root
 * `.gitignore` ignores `dist` at any depth — the files would never have been committed.)
 *
 * It needs `pnpm build` to have run first. Use `pnpm test:published`, which builds.
 */
export default defineConfig({
  // Compiles the JSX in `dist/*.solid.jsx` — the whole point of the `solid` export
  // condition is that the CONSUMER's Solid compiler does this, so a consumer-shaped test
  // has to do it too.
  plugins: [solidPlugin({ hot: false })],
  test: {
    include: ["tests/published/**/*.test.{ts,tsx}"],
    // No `setupFiles`: the shared setup imports from `src/`, which would pull a second
    // copy of the library into this suite's module graph — the very thing under test.
    environment: "node",
    // Real WebGL contexts are GPU-process-limited; see `vitest.config.ts`.
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--enable-features=Vulkan"],
        },
      }),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
})
