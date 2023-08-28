import { T } from '@solid-three/fiber'
import { JSX } from 'solid-js'

export function Sphere(props: Partial<Parameters<typeof T.Mesh>[0]> & { children?: JSX.Element; color?: string }) {
  return (
    <T.Mesh {...props}>
      {props.children}
      <T.SphereGeometry />
      <T.MeshStandardMaterial color={props.color} />
    </T.Mesh>
  )
}
