import * as THREE from "three"
import { WebGPURenderer } from "three/webgpu"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

function SpinningKnot() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.4
    mesh.rotation.y += delta * 0.6
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[0.6, 0.2, 128, 32]} />
      <T.MeshStandardMaterial color="#9b59ff" metalness={0.4} roughness={0.25} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3] }}
      gl={canvas => new WebGPURenderer({ canvas, antialias: true })}
    >
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[5, 5, 5]} intensity={2} />
      <SpinningKnot />
    </Canvas>
  )
}
