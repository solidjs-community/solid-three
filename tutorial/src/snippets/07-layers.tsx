import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default function App() {
  const [front, setFront] = createSignal(false)
  // Mesh on layer 1 is invisible to the default raycaster (which only checks
  // layer 0). The back cube here is on layer 1, so it cannot be clicked,
  // even though it sits directly behind the front one.
  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <T.Mesh
        position={[0, 0, -0.5]}
        ref={mesh => mesh.layers.set(1)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color="#444" />
      </T.Mesh>
      <T.Mesh
        scale={0.6}
        onClick={() => setFront(value => !value)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={front() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
