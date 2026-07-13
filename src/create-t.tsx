import { createMemo, mergeProps, type Component, type JSX, type ParentProps } from "solid-js"
import { Canvas, type CanvasProps } from "./canvas.tsx"
import { useProps } from "./props.ts"
import type { BaseProps, CanvasPropsOf, Plugin, Props } from "./types.ts"
import { autodispose, meta } from "./utils.ts"

/**********************************************************************************/
/*                                                                                */
/*                                    Create T                                    */
/*                                                                                */
/**********************************************************************************/

export function createT<
  const TCatalogue extends Record<string, unknown>,
  const TPlugins extends readonly Plugin[] = readonly Plugin[],
>(catalogue: TCatalogue, plugins?: TPlugins) {
  const pluginList: Plugin[] = plugins ? [...plugins] : []
  const cache = new Map<string, Component<any>>()
  return new Proxy<{
    [K in keyof TCatalogue]: Component<Props<TCatalogue[K], TPlugins>>
  }>({} as any, {
    get: (_, name: string) => {
      /* Create and memoize a wrapper component for the specified property. */
      if (!cache.has(name)) {
        /* Try and find a constructor within the THREE namespace. */
        const constructor = catalogue[name]

        /* If no constructor is found, return undefined. */
        if (!constructor) return undefined

        /* Otherwise, create and memoize a component for that constructor. */
        cache.set(name, createEntity(constructor, pluginList))
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
): Component<BaseProps<TConstructor>> {
  return (props: BaseProps<TConstructor>) => {
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

/**
 * `createT` plus a `Canvas` typed by the same plugins. Sugar over `<Canvas plugins={…}>`
 * for the common single-namespace case: the returned `Canvas` defaults its `plugins` prop
 * to `plugins`, and the prop stays available to override or extend (co-existence).
 */
createT.withCanvas = function withCanvas<
  const TCatalogue extends Record<string, unknown>,
  const TPlugins extends readonly Plugin[],
>(catalogue: TCatalogue, plugins: TPlugins) {
  const T = createT(catalogue, plugins)
  const BoundCanvas = (
    props: ParentProps<CanvasProps<TPlugins>> & Partial<CanvasPropsOf<TPlugins>>,
  ) => {
    const merged = mergeProps({ plugins }, props)
    return Canvas(merged as ParentProps<CanvasProps<TPlugins>> & Partial<CanvasPropsOf<TPlugins>>)
  }
  return { T, Canvas: BoundCanvas }
}
