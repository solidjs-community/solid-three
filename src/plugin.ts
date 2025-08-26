import type { Plugin, PluginFn } from "./types.ts"

// Main function implementation
export const plugin: PluginFn = (selectorOrMethods?: any, methods?: any): Plugin<any> => {
  // Single argument case - global plugin (apply to all elements)
  if (methods === undefined) {
    return (element: any) => {
      return selectorOrMethods(element)
    }
  }

  // Two argument case - filtered plugin (array of constructors or type guard)
  return (element: any) => {
    // Handle array of constructors
    if (Array.isArray(selectorOrMethods)) {
      for (const Constructor of selectorOrMethods) {
        if (element instanceof Constructor) {
          return methods(element)
        }
      }
    }
    // Handle type guard function
    else if (typeof selectorOrMethods === "function") {
      if (selectorOrMethods(element)) {
        return methods(element)
      }
    }

    return undefined
  }
}
