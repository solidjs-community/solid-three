import * as THREE from "three"
import { Canvas, createT, useFrame } from "../../../../src/index.ts"

// Create selective T namespace for tree-shaking
const T = createT({
  Mesh: THREE.Mesh,
  BoxGeometry: THREE.BoxGeometry,
  SphereGeometry: THREE.SphereGeometry,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  AmbientLight: THREE.AmbientLight,
  PointLight: THREE.PointLight,
})

export default function () {
  let sphereRef: THREE.Mesh | undefined

  useFrame(() => {
    if (sphereRef) {
      sphereRef.position.y = Math.sin(Date.now() * 0.001) * 0.5
    }
  })

  return (
    <div>
      <details>
        <summary>
          <h3>T / createT Demo</h3>
        </summary>
        <p>This example demonstrates the createT function for tree-shaking optimization.</p>
        <p>
          By creating a selective T namespace with only the components you need, you can reduce
          bundle size while still enjoying the convenience of JSX components.
        </p>
        <p>Features shown:</p>
        <ul>
          <li>Creating a custom T namespace with createT</li>
          <li>Using hyphen notation for nested properties (position-z)</li>
          <li>Deep nested properties (emissive-r, emissive-g, emissive-b)</li>
          <li>Animated floating sphere using useFrame</li>
        </ul>
      </details>

      <Canvas camera={{ position: [0, 0, 8] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />
        <T.Mesh ref={sphereRef} position={[2, 0, 0]}>
          <T.SphereGeometry args={[0.7, 32, 16]} />
          <T.MeshStandardMaterial
            color="cyan"
            // Hyphen notation for nested properties
            position-z={0.1}
            // Deep nested properties
            emissive-r={0.1}
            emissive-g={0.3}
            emissive-b={0.1}
          />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
