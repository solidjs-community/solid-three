import * as THREE from "three"
import { createResource, createSignal, Suspense } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const palette = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

function pickRandomColor(): Promise<string> {
  return new Promise(resolve =>
    setTimeout(() => resolve(palette[Math.floor(Math.random() * palette.length)]), 800),
  )
}

export default () => {
  const [nonce, setNonce] = createSignal(0)
  // The resource refetches whenever `nonce` changes — that's what suspends.
  const [color] = createResource(nonce, pickRandomColor)

  function Cube() {
    return (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={color()} />
      </T.Mesh>
    )
  }

  function Spinner() {
    return (
      <T.Mesh>
        <T.TorusGeometry args={[0.6, 0.06, 16, 48]} />
        <T.MeshBasicMaterial color="#888" />
      </T.Mesh>
    )
  }

  return (
    <>
      <button
        onClick={() => setNonce(value => value + 1)}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          border: "0",
          "border-radius": "4px",
          cursor: "pointer",
        }}
      >
        new colour
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Suspense fallback={<Spinner />}>
          <Cube />
        </Suspense>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
