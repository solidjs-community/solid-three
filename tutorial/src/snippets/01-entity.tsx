import * as THREE from "three"
import { Canvas, Entity } from "solid-three"

export default () => (
  <Canvas camera={{ position: [0, 0, 3] }}>
    <Entity from={THREE.Mesh}>
      <Entity from={THREE.BoxGeometry} />
      <Entity from={THREE.MeshNormalMaterial} />
    </Entity>
  </Canvas>
)
