import { MergeProps, mergeProps } from 'solid-js'
import { KeyOfOptionals } from './typeHelpers'

export function defaultProps<T, K extends KeyOfOptionals<T>>(
  props: T,
  defaults: Required<Pick<T, K>>
): MergeProps<[Required<Pick<T, K>>, T]> {
  return mergeProps(defaults, props)
}
