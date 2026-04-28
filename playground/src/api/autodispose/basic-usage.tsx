import * as THREE from "three"
import { Canvas, Entity, autodispose, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  // Objects wrapped with autodispose will be disposed when component unmounts
  const geometry = autodispose(new THREE.BoxGeometry())
  const material = autodispose(new THREE.MeshBasicMaterial({ color: "red" }))

  return (
    <div>
      <details>
        <summary>
          <h3>Basic autodispose Usage</h3>
        </summary>
        <p>This example demonstrates basic autodispose usage for automatic resource cleanup:</p>
        <ul>
          <li>
            <strong>Automatic disposal:</strong> Resources cleaned up when component unmounts
          </li>
          <li>
            <strong>Memory safety:</strong> Prevents memory leaks in dynamic scenes
          </li>
          <li>
            <strong>Simple wrapper:</strong> Just wrap Three.js objects with autodispose()
          </li>
        </ul>
        <p>
          The geometry and material will be automatically disposed when this component is removed
          from the scene.
        </p>
      </details>

      <Canvas camera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Mesh>
          <Entity from={geometry} />
          <Entity from={material} />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
