import { createMemo, type Component, type JSX } from "solid-js"
import { useProps } from "./props.ts"
import type { Plugin, Props } from "./types.ts"
import { autodispose, meta } from "./utils.ts"

/**********************************************************************************/
/*                                                                                */
/*                                    Create T                                    */
/*                                                                                */
/**********************************************************************************/

export function createT<TCatalogue extends Record<string, unknown>>(
  catalogue: TCatalogue,
  plugins: Plugin[] = [],
) {
  const cache = new Map<string, Component<any>>()
  return new Proxy<{
    [K in keyof TCatalogue]: Component<Props<TCatalogue[K]>>
  }>({} as any, {
    get: (_, name: string) => {
      /* Create and memoize a wrapper component for the specified property. */
      if (!cache.has(name)) {
        /* Try and find a constructor within the THREE namespace. */
        const constructor = catalogue[name]

        /* If no constructor is found, return undefined. */
        if (!constructor) return undefined

        /* Otherwise, create and memoize a component for that constructor. */
        cache.set(name, createEntity(constructor, plugins))
      }

      return cache.get(name)
    },
  })
}

/**
 * Creates an Entity-instance from a given source constructor.
 *
 * @template TConstructor The source constructor type.
 * @param Constructor - The constructor from which the component will be created.
 * @returns The created component.
 */
export function createEntity<TConstructor>(
  Constructor: TConstructor,
  plugins: Plugin[] = [],
): Component<Props<TConstructor>> {
  return (props: Props<TConstructor>) => {
    const memo = createMemo(() => {
      // listen to key changes
      props.key
      try {
        return meta(autodispose(new (Constructor as any)(...(props.args ?? []))), { props })
      } catch (e) {
        console.error(e)
        throw new Error("")
      }
    })
    // Plugin methods are resolved once per element inside useProps, gated by
    // plugins.length — a no-plugin namespace never touches the plugin path.
    useProps(memo, props, undefined, plugins)
    return memo as unknown as JSX.Element
  }
}
