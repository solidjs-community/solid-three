import { resolve } from "node:path"

import { build } from "esbuild"
import { solidPlugin as esbuildSolidPlugin } from "esbuild-plugin-solid"
import type { Plugin } from "vite"

import { BASE } from "../base.config"

/**
 * Entry of the local solid-three source. Resolved from `process.cwd()`
 * (the `site/` directory) so the path stays correct after vinxi bundles
 * the config — `import.meta.url`-based resolution does not survive that.
 */
const SOLID_THREE_ENTRY = resolve(process.cwd(), "../src/index.ts")
const SOLID_THREE_VIRTUAL_PATH = "/@tutorial/solid-three.js"

/**
 * Serve a single-file ESM bundle of the local solid-three at a virtual
 * route. solid-js / solid-js/web / solid-js/store / three are kept external
 * so the iframe's import map can pin them to esm.sh and all modules share
 * the same singletons.
 */
export function solidThreeBundlePlugin(): Plugin {
  const externals = ["solid-js", "solid-js/web", "solid-js/store", "three"]

  async function bundle(): Promise<string> {
    const result = await build({
      entryPoints: [SOLID_THREE_ENTRY],
      bundle: true,
      format: "esm",
      target: "esnext",
      platform: "browser",
      write: false,
      external: externals,
      plugins: [esbuildSolidPlugin()],
      define: {
        "process.env.NODE_ENV": `"development"`,
        "process.env.PROD": "false",
        "process.env.DEV": "true",
        "import.meta.env.NODE_ENV": `"development"`,
        "import.meta.env.PROD": "false",
        "import.meta.env.DEV": "true",
        // Snippets run here (the editor's blob iframe) as well as on the main
        // page; Vite defines BASE_URL there but esbuild must define it here so
        // base-relative asset URLs (e.g. the hero font) resolve under the base.
        "import.meta.env.BASE_URL": JSON.stringify(BASE),
      },
      logLevel: "warning",
    })
    const output = result.outputFiles[0]
    if (!output) throw new Error("esbuild produced no output")
    return output.text
  }

  return {
    name: "tutorial:solid-three-bundle",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const url = req.url.split("?")[0]
        if (url !== SOLID_THREE_VIRTUAL_PATH) return next()
        try {
          const code = await bundle()
          res.setHeader("Content-Type", "application/javascript")
          res.setHeader("Cache-Control", "no-store")
          res.end(code)
        } catch (error) {
          res.statusCode = 500
          res.setHeader("Content-Type", "text/plain")
          res.end(String(error))
        }
      })
    },
    async generateBundle() {
      const code = await bundle()
      this.emitFile({
        type: "asset",
        fileName: "@tutorial/solid-three.js",
        source: code,
      })
    },
  }
}
