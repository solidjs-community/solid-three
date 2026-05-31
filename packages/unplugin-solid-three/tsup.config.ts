import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  target: "node18",
  dts: true,
  clean: true,
})
