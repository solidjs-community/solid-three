import * as THREE from "three"
import { Canvas, createT, useThree } from "../../../../src/index.ts"

const T = createT(THREE)

function ManualRenderer() {
  const three = useThree()

  const forceRender = () => {
    console.info("Manual render triggered")
    three.render(performance.now())
  }

  const requestRender = () => {
    console.info("Render requested")
    three.requestRender()
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        left: "10px",
        "z-index": 1000,
        background: "rgba(0, 0, 0, 0.8)",
        padding: "10px",
        "border-radius": "8px",
        color: "white",
      }}
    >
      <button
        onClick={forceRender}
        style={{
          background: "#FF9800",
          color: "white",
          border: "none",
          padding: "8px 16px",
          "border-radius": "4px",
          cursor: "pointer",
          "margin-right": "8px",
        }}
      >
        Force Render
      </button>
      <button
        onClick={requestRender}
        style={{
          background: "#2196F3",
          color: "white",
          border: "none",
          padding: "8px 16px",
          "border-radius": "4px",
          cursor: "pointer",
        }}
      >
        Request Render
      </button>
    </div>
  )
}

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Manual Rendering</h3>
        </summary>
        <p>This example demonstrates manual render control with demand frameloop:</p>
        <ul>
          <li>
            <strong>Demand mode:</strong> Only renders when needed
          </li>
          <li>
            <strong>Force Render:</strong> Immediate render using three.render()
          </li>
          <li>
            <strong>Request Render:</strong> Queued render using three.requestRender()
          </li>
        </ul>
        <p>Open console to see render trigger logs. Scene only updates when you click buttons.</p>
      </details>

      <Canvas
        camera={{ position: [0, 0, 5] }}
        frameloop="demand"
        style={{ width: "100%", height: "100%" }}
      >
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} />

        <T.Mesh>
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial color="green" />
        </T.Mesh>

        <ManualRenderer />
      </Canvas>
    </div>
  )
}
