import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const cache = new Map<string, Promise<string[]>>()

/** Export names of a module, resolved from `root`, excluding `default` and internals. */
export function enumerateNamespaceKeys(moduleId: string, root: string): Promise<string[]> {
  const cacheKey = `${root}\0${moduleId}`
  let pending = cache.get(cacheKey)
  if (!pending) {
    pending = load(moduleId, root)
    cache.set(cacheKey, pending)
  }
  return pending
}

// A catalogue key must be referenceable as a member expression (`NS.Key`) and
// emitted as an `export const Key` in the scaffold, so it must be a valid JS
// identifier. CJS builds surfaced through ESM interop can leak non-member keys
// such as `module.exports`; drop anything that isn't a plain identifier.
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function exportNames(ns: Record<string, unknown>): string[] {
  // `default` and `__`-prefixed names (e.g. `__esModule`) are interop bookkeeping,
  // not catalogue members — they pass the identifier test but must still be dropped.
  return Object.keys(ns).filter(k => k !== "default" && !k.startsWith("__") && IDENTIFIER.test(k))
}

async function load(moduleId: string, root: string): Promise<string[]> {
  const require = createRequire(pathToFileURL(`${root}/package.json`))
  const resolved = require.resolve(moduleId)
  const ns = await import(pathToFileURL(resolved).href)
  let keys = exportNames(ns)
  // CJS modules imported via ESM interop often surface only `{ default }`.
  // When that happens, fall back to the default export if it is a plain object
  // holding the actual namespace members (e.g. three's CJS build).
  if (keys.length === 0 && ns.default != null && typeof ns.default === "object") {
    keys = exportNames(ns.default as Record<string, unknown>)
  }
  return keys
}
