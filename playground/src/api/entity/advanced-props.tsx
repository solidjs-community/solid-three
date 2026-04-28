import * as THREE from "three"
import { Canvas, Entity, autodispose } from "../../../../src/index.ts"

export default function () {
  // Create a custom material to attach to
  const customMaterial = autodispose(new THREE.MeshStandardMaterial({ color: "white" }))

  return (
    <div>
      <details>
        <summary>
          <h3>Advanced Entity Props</h3>
        </summary>
        <p>This example demonstrates advanced prop patterns with Entity:</p>
        <ul>
          <li>
            <strong>Kebab-case props:</strong> position-x, rotation-y, scale-z
          </li>
          <li>
            <strong>Deep nested props:</strong> material-emissive-intensity
          </li>
          <li>
            <strong>Attach prop:</strong> Attach objects to specific parent properties
          </li>
          <li>
            <strong>Direct assignment:</strong> Overwriting default attachments
          </li>
        </ul>
        <p>Kebab-case props like position-x automatically map to object.position.x = value.</p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <Entity from={THREE.AmbientLight} args={[0.4]} />
        <Entity from={THREE.PointLight} position={[10, 10, 10]} args={[0xffffff, 0.8]} />

        {/* Left mesh: kebab-case props */}
        <Entity
          from={THREE.Mesh}
          position-x={-2}
          position-y={0}
          rotation-y={Math.PI / 4}
          scale-z={1.5}
        >
          <Entity from={THREE.BoxGeometry} args={[1, 1, 1]} />
          <Entity from={THREE.MeshStandardMaterial} args={[{ color: "red" }]} />
        </Entity>

        {/* Center mesh: deep nested props */}
        <Entity
          from={THREE.Mesh}
          position={[0, 0, 0]}
          material-emissive-intensity={0.3}
          material-emissive="#00ff00"
        >
          <Entity from={THREE.BoxGeometry} args={[1, 1, 1]} />
          <Entity from={THREE.MeshStandardMaterial} args={[{ color: "blue" }]} />
        </Entity>

        {/* Right mesh: attach prop usage */}
        <Entity from={THREE.Mesh} position-x={2}>
          <Entity from={THREE.BoxGeometry} args={[1, 1, 1]} />
          {/* Attach the custom material to this mesh */}
          <Entity from={customMaterial} attach="material" />
        </Entity>

        {/* Bottom mesh: multiple kebab props */}
        <Entity
          from={THREE.Mesh}
          position-y={-2}
          rotation-x={Math.PI / 6}
          rotation-z={Math.PI / 8}
          scale-x={0.5}
          scale-y={2}
        >
          <Entity from={THREE.ConeGeometry} args={[0.5, 1, 8]} />
          <Entity from={THREE.MeshStandardMaterial} args={[{ color: "purple" }]} />
        </Entity>
      </Canvas>
    </div>
  )
}
