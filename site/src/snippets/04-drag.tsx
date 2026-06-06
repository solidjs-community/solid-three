import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [position, setPosition] = createSignal<[number, number, number]>([0, 0, 0])
  const [dragging, setDragging] = createSignal(false)
  // Offset from the mesh origin to the grabbed point, so it doesn't jump on grab.
  let grabOffset = new THREE.Vector3()

  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <T.Mesh
        position={position()}
        scale={dragging() ? 1.15 : 1}
        onPointerDown={event => {
          event.stopPropagation()
          event.setPointerCapture() // grab — moves now follow this mesh
          grabOffset = new THREE.Vector3(...position()).sub(event.intersection.point)
          setDragging(true)
        }}
        onPointerMove={event => {
          if (!dragging()) return
          // event.intersection.point tracks the drag plane, even off the mesh.
          const next = event.intersection.point.clone().add(grabOffset)
          setPosition([next.x, next.y, next.z])
        }}
        onPointerUp={() => setDragging(false)} // capture auto-releases on pointerup
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={dragging() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
