import { omit } from "solid-js"
import { defaultProps } from "./default-props.ts"

/**
 * Solid 2.x replacement for the Solid 1.x `splitProps(defaults ∪ props, keys)` pattern.
 * Returns `[picked, rest]`, where `picked` has reactive getters for the split
 * keys and `rest` is the remainder (via `omit`).
 */
export function processProps<
  const TProps extends object,
  const TSplit extends readonly (keyof TProps)[],
>(
  props: TProps,
  defaults: Partial<TProps>,
  split?: TSplit,
): [Pick<TProps, TSplit[number]>, Omit<TProps, TSplit[number]>] {
  const merged = defaultProps(props, defaults) as TProps
  const keys = (split ?? []) as readonly (keyof TProps)[]
  const picked = {} as Pick<TProps, TSplit[number]>
  for (const key of keys) {
    Object.defineProperty(picked, key, {
      get: () => merged[key],
      enumerable: true,
    })
  }
  const rest = omit(merged as Record<keyof TProps, unknown>, ...keys) as unknown as Omit<
    TProps,
    TSplit[number]
  >
  return [picked, rest]
}
