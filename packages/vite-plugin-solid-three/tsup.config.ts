import { defineConfig } from "tsup"

// Local config so tsup does not walk up and inherit the root solid-three build
// config (which targets the library with Solid JSX output and multiple entries).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
})
