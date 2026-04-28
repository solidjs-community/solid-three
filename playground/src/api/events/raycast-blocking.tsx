import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Raycast Blocking Example</h3>
        </summary>
        <p>This example demonstrates how raycast propagation and blocking works in solid-three.</p>

        <p>
          <strong>Scene setup:</strong>
        </p>
        <ul>
          <li>
            <strong>Yellow cube:</strong> Front object (closer to camera)
          </li>
          <li>
            <strong>Green cube:</strong> Back object (further from camera)
          </li>
        </ul>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>Raycasting hits objects in order (front to back)</li>
          <li>
            <code>stopPropagation()</code> prevents the raycast from continuing
          </li>
          <li>
            When an object blocks the raycast, objects behind it receive <code>onClickMissed</code>
          </li>
          <li>This mimics real-world occlusion behavior</li>
        </ul>

        <p>
          <strong>Try it:</strong>
        </p>
        <ul>
          <li>Click the yellow cube - only it receives the click</li>
          <li>Click where they overlap - green cube's onClickMissed fires</li>
          <li>Click the green cube directly - it receives the click</li>
        </ul>

        <p
          style={{
            "margin-top": "10px",
            "background-color": "rgba(255, 255, 0, 0.2)",
            padding: "5px",
            "border-radius": "4px",
          }}
        >
          <strong>⚠️ Open the console to see the blocking behavior!</strong>
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh
          name="front mesh"
          position={[0, 0, 2]}
          onClick={e => {
            e.stopPropagation()
            console.info("Front mesh clicked")
          }}
        >
          <T.BoxGeometry args={[1.5, 1.5, 1]} />
          <T.MeshStandardMaterial color="yellow" transparent opacity={0.8} />
        </T.Mesh>

        <T.Mesh
          name="back mesh"
          position={[0, 0, 0]}
          onClickMissed={() => console.info("Back mesh missed - front mesh blocked it")}
        >
          <T.BoxGeometry args={[2, 2, 1]} />
          <T.MeshStandardMaterial color="green" transparent opacity={0.6} />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
