import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, CenterRaycaster, createT, CursorRaycaster } from "../../../../src/index.ts"

const T = createT(THREE)

// Custom raycaster that applies transformations
class CustomRaycaster extends THREE.Raycaster {
  update(event: PointerEvent | MouseEvent | WheelEvent, context: any) {
    const pointer = new THREE.Vector2()

    // Apply custom transformation - scale down movement sensitivity
    pointer.x = ((event.offsetX / context.bounds.width) * 2 - 1) * 0.5
    pointer.y = (-(event.offsetY / context.bounds.height) * 2 + 1) * 0.5

    // Update the raycaster with transformed coordinates
    this.setFromCamera(pointer, context.camera)
  }
}

export default function () {
  const [raycasterType, setRaycasterType] = createSignal<"cursor" | "center" | "custom">("cursor")
  const [lastHit, setLastHit] = createSignal("None")

  const getRaycaster = () => {
    switch (raycasterType()) {
      case "center":
        return new CenterRaycaster()
      case "custom":
        return new CustomRaycaster()
      default:
        return new CursorRaycaster()
    }
  }

  return (
    <div>
      <details>
        <summary>
          <h3>Raycaster Demo</h3>
        </summary>
        <p>
          This example demonstrates different raycaster types and custom raycaster implementations.
        </p>

        <div>
          <label>
            Raycaster Type:
            <select
              value={raycasterType()}
              onChange={e => setRaycasterType(e.target.value as any)}
              style={{ "margin-left": "5px", padding: "2px" }}
            >
              <option value="cursor">Cursor (Default)</option>
              <option value="center">Center</option>
              <option value="custom">Custom (Scaled)</option>
            </select>
          </label>
        </div>

        <p>
          <strong>Current:</strong> {raycasterType()}
        </p>
        <p>
          <strong>Last Hit:</strong> {lastHit()}
        </p>

        <p>
          <strong>Raycaster types:</strong>
        </p>
        <ul style={{ margin: "5px 0", "padding-left": "20px", "font-size": "12px" }}>
          <li>
            <strong>CursorRaycaster:</strong> Default - follows mouse pointer precisely
          </li>
          <li>
            <strong>CenterRaycaster:</strong> Always casts from viewport center (FPS-style)
          </li>
          <li>
            <strong>Custom:</strong> Example with reduced mouse sensitivity (0.5x scale)
          </li>
        </ul>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul style={{ margin: "5px 0", "padding-left": "20px", "font-size": "12px" }}>
          <li>Raycasters determine how pointer events map to 3D space</li>
          <li>Custom raycasters extend THREE.Raycaster</li>
          <li>Override the update() method to transform coordinates</li>
          <li>The white dot shows the center when using CenterRaycaster</li>
        </ul>

        <p style={{ "margin-top": "10px", "font-style": "italic", "font-size": "12px" }}>
          Try switching raycaster types and hovering/clicking objects!
        </p>
      </details>

      <Canvas
        raycaster={getRaycaster()}
        camera={{ position: [0, 0, 8] }}
        style={{ width: "100%", height: "100%" }}
        onPointerMove={() => {
          // This will trigger raycaster updates
        }}
      >
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        {/* Grid of objects to demonstrate raycasting */}
        <T.Mesh
          position={[-2, 2, 0]}
          onClick={() => setLastHit("Red Box (Top Left)")}
          onPointerEnter={() => setLastHit("Hovering Red Box")}
        >
          <T.BoxGeometry args={[1, 1, 1]} />
          <T.MeshStandardMaterial color="red" />
        </T.Mesh>

        <T.Mesh
          position={[0, 2, 0]}
          onClick={() => setLastHit("Green Sphere (Top Center)")}
          onPointerEnter={() => setLastHit("Hovering Green Sphere")}
        >
          <T.SphereGeometry args={[0.7, 32, 16]} />
          <T.MeshStandardMaterial color="green" />
        </T.Mesh>

        <T.Mesh
          position={[2, 2, 0]}
          onClick={() => setLastHit("Blue Cone (Top Right)")}
          onPointerEnter={() => setLastHit("Hovering Blue Cone")}
        >
          <T.ConeGeometry args={[0.5, 1, 8]} />
          <T.MeshStandardMaterial color="blue" />
        </T.Mesh>

        <T.Mesh
          position={[-2, 0, 0]}
          onClick={() => setLastHit("Yellow Cylinder (Center Left)")}
          onPointerEnter={() => setLastHit("Hovering Yellow Cylinder")}
        >
          <T.CylinderGeometry args={[0.5, 0.5, 1, 8]} />
          <T.MeshStandardMaterial color="yellow" />
        </T.Mesh>

        <T.Mesh
          position={[0, 0, 0]}
          onClick={() => setLastHit("Purple Octahedron (CENTER)")}
          onPointerEnter={() => setLastHit("Hovering Purple Octahedron")}
        >
          <T.OctahedronGeometry args={[0.8]} />
          <T.MeshStandardMaterial color="purple" />
        </T.Mesh>

        <T.Mesh
          position={[2, 0, 0]}
          onClick={() => setLastHit("Orange Torus (Center Right)")}
          onPointerEnter={() => setLastHit("Hovering Orange Torus")}
        >
          <T.TorusGeometry args={[0.6, 0.2, 16, 100]} />
          <T.MeshStandardMaterial color="orange" />
        </T.Mesh>

        <T.Mesh
          position={[-2, -2, 0]}
          onClick={() => setLastHit("Cyan Dodecahedron (Bottom Left)")}
          onPointerEnter={() => setLastHit("Hovering Cyan Dodecahedron")}
        >
          <T.DodecahedronGeometry args={[0.7]} />
          <T.MeshStandardMaterial color="cyan" />
        </T.Mesh>

        <T.Mesh
          position={[0, -2, 0]}
          onClick={() => setLastHit("Magenta Icosahedron (Bottom Center)")}
          onPointerEnter={() => setLastHit("Hovering Magenta Icosahedron")}
        >
          <T.IcosahedronGeometry args={[0.7]} />
          <T.MeshStandardMaterial color="magenta" />
        </T.Mesh>

        <T.Mesh
          position={[2, -2, 0]}
          onClick={() => setLastHit("Lime Tetrahedron (Bottom Right)")}
          onPointerEnter={() => setLastHit("Hovering Lime Tetrahedron")}
        >
          <T.TetrahedronGeometry args={[0.8]} />
          <T.MeshStandardMaterial color="lime" />
        </T.Mesh>

        {/* Center marker to help visualize center raycaster */}
        <T.Mesh position={[0, 0, 3]}>
          <T.SphereGeometry args={[0.1, 8, 8]} />
          <T.MeshBasicMaterial
            color="white"
            transparent
            opacity={raycasterType() === "center" ? 0.8 : 0.2}
          />
        </T.Mesh>
      </Canvas>
    </div>
  )
}
