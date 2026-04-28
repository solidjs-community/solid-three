import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useFrame } from "../src/index.ts"

const T = createT(THREE)

export function App() {
  return (
    <Canvas>
      <Cube />
    </Canvas>
  )
}

function Cube() {
  const [hovered, setHovered] = createSignal(false)
  let meshRef!: THREE.Mesh

  useFrame(() => {
    if (meshRef) {
      meshRef.rotation.x += 0.01
      meshRef.rotation.y += 0.01
    }
  })

  return (
    <T.Mesh
      ref={el => (meshRef = el)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <T.BoxGeometry args={[1, 1, 1]} />
      <T.MeshStandardMaterial color={hovered() ? "hotpink" : "orange"} />
    </T.Mesh>
  )
}
