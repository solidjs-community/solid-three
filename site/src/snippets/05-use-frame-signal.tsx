import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

function SpinningCube() {
  const [angle, setAngle] = createSignal(0)
  useFrame((_context, delta) => setAngle(value => value + delta))
  return (
    <T.Mesh rotation={[angle(), angle(), 0]}>
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
