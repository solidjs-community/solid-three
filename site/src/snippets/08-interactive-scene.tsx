import * as THREE from "three"
import { createSignal, For, onCleanup, Show, Suspense } from "solid-js"
import { Canvas, createT, useFrame, useLoader } from "solid-three"

const T = createT(THREE)

const GRID_SIZE = 3
const SPACING = 1.1
const ROUND_DURATION_MS = 20_000

// Build a 3x3 grid of cube positions centred on the origin.
const positions: [number, number, number][] = []
for (let y = 0; y < GRID_SIZE; y++) {
  for (let x = 0; x < GRID_SIZE; x++) {
    positions.push([
      (x - (GRID_SIZE - 1) / 2) * SPACING,
      (y - (GRID_SIZE - 1) / 2) * SPACING,
      0,
    ])
  }
}

function pickRandomIndex(exclude: number): number {
  let next = exclude
  while (next === exclude) next = Math.floor(Math.random() * positions.length)
  return next
}

function Cube(props: {
  position: [number, number, number]
  active: boolean
  onHit: () => void
}) {
  // A loaded texture wraps every cube; the active one tints + glows
  // tomato on top of it. `useLoader` caches per URL, so all nine cubes
  // share one upload.
  const texture = useLoader(THREE.TextureLoader, "https://picsum.photos/seed/whack/256")

  let mesh: THREE.Mesh | undefined
  // The active cube bobs forward toward the camera.
  useFrame(context => {
    if (!mesh) return
    mesh.position.z = props.active
      ? Math.sin(context.clock.elapsedTime * 6) * 0.1 + 0.2
      : 0
  })
  return (
    <T.Mesh
      ref={mesh}
      position={props.position}
      scale={0.7}
      onClick={event => {
        event.stopPropagation()
        if (props.active) props.onHit()
      }}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial
        map={texture()}
        color={props.active ? "tomato" : "#ffffff"}
        emissive={props.active ? "tomato" : "#000000"}
        emissiveIntensity={props.active ? 0.5 : 0}
      />
    </T.Mesh>
  )
}

export default function App() {
  const [running, setRunning] = createSignal(false)
  const [score, setScore] = createSignal(0)
  const [activeIndex, setActiveIndex] = createSignal(0)
  const [timeLeft, setTimeLeft] = createSignal(ROUND_DURATION_MS)

  function startRound() {
    setScore(0)
    setActiveIndex(Math.floor(Math.random() * positions.length))
    setTimeLeft(ROUND_DURATION_MS)
    setRunning(true)
    const startedAt = performance.now()
    const id = setInterval(() => {
      const remaining = ROUND_DURATION_MS - (performance.now() - startedAt)
      if (remaining <= 0) {
        setTimeLeft(0)
        setRunning(false)
        clearInterval(id)
      } else {
        setTimeLeft(remaining)
      }
    }, 100)
    onCleanup(() => clearInterval(id))
  }

  function handleHit() {
    setScore(value => value + 1)
    setActiveIndex(index => pickRandomIndex(index))
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.75rem 1rem",
          background: "rgba(20,23,31,0.9)",
          color: "#e8e8e8",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.85rem",
          "border-radius": "6px",
          "min-width": "10rem",
        }}
      >
        <div>score: {score()}</div>
        <div>time: {(timeLeft() / 1000).toFixed(1)}s</div>
        <Show when={!running()}>
          <button
            onClick={startRound}
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
            {timeLeft() === 0 ? "play again" : "start"}
          </button>
        </Show>
      </div>
      <Canvas camera={{ position: [0, 0, 4] }}>
        <Suspense>
          <For each={positions}>
            {(position, index) => (
              <Cube
                position={position}
                active={running() && activeIndex() === index()}
                onHit={handleHit}
              />
            )}
          </For>
        </Suspense>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 3]} />
      </Canvas>
    </>
  )
}
