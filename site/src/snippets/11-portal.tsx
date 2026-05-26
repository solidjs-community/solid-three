import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT, Portal } from "solid-three"

const T = createT(THREE)

export default function App() {
  const [shifted, setShifted] = createSignal(false)
  return (
    <>
      <button
        onClick={() => setShifted(value => !value)}
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
        move parent group
      </button>

      <Canvas camera={{ position: [0, 0, 3] }}>
        {/* Parent group shifts horizontally when you click the button. */}
        <T.Group position={[shifted() ? 1 : -1, 0, 0]}>
          {/* Normal child — moves with the group. */}
          <T.Mesh>
            <T.BoxGeometry args={[0.6, 0.6, 0.6]} />
            <T.MeshStandardMaterial color="cornflowerblue" />
          </T.Mesh>

          {/* Same JSX nesting, but Portal sends this one to the scene root.
              It doesn't inherit the group's translation. */}
          <Portal>
            <T.Mesh position={[0, 0.8, 0]}>
              <T.BoxGeometry args={[0.6, 0.6, 0.6]} />
              <T.MeshStandardMaterial color="tomato" />
            </T.Mesh>
          </Portal>
        </T.Group>

        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
