import { Loading } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useLoader } from "../../../../src/index.ts"

const T = createT(THREE)

function TextureRecord() {
  // Load multiple textures using Record<string, string>
  const textures = useLoader(THREE.TextureLoader, {
    diffuse: "https://threejs.org/examples/textures/crate.gif",
    normal: "https://threejs.org/examples/textures/brick_bump.jpg",
    roughness: "https://threejs.org/examples/textures/roughnessMap.jpg",
  })

  return (
    <T.Mesh>
      <T.BoxGeometry args={[2, 2, 2]} />
      <T.MeshStandardMaterial
        map={textures()?.diffuse}
        normalMap={textures()?.normal}
        roughnessMap={textures()?.roughness}
        roughness={0.8}
        metalness={0.2}
      />
    </T.Mesh>
  )
}

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Record Loading</h3>
        </summary>
        <p>
          This example demonstrates useLoader with Record&lt;string, string&gt; for loading multiple
          related assets:
        </p>
        <ul>
          <li>
            <strong>Named textures:</strong> Load multiple textures with descriptive keys
          </li>
          <li>
            <strong>Material maps:</strong> Combine diffuse, normal, and roughness maps
          </li>
          <li>
            <strong>Type safety:</strong> Access textures by name with full typing
          </li>
        </ul>
        <p>
          The box uses three different texture maps loaded as a record for organized asset
          management.
        </p>
      </details>

      <Canvas defaultCamera={{ position: [0, 0, 5] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.3} />
        <T.DirectionalLight position={[5, 5, 5]} intensity={1} />

        <Loading
          fallback={
            <T.Mesh>
              <T.BoxGeometry args={[2, 2, 2]} />
              <T.MeshBasicMaterial color="gray" />
            </T.Mesh>
          }
        >
          <TextureRecord />
        </Loading>
      </Canvas>
    </div>
  )
}
