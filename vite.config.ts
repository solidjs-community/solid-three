import { defineConfig } from "vite";
import inspect from "vite-plugin-inspect";
import solidPlugin from "vite-plugin-solid";
export default defineConfig(async (mode) => ({
  build:
    process.env.BUILD_MODE === "lib"
      ? {
          lib: {
            entry: "./src/index.tsx",
            formats: ["es", "cjs", "umd"],
            fileName: "index",
            name: "SolidThree",
          },
          minify: false,
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
        }
      : {},
  plugins: [
    // mdx({
    //   transformMDX: (code) => {
    //     return code.replace(/<\!--[a-zA-Z\.\s]+-->/g, ` `);
    //   },
    //   xdm: {
    //     remarkPlugins: [(await import("remark-gfm")).default],
    //   },
    // }),
    // for the playground, we need to be able to use the renderer from the src itself
    solidPlugin(),
    inspect(),
  ],
}));
