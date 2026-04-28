import * as THREE from "three"
import { DRACOLoader, GLTFLoader } from "three-stdlib"
import { Canvas, Entity, Resource } from "../../../../src/index.ts"

let dracoLoader: DRACOLoader

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Resource</h3>
        </summary>
        <p>This example demonstrates the Resource component for loading external assets.</p>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>Resource provides a declarative API for three-stdlib loaders</li>
          <li>Supports GLTFLoader, FBXLoader, OBJLoader, etc.</li>
          <li>Handles async loading with Suspense integration</li>
          <li>onBeforeLoad hook for loader configuration</li>
          <li>Children receive the loaded resource as a reactive accessor</li>
        </ul>

        <p>
          <strong>In this example:</strong>
        </p>
        <ul>
          <li>Loading a GLTF model (Suzanne monkey head)</li>
          <li>Configuring DRACO compression decoder</li>
          <li>The loader is cached and reused</li>
          <li>The model is rendered once loaded</li>
        </ul>

        <p>
          <strong>Note:</strong> Resource components integrate with Suspense boundaries for loading
          states.
        </p>
      </details>

      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: new THREE.Vector3(0, 0, 3) }}
      >
        <Entity from={THREE.AmbientLight} />
        <Resource
          loader={GLTFLoader}
          url="/suzanne.glb"
          onBeforeLoad={loader => {
            dracoLoader ??= new DRACOLoader()
            dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/")
            loader.setDRACOLoader(dracoLoader)
          }}
        >
          {gltf => <Entity from={gltf().scene} />}
        </Resource>
      </Canvas>
    </div>
  )
}
