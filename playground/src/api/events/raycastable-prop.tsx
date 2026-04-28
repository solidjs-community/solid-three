import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Raycastable Control Example</h3>
        </summary>
        <p>
          This example demonstrates the <code>raycastable</code> prop and event bubbling behavior.
        </p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>
            <code>raycastable={"{false}"}</code> makes an object "transparent" to raycasts
          </li>
          <li>Non-raycastable objects can still receive events through bubbling</li>
          <li>Child events bubble up to non-raycastable parents</li>
          <li>Useful for creating invisible hit areas or grouping objects</li>
        </ul>

        <p
          style={{
            "margin-top": "10px",
            "background-color": "rgba(255, 255, 0, 0.2)",
            padding: "5px",
            "border-radius": "4px",
          }}
        >
          <strong>⚠️ Open the console to see event bubbling!</strong>
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh
          name="parent"
          raycastable={false}
          onClick={() => console.info("Child clicked! Event bubbled to parent.")}
          position={[0, 0, 0]}
        >
          <T.BoxGeometry args={[3, 3, 1]} />
          <T.MeshStandardMaterial color="gray" transparent opacity={0.3} />

          <T.Mesh
            name="child"
            position={[0, 0, 0.6]}
            onClick={() => console.info("Child mesh clicked directly")}
          >
            <T.SphereGeometry args={[0.8, 32, 16]} />
            <T.MeshStandardMaterial color="lime" />
          </T.Mesh>
        </T.Mesh>
      </Canvas>
    </div>
  )
}
