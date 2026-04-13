import { Loading } from "solid-js"
import * as THREE from "three"
import { Canvas, createT, useLoader } from "../../../../src/index.ts"

const T = createT(THREE)

function SkyboxSphere() {
  // Load cube texture using array of paths for each face
  const cubeTexture = useLoader(
    THREE.CubeTextureLoader,
    [
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/px.jpg", // positive x
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/nx.jpg", // negative x
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/py.jpg", // positive y
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/ny.jpg", // negative y
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/pz.jpg", // positive z
      "https://threejs.org/examples/textures/cube/SwedishRoyalCastle/nz.jpg", // negative z
    ],
    {
      // Configure the CubeTexture once it loads.
      onLoad(tex) {
        tex.mapping = THREE.CubeReflectionMapping
        tex.wrapS = THREE.ClampToEdgeWrapping
        tex.wrapT = THREE.ClampToEdgeWrapping
        tex.magFilter = THREE.LinearFilter
        tex.minFilter = THREE.LinearMipmapLinearFilter
      },
    },
  )

  return (
    <>
      {/* Set the scene background */}
      <T.Scene background={cubeTexture()} />

      {/* Reflective sphere using the same cube texture */}
      <T.Mesh>
        <T.SphereGeometry args={[1, 64, 32]} />
        <T.MeshStandardMaterial envMap={cubeTexture()} metalness={1} roughness={0} color="white" />
      </T.Mesh>
    </>
  )
}

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Cube Texture Loading</h3>
        </summary>
        <p>This example demonstrates useLoader with CubeTextureLoader and texture properties:</p>
        <ul>
          <li>
            <strong>Cube mapping:</strong> Array of 6 texture paths for each face
          </li>
          <li>
            <strong>Texture props:</strong> Configure mapping, wrapping, and filtering
          </li>
          <li>
            <strong>Environment map:</strong> Use for both scene background and material reflection
          </li>
          <li>
            <strong>HDR lighting:</strong> Realistic reflections from cube texture
          </li>
        </ul>
        <p>
          The sphere reflects the Swedish Royal Castle environment while the same texture serves as
          the scene background.
        </p>
      </details>

      <Canvas defaultCamera={{ position: [0, 0, 3] }} style={{ width: "100%", height: "100%" }}>
        <T.AmbientLight intensity={0.2} />

        <Loading
          fallback={
            <>
              <T.Scene background={new THREE.Color(0x222222)} />
              <T.Mesh>
                <T.SphereGeometry args={[1, 32, 16]} />
                <T.MeshBasicMaterial color="gray" />
              </T.Mesh>
            </>
          }
        >
          <SkyboxSphere />
        </Loading>
      </Canvas>
    </div>
  )
}
