import * as THREE from "three"
import { mix, sin, time, uv, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT({ ...THREE, MeshBasicNodeMaterial })

// A procedural material written entirely with TSL nodes. No GLSL strings, no
// uniforms hand-wired from JS each frame. `time` runs on the GPU.
function buildColorNode() {
  const stripes = sin(uv().x.mul(20).add(time.mul(2)))
  const wash = sin(uv().y.mul(8).sub(time))
  return mix(vec3(0.95, 0.3, 0.6), vec3(0.2, 0.7, 1.0), stripes.mul(0.5).add(wash.mul(0.5)))
}

function SpinningKnot() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.3
    mesh.rotation.y += delta * 0.4
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[0.6, 0.2, 128, 32]} />
      <T.MeshBasicNodeMaterial colorNode={buildColorNode()} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3] }}
      gl={canvas => new WebGPURenderer({ canvas, antialias: true })}
    >
      <SpinningKnot />
    </Canvas>
  )
}
