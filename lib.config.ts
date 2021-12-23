import { build, defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
// import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
// import { HTMLElements } from "./src/solid-three/html-elements";
// import { SVGElements } from "./src/solid-three/constants";
// import { babel } from "@rollup/plugin-babel";

build({
  build: {
    lib: {
      entry: "./src/index.tsx",
      name: "SolidThree",
      formats: ["es"],
      fileName: "index",
    },

    rollupOptions: {
      external: ["three", "solid-js", "zustand/vanilla", "solid-js/universal"],
    },
    minify: "esbuild",
    polyfillDynamicImport: false,
  },
});

build({
  build: {
    lib: {
      entry: "./src/index.tsx",
      name: "SolidThree",
      formats: ["umd"],
      fileName: "index",
    },
    minify: "esbuild",
    target: "esnext",
    polyfillDynamicImport: false,
  },
});
