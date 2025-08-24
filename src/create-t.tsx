import { createMemo, type Component, type JSX, type JSXElement, type MergeProps } from "solid-js"
import { createCanvas } from "./canvas.tsx"
import { $S3C } from "./constants.ts"
import { useProps } from "./props.ts"
import type { Plugin, Props } from "./types.ts"
import { meta } from "./utils.ts"

/**********************************************************************************/
/*                                                                                */
/*                                    Create T                                    */
/*                                                                                */
/**********************************************************************************/

export type InferPluginsFromT<T extends object> = T extends { [$S3C]: infer U } ? U : never

export function createT<
  const TCatalogue extends Record<string, unknown>,
  const TCataloguePlugins extends Plugin[] = [],
>(catalogue: TCatalogue, plugins?: TCataloguePlugins = []) {
  const cache = new Map<string, Component<any>>()
  return {
    Canvas: createCanvas(plugins),
    T: new Proxy<
      | {
          [K in keyof TCatalogue]: <const TPlugins extends Plugin[] | undefined>(
            props: { plugins?: TPlugins } & Partial<
              TPlugins extends Plugin[]
                ? Props<TCatalogue[K], [...TCataloguePlugins, ...TPlugins]>
                : Props<TCatalogue[K], TCataloguePlugins>
            >,
          ) => JSXElement
        } & { [$S3C]: TCataloguePlugins }
    >({} as any, {
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
    }),
  }
}

/**
 * Creates an Entity-instance from a given source constructor.
 *
 * @template TConstructor The source constructor type.
 * @param Constructor - The constructor from which the component will be created.
 * @returns The created component.
 */
export function createEntity<TConstructor, TEntityPlugins extends Plugin[] = Plugin[]>(
  Constructor: TConstructor,
  plugins: TEntityPlugins,
) {
  return function <TPlugins extends Plugin[] = Plugin[]>(
    props: MergeProps<[InferPluginsFromT<TEntityPlugins>, Props<TConstructor, TPlugins>]>,
  ) {
    const entity = createMemo(() => {
      // listen to key changes
      props.key
      try {
        return meta(new (Constructor as any)(...(props.args ?? [])), { props, plugins })
      } catch (e) {
        console.error(e)
        throw new Error("")
      }
    })
    useProps(entity, props, plugins)
    return entity as unknown as JSX.Element
  }
}
