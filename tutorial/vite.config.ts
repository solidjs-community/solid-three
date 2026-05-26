import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tsconfig from "vite-tsconfig-paths"

export default defineConfig({
  base: "./",
  plugins: [tsconfig(), solid()],
})
