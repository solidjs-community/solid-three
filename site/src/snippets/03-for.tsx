import * as THREE from "three"
import { createSignal, For } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const colors = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

export default () => {
  const [cubes, setCubes] = createSignal<string[]>(["cornflowerblue"])

  function addCube() {
    setCubes(list => [...list, colors[list.length % colors.length]])
  }
  function removeCube() {
    setCubes(list => list.slice(0, -1))
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={addCube}
          style={{
            padding: "0.5rem 0.75rem",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          add
        </button>
        <button
          onClick={removeCube}
          style={{
            padding: "0.5rem 0.75rem",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          remove
        </button>
      </div>
      <Canvas camera={{ position: [0, 0, 6] }}>
        <For each={cubes()}>
          {(color, index) => (
            <T.Mesh
              position={[(index() - (cubes().length - 1) / 2) * 1.2, 0, 0]}
              scale={0.7}
            >
              <T.BoxGeometry />
              <T.MeshStandardMaterial color={color} />
            </T.Mesh>
          )}
        </For>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
