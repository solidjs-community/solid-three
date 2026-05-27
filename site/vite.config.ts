import { importChunkUrl } from "@lightningjs/vite-plugin-import-chunk-url"
import { createSolidBase, defineTheme } from "@kobalte/solidbase/config"
import defaultTheme from "@kobalte/solidbase/default-theme"
import { solidStart } from "@solidjs/start/config"
import { nitroV2Plugin } from "@solidjs/vite-plugin-nitro-2"
import { defineConfig } from "vite"

import { solidThreeBundlePlugin } from "./vite-plugins/solid-three-bundle"
import { solidbaseJsxFallback } from "./vite-plugins/solidbase-jsx-fallback"

const theme = defineTheme({
  componentsPath: new URL("./src/theme/", import.meta.url).href,
  extends: defaultTheme,
})

const solidBase = createSolidBase(theme)

export default defineConfig({
  resolve: {
    dedupe: ["@solidjs/start", "@kobalte/solidbase"],
  },
  plugins: [
    { ...importChunkUrl(), applyToEnvironment: (env) => env.name === "client" },
    {
      name: "importChunkUrl-ssr-stub",
      applyToEnvironment: (env) => env.name !== "client",
      resolveId(id) {
        if (id.endsWith("?importChunkUrl")) return id
      },
      load(id) {
        if (id.endsWith("?importChunkUrl")) return `export default ""`
      },
    },
    solidbaseJsxFallback(),
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
              { title: "Let's build Tetris!", link: "/tutorial/08-tetris" },
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
    solidStart(solidBase.startConfig()),
    nitroV2Plugin({
      preset: "static",
      prerender: {
        crawlLinks: true,
        routes: ["/"],
        failOnError: true,
      },
    }),
  ],
})
