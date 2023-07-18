import { JSX } from 'solid-js'
import { T } from '../../src'

export function Box(props: Partial<Parameters<typeof T.Mesh>[0]> & { children?: JSX.Element; color?: string }) {
  return (
    <T.Mesh {...props}>
      {props.children}
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={props.color} />
    </T.Mesh>
  )
}
