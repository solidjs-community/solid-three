import * as THREE from "three"
import { mix, sin, time, uv, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu"
import { Canvas, createT, useFrame } from "../../../src/index.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT({ ...THREE, MeshBasicNodeMaterial })

/**
 * Animated procedural material built entirely with TSL nodes — no GLSL, no
 * uniforms set from JS each frame. `timerLocal()` drives the animation on the
 * GPU; `uv()` is the per-fragment UV; `mix`/`sin` are TSL math ops.
 */
function buildColorNode() {
  const t = time
  const stripes = sin(uv().x.mul(20).add(t.mul(2)))
  const wash = sin(uv().y.mul(8).sub(t))
  return mix(vec3(0.95, 0.3, 0.6), vec3(0.2, 0.7, 1.0), stripes.mul(0.5).add(wash.mul(0.5)))
}

function SpinningKnot() {
  let mesh: THREE.Mesh = null!
  useFrame((_, delta) => {
    mesh.rotation.x += delta * 0.3
    mesh.rotation.y += delta * 0.4
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[1, 0.35, 256, 32]} />
      <T.MeshBasicNodeMaterial colorNode={buildColorNode()} />
    </T.Mesh>
  )
}

export default function () {
  return (
    <Canvas
      camera={{ position: new THREE.Vector3(0, 0, 5) }}
      gl={canvas => new WebGPURenderer({ canvas, antialias: true })}
    >
      <OrbitControls />
      <SpinningKnot />
    </Canvas>
  )
}
