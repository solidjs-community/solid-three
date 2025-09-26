import { solidPlugin } from "esbuild-plugin-solid"
import { defineConfig, type Options } from "tsup"

type Entry = { readonly entry: string; readonly name: string }
type Variation = { readonly dev: boolean; readonly solid: boolean }

export default defineConfig(config => {
  const watching = !!config.watch

  const packageEntries: Entry[] = [
    { entry: "src/index.ts", name: "index" },
    { entry: "src/testing/index.tsx", name: "testing" },
  ]

  return packageEntries.flatMap(({ entry, name }, i) => {
    const packageEntries: Variation[] = [
      { dev: false, solid: false },
      { dev: true, solid: false },
      { dev: true, solid: true },
    ]

    return packageEntries.flatMap(({ dev, solid }, j) => {
      const outFilename = `${name}${dev ? ".dev" : ""}${solid ? ".solid" : ""}`

      return {
        watch: watching,
        target: "esnext",
        format: "esm",
        clean: i === 0,
        dts: j === 0,
        entry: { [outFilename]: entry },
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
})
