import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT, useFrame, useThree } from "solid-three"

const T = createT(THREE)

function OrbitingCamera() {
  const context = useThree()
  useFrame(() => {
    const time = context.clock.elapsedTime
    context.camera.position.x = Math.sin(time) * 3
    context.camera.position.z = Math.cos(time) * 3
    context.camera.lookAt(0, 0, 0)
  })
  return null
}

function Reporter(props: { set: (value: string) => void }) {
  const context = useThree()
  useFrame(() => {
    const { x, y, z } = context.camera.position
    props.set(`camera @ ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`)
  })
  return null
}

export default function App() {
  const [info, setInfo] = createSignal("…")
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.8rem",
          "border-radius": "4px",
        }}
      >
        {info()}
      </div>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <OrbitingCamera />
        <Reporter set={setInfo} />
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshNormalMaterial />
        </T.Mesh>
      </Canvas>
    </>
  )
}
