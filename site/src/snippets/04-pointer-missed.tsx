import * as THREE from "three"
import { createSignal } from "solid-js"
import { createT } from "solid-three"
import { pointerEvents } from "solid-three/events"

const { T, Canvas } = createT.withCanvas(THREE, [pointerEvents()])

export default () => {
  const [selected, setSelected] = createSignal(false)

  return (
    <Canvas camera={{ position: [0, 0, 3] }} onPointerMissed={() => setSelected(false)}>
      <T.Mesh onClick={() => setSelected(true)}>
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={selected() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
