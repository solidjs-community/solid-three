import type { Plugin, PluginBuilder } from "types"

export function plugin<TContext extends object>(setup?: () => TContext): PluginBuilder<TContext> {
  return {
    // Unified prop method - handles both single and two argument cases
    prop(filterArgOrMethods: any, methods?: any): Plugin<any> {
      // Single argument case - apply to all elements
      if (methods === undefined) {
        type PluginFn = (element: any) => any

        const plugin: Plugin<PluginFn> = () => {
          // Run setup once if provided and store result as context
          const context = setup ? setup() : undefined

          return ((element: any) => {
            return filterArgOrMethods(element, context)
          }) as PluginFn
        }

        return plugin
      }

      // Two argument case - use filtering
      return filteredPlugin(setup, filterArgOrMethods, methods)
    },
  } as PluginBuilder<TContext>
}

/**
 * Creates a plugin with a unified prop API
 * Usage:
 * - createPlugin(() => { setup }).prop((element, context) => methods) // apply to all elements
 * - createPlugin(() => { setup }).prop(Constructor, (element, context) => methods) // single constructor filter
 * - createPlugin(() => { setup }).prop([Constructor1, Constructor2], (element, context) => methods) // multiple constructors
 * - createPlugin(() => { setup }).prop((element): element is T => condition, (element, context) => methods) // type guard
 */

// Helper function to create the actual plugin implementation
function filteredPlugin(setup: (() => any) | undefined, filterArg: any, methods: any): Plugin<any> {
  const plugin: Plugin<any> = () => {
    // Run setup once if provided and store result as context
    const context = setup ? setup() : undefined

    return ((element: any) => {
      // Handle single constructor
      if (typeof filterArg === "function" && filterArg.prototype) {
        if (element instanceof filterArg) {
          return methods(element, context)
        }
      }
      // Handle array of constructors
      else if (Array.isArray(filterArg)) {
        for (const Constructor of filterArg) {
          if (element instanceof Constructor) {
            return methods(element, context)
          }
        }
      }
      // Handle type guard function
      else if (typeof filterArg === "function") {
        if (filterArg(element)) {
          return methods(element, context)
        }
      }

      return {}
    }) as any
  }

  return plugin
}
