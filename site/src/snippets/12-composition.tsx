import * as THREE from "three"
import { ParentProps } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

// A reusable Cube component. Props pass through to <T.Mesh>, so the caller
// gets the full smart-prop syntax (position arrays, scale numbers, ...) "for
// free" — <T.Mesh> handles it via its own useProps internally.
function Cube(props: ParentProps & { color?: string; position?: [number, number, number]; scale?: number }) {
  return (
    <T.Mesh {...props}>
      <T.BoxGeometry args={[0.6, 0.6, 0.6]} />
      <T.MeshStandardMaterial color={props.color ?? "cornflowerblue"} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <Cube position={[-1, 0, 0]} color="cornflowerblue" />
      <Cube position={[0, 0, 0]} color="tomato" scale={0.6} />
      <Cube position={[1, 0, 0]} color="mediumseagreen" />
      <T.AmbientLight intensity={0.4} />
      <T.DirectionalLight position={[2, 2, 2]} />
    </Canvas>
  )
}
