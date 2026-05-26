import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 5] }}>
    <T.Group rotation={[0, 0.6, 0]}>
      <T.Mesh position={[-1.2, 0, 0]}>
        <T.BoxGeometry />
        <T.MeshNormalMaterial />
      </T.Mesh>
      <T.Mesh position={[1.2, 0, 0]}>
        <T.BoxGeometry />
        <T.MeshNormalMaterial />
      </T.Mesh>
    </T.Group>
  </Canvas>
)
