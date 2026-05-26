import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [hot, setHot] = createSignal(false)

  return (
    <>
      <button
        onClick={() => setHot(value => !value)}
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
        Toggle colour
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshStandardMaterial color={hot() ? "tomato" : "cornflowerblue"} />
        </T.Mesh>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
