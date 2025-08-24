import type { Plugin, PluginBuilder } from "./types.ts"

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

interface PluginInterface {
  // No setup - direct usage with one argument (global)
  <Methods extends Record<string, any>>(methods: (element: any) => Methods): Plugin<
    (element: any) => Methods
  >

  // No setup - direct usage with two arguments (single constructor)
  <T extends new (...args: any[]) => any, Methods extends Record<string, any>>(
    Constructor: T,
    methods: (element: InstanceType<T>) => Methods,
  ): Plugin<{
    (element: InstanceType<T>): Methods
    (element: any): {}
  }>

  // No setup - direct usage with two arguments (array of constructors)
  <T extends readonly (new (...args: any[]) => any)[], Methods extends Record<string, any>>(
    Constructors: T,
    methods: (
      element: T extends readonly (new (...args: any[]) => infer U)[] ? U : never,
    ) => Methods,
  ): Plugin<{
    (element: T extends readonly (new (...args: any[]) => infer U)[] ? U : never): Methods
    (element: any): {}
  }>

  // No setup - direct usage with two arguments (type guard)
  <T, Methods extends Record<string, any>>(
    condition: (element: unknown) => element is T,
    methods: (element: T) => Methods,
  ): Plugin<{
    (element: T): Methods
    (element: any): {}
  }>

  // Setup function
  setup<TSetupContext extends object>(
    setupFn: () => TSetupContext,
  ): {
    then: {
      // With setup - one argument (global)
      <Methods extends Record<string, any>>(
        methods: (element: any, context: TSetupContext) => Methods,
      ): Plugin<(element: any) => Methods>

      // With setup - two arguments (single constructor)
      <T extends new (...args: any[]) => any, Methods extends Record<string, any>>(
        Constructor: T,
        methods: (element: InstanceType<T>, context: TSetupContext) => Methods,
      ): Plugin<{
        (element: InstanceType<T>): Methods
        (element: any): {}
      }>

      // With setup - two arguments (array of constructors)
      <T extends readonly (new (...args: any[]) => any)[], Methods extends Record<string, any>>(
        Constructors: T,
        methods: (
          element: T extends readonly (new (...args: any[]) => infer U)[] ? U : never,
          context: TSetupContext,
        ) => Methods,
      ): Plugin<{
        (element: T extends readonly (new (...args: any[]) => infer U)[] ? U : never): Methods
        (element: any): {}
      }>

      // With setup - two arguments (type guard)
      <T, Methods extends Record<string, any>>(
        condition: (element: unknown) => element is T,
        methods: (element: T, context: TSetupContext) => Methods,
      ): Plugin<{
        (element: T): Methods
        (element: any): {}
      }>
    }
  }

  // Legacy PluginBuilder for backward compatibility
  (): PluginBuilder<{}>
}

export const plugin: PluginInterface = Object.assign(
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
      } as PluginBuilder<{}>
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
