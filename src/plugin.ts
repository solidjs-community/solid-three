import type { Constructor, Plugin, PluginFn } from "./types.ts"

/**
 * Create a plugin. Three forms:
 * - `plugin(el => methods)` — applies to every element.
 * - `plugin([Mesh, Camera], el => methods)` — only elements `instanceof` one of the constructors.
 * - `plugin(guard, el => methods)` — only elements passing the type-guard.
 *
 * Returns `(element) => methods | undefined`; a non-matching element yields `undefined`.
 * A contributed method's first-param type becomes the element prop type.
 */
export const plugin: PluginFn = (selectorOrMethods: any, methods?: any): Plugin<any> => {
  if (methods === undefined) {
    return (element: any) => selectorOrMethods(element)
  }
  return (element: any) => {
    if (Array.isArray(selectorOrMethods)) {
      for (const Ctor of selectorOrMethods as Constructor[]) {
        if (element instanceof Ctor) return methods(element)
      }
      return undefined
    }
    if (typeof selectorOrMethods === "function" && selectorOrMethods(element)) {
      return methods(element)
    }
    return undefined
  }
}

/**
 * Run each plugin's factory against `element` and merge the returned method
 * objects into one plain object (no proxy — optimize for access). Non-matching
 * plugins return `undefined` and are skipped. Called once per plugged element at
 * creation (gated by `plugins.length`), never on the per-attach path.
 */
export function resolvePluginMethods(
  element: object,
  plugins: Plugin[],
): Record<string, (value: any) => void> {
  const merged: Record<string, any> = {}
  for (const plugin of plugins) {
    const result = (plugin as (el: object) => Record<string, any> | undefined)(element)
    if (!result) continue
    for (const key in result) {
      const descriptor = Object.getOwnPropertyDescriptor(result, key)
      if (descriptor?.get || descriptor?.set) Object.defineProperty(merged, key, descriptor)
      else merged[key] = result[key]
    }
  }
  return merged
}
