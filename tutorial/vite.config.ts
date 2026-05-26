import mdx from "@mdx-js/rollup"
import { build } from "esbuild"
import { solidPlugin as esbuildSolidPlugin } from "esbuild-plugin-solid"
import { defineConfig, type Plugin } from "vite"
import solid from "vite-plugin-solid"
import tsconfig from "vite-tsconfig-paths"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"

const SOLID_THREE_ENTRY = new URL("../src/index.ts", import.meta.url).pathname
const SOLID_THREE_VIRTUAL_PATH = "/@tutorial/solid-three.js"

/**
 * Serve a single-file ESM bundle of the local solid-three at a virtual
 * route. solid-js / solid-js/web / solid-js/store / three are kept external
 * so the iframe's import map can pin them to esm.sh and all modules share
 * the same singletons.
 */
function solidThreeBundlePlugin(): Plugin {
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

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "solid-three": SOLID_THREE_ENTRY,
    },
  },
  plugins: [
    solidThreeBundlePlugin(),
    tsconfig(),
    {
      enforce: "pre",
      ...mdx({
        jsxImportSource: "solid-js",
        providerImportSource: "solid-mdx",
        remarkPlugins: [
          remarkFrontmatter,
          [remarkMdxFrontmatter, { name: "frontmatter" }],
        ],
      }),
    },
    solid({ extensions: [".mdx"] }),
  ],
})
