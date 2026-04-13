import { createMemo, createSignal, merge } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, Entity, S3, useProps } from "../../../../src/index.ts"

const T = createT(THREE)

function CustomMesh(props: S3.Props<THREE.Mesh>) {
  const [geometry, setGeometry] = createSignal<"box" | "sphere">("box")

  const mesh = createMemo(() => {
    const geom =
      geometry() === "box" ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.7, 32, 16)

    const material = new THREE.MeshStandardMaterial()
    return new THREE.Mesh(geom, material)
  })

  const config = merge(props, {
    onClick() {
      setGeometry(g => (g === "box" ? "sphere" : "box"))
    },
  })

  // Apply props to the dynamic mesh
  useProps(mesh, config)

  return <Entity from={mesh()} />
}

export default function () {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <details>
        <summary>
          <h3>useProps Demo</h3>
        </summary>
        <p>
          This example demonstrates the useProps hook for applying solid-three props to raw Three.js
          objects.
        </p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>useProps applies declarative props to imperative objects</li>
          <li>Supports all solid-three prop patterns (hyphen notation, etc.)</li>
          <li>Handles refs, events, and children</li>
          <li>Enables custom component creation</li>
          <li>Props are reactive and update automatically</li>
        </ul>
      </details>

      <Canvas defaultCamera={{ position: [0, 0, 8] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        {/* Custom mesh using useProps */}
        <CustomMesh position={[-2, 2, 0]} material-color="purple" scale={[0.8, 0.8, 0.8]} />
      </Canvas>
    </div>
  )
}
