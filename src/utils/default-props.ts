import { MergeProps, mergeProps } from "solid-js";

/** Extracts the keys of the optional properties in T. */
type KeyOfOptionals<T> = keyof {
  [K in keyof T as T extends Record<K, T[K]> ? never : K]: T[K];
};

export function defaultProps<T, K extends KeyOfOptionals<T>>(
  props: T,
  defaults: Required<Pick<T, K>>,
): MergeProps<[Required<Pick<T, K>>, T]> {
  return mergeProps(defaults, props);
}
