import { Show, createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, Entity, autodispose, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  const [shape, setShape] = createSignal<"box" | "sphere">("box")

  // Correct way: autodispose instances for conditional rendering
  const boxGeometry = autodispose(new THREE.BoxGeometry(0.8, 0.8, 0.8))
  const sphereGeometry = autodispose(new THREE.SphereGeometry(0.5, 32, 16))
  const material = autodispose(
    new THREE.MeshStandardMaterial({
      color: "blue",
      transparent: true,
      opacity: 0.8,
    }),
  )

  return (
    <div>
      <details>
        <summary>
          <h3>Conditional Rendering</h3>
        </summary>
        <p>This example demonstrates autodispose with conditional rendering:</p>
        <ul>
          <li>
            <strong>Shape switching:</strong> Toggle between box and sphere geometry
          </li>
          <li>
            <strong>Resource safety:</strong> Unused geometries are properly disposed
          </li>
          <li>
            <strong>Solid Show:</strong> Uses Solid's Show component for conditions
          </li>
        </ul>
        <p>
          Click the shape to toggle between box and sphere. Both geometries are autodisposed for
          safety.
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh onClick={() => setShape(s => (s === "box" ? "sphere" : "box"))}>
          <Show when={shape() === "box"} fallback={<Entity from={sphereGeometry} />}>
            <Entity from={boxGeometry} />
          </Show>
          <Entity from={material} />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
