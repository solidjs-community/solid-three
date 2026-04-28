import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useFrame } from "../../../../src/index.ts"

// Create T namespace with all three.js objects
const T = createT(THREE)

export default function () {
  let meshRef: THREE.Mesh | undefined
  const [hovered, setHovered] = createSignal(false)

  useFrame(() => {
    if (meshRef) {
      meshRef.rotation.y += 0.01
    }
  })

  return (
    <div>
      <details>
        <summary>
          <h3>T / createT Demo</h3>
        </summary>
        <p>This demonstrates the T pattern from the README showing:</p>
        <ul>
          <li>createT() function with full THREE namespace</li>
          <li>T component usage (T.Mesh, T.BoxGeometry, etc.)</li>
          <li>Advanced prop patterns (emissive-intensity)</li>
          <li>useFrame animation loop</li>
          <li>Hover interaction with color change</li>
        </ul>
        <p>
          <strong>Hover over the orange box to see it change to hotpink!</strong>
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 8] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh
          ref={meshRef}
          position={[-2, 0, 0]}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial
            color={hovered() ? "hotpink" : "orange"}
            // Advanced prop patterns
            emissive-intensity={hovered() ? 0.2 : 0}
          />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
