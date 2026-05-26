import * as THREE from "three"
import { Canvas, createT, useProps, autodispose } from "solid-three"

const T = createT(THREE)

// A custom helper that creates a `THREE.AxesHelper` directly and wires it up
// with solid-three's prop pipeline via `useProps`. The caller can pass any
// Object3D prop — position, rotation, scale, visible — and it works the same
// as it would on a built-in <T.*> component.
function Axes(props: { size?: number; position?: [number, number, number]; scale?: number; visible?: boolean }) {
  const axes = autodispose(new THREE.AxesHelper(props.size ?? 1))
  useProps(axes, props)
  return axes
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <Axes position={[-1, 0, 0]} size={0.8} />
      <Axes position={[1, 0, 0]} size={0.5} />
      <T.Mesh>
        <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
        <T.MeshNormalMaterial />
      </T.Mesh>
    </Canvas>
  )
}
