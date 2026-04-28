import * as THREE from "three"
import { Canvas, createT, useFrame } from "../../../../src/index.ts"

const T = createT(THREE)

function AnimatedMesh() {
  let mesh: THREE.Mesh = null!

  // Run with high priority before render
  useFrame(
    (context, delta) => {
      mesh.position.x = Math.sin(delta) * 2
    },
    { priority: -1 },
  )

  // Run after render with lower priority
  useFrame(
    () => {
      console.info("Frame rendered")
    },
    { stage: "after", priority: 10 },
  )

  return (
    <T.Mesh ref={mesh}>
      <T.BoxGeometry args={[1, 1, 1]} />
      <T.MeshStandardMaterial color="red" />
    </T.Mesh>
  )
}

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Basic Rotation Animation</h3>
        </summary>
        <p>This demonstrates the most basic use of useFrame from the README:</p>
        <ul>
          <li>Simple mesh rotation using delta time</li>
          <li>Consistent speed regardless of framerate</li>
          <li>Delta ensures smooth animation (delta * PI radians per second)</li>
        </ul>
        <p>
          <strong>Key concept:</strong> Always use delta for frame-rate independent animations.
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <AnimatedMesh />
      </Canvas>
    </div>
  )
}
