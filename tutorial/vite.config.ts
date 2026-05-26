import mdx from "@mdx-js/rollup"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tsconfig from "vite-tsconfig-paths"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "solid-three": new URL("../src/index.ts", import.meta.url).pathname,
    },
  },
  plugins: [
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
