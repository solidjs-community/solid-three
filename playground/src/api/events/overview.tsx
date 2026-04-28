import { createSignal } from "solid-js"
import * as THREE from "three"
import { Canvas, createT } from "../../../../src/index.ts"

const T = createT(THREE)

function ClickExample() {
  const [clicks, setClicks] = createSignal(0)
  const [color, setColor] = createSignal("red")

  return (
    <T.Mesh
      position={[-3, 2, 0]}
      onClick={e => {
        setClicks(c => c + 1)
        setColor(c => (c === "red" ? "blue" : "red"))
        console.info("Cube clicked!", clicks())
      }}
      onClickMissed={() => {
        console.info("Click missed cube")
      }}
    >
      <T.BoxGeometry args={[1, 1, 1]} />
      <T.MeshStandardMaterial color={color()} />
    </T.Mesh>
  )
}

function HoverExample() {
  const [hovered, setHovered] = createSignal(false)
  const [enterCount, setEnterCount] = createSignal(0)

  return (
    <T.Mesh
      position={[0, 2, 0]}
      onPointerEnter={e => {
        setHovered(true)
        setEnterCount(c => c + 1)
        console.info("Mouse entered sphere")
      }}
      onPointerLeave={e => {
        setHovered(false)
        console.info("Mouse left sphere")
      }}
      onPointerMove={e => {
        console.info("Mouse moving over sphere")
      }}
    >
      <T.SphereGeometry args={[0.7, 32, 16]} />
      <T.MeshStandardMaterial
        color={hovered() ? "hotpink" : "green"}
        emissive={hovered() ? new THREE.Color(0x444444) : new THREE.Color(0x000000)}
      />
    </T.Mesh>
  )
}

function PropagationExample() {
  const [frontClicks, setFrontClicks] = createSignal(0)
  const [backClicks, setBackClicks] = createSignal(0)
  const [groupClicks, setGroupClicks] = createSignal(0)

  return (
    <T.Group
      position={[3, 2, 0]}
      onClick={() => {
        setGroupClicks(c => c + 1)
        console.info("Group clicked (tree propagation)")
      }}
    >
      {/* Back mesh */}
      <T.Mesh
        position={[0, 0, -1]}
        onClick={() => {
          setBackClicks(c => c + 1)
          console.info("Back mesh clicked (raycast propagation)")
        }}
        onClickMissed={() => console.info("Back mesh missed - front mesh blocked it")}
      >
        <T.BoxGeometry args={[1, 1, 1]} />
        <T.MeshStandardMaterial color="green" transparent opacity={0.7} />
      </T.Mesh>

      {/* Front mesh */}
      <T.Mesh
        position={[0, 0, 1]}
        onClick={e => {
          setFrontClicks(c => c + 1)
          console.info("Front mesh clicked")
          // Uncomment to stop propagation
          // e.stopPropagation()
        }}
      >
        <T.BoxGeometry args={[0.8, 0.8, 0.8]} />
        <T.MeshStandardMaterial color="yellow" transparent opacity={0.8} />
      </T.Mesh>
    </T.Group>
  )
}

function ContextMenuExample() {
  const [rightClicks, setRightClicks] = createSignal(0)

  return (
    <T.Mesh
      position={[-3, 0, 0]}
      onContextMenu={e => {
        setRightClicks(c => c + 1)
        console.info("Right clicked!", rightClicks())
      }}
      onContextMenuMissed={() => {
        console.info("Right click missed")
      }}
    >
      <T.ConeGeometry args={[0.5, 1, 8]} />
      <T.MeshStandardMaterial color="purple" />
    </T.Mesh>
  )
}

function DoubleClickExample() {
  const [doubleClicks, setDoubleClicks] = createSignal(0)
  const [scale, setScale] = createSignal(1)

  return (
    <T.Mesh
      position={[0, 0, 0]}
      scale={[scale(), scale(), scale()]}
      onDoubleClick={e => {
        setDoubleClicks(c => c + 1)
        setScale(s => (s === 1 ? 1.5 : 1))
        console.info("Double clicked!", doubleClicks())
      }}
      onDoubleClickMissed={() => {
        console.info("Double click missed")
      }}
    >
      <T.OctahedronGeometry args={[0.8]} />
      <T.MeshStandardMaterial color="orange" />
    </T.Mesh>
  )
}

function MouseEventsExample() {
  const [mouseDown, setMouseDown] = createSignal(false)

  return (
    <T.Mesh
      position={[3, 0, 0]}
      onMouseDown={() => {
        setMouseDown(true)
        console.info("Mouse down")
      }}
      onMouseUp={() => {
        setMouseDown(false)
        console.info("Mouse up")
      }}
      onMouseEnter={() => console.info("Mouse enter")}
      onMouseLeave={() => console.info("Mouse leave")}
    >
      <T.CylinderGeometry args={[0.5, 0.5, 1, 8]} />
      <T.MeshStandardMaterial
        color={mouseDown() ? "red" : "cyan"}
        emissive={mouseDown() ? new THREE.Color(0x333333) : new THREE.Color(0x000000)}
      />
    </T.Mesh>
  )
}

function WheelExample() {
  const [wheelDelta, setWheelDelta] = createSignal(0)

  return (
    <T.Mesh
      position={[0, -2, 0]}
      rotation={[wheelDelta() * 0.01, wheelDelta() * 0.02, 0]}
      onWheel={e => {
        setWheelDelta(d => d + e.nativeEvent.deltaY)
        console.info("Wheel event:", e.nativeEvent.deltaY)
      }}
    >
      <T.TorusGeometry args={[0.8, 0.3, 16, 100]} />
      <T.MeshStandardMaterial color="magenta" />
    </T.Mesh>
  )
}

function RaycastableExample() {
  return (
    <T.Mesh
      position={[-3, -2, 0]}
      raycastable={false}
      onClick={() => console.info("Parent clicked via child!")}
    >
      <T.BoxGeometry args={[1.5, 1.5, 1.5]} />
      <T.MeshStandardMaterial color="gray" transparent opacity={0.3} />

      {/* Child mesh that can be clicked */}
      <T.Mesh
        position={[0, 0, 0]}
        onClick={() => console.info("Child clicked, event bubbles to parent")}
      >
        <T.SphereGeometry args={[0.4, 32, 16]} />
        <T.MeshStandardMaterial color="lime" />
      </T.Mesh>
    </T.Mesh>
  )
}

export default function () {
  return (
    <div>
      <details>
        <summary>
          <h3>Event Handling Demo</h3>
        </summary>
        <p>This comprehensive example demonstrates all event types supported by solid-three:</p>

        <p>
          <strong>Top Row:</strong>
        </p>
        <ul>
          <li>
            <strong>Red/Blue cube:</strong> Click events (onClick, onClickMissed)
          </li>
          <li>
            <strong>Green/Pink sphere:</strong> Hover events (onPointerEnter/Leave/Move)
          </li>
          <li>
            <strong>Yellow/Green boxes:</strong> Event propagation through hierarchy
          </li>
        </ul>

        <p>
          <strong>Middle Row:</strong>
        </p>
        <ul>
          <li>
            <strong>Purple cone:</strong> Right-click context menu events
          </li>
          <li>
            <strong>Orange octahedron:</strong> Double-click to scale
          </li>
          <li>
            <strong>Cyan cylinder:</strong> Mouse down/up state changes
          </li>
        </ul>

        <p>
          <strong>Bottom Row:</strong>
        </p>
        <ul>
          <li>
            <strong>Magenta torus:</strong> Wheel events rotate the shape
          </li>
          <li>
            <strong>Gray box:</strong> raycastable=false (click the green sphere inside)
          </li>
        </ul>

        <p>
          <strong>Key concepts:</strong>
        </p>
        <ul>
          <li>All standard pointer/mouse events are supported</li>
          <li>Events bubble through the Three.js hierarchy</li>
          <li>stopPropagation() prevents bubbling</li>
          <li>raycastable prop controls event handling</li>
        </ul>

        <p
          style={{
            "margin-top": "10px",
            "background-color": "rgba(255, 255, 0, 0.2)",
            padding: "5px",
            "border-radius": "4px",
          }}
        >
          <strong>⚠️ Open the console to see all event logs!</strong>
        </p>
      </details>

      <Canvas
        camera={{ position: [0, 0, 8] }}
        style={{ width: "100%", height: "100%" }}
        onClick={() => console.info("Canvas clicked (canvas propagation)")}
        onClickMissed={() => console.info("Clicked empty space")}
      >
        <T.AmbientLight intensity={0.5} />
        <T.PointLight position={[10, 10, 10]} intensity={0.8} />

        {/* Click events */}
        <ClickExample />

        {/* Hover events */}
        <HoverExample />

        {/* Event propagation */}
        <PropagationExample />

        {/* Context menu */}
        <ContextMenuExample />

        {/* Double click */}
        <DoubleClickExample />

        {/* Mouse events */}
        <MouseEventsExample />

        {/* Wheel events */}
        <WheelExample />

        {/* Raycastable example */}
        <RaycastableExample />
      </Canvas>
    </div>
  )
}
