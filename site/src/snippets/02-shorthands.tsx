import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 4] }}>
    <T.Mesh position={[-1.5, 0, 0]} scale={1.2}>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color="cornflowerblue" />
    </T.Mesh>
    <T.Mesh position={[1.5, 0, 0]} scale={0.8}>
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={[1, 0.4, 0.2]} />
    </T.Mesh>
    <T.AmbientLight intensity={0.3} />
    <T.DirectionalLight position={[2, 2, 2]} />
  </Canvas>
)
