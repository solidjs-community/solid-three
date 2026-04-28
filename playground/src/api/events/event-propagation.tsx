import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Event Propagation Example</h3>
        </summary>
        <p>From the README - demonstrates:</p>
        <p>
          <strong>Dual propagation system:</strong>
        </p>
        <p>
          1. <strong>Raycast Propagation:</strong> Front to back objects
        </p>
        <p>
          2. <strong>Tree Propagation:</strong> Child to parent in scene graph
        </p>
        <br />
        <p>
          <strong>Expected order when clicking overlapping area:</strong>
        </p>
        <p>1. Front mesh (red, closest to camera)</p>
        <p>2. Back mesh (blue, further from camera)</p>
        <p>3. Group (parent in tree)</p>
        <p>4. Canvas (root container)</p>
        <br />
        <p>
          <strong>With stopPropagation():</strong> Only front mesh receives event
        </p>
        <p>
          <strong>Open console and click to see event order!</strong>
        </p>
      </details>

      <Canvas
        onClick={() => console.info("4. Canvas clicked (canvas propagation)")}
        camera={{ position: [0, 0, 8] }}
        style={{ width: "100%", height: "100%" }}
      >
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        <T.Group onClick={() => console.info("3. Group clicked (tree propagation)")}>
          <T.Mesh
            position={[0, 0, -1]}
            onClick={() => console.info("2. Back mesh clicked (raycast propagation)")}
          >
            <T.BoxGeometry args={[2, 2, 1]} />
            <T.MeshStandardMaterial color="blue" transparent opacity={0.7} />
          </T.Mesh>

          <T.Mesh
            position={[0, 0, 1]} // In front
            onClick={e => {
              console.info("1. Front mesh clicked (raycast propagation)")
              e.stopPropagation() // Stops ALL propagation (raycast, tree, and canvas)
            }}
          >
            <T.BoxGeometry args={[1.5, 1.5, 1]} />
            <T.MeshStandardMaterial color="red" transparent opacity={0.8} />
          </T.Mesh>
        </T.Group>
      </Canvas>
    </div>
  )
}
