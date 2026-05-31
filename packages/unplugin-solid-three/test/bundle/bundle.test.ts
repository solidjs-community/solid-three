import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import solid from "vite-plugin-solid"
import { describe, expect, it } from "vitest"
import { vitePlugin } from "../../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = resolve(here, "fixture")

async function bundle(withPlugin: boolean): Promise<string> {
  const output = await build({
    root: fixture,
    logLevel: "silent",
    plugins: [
      ...(withPlugin ? [vitePlugin({ tsconfig: resolve(fixture, "tsconfig.json") })] : []),
      solid(),
    ],
    build: {
      write: false,
      lib: { entry: resolve(fixture, "scene.tsx"), formats: ["es"], fileName: "scene" },
      minify: false,
    },
  })
  const chunks = Array.isArray(output) ? output : [output]
  return chunks
    .flatMap(o => ("output" in o ? o.output : []))
    .filter(c => c.type === "chunk")
    .map(c => (c as { code: string }).code)
    .join("\n")
}

describe("vite bundle", () => {
  it("drops unused three classes when the plugin runs", async () => {
    const code = await bundle(true)
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  }, 60_000)

  it("retains all classes without the plugin (baseline)", async () => {
    const code = await bundle(false)
    expect(code).toContain("BoxGeometry")
  }, 60_000)
})
