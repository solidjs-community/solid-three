import { createSolidBase, defineTheme } from "@kobalte/solidbase/config"
import defaultTheme from "@kobalte/solidbase/default-theme"
import { importChunkUrl } from "@lightningjs/vite-plugin-import-chunk-url"
import { solidStart } from "@solidjs/start/config"
import { nitroV2Plugin } from "@solidjs/vite-plugin-nitro-2"
import { defineConfig } from "vite"

import { BASE } from "./base.config"
import { solidThreeBundlePlugin } from "./vite-plugins/solid-three-bundle"

const theme = defineTheme({
  componentsPath: new URL("./src/theme/", import.meta.url).href,
  extends: defaultTheme,
})

// SolidBase rewrites each sidebar item's link by prepending its prefix key, so
// the same chapter list is emitted relative to `/tour` (for tour pages)
// and as full paths under `/` (the home-page fallback).
const tutorialChapters: Array<[title: string, slug: string]> = [
  ["Getting started", "00-getting-started"],
  ["Your first scene", "01-your-first-scene"],
  ["Props and children", "02-props-and-children"],
  ["Control flow", "03-control-flow"],
  ["Pointer events", "04-pointer-events"],
  ["useFrame", "05-use-frame"],
  ["Loaders & Resource", "06-loaders-and-resource"],
  ["Portal", "07-portal"],
  ["Let's build Tetris!", "08-tetris"],
  ["A peek at WebGPU", "09-webgpu-peek"],
]
const tutorialSidebar = (base: string) =>
  tutorialChapters.map(([title, slug]) => ({ title, link: `${base}${slug}` }))

const solidBase = createSolidBase(theme)

export default defineConfig({
  base: BASE,
  resolve: {
    dedupe: ["@solidjs/start", "@kobalte/solidbase"],
  },
  // The hero lazy-loads gallery snippets (letter-drop, rubiks, tunnel) that
  // pull in three, cannon-es, and several three/examples/jsm modules. Behind a
  // dynamic import, Vite never sees them at startup — it discovers them on first
  // demo load and re-optimizes mid-session, a slow full reload. Skip pre-bundling
  // them; they're already ESM. Everything that imports `three` resolves to the
  // same excluded copy, so there's still a single three instance.
  optimizeDeps: {
    exclude: [
      "three",
      "cannon-es",
      "three/examples/jsm/environments/RoomEnvironment.js",
      "three/examples/jsm/geometries/TextGeometry.js",
      "three/examples/jsm/geometries/RoundedBoxGeometry.js",
      "three/examples/jsm/loaders/FontLoader.js",
      "three/examples/jsm/loaders/TTFLoader.js",
    ],
  },
  plugins: [
    { ...importChunkUrl(), applyToEnvironment: env => env.name === "client" },
    {
      name: "importChunkUrl-ssr-stub",
      applyToEnvironment: env => env.name !== "client",
      resolveId(id) {
        if (id.endsWith("?importChunkUrl")) return id
      },
      load(id) {
        if (id.endsWith("?importChunkUrl")) return `export default ""`
      },
    },
    solidThreeBundlePlugin(),
    solidBase.plugin({
      title: "solid three",
      description: "A SolidJS renderer for three.js — learn by reading.",
      lang: "en",
      themeConfig: {
        socialLinks: {
          github: "https://github.com/solidjs-community/solid-three",
        },
        sidebar: {
          "/": tutorialSidebar("/tour/"),
          "/tour": tutorialSidebar("/"),
          "/api": [
            {
              title: "Components",
              collapsed: true,
              items: [
                { title: "Canvas", link: "/components/canvas" },
                { title: "Entity", link: "/components/entity" },
                { title: "T / createT", link: "/components/t" },
                { title: "Portal", link: "/components/portal" },
                { title: "Resource", link: "/components/resource" },
              ],
            },
            {
              title: "Hooks",
              collapsed: true,
              items: [
                { title: "useThree", link: "/hooks/use-three" },
                { title: "useFrame", link: "/hooks/use-frame" },
                { title: "createXR", link: "/hooks/create-xr" },
                { title: "useXR", link: "/hooks/use-xr" },
                { title: "useLoader", link: "/hooks/use-loader" },
                { title: "useProps", link: "/hooks/use-props" },
              ],
            },
            {
              title: "Utilities",
              collapsed: true,
              items: [
                { title: "Raycasters", link: "/utilities/raycasters" },
                { title: "LoaderCache", link: "/utilities/loader-cache" },
                { title: "autodispose", link: "/utilities/autodispose" },
                { title: "Metadata", link: "/utilities/metadata" },
                { title: "Testing", link: "/utilities/testing" },
              ],
            },
            {
              title: "Events",
              collapsed: true,
              items: [
                { title: "Overview", link: "/events/overview" },
                { title: "raycastable", link: "/events/raycastable" },
              ],
            },
            { title: "Types", link: "/types" },
          ],
        },
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
