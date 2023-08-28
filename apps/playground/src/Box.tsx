import { T, useFrame } from '@solid-three/fiber'
import { JSX, createSignal } from 'solid-js'
import { Mesh } from 'three'

export function Box(props: { position?: [number, number, number]; children?: JSX.Element }) {
  let mesh: Mesh | undefined
  const [hovered, setHovered] = createSignal(false)
  useFrame(() => {
    mesh!.rotation.y += 0.01
  })

  return (
    <T.Mesh
      position={props.position ?? [0, 0, 0]}
      ref={mesh}
      onPointerEnter={(e) => setHovered(true)}
      onPointerLeave={(e) => setHovered(false)}>
      {props.children}
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={hovered() ? 'blue' : 'green'} />
    </T.Mesh>
  )
}
