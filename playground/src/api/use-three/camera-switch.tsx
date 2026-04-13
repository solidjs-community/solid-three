import { createEffect, createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useThree } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  const [useOrtho, setUseOrtho] = createSignal(false)

  return (
    <div>
      <details>
        <summary>
          <h3>Camera Switching Example</h3>
        </summary>
        <p>This example demonstrates the camera stack system from the README.</p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>
            Use <code>useThree()</code> to access the Three.js context
          </li>
          <li>
            <code>setCamera()</code> pushes a new camera onto the stack
          </li>
          <li>Returns a restore function to pop the camera</li>
          <li>
            Use <code>onCleanup()</code> for automatic restoration
          </li>
          <li>Cameras are properly managed when components unmount</li>
        </ul>

        <p style={{ "margin-top": "10px", "font-style": "italic" }}>
          Click the button below to switch between camera types and see the difference!
        </p>
      </details>

      <div
        style={{
          position: "absolute",
          bottom: "10px",

          "z-index": 1000,
          background: "rgba(0, 0, 0, 0.8)",
          padding: "10px",
          "border-radius": "8px",
          color: "white",
        }}
      >
        <button
          onClick={() => setUseOrtho(v => !v)}
          style={{
            background: useOrtho() ? "#4CAF50" : "#f44336",
            color: "white",
            border: "none",
            padding: "8px 16px",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          {useOrtho() ? "Switch to Perspective" : "Switch to Orthographic"}
        </button>
      </div>

      <Canvas defaultCamera={{ position: [0, 0, 5] }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} />

        <T.Mesh position={[-1, 0, 0]}>
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial color="red" />
        </T.Mesh>

        <T.Mesh position={[1, 0, 0]}>
          <T.SphereGeometry args={[0.7, 32, 16]} />
          <T.MeshStandardMaterial color="blue" />
        </T.Mesh>

        {(() => {
          const three = useThree()

          createEffect(
            () => useOrtho(),
            ortho => {
              if (!ortho) return
              const orthoCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000)
              orthoCamera.position.set(0, 0, 5)

              // Push ortho camera onto stack; cleanup restores previous camera.
              return three.setCamera(orthoCamera)
            },
          )

          return null!
        })()}
      </Canvas>
    </div>
  )
}
