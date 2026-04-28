import * as THREE from "three"
import { Canvas, createT, Entity, Portal } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  const group = new THREE.Group()
  return (
    <div>
      <details>
        <summary>
          <h3>Portal Component Demo</h3>
        </summary>
        <p>
          This example demonstrates the Portal component for rendering objects into arbitrary
          Three.js nodes.
        </p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>Portal renders children into a specific Three.js object</li>
          <li>Useful for organizing complex scene hierarchies</li>
          <li>Maintains proper event handling across portals</li>
          <li>Children are reactive and update normally</li>
        </ul>

        <p>
          <strong>In this example:</strong>
        </p>
        <ul>
          <li>A Group is created and positioned at (0, 5, 0)</li>
          <li>The red sphere is rendered into that group via Portal</li>
          <li>The sphere appears at the group's position</li>
          <li>Events work correctly through the portal</li>
        </ul>

        <p
          style={{
            "margin-top": "10px",
            "background-color": "rgba(255, 255, 0, 0.2)",
            padding: "5px",
            "border-radius": "4px",
          }}
        >
          <strong>⚠️ Open console to see canvas events firing!</strong>
        </p>
      </details>

      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: new THREE.Vector3(0, 0, 30) }}
        onClick={event => console.debug("canvas clicked", event)}
        onClickMissed={event => console.debug("canvas click missed", event)}
        onPointerLeave={event => console.debug("canvas pointer leave", event)}
        onPointerEnter={event => console.debug("canvas pointer enter", event)}
      >
        <Entity from={group} position={[0, 5, 0]} />
        <Portal element={group}>
          <T.Mesh>
            <T.SphereGeometry args={[2, 32, 32]} />
            <T.MeshBasicMaterial color="red" />
          </T.Mesh>
        </Portal>
      </Canvas>
    </div>
  )
}
