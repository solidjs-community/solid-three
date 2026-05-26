import * as THREE from "three"
import { createSignal, Match, Switch } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

type State = "idle" | "loading" | "ready"
const next: Record<State, State> = { idle: "loading", loading: "ready", ready: "idle" }

export default () => {
  const [state, setState] = createSignal<State>("idle")
  return (
    <>
      <button
        onClick={() => setState(value => next[value])}
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
        state: {state()} → cycle
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Switch>
          <Match when={state() === "idle"}>
            <T.Mesh>
              <T.BoxGeometry />
              <T.MeshStandardMaterial color="#666" />
            </T.Mesh>
          </Match>
          <Match when={state() === "loading"}>
            <T.Mesh>
              <T.TorusGeometry args={[0.6, 0.18, 16, 64]} />
              <T.MeshStandardMaterial color="cornflowerblue" />
            </T.Mesh>
          </Match>
          <Match when={state() === "ready"}>
            <T.Mesh>
              <T.SphereGeometry args={[0.7, 32, 16]} />
              <T.MeshStandardMaterial color="mediumseagreen" />
            </T.Mesh>
          </Match>
        </Switch>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
