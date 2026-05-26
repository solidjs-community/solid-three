import * as THREE from "three"
import WebGPURenderer from "three/addons/renderers/webgpu/WebGPURenderer.js"
import { Canvas, createT, useFrame } from "../../../src/index.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT(THREE)

function SpinningKnot() {
  let mesh: THREE.Mesh = null!
  useFrame((_, delta) => {
    mesh.rotation.x += delta * 0.4
    mesh.rotation.y += delta * 0.6
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[1, 0.35, 256, 32]} />
      <T.MeshStandardMaterial color="#9b59ff" metalness={0.4} roughness={0.25} />
    </T.Mesh>
  )
}

/**
 * Minimal WebGPU example: hands a `WebGPURenderer` factory to `<Canvas>`.
 * solid-three awaits `renderer.init()` before the first frame.
 */
export default function () {
  return (
    <Canvas
      camera={{ position: new THREE.Vector3(0, 0, 5) }}
      gl={canvas => new WebGPURenderer({ canvas, antialias: true })}
    >
      <OrbitControls />
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[5, 5, 5]} intensity={2} />
      <T.DirectionalLight position={[-5, -5, -5]} intensity={0.5} color="#88f" />
      <SpinningKnot />
    </Canvas>
  )
}
