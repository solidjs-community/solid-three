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
            title: "Part 1 — It's just Solid",
            collapsed: false,
            items: [
              { title: "Your first scene", link: "/01-your-first-scene" },
              { title: "Nesting & transforms", link: "/02-nesting-and-transforms" },
              { title: "Smart props", link: "/03-smart-props" },
            ],
          },
          {
            title: "Part 2 — The scene talks back",
            collapsed: true,
            items: [
              { title: "Signals drive the scene", link: "/04-signals-drive-the-scene" },
              { title: "Pointer events", link: "/05-pointer-events" },
              { title: "Stopping events", link: "/06-event-propagation" },
              { title: "Configuring the raycaster", link: "/07-raycaster" },
            ],
          },
          {
            title: "Part 3 — Frame by frame",
            collapsed: true,
            items: [
              { title: "useFrame", link: "/08-use-frame" },
              { title: "useThree", link: "/09-use-three" },
            ],
          },
          {
            title: "Part 4 — Stuff that's not in the scene",
            collapsed: true,
            items: [
              { title: "Loaders & Resource", link: "/10-loaders-and-resource" },
              { title: "autodispose & meta", link: "/11-autodispose-and-meta" },
            ],
          },
          {
            title: "Part 5 — Compose your own",
            collapsed: true,
            items: [
              { title: "Portal", link: "/12-portal" },
              { title: "useProps & custom components", link: "/13-use-props" },
            ],
          },
          {
            title: "Part 6 — Ship something real",
            collapsed: true,
            items: [
              { title: "An interactive scene", link: "/14-interactive-scene" },
            ],
          },
          {
            title: "Encore",
            collapsed: true,
            items: [
              { title: "A peek at WebGPU", link: "/15-webgpu-peek" },
            ],
          },
        ],
      },
    }),
    solidStart({ ...solidBase.startConfig(), ssr: false }),
    nitro({
      preset: "static",
    }),
  ],
})
