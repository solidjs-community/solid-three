import { defineConfig } from "vite";
import solidPlugin from "@vinxi/vite-plugin-solid";
import inspect from "vite-plugin-inspect";
import { HTMLElements, SVGElements } from "./elements";
import dts from "vite-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.tsx",
      formats: ["es", "cjs", "umd"],
      fileName: "index",
      name: "SolidThree",
    },
    rollupOptions: {
      external: [
        "solid-js",
        "solid-js/web",
        "solid-js/store",
        "three",
        "zustand",
        "zustand/vanilla",
      ],
    },
    polyfillDynamicImport: false,
  },
  plugins: [
    // for the playground, we need to be able to use the solid-three package itself
    solidPlugin({
      solid: {
        moduleName: "solid-js/web",
        // @ts-ignore
        generate: "dynamic",
        renderers: [
          {
            name: "dom",
            moduleName: "solid-js/web",
            elements: [...HTMLElements, ...SVGElements],
          },
          {
            name: "universal",
            moduleName: "/src/renderer.tsx",
            elements: [],
          },
        ],
      },
    }),
    inspect(),
  ],
});
