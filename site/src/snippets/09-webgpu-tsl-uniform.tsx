import * as THREE from "three"
import { createEffect, createSignal } from "solid-js"
import { mix, sin, step, time, uniform, uv, vec3 } from "three/tsl"
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT({ ...THREE, MeshBasicNodeMaterial })

export default function App() {
  const [frequency, setFrequency] = createSignal(20)

  // A TSL uniform whose value is read on the GPU each frame. Solid pushes
  // updates into it via createEffect — same signal → uniform plumbing
  // you'd use for any other reactive prop.
  const frequencyUniform = uniform(frequency())
  createEffect(() => {
    frequencyUniform.value = frequency()
  })

  const colorNode = mix(
    vec3(0.95, 0.3, 0.6),
    vec3(0.2, 0.7, 1.0),
    step(0, sin(uv().x.mul(frequencyUniform).add(time.mul(2)))),
  )

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
        <T.MeshBasicNodeMaterial colorNode={colorNode} />
      </T.Mesh>
    )
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          background: "rgba(20,23,31,0.85)",
          color: "#e8e8e8",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.8rem",
          "border-radius": "6px",
        }}
      >
        <label>
          stripes: {frequency()}
          <input
            type="range"
            min="2"
            max="60"
            step="1"
            value={frequency()}
            onInput={event => setFrequency(Number(event.currentTarget.value))}
            style={{ display: "block", width: "180px", "margin-top": "0.25rem" }}
          />
        </label>
      </div>
      <Canvas
        camera={{ position: [0, 0, 3] }}
        gl={canvas => new WebGPURenderer({ canvas, antialias: true })}
      >
        <SpinningKnot />
      </Canvas>
    </>
  )
}
