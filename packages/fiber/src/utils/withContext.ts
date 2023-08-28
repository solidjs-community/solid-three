import { Accessor, Context, JSX } from 'solid-js'

export type ContextProviderProps = {
  children?: JSX.Element
} & Record<string, unknown>
export type ContextProvider<T extends ContextProviderProps> = (props: { children: JSX.Element } & T) => JSX.Element
/**
 * A utility-function to provide context to components.
 *
 * @param children Accessor of Children
 * @param context Context<T>
 * @param value T
 *
 * @example
 * ```tsx
 * const NumberContext = createContext<number>
 *
 * const children = withContext(
 *    () => props.children,
 *    NumberContext,
 *    1
 * )
 * ```
 */

export function withContext<T>(children: Accessor<JSX.Element | JSX.Element[]>, context: Context<T>, value: T) {
  let result: JSX.Element | JSX.Element[]

  context.Provider({
    value,
    children: (() => {
      result = children()
      return ''
    }) as any as JSX.Element,
  })

  return () => result
}

/*

Type validation of the `values` array thanks to the amazing @otonashixav (https://github.com/otonashixav)

*/

/**
 * A utility-function to provide multiple context to components.
 *
 * @param children Accessor of Children
 * @param values Array of tuples of `[Context<T>, value T]`.
 *
 * @example
 * ```tsx
 * const NumberContext = createContext<number>
 * const StringContext = createContext<string>
 * const children = withContext(
 *    () => props.children,
 *    [
 *      [NumberContext, 1],
 *      [StringContext, "string"]
 *    ]
 * )
 * ```
 */

export function withMultiContexts<T extends readonly [unknown?, ...unknown[]]>(
  children: Accessor<JSX.Element | JSX.Element[]>,
  values: {
    [K in keyof T]: readonly [Context<T[K]>, [T[K]][T extends unknown ? 0 : never]]
  },
) {
  let result: JSX.Element | JSX.Element[]

  const fn = (index: number) => {
    const [context, value] = values[index]!
    context.Provider({
      value,
      children: (() => {
        if (index < values.length - 1) {
          fn(index + 1)
        } else {
          result = children()
        }
        return ''
      }) as any as JSX.Element,
    })
  }

  fn(0)

  return () => result
}
