import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"
import { pointerEvents } from "solid-three/events"

const T = createT(THREE, [pointerEvents()])

export default () => {
  const [hovered, setHovered] = createSignal(false)

  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <T.Mesh
        scale={hovered() ? 1.2 : 1}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color="cornflowerblue" />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
