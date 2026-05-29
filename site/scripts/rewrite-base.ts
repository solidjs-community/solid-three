import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { BASE } from "../base.config.ts"

// SolidStart v2 (the Vite-plugin architecture) does not thread a deploy base
// through its manifest injection, the SolidBase theme/MDX links, or the app
// <head>, so prerendered HTML ships root-absolute href/src. GitHub Pages serves
// this project under BASE, where those URLs 404. Rewrite every root-absolute
// href/src in the prerendered HTML to sit under BASE. Runtime client routing is
// already base-aware via Vite `base` + the Router `base` prop; this only fixes
// the static markup.

const PUBLIC_DIR = fileURLToPath(new URL("../.output/public", import.meta.url))

async function* htmlFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* htmlFiles(path)
    else if (entry.name.endsWith(".html")) yield path
  }
}

if (BASE === "/") {
  console.log("[rewrite-base] BASE is '/', nothing to rewrite")
} else {
  const baseNoLeadingSlash = BASE.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // Match href="/… or src="/… that is not protocol-relative ("//") and not
  // already under BASE. The leading slash is consumed and replaced by BASE.
  const pattern = new RegExp(`((?:href|src)=")/(?!/|${baseNoLeadingSlash})`, "g")

  let files = 0
  let replacements = 0
  for await (const file of htmlFiles(PUBLIC_DIR)) {
    const html = await readFile(file, "utf8")
    let count = 0
    const rewritten = html.replace(pattern, (_match, attr) => {
      count++
      return `${attr}${BASE}`
    })
    if (count > 0) {
      await writeFile(file, rewritten)
      files++
      replacements += count
    }
  }
  console.log(`[rewrite-base] prefixed ${replacements} refs across ${files} files with ${BASE}`)
}
