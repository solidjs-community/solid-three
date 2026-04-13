import { Portal } from "@solidjs/web"
import * as THREE from "three"
import { Canvas, createT, useThree } from "../../../../src/index.ts"

const T = createT(THREE)

let container: HTMLDivElement

function Overview() {
  const three = useThree()

  return (
    <Portal mount={container!}>
      <details open style={{ position: "absolute", top: "0px" }}>
        <summary>
          <h3>Context Information</h3>
        </summary>
        <p>This example demonstrates accessing Three.js context using useThree:</p>
        <div>
          <h3>useThree Context</h3>
          <ul>
            <li>
              <strong>Camera Type:</strong> {three.camera.type}
            </li>
            <li>
              <strong>Canvas Size:</strong> {three.bounds.width}×{three.bounds.height}
            </li>
            <li>
              <strong>DPR:</strong> {three.dpr}
            </li>
            <li>
              <strong>Renderer:</strong> {three.gl.constructor.name}
            </li>
            <li>
              <strong>Scene Children:</strong> {three.scene.children.length}
            </li>
            <li>
              <strong>Clock Time:</strong> {three.clock.elapsedTime.toFixed(2)}s
            </li>
          </ul>
        </div>
      </details>
    </Portal>
  )
}

export default function () {
  return (
    <div ref={container!}>
      <Canvas defaultCamera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} />

        <T.Mesh>
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial color="red" />
        </T.Mesh>

        <Overview />
      </Canvas>
    </div>
  )
}
