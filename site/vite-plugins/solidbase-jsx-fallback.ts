import { existsSync } from "node:fs"
import { dirname, extname, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"

import type { Plugin } from "vite"

/**
 * `@kobalte/solidbase`'s published `dist/` ships `.jsx` files but the import
 * statements within them reference `.js`. Vite 8 + Rolldown does not perform
 * the `.js` -> `.jsx` substitution that Vite 6 + esbuild did. This plugin
 * intercepts `.js` imports originating inside `@kobalte/solidbase` and rewrites
 * them to the sibling `.jsx` file when one exists.
 */
export function solidbaseJsxFallback(): Plugin {
  return {
    name: "tutorial:solidbase-jsx-fallback",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer) return null
      if (!importer.includes("@kobalte/solidbase")) return null
      if (extname(source) !== ".js") return null

      const importerPath = importer.startsWith("file://")
        ? fileURLToPath(importer)
        : importer
      const absolute = resolvePath(dirname(importerPath), source)
      const jsxCandidate = absolute.replace(/\.js$/, ".jsx")

      if (existsSync(jsxCandidate)) return jsxCandidate
      return null
    },
  }
}
