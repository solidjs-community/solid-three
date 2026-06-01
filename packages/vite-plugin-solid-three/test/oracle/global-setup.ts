// Global setup for the browser soundness oracle.
//
// Before the browser test runs, build the oracle scene fixture through the real
// plugin (same build shape as `test/fixtures/_harness.ts`), extract the
// build-narrowed catalogue keys from the emitted `createT({ ... })` call, and
// persist them to `oracle.generated.json`. The browser test then asserts that
// every catalogue key the running scene actually accesses is contained in this
// narrowed set.

import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import solid from "vite-plugin-solid"
import solidThree from "../../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))

function extractNarrowedKeys(code: string): string[] {
  const match = code.match(/createT\(\s*\{([^}]*)\}\s*\)/)
  if (!match) {
    throw new Error("oracle global-setup: no createT({ ... }) call found in emitted output")
  }
  const body = match[1]
  const keys: string[] = []
  for (const rawEntry of body.split(",")) {
    const entry = rawEntry.trim()
    if (entry.length === 0) continue
    // Shorthand (`Mesh`) or longhand (`Mesh: value`); identifier before any `:`.
    const identifier = entry.split(":")[0].trim()
    if (/^[A-Za-z_$][\w$]*$/.test(identifier)) {
      keys.push(identifier)
    }
  }
  return keys
}

export default async function setup() {
  const root = here
  const output = await build({
    root,
    logLevel: "silent",
    plugins: [solidThree(), solid()],
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve(root, "scene.fixture.tsx"), formats: ["es"], fileName: "out" },
    },
  })
  const chunks = (Array.isArray(output) ? output : [output]).flatMap(o =>
    "output" in o ? o.output : [],
  )
  const code = chunks
    .filter(c => c.type === "chunk")
    .map(c => (c as { code: string }).code)
    .join("\n")

  const keys = extractNarrowedKeys(code)
  if (keys.length === 0) {
    throw new Error("oracle global-setup: extracted narrowed key set is empty")
  }

  writeFileSync(resolve(root, "oracle.generated.json"), JSON.stringify({ keys }, null, 2))
}
