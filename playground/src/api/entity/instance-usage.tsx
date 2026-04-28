import * as THREE from "three"
import { Canvas, Entity, autodispose } from "../../../../src/index.ts"

export default function () {
  // Create instances manually - need autodispose for proper cleanup
  const geometry = autodispose(new THREE.BoxGeometry(1, 1, 1))
  const material = autodispose(new THREE.MeshStandardMaterial({ color: "red" }))
  const mesh = new THREE.Mesh(geometry, material)

  // Position the mesh instance
  mesh.position.set(0, 0, 0)

  return (
    <div>
      <details>
        <summary>
          <h3>Entity Instance Usage</h3>
        </summary>
        <p>This example demonstrates using Entity with pre-created instances:</p>
        <ul>
          <li>
            <strong>Instance passing:</strong> Pass existing Three.js objects to Entity
          </li>
          <li>
            <strong>Manual creation:</strong> Create geometry, material, and mesh instances
          </li>
          <li>
            <strong>autodispose:</strong> Wrap instances for automatic memory management
          </li>
          <li>
            <strong>Positioning:</strong> Set properties on instances before passing
          </li>
        </ul>
        <p>
          When passing instances, you're responsible for disposal. Use autodispose() to ensure
          cleanup.
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <Entity from={THREE.AmbientLight} args={[0.5]} />
        <Entity from={THREE.PointLight} position={[10, 10, 10]} args={[0xffffff, 0.8]} />

        <Entity from={mesh} />
      </Canvas>
    </div>
  )
}
