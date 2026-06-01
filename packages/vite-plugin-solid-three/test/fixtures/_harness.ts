import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import solid from "vite-plugin-solid"
import solidThree from "../../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))

export async function buildFixture(name: string, entry = "scene.tsx"): Promise<string> {
  const root = resolve(here, name)
  const output = await build({
    root,
    logLevel: "silent",
    plugins: [solidThree(), solid()],
    build: { write: false, minify: false, lib: { entry: resolve(root, entry), formats: ["es"], fileName: "out" } },
  })
  const chunks = (Array.isArray(output) ? output : [output]).flatMap(o => ("output" in o ? o.output : []))
  return chunks.filter(c => c.type === "chunk").map(c => (c as { code: string }).code).join("\n")
}
