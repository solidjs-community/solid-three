import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
// import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
// import { HTMLElements } from "./src/solid-three/html-elements";
// import { SVGElements } from "./src/solid-three/constants";
// import { babel } from "@rollup/plugin-babel";

function presetSolid() {
  return [
    // icons({ compiler: "solid" }),
    // tsconfigPaths(),
    // vanillaExtractPlugin(),
    // {
    //   ...babel({
    //     plugins: [
    //       ["@babel/plugin-syntax-typescript", { isTSX: true }],
    //       babelPluginUndestructure,
    //     ],
    //     extensions: [".tsx"],
    //   }),
    //   enforce: "pre",
    // },
    // {
    //   ...babel({
    //     plugins: ["@babel/plugin-syntax-typescript", babelPluginUndestructure],
    //     extensions: [".ts"],
    //   }),
    //   enforce: "pre",
    // },
    // solidPlugin({
    //   solid: {
    //     moduleName: "solid-js/web",
    //     // @ts-ignore
    //     generate: "dynamic",
    //     renderers: [
    //       {
    //         name: "dom",
    //         moduleName: "solid-js/web",
    //         elements: [...HTMLElements, ...SVGElements],
    //       },
    //       {
    //         name: "universal",
    //         moduleName: "solid-three",
    //         elements: [],
    //       },
    //     ],
    //   },
    // }),
    // inspect(),
  ];
}

export default defineConfig({
  // plugins: [
  //   ...presetSolid(),
  //   windiCSS({
  //     scan: {
  //       fileExtensions: ["html", "js", "ts", "jsx", "tsx"],
  //     },
  //   }),
  // ],

  build: {
    lib: {
      entry: "./src/three/index.tsx",
      name: "SolidThree",
    },
    // target: "esnext",
    polyfillDynamicImport: false,
  },
});
