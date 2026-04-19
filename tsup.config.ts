import { defineConfig, type Options } from "tsup"
import { transformAsync } from "@babel/core"
import solid from "babel-preset-solid"
import ts from "@babel/preset-typescript"
import { readFile } from "node:fs/promises"
import { parse } from "node:path"

function solidPlugin() {
  return {
    name: "esbuild:solid",
    setup(build: any) {
      build.onLoad({ filter: /\.(t|j)sx$/ }, async (args: any) => {
        const source = await readFile(args.path, { encoding: "utf-8" })
        const { name, ext } = parse(args.path)
        const result = await transformAsync(source, {
          presets: [[solid, {}], [ts, {}]],
          filename: name + ext,
          sourceMaps: "inline",
        })
        return { contents: result!.code!, loader: "js" }
      })
    },
  }
}

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
        external: ["solid-js", "@solidjs/signals", "@solidjs/web", "three"],
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
