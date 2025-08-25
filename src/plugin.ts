import type { Context, Plugin, PluginFn } from "./types.ts"

export const plugin: PluginFn = Object.assign(
  // Main function implementation
  (filterArgOrMethods?: any, methods?: any): any => {
    // Single argument case - global plugin (apply to all elements)
    if (methods === undefined) {
      const plugin: Plugin<any> = (_context: Context) => {
        return (element: any) => {
          return filterArgOrMethods(element)
        }
      }
      return plugin
    }

    // Two argument case - filtered plugin (array of constructors or type guard)
    return filteredPlugin(undefined, filterArgOrMethods, methods)
  },
  {
    setup<TSetupContext extends object>(setupFn: (context: Context) => TSetupContext) {
      return {
        then(filterArgOrMethods: any, methods?: any) {
          // Single argument case - global plugin with setup
          if (methods === undefined) {
            const plugin: Plugin<any> = (context: Context) => {
              const setupContext = setupFn(context)
              return (element: any) => {
                return filterArgOrMethods(element, setupContext)
              }
            }
            return plugin
          }

          // Two argument case - filtered plugin with setup
          return filteredPlugin(setupFn, filterArgOrMethods, methods)
        },
      }
    },
  },
)

function filteredPlugin(
  setup: ((context: Context) => any) | undefined,
  filterArg: any,
  methods: any,
): Plugin<any> {
  const plugin: Plugin<any> = (context: Context) => {
    // Run setup once if provided and store result as context
    const setupContext = setup ? setup(context) : undefined

    return (element: any) => {
      // Handle array of constructors
      if (Array.isArray(filterArg)) {
        for (const Constructor of filterArg) {
          if (element instanceof Constructor) {
            return methods(element, setupContext)
          }
        }
      }
      // Handle type guard function
      else if (typeof filterArg === "function") {
        if (filterArg(element)) {
          return methods(element, setupContext)
        }
      }

      return undefined
    }
  }

  return plugin
}
