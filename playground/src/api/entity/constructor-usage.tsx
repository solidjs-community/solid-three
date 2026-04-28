import * as THREE from "three"
import { Canvas, Entity } from "../../../../src/index.ts"

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Entity Constructor Usage</h3>
        </summary>
        <p>This example demonstrates using Entity with Three.js constructors:</p>
        <ul>
          <li>
            <strong>Constructor pattern:</strong> Pass class constructors to Entity
          </li>
          <li>
            <strong>Args prop:</strong> Arguments are passed to constructor
          </li>
          <li>
            <strong>Automatic disposal:</strong> Objects created from constructors are auto-disposed
          </li>
          <li>
            <strong>Hierarchical structure:</strong> Geometry and material as children of mesh
          </li>
        </ul>
        <p>
          This is the recommended pattern for most use cases - cleaner and handles disposal
          automatically.
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <Entity from={THREE.AmbientLight} args={[0.5]} />
        <Entity from={THREE.PointLight} position={[10, 10, 10]} args={[0xffffff, 0.8]} />

        <Entity from={THREE.Mesh}>
          <Entity from={THREE.BoxGeometry} args={[1, 1, 1]} />
          <Entity from={THREE.MeshStandardMaterial} args={[{ color: "blue" }]} />
        </Entity>
      </Canvas>
    </div>
  )
}
