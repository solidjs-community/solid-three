import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [front, setFront] = createSignal(false)
  const [back, setBack] = createSignal(false)

  return (
    <Canvas camera={{ position: [0, 0, 4] }}>
      <T.Mesh
        position={[0, 0, -1]}
        onClick={() => setBack(value => !value)}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={back() ? "tomato" : "#888"} />
      </T.Mesh>
      <T.Mesh
        position={[0, 0, 0]}
        scale={0.6}
        onClick={event => {
          event.stopPropagation()
          setFront(value => !value)
        }}
      >
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={front() ? "tomato" : "cornflowerblue"} />
      </T.Mesh>
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
