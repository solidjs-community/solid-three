import { existsSync } from "node:fs"

import { createSolidBase, defineTheme } from "@kobalte/solidbase/config"
import defaultTheme from "@kobalte/solidbase/default-theme"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import { defineConfig, type Plugin } from "vite"

/**
 * SolidBase 0.6.3 publishes some compiled files (notably
 * `dist/client/index.jsx`) under a `.jsx` extension while sibling modules
 * import them as `.js`. Vite's exact-match resolver refuses to bridge the
 * mismatch, so we rewrite the `.js` request to `.jsx` whenever the latter
 * exists on disk and the former does not. Scoped to the solidbase install to
 * avoid masking real missing-file errors elsewhere.
 */
function solidBaseJsxFallbackPlugin(): Plugin {
  return {
    name: "tutorial:solidbase-jsx-fallback",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!importer || !importer.includes("@kobalte/solidbase")) return null
      if (!source.endsWith(".js")) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (resolved && existsSync(resolved.id)) return null
      const jsxCandidate = source.replace(/\.js$/, ".jsx")
      const resolvedJsx = await this.resolve(jsxCandidate, importer, {
        skipSelf: true,
      })
      if (resolvedJsx && existsSync(resolvedJsx.id)) return resolvedJsx
      return null
    },
  }
}

import { solidThreeBundlePlugin } from "./vite-plugins/solid-three-bundle"

/**
 * solid-three tutorial site.
 *
 * NOTE: SolidBase 0.6.x targets SolidStart v2, which is vite-native (no more
 * `app.config.ts` / vinxi). The site is configured with a plain Vite config
 * + `solidStart()` plugin + `nitro/vite`, matching the SolidBase docs site.
 */

const theme = defineTheme({
  componentsPath: new URL("./src/theme/", import.meta.url).href,
  extends: defaultTheme,
})

const solidBase = createSolidBase(theme)

export default defineConfig({
  // SolidBase 0.6.3's published dist references sibling source files via the
  // `.js` extension even when only `.jsx` exists on disk (e.g. Layout.jsx →
  // `../client/index.js`). Map `.js` to `.jsx` so vite can resolve them.
  resolve: {
    extensionAlias: {
      ".js": [".js", ".jsx", ".ts", ".tsx"],
    },
  },
  ssr: {
    noExternal: ["@kobalte/solidbase"],
  },
  plugins: [
    solidBaseJsxFallbackPlugin(),
    solidThreeBundlePlugin(),
    solidBase.plugin({
      title: "solid-three",
      description: "A SolidJS renderer for three.js — learn by reading.",
      lang: "en",
      themeConfig: {
        socialLinks: {
          github: "https://github.com/solidjs-community/solid-three",
        },
        sidebar: [
          {
            title: "Part I — Foundations",
            collapsed: false,
            items: [
              { title: "Hello, Canvas", link: "/01-hello-canvas" },
              { title: "The T proxy", link: "/02-t-proxy" },
            ],
          },
          {
            title: "Part II — Reactivity",
            collapsed: true,
            items: [],
          },
          {
            title: "Part III — Beyond primitives",
            collapsed: true,
            items: [],
          },
          {
            title: "Part IV — Interaction",
            collapsed: true,
            items: [],
          },
          {
            title: "Part V — Composition",
            collapsed: true,
            items: [],
          },
          {
            title: "Part VI — Putting it together",
            collapsed: true,
            items: [],
          },
        ],
      },
    }),
    solidStart(solidBase.startConfig()),
    nitro({
      preset: "node-server",
    }),
  ],
})
