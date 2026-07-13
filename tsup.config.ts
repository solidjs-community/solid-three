import { solidPlugin } from "esbuild-plugin-solid"
import { defineConfig, type Options } from "tsup"

type Variation = { readonly dev: boolean; readonly solid: boolean }

/**
 * One build PER VARIATION, with all three entry points in it — not one build per
 * (entry point × variation).
 *
 * The three entry points share core modules (`constants.ts`, `utils.ts`, `plugin.ts`,
 * …). Building each one on its own made every bundle carry a PRIVATE COPY of that
 * shared code, and a copied module means copied module-level STATE: a second
 * `Symbol("solid-three")` for `$S3C`, a second `engines` WeakMap, a second loader
 * cache. Core's `meta()` (from `dist/index.js`) then branded objects with copy A's
 * `$S3C` while the engine's `getMeta()` (from `dist/events.js`) looked up copy B's —
 * read `undefined`, never registered the object, and pointer events silently never
 * fired for anyone consuming the PUBLISHED package. (The repo's own suites import from
 * `src/`, a single module graph, so they could not see it.
 * `tests/published/consumer.test.tsx` is the one that can: it resolves through the
 * `exports` map onto these files.)
 *
 * Putting all three entry points in one build lets esbuild's code splitting hoist what
 * they share into a chunk that each of them IMPORTS, so there is exactly one copy of
 * every core module at runtime. Each variation is its own build (so its own chunks),
 * which is correct: a consumer resolves every subpath under the same conditions, so it
 * only ever loads entry points from one variation.
 *
 * This mirrors the fix already made for the declarations — see `tsconfig.build.json`,
 * where one `tsc` pass over the whole source tree replaced tsup's per-entry `dts`
 * rollup for exactly the same reason (a private `$S3C` per bundle). That is also why
 * there is still no `dts` option here.
 */
export default defineConfig(config => {
  const watching = !!config.watch

  const variations: Variation[] = [
    { dev: false, solid: false },
    { dev: true, solid: false },
    { dev: true, solid: true },
  ]

  return variations.map(({ dev, solid }, index) => {
    const suffix = `${dev ? ".dev" : ""}${solid ? ".solid" : ""}`

    return {
      watch: watching,
      target: "esnext",
      format: "esm",
      clean: index === 0,
      entry: {
        [`index${suffix}`]: "src/index.ts",
        [`events${suffix}`]: "src/events/index.ts",
        [`testing${suffix}`]: "src/testing/index.tsx",
      },
      // The load-bearing option: without it esbuild inlines the shared core into each
      // entry point instead of emitting it once as an imported chunk.
      splitting: true,
      treeshake: watching ? undefined : { preset: "safest" },
      replaceNodeEnv: true,
      esbuildOptions(options) {
        options.define = {
          ...options.define,
          "process.env.NODE_ENV": dev ? `"development"` : `"production"`,
          "process.env.PROD": dev ? "false" : "true",
          "process.env.DEV": dev ? "true" : "false",
          "import.meta.env.NODE_ENV": dev ? `"development"` : `"production"`,
          "import.meta.env.PROD": dev ? "false" : "true",
          "import.meta.env.DEV": dev ? "true" : "false",
        }
        options.jsx = "preserve"
        // All variations emit into the same `dist`, so name the shared chunks per
        // variation. Content hashes alone would already keep them apart, but this keeps
        // it obvious which chunk belongs to which set of entry points.
        options.chunkNames = `chunk${suffix}-[hash]`

        if (!dev) options.drop = ["console", "debugger"]

        return options
      },
      outExtension: ({ format }) => {
        if (format === "esm" && solid) return { js: ".jsx" }
        return {}
      },
      esbuildPlugins: !solid ? [solidPlugin() as any] : undefined,
    } satisfies Options
  })
})
