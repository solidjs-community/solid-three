import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Click Outside Detection</h3>
        </summary>
        <p>
          This example demonstrates the <code>onClickMissed</code> event handler from the README.
        </p>
        <p>
          The onClickMissed event fires when you click anywhere in the canvas that doesn't hit a
          raycastable object. This is particularly useful for:
        </p>
        <ul>
          <li>Deselecting objects when clicking empty space</li>
          <li>Closing menus or dialogs</li>
          <li>Clearing highlights or focus states</li>
          <li>General UI layer interactions</li>
        </ul>
        <p>
          <strong>Try it out:</strong>
        </p>
        <ul>
          <li>Click on the blue cube - nothing happens</li>
          <li>Click anywhere else in the canvas - triggers onClickMissed</li>
        </ul>
        <p
          style={{
            "margin-top": "10px",
            "background-color": "rgba(255, 255, 0, 0.2)",
            padding: "5px",
            "border-radius": "4px",
          }}
        >
          <strong>⚠️ Open the console to see the missed click events!</strong>
        </p>
      </details>

      <Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 0, 5] }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh onClickMissed={() => console.info("Missed - clicked outside this mesh")}>
          <T.BoxGeometry args={[2, 2, 2]} />
          <T.MeshStandardMaterial color="blue" />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
