import { createMemo, type Component, type JSX } from "solid-js"
import { SHOULD_DEBUG } from "./constants.ts"
import { useProps } from "./props.ts"
import type { Props } from "./types.ts"
import { createDebug, describeOwnerChain, meta } from "./utils.ts"

const debugCreateT = createDebug("create-t:createT", SHOULD_DEBUG)
const debugCreateEntity = createDebug("create-t:createEntity", SHOULD_DEBUG)

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
        if (!constructor) {
          debugCreateT("missing", { name })
          return undefined
        }

        debugCreateT("resolved", { name })
        
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
  const name = (Constructor as any)?.name

  debugCreateEntity("factory", { constructor: name })

  return (props: Props<TConstructor>) => {
    const chain = describeOwnerChain()
    const isNullContext = chain === "(anon)[0ctx](T)"

    if (isNullContext) {
      debugCreateEntity("null context", { constructor: name, ownerChain: chain }, { trace: true })
    } else {
      debugCreateEntity("mount", { constructor: name })
    }

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
