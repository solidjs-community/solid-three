import { T } from '@solid-three/fiber'
import { JSX } from 'solid-js'

export function Box(props: Partial<Parameters<typeof T.Mesh>[0]> & { children?: JSX.Element; color?: string }) {
  return (
    <T.Mesh {...props}>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={props.color} />
      {props.children}
    </T.Mesh>
  )
}
