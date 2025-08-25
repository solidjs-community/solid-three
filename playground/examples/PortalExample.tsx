import * as THREE from "three"
import { createT, Entity, EventPlugin, Portal } from "../../src/index.ts"

const { T, Canvas } = createT(THREE, [EventPlugin])

export function PortalExample() {
  const group = new THREE.Group()
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
      onClick={event => console.debug("canvas clicked", event)}
      onClickMissed={event => console.debug("canvas click missed", event)}
      onPointerLeave={event => console.debug("canvas pointer leave", event)}
      onPointerEnter={event => console.debug("canvas pointer enter", event)}
    >
      <Entity from={group} position={[0, 5, 0]} />
      <Portal element={group}>
        <T.Mesh>
          <T.SphereGeometry args={[2, 32, 32]} />
          <T.MeshBasicMaterial color="red" />
        </T.Mesh>
      </Portal>
    </Canvas>
  )
}
