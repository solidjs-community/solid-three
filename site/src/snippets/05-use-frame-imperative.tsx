import * as THREE from "three"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

function SpinningCube() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta
    mesh.rotation.y += delta
  })
  return (
    <T.Mesh ref={mesh}>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <SpinningCube />
    </Canvas>
  )
}
