import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const positions = new Float32Array(
  Array.from({ length: 200 * 3 }, () => (Math.random() - 0.5) * 3),
)

export default function App() {
  const [hits, setHits] = createSignal(0)
  return (
    <Canvas
      camera={{ position: [0, 0, 3] }}
      raycaster={{ params: { Points: { threshold: 0.1 } } }}
    >
      <T.Points onClick={() => setHits(value => value + 1)}>
        <T.BufferGeometry>
          <T.BufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </T.BufferGeometry>
        <T.PointsMaterial size={0.05} color={hits() ? "tomato" : "cornflowerblue"} />
      </T.Points>
    </Canvas>
  )
}
