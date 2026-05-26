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
  resolve: {
    extensionAlias: {
      ".js": [".js", ".jsx", ".ts", ".tsx"],
    },
  },
  ssr: {
    noExternal: ["@kobalte/solidbase", "tm-textarea"],
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
            title: "Tutorial",
            collapsed: false,
            items: [
              { title: "Your first scene", link: "/tutorial/01-your-first-scene" },
              { title: "Props and children", link: "/tutorial/02-props-and-children" },
              { title: "Control flow", link: "/tutorial/03-control-flow" },
              { title: "Pointer events", link: "/tutorial/04-pointer-events" },
              { title: "useFrame", link: "/tutorial/05-use-frame" },
              { title: "Loaders & Resource", link: "/tutorial/06-loaders-and-resource" },
              { title: "Portal", link: "/tutorial/07-portal" },
              { title: "A small game", link: "/tutorial/08-interactive-scene" },
              { title: "A peek at WebGPU", link: "/tutorial/09-webgpu-peek" },
            ],
          },
          {
            title: "API reference",
            collapsed: false,
            items: [
              { title: "Introduction", link: "/api" },
              {
                title: "Components",
                collapsed: true,
                items: [
                  { title: "Canvas", link: "/api/components/canvas" },
                  { title: "Entity", link: "/api/components/entity" },
                  { title: "T / createT", link: "/api/components/t" },
                  { title: "Portal", link: "/api/components/portal" },
                  { title: "Resource", link: "/api/components/resource" },
                ],
              },
              {
                title: "Hooks",
                collapsed: true,
                items: [
                  { title: "useThree", link: "/api/hooks/use-three" },
                  { title: "useFrame", link: "/api/hooks/use-frame" },
                  { title: "useLoader", link: "/api/hooks/use-loader" },
                  { title: "useProps", link: "/api/hooks/use-props" },
                ],
              },
              {
                title: "Utilities",
                collapsed: true,
                items: [
                  { title: "Raycasters", link: "/api/utilities/raycasters" },
                  { title: "LoaderCache", link: "/api/utilities/loader-cache" },
                  { title: "autodispose", link: "/api/utilities/autodispose" },
                  { title: "Metadata", link: "/api/utilities/metadata" },
                  { title: "Testing", link: "/api/utilities/testing" },
                ],
              },
              {
                title: "Events",
                collapsed: true,
                items: [
                  { title: "Overview", link: "/api/events/overview" },
                  { title: "raycastable", link: "/api/events/raycastable" },
                ],
              },
            ],
          },
        ],
      },
    }),
    solidStart({
      ...solidBase.startConfig(),
      ssr: false,
      // Solid Start's dev-overlay (`DevOverlayDialog.jsx`) uses the
      // `import attributes` syntax (`with { type: "json" }`), which the
      // bundled @babel/parser doesn't recognise unless this plugin is
      // wired in. Without it, any page-level error gets masked by the
      // overlay's own parse failure.
      solid: {
        babel: {
          plugins: ["@babel/plugin-syntax-import-attributes"],
        },
      },
    }),
    nitro({
      preset: "static",
    }),
  ],
})
