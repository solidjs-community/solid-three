import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

// Counts how many times the App body itself runs. In React this would tick
// up with every click. In Solid it runs once: only the reactive expression
// reading `hot()` re-evaluates.
let setupRuns = 0

export default () => {
  setupRuns++
  const [hot, setHot] = createSignal(false)

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          background: "rgba(20,23,31,0.9)",
          color: "#e8e8e8",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.8rem",
          "border-radius": "6px",
        }}
      >
        <div>
          App body has run: {setupRuns} time{setupRuns === 1 ? "" : "s"}
        </div>
        <button
          onClick={() => setHot(value => !value)}
          style={{
            "margin-top": "0.5rem",
            padding: "0.3rem 0.75rem",
            background: "tomato",
            color: "#fff",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
            "font-size": "0.8rem",
          }}
        >
          Toggle colour
        </button>
      </div>
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
