import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export function App() {
  const [hovered, setHovered] = createSignal(false)

  return (
    <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[5, 5, 5]} intensity={1} />
      <T.Mesh onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
        <T.BoxGeometry args={[2, 2, 2]} />
        <T.MeshStandardMaterial color={hovered() ? "green" : "red"} />
      </T.Mesh>
    </Canvas>
  )
}
