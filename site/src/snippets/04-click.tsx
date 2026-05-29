import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [hot, setHot] = createSignal(false)

  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <T.Mesh onClick={() => setHot(value => !value)}>
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={hot() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
