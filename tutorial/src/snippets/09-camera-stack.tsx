import * as THREE from "three"
import { createSignal, Show, onCleanup } from "solid-js"
import { Canvas, createT, useThree } from "solid-three"

const T = createT(THREE)

function TopDownCamera() {
  const context = useThree()
  const camera = new THREE.PerspectiveCamera(50)
  camera.position.set(0, 5, 0)
  camera.lookAt(0, 0, 0)
  // setCamera pushes onto the camera stack and returns a cleanup that pops it
  // off again. When this component unmounts, the previous camera takes over.
  onCleanup(context.setCamera(camera))
  return null
}

export default function App() {
  const [topDown, setTopDown] = createSignal(false)
  return (
    <>
      <button
        onClick={() => setTopDown(value => !value)}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          background: "#fff",
          border: "0",
          "border-radius": "4px",
          cursor: "pointer",
        }}
      >
        {topDown() ? "side view" : "top-down view"}
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Show when={topDown()}>
          <TopDownCamera />
        </Show>
        <T.Mesh position={[-1, 0, 0]}>
          <T.BoxGeometry />
          <T.MeshStandardMaterial color="cornflowerblue" />
        </T.Mesh>
        <T.Mesh position={[1, 0, 0]}>
          <T.BoxGeometry />
          <T.MeshStandardMaterial color="tomato" />
        </T.Mesh>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
