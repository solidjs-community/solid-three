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

async function load(moduleId: string, root: string): Promise<string[]> {
  const require = createRequire(pathToFileURL(`${root}/package.json`))
  const resolved = require.resolve(moduleId)
  const ns = await import(pathToFileURL(resolved).href)
  let keys = Object.keys(ns).filter(k => k !== "default" && !k.startsWith("__"))
  // CJS modules imported via ESM interop often surface only `{ default }`.
  // When that happens, fall back to the default export if it is a plain object
  // holding the actual namespace members (e.g. three's CJS build).
  if (keys.length === 0 && ns.default != null && typeof ns.default === "object") {
    keys = Object.keys(ns.default).filter(k => k !== "default" && !k.startsWith("__"))
  }
  return keys
}
