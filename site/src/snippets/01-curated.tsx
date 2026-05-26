import { Mesh, BoxGeometry, MeshNormalMaterial } from "three"
import { Canvas, createT } from "solid-three"

const T = createT({ Mesh, BoxGeometry, MeshNormalMaterial })

export default () => (
  <Canvas camera={{ position: [0, 0, 3] }}>
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  </Canvas>
)
