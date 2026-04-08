import { createMemo, type Component, type JSX } from "solid-js"
import { useProps } from "./props.ts"
import type { Props } from "./types.ts"
import { createDebug, describeOwnerChain, meta } from "./utils.ts"

const debug = createDebug("create-t:createEntity", false)

/**********************************************************************************/
/*                                                                                */
/*                                    Create T                                    */
/*                                                                                */
/**********************************************************************************/

export function createT<TCatalogue extends Record<string, unknown>>(catalogue: TCatalogue) {
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
        cache.set(name, createEntity(constructor))
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
): Component<Props<TConstructor>> {
  return (props: Props<TConstructor>) => {
    const chain = describeOwnerChain()
    const isNullContext = chain === "(anon)[0ctx](T)"
    debug(`component body: ${(Constructor as any)?.name} owner chain: ${chain}`, undefined, {
      trace: isNullContext,
    })
    const memo = createMemo(() => {
      // listen to key changes
      props.key
      try {
        return meta(new (Constructor as any)(...(props.args ?? [])), { props })
      } catch (e) {
        console.error(e)
        throw new Error("")
      }
    })
    useProps(memo, props)
    return memo as unknown as JSX.Element
  }
}
