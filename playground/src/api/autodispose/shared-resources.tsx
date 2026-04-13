import { createSignal, Repeat } from "solid-js"
import * as THREE from "three"
import { autodispose, Canvas, createT, Entity } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  const [instanceCount, setInstanceCount] = createSignal(3)

  // Shared geometry and material - autodisposed when no longer used
  const geometry = autodispose(new THREE.SphereGeometry(0.3, 16, 16))
  const material = autodispose(
    new THREE.MeshStandardMaterial({
      color: "purple",
      metalness: 0.5,
      roughness: 0.2,
    }),
  )

  return (
    <div>
      <details open>
        <summary>
          <h3>Shared Resources</h3>
        </summary>
        <p>This example demonstrates autodispose with shared resources:</p>
        <ul>
          <li>
            <strong>Resource sharing:</strong> Multiple meshes use same geometry/material
          </li>
          <li>
            <strong>Efficient disposal:</strong> Resources disposed when all instances removed
          </li>
          <li>
            <strong>Dynamic instances:</strong> Toggle count to see shared resource management
          </li>
        </ul>
        <p>
          The same geometry and material are shared across all spheres. autodispose handles
          reference counting automatically.
        </p>
        <section>
          <button onClick={() => setInstanceCount(c => (c === 3 ? 1 : 3))}>
            Toggle Count: {instanceCount()}
          </button>
        </section>
      </details>

      <Canvas defaultCamera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />
        <Repeat count={instanceCount()}>
          {i => (
            <T.Mesh position={[(i - instanceCount() / 2) * 0.8, 0, 0]}>
              <Entity from={geometry} />
              <Entity from={material} />
            </T.Mesh>
          )}
        </Repeat>
      </Canvas>
    </div>
  )
}
