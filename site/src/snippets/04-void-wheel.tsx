import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export default () => {
  const [size, setSize] = createSignal(1)
  const [distance, setDistance] = createSignal(5)

  return (
    <Canvas
      camera={{ position: [0, 0, distance()] }}
      onVoidWheel={event => setDistance(d => clamp(d + event.nativeEvent.deltaY * 0.005, 3, 9))}
    >
      <T.Mesh
        scale={size()}
        onWheel={event => setSize(s => clamp(s - event.nativeEvent.deltaY * 0.001, 0.5, 2))}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color="cornflowerblue" />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
