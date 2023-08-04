import { splitProps } from 'solid-js'
import { defaultProps } from './defaultProps'
import { KeyOfOptionals } from './typeHelpers'

export function processProps<
  TProps extends Record<string, any>,
  TKey extends KeyOfOptionals<TProps>,
  TSplit extends (keyof TProps)[],
>(props: TProps, defaults: Required<Pick<TProps, TKey>>, split?: TSplit) {
  return splitProps(defaultProps(props, defaults), split || [])
}
