import { merge, type Merge } from "solid-js"

export function defaultProps<TProps extends object>(
  props: TProps,
  defaults: Partial<TProps>,
): Merge<[Partial<TProps>, TProps]> {
  return merge(defaults, props)
}
