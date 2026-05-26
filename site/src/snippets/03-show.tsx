import * as THREE from "three"
import { createSignal, Show } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [visible, setVisible] = createSignal(true)

  return (
    <>
      <button
        onClick={() => setVisible(value => !value)}
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
        {visible() ? "remove cube" : "add cube"}
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Show when={visible()}>
          <T.Mesh>
            <T.BoxGeometry />
            <T.MeshNormalMaterial />
          </T.Mesh>
        </Show>
      </Canvas>
    </>
  )
}
