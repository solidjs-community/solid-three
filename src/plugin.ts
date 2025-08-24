import type { Accessor } from "solid-js"
import type { Context, Plugin, PluginFn } from "./types.ts"

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
 *   .setup((context) => {
 *     return { scene: context.scene }
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
    /**
     * Creates a plugin with access to a setup context.
     *
     * The setup function runs once when the plugin is initialized and receives
     * the Three.js context as its argument. The returned data is passed to all
     * plugin methods.
     *
     * @param setupFn - Function that receives the Three.js context and returns data to share
     * @returns An object with a `then` method to define the plugin behavior
     *
     * @example
     * const plugin = plugin
     *   .setup((context) => {
     *     return { renderer: context.gl }
     *   })
     *   .then((element, context) => ({
     *     render: () => context.renderer.render(...)
     *   }))
     */
    setup<TSetupContext extends object>(setupFn: (context: Context) => TSetupContext) {
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
