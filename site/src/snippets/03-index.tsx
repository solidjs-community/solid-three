import * as THREE from "three"
import { createSignal, Index } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const palette = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

export default () => {
  const [colors, setColors] = createSignal(["cornflowerblue", "tomato", "mediumseagreen"])

  function shuffle() {
    setColors(current =>
      current.map(() => palette[Math.floor(Math.random() * palette.length)]),
    )
  }

  return (
    <>
      <button
        onClick={shuffle}
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
        shuffle colours
      </button>
      <Canvas camera={{ position: [0, 0, 4] }}>
        <Index each={colors()}>
          {(color, index) => (
            <T.Mesh position={[(index - 1) * 1.2, 0, 0]} scale={0.7}>
              <T.BoxGeometry />
              <T.MeshStandardMaterial color={color()} />
            </T.Mesh>
          )}
        </Index>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
