import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useFrame } from "../../src"

const T = createT(THREE)

export function App() {
  const [hovered, setHovered] = createSignal(false)
  let meshRef!: THREE.Mesh

  return (
    <Canvas
      camera={{ position: [5, 5, 5] }}
      ref={ctx => {
        ctx.camera.lookAt(0, 0, 0)
      }}
    >
      {() => {
        useFrame(() => {
          if (meshRef) {
            meshRef.rotation.x += 0.01
            meshRef.rotation.y += 0.01
          }
        })
        return null!
      }}
      <T.Mesh
        ref={el => (meshRef = el)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <T.BoxGeometry args={[1, 1, 1]} />
        <T.MeshBasicMaterial color={hovered() ? "blue" : "red"} />
      </T.Mesh>
    </Canvas>
  )
}
