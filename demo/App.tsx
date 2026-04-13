import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, Entity, useFrame } from "../src/index.ts"

const T = createT(THREE)

export function App() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <Cube />
    </Canvas>
  )
}

function Cube() {
  const [hovered, setHovered] = createSignal(false)
  const meshRef = { current: null as THREE.Mesh | null }

  useFrame((_, { object }) => {
    if (object) {
      object.rotation.x += 0.01
      object.rotation.y += 0.01
    }
  })

  return (
    <Entity
      from={THREE.Mesh}
      ref={meshRef}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <T.BoxGeometry args={[1, 1, 1]} />
      <T.MeshStandardMaterial color={hovered() ? "hotpink" : "orange"} />
    </Entity>
  )
}
