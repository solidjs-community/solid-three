import { mergeProps, type MergeProps, splitProps } from "solid-js"
import type { KeyOfOptionals } from "./type-utils.ts"

export function processProps<
  const TProps,
  const TDefaults extends Partial<Pick<TProps, KeyOfOptionals<TProps>>>,
  const TSplit extends readonly (keyof MergeProps<[TDefaults, TProps]>)[],
>(props: TProps, defaults: TDefaults, split?: TSplit) {
  const merged = mergeProps(defaults, props)
  return splitProps(merged, (split ?? []) as readonly (keyof typeof merged)[])
}
