import type { Plugin, PluginFn } from "./types.ts"

export const plugin: PluginFn = Object.assign(
  // Main function implementation
  (filterArgOrMethods?: any, methods?: any): any => {
    // No arguments - return PluginBuilder for backward compatibility
    if (filterArgOrMethods === undefined && methods === undefined) {
      return {
        prop(filterArgOrMethods: any, methods?: any): Plugin<any> {
          // Single argument case - apply to all elements
          if (methods === undefined) {
            const plugin: Plugin<any> = () => {
              return ((element: any) => {
                return filterArgOrMethods(element, undefined)
              }) as any
            }
            return plugin
          }

          // Two argument case - use filtering
          return createFilteredPlugin(undefined, filterArgOrMethods, methods)
        },
      }
    }

    // Single argument case - apply to all elements
    if (methods === undefined) {
      const plugin: Plugin<any> = () => {
        return ((element: any) => {
          return filterArgOrMethods(element)
        }) as any
      }
      return plugin
    }

    // Two argument case - use filtering
    return createFilteredPlugin(undefined, filterArgOrMethods, methods)
  },
  {
    setup<TSetupContext extends object>(setupFn: () => TSetupContext) {
      return {
        then: (filterArgOrMethods: any, methods?: any): Plugin<any> => {
          // Single argument case - apply to all elements
          if (methods === undefined) {
            const plugin: Plugin<any> = () => {
              const context = setupFn()
              return ((element: any) => {
                return filterArgOrMethods(element, context)
              }) as any
            }
            return plugin
          }

          // Two argument case - use filtering
          return createFilteredPlugin(setupFn, filterArgOrMethods, methods)
        },
      }
    },
  },
)

// Helper function to create the actual plugin implementation
function createFilteredPlugin(
  setup: (() => any) | undefined,
  filterArg: any,
  methods: any,
): Plugin<any> {
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
