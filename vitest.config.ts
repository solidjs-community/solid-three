import { playwright } from "@vitest/browser-playwright"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

/**
 * Two projects:
 * - `browser` — full `tests/` suite in real Chromium (catches DOM-timing /
 *   Solid-compile bugs that jsdom hides).
 * - `jsdom` — a tiny contract suite for `src/testing/`, the public jsdom API
 *   external consumers depend on. Keeps that code path from bitrotting.
 *
 * `pnpm test` runs both.
 */
export default defineConfig({
  plugins: [solidPlugin({ hot: false })],
  test: {
    projects: [
      {
        plugins: [solidPlugin({ hot: false })],
        test: {
          name: "browser",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/jsdom/**"],
          setupFiles: ["./tests/setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        plugins: [solidPlugin({ hot: false })],
        test: {
          name: "jsdom",
          include: ["tests/jsdom/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
        },
      },
    ],
  },
})
