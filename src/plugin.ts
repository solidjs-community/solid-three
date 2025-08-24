import type { Accessor } from "solid-js"
import type { Plugin, PluginFn } from "./types.ts"

/**
 * Creates a plugin that extends solid-three components with additional functionality.
 *
 * Plugins can be used to add custom methods to THREE.js objects in a type-safe way.
 * They are applied during component creation and can optionally filter which elements
 * they apply to.
 *
 * @example
 * // Global plugin - applies to all elements
 * const LogPlugin = plugin(element => ({
 *   log: (message: string) => console.log(`[${element.type}] ${message}`)
 * }))
 *
 * @example
 * // Filtered plugin - applies only to specific element types
 * const ShakePlugin = plugin([THREE.Camera, THREE.Mesh], element => ({
 *   shake: (intensity = 0.1) => {
 *     useFrame(() => {
 *       element.position.x += (Math.random() - 0.5) * intensity
 *     })
 *   }
 * }))
 *
 * @example
 * // Type guard plugin - custom filtering logic
 * const MaterialPlugin = plugin(
 *   (element): element is THREE.Mesh => element instanceof THREE.Mesh,
 *   element => ({
 *     setColor: (color: string) => element.material.color.set(color)
 *   })
 * )
 *
 * @example
 * // Plugin with setup context
 * const ContextPlugin = plugin
 *   .setup(() => {
 *     const scene = useThree().scene
 *     return { scene }
 *   })
 *   .then([THREE.Object3D], (element, context) => ({
 *     addToScene: () => context.scene.add(element)
 *   }))
 */
export const plugin: PluginFn = Object.assign(
  // Main function implementation
  (filterArgOrMethods?: any, methods?: any): any => {
    // Single argument case - global plugin (apply to all elements)
    if (methods === undefined) {
      const plugin: Plugin<any> = () => {
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
    /**
     * Creates a plugin with access to a setup context.
     *
     * The setup function runs once when the plugin is initialized and can access
     * hooks like useThree(). The returned context is passed to all plugin methods.
     *
     * @param setupFn - Function that returns context data to be shared with plugin methods
     * @returns An object with a `then` method to define the plugin behavior
     *
     * @example
     * const plugin = plugin
     *   .setup(() => {
     *     const gl = useThree().gl
     *     return { renderer: gl }
     *   })
     *   .then((element, context) => ({
     *     render: () => context.renderer.render(...)
     *   }))
     */
    setup<TSetupContext extends object>(setupFn: Accessor<TSetupContext>) {
      return {
        /**
         * Defines the plugin methods after setup.
         *
         * @param filterArgOrMethods - Either methods (for global plugin) or filter argument
         * @param methods - Plugin methods (when using filter argument)
         * @returns The configured plugin
         */
        then(filterArgOrMethods: any, methods?: any) {
          // Single argument case - global plugin with setup
          if (methods === undefined) {
            const plugin: Plugin<any> = () => {
              const context = setupFn()
              return (element: any) => {
                return filterArgOrMethods(element, context)
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
  setup: Accessor<any> | undefined,
  filterArg: any,
  methods: any,
): Plugin<any> {
  const plugin: Plugin<any> = () => {
    // Run setup once if provided and store result as context
    const context = setup ? setup() : undefined

    return (element: any) => {
      // Handle array of constructors
      if (Array.isArray(filterArg)) {
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

      return undefined
    }
  }

  return plugin
}
