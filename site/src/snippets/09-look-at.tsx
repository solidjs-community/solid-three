import * as THREE from "three"
import { createSignal, For } from "solid-js"
import { Canvas, createT, plugin } from "solid-three"

// A plugin: every Object3D gains a `lookAt` prop that calls three's `lookAt()`.
const lookAt = plugin([THREE.Object3D], object => ({
  lookAt: (target: THREE.Vector3) => object.lookAt(target),
}))

const T = createT(THREE, [lookAt])

// One cone geometry, rotated so its tip points along -Z — the axis `lookAt` aims.
const cone = new THREE.ConeGeometry(0.18, 0.7, 24)
cone.rotateX(-Math.PI / 2)

// A 5×5 grid of cone positions in the XY-plane.
const positions: [number, number, number][] = []
for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) positions.push([x, y, 0])

export default () => {
  const [target, setTarget] = createSignal(new THREE.Vector3())

  return (
    <Canvas camera={{ position: [0, 0, 8] }}>
      {/* An invisible backdrop catches the pointer; the cones opt out of
          raycasting (`raycastable={false}`) so the ray always reaches it. */}
      <T.Mesh
        position={[0, 0, -0.5]}
        onPointerMove={event => setTarget(event.intersection.point.clone().setZ(0))}
      >
        <T.PlaneGeometry args={[24, 24]} />
        <T.MeshBasicMaterial visible={false} />
      </T.Mesh>

      <For each={positions}>
        {position => (
          <T.Mesh geometry={cone} position={position} raycastable={false} lookAt={target()}>
            <T.MeshStandardMaterial color="cornflowerblue" />
          </T.Mesh>
        )}
      </For>

      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[2, 2, 4]} />
    </Canvas>
  )
}
