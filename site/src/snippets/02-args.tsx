import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 4] }}>
    <T.Mesh>
      <T.BoxGeometry args={[2, 1, 1]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  </Canvas>
)
