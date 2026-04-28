import * as THREE from "three"
import { DRACOLoader, GLTFLoader } from "three-stdlib"
import { Canvas, Entity, useLoader } from "../../../../src/index.ts"

let dracoLoader: DRACOLoader

export default function () {
  const resource = useLoader(GLTFLoader, "/suzanne.glb", {
    onBeforeLoad(loader) {
      dracoLoader ??= new DRACOLoader()
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/")
      loader.setDRACOLoader(dracoLoader)
    },
  })

  return (
    <div>
      <details>
        <summary>
          <h3>useLoader Hook Demo</h3>
        </summary>
        <p>
          This example demonstrates the useLoader hook for loading external assets imperatively.
        </p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>useLoader provides a hook-based API for three-stdlib loaders</li>
          <li>Returns a reactive accessor to the loaded resource</li>
          <li>Integrates with Suspense for loading states</li>
          <li>Caches results to prevent duplicate loads</li>
          <li>Supports onBeforeLoad for loader configuration</li>
        </ul>

        <p>
          <strong>Comparison with Resource component:</strong>
        </p>
        <ul>
          <li>
            <strong>useLoader:</strong> Hook-based, use in setup code
          </li>
          <li>
            <strong>Resource:</strong> Component-based, use in JSX
          </li>
          <li>Both share the same underlying loading system</li>
        </ul>

        <p>
          <strong>In this example:</strong>
        </p>
        <ul>
          <li>Loading the same GLTF model as Resource example</li>
          <li>Using DRACO compression for efficiency</li>
          <li>Accessing the loaded scene imperatively</li>
        </ul>
      </details>

      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: new THREE.Vector3(0, 0, 3) }}
      >
        <Entity from={THREE.AmbientLight} />
        <Entity from={resource()?.scene.children[0]} />
      </Canvas>
    </div>
  )
}
