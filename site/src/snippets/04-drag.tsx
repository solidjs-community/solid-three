import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"
import { hasPointerCapture, pointerEvents } from "solid-three/events"

const T = createT(THREE, [pointerEvents()])

export default () => {
  const [position, setPosition] = createSignal<[number, number, number]>([0, 0, 0])
  let mesh: THREE.Mesh | undefined
  // Offset from the mesh origin to the grabbed point, so it doesn't jump on grab.
  let grabOffset = new THREE.Vector3()
  // Drag state is derived from the capture itself — no signal to keep in sync.
  const dragging = () => hasPointerCapture(mesh)

  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <T.Mesh
        ref={mesh}
        position={position()}
        scale={dragging() ? 1.15 : 1}
        onPointerDown={event => {
          event.setPointerCapture() // grab — moves now follow this mesh
          grabOffset = new THREE.Vector3(...position()).sub(event.intersection.point)
        }}
        onPointerMove={event => {
          if (!event.hasPointerCapture()) return
          // event.intersection.point tracks the drag plane, even off the mesh.
          const next = event.intersection.point.clone().add(grabOffset)
          setPosition([next.x, next.y, next.z])
        }}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={dragging() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
