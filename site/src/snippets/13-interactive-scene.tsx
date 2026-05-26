import * as THREE from "three"
import { createSignal, For, Show } from "solid-js"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

interface CubeData {
  id: number
  color: string
  position: [number, number, number]
}

const initialCubes: CubeData[] = [
  { id: 1, color: "cornflowerblue", position: [-1.4, 0, 0] },
  { id: 2, color: "tomato", position: [0, 0, 0] },
  { id: 3, color: "mediumseagreen", position: [1.4, 0, 0] },
]

function Cube(props: {
  data: CubeData
  selected: boolean
  onSelect: () => void
}) {
  const [hovered, setHovered] = createSignal(false)
  let mesh: THREE.Mesh | undefined

  // Selected cubes bob gently up and down.
  useFrame(context => {
    if (!mesh) return
    if (props.selected) {
      mesh.position.y = Math.sin(context.clock.elapsedTime * 3) * 0.15
    } else {
      mesh.position.y = 0
    }
  })

  return (
    <T.Mesh
      ref={mesh}
      position={props.data.position}
      scale={hovered() ? 1.15 : 1}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={event => {
        event.stopPropagation()
        props.onSelect()
      }}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        color={props.data.color}
        emissive={props.selected ? props.data.color : "#000000"}
        emissiveIntensity={props.selected ? 0.4 : 0}
      />
    </T.Mesh>
  )
}

export default function App() {
  const [selectedId, setSelectedId] = createSignal<number | null>(null)
  const selected = () => initialCubes.find(c => c.id === selectedId()) ?? null

  return (
    <>
      <Show when={selected()}>
        {selected => (
          <div
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              "z-index": 1,
              padding: "0.75rem 1rem",
              background: "rgba(20,23,31,0.9)",
              color: "#e8e8e8",
              "font-family": "ui-monospace, monospace",
              "font-size": "0.8rem",
              "border-radius": "6px",
              "min-width": "10rem",
            }}
          >
            <div>cube #{selected().id}</div>
            <div style={{ color: selected().color }}>{selected().color}</div>
            <button
              onClick={() => setSelectedId(null)}
              style={{
                "margin-top": "0.5rem",
                padding: "0.25rem 0.5rem",
                background: "transparent",
                color: "#c8c8c8",
                border: "1px solid #333",
                "border-radius": "4px",
                cursor: "pointer",
                "font-size": "0.75rem",
              }}
            >
              deselect
            </button>
          </div>
        )}
      </Show>
      <Canvas
        camera={{ position: [0, 0, 4] }}
        onClickMissed={() => setSelectedId(null)}
      >
        <For each={initialCubes}>
          {cube => (
            <Cube
              data={cube}
              selected={selectedId() === cube.id}
              onSelect={() => setSelectedId(cube.id)}
            />
          )}
        </For>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
