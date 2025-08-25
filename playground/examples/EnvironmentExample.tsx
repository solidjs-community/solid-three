import { createSignal } from "solid-js"
import * as THREE from "three"
import { createT, EventPlugin, Resource } from "../../src/index.ts"
import { OrbitControls } from "../controls/OrbitControls.tsx"

const { T, Canvas } = createT(THREE, [EventPlugin])

export function EnvironmentExample() {
  const [position, setPosition] = createSignal(0)

  setInterval(() => setPosition(position => position + 1), 500)

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
      onClick={event => console.debug("canvas clicked", event)}
      onClickMissed={event => console.debug("canvas click missed", event)}
      onPointerLeave={event => console.debug("canvas pointer leave", event)}
      onPointerEnter={event => console.debug("canvas pointer enter", event)}
    >
      <OrbitControls />
      <T.Mesh position={new THREE.Vector3(position(), 0, 0)}>
        <T.BoxGeometry args={[1, 0.5, 128, 32]} />
        <T.MeshBasicMaterial color="red" />
      </T.Mesh>
      <T.Mesh>
        <T.TorusKnotGeometry args={[1, 0.5, 128, 32]} />
        <T.MeshStandardMaterial metalness={1} roughness={0} color="white">
          <Resource
            loader={THREE.CubeTextureLoader}
            attach="envMap"
            path="https://rawcdn.githack.com/mrdoob/three.js/54ac263593c81b669ca9a089491ddd9e240427d2/examples/textures/cube/Bridge2/"
            url={["posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", "posz.jpg", "negz.jpg"]}
          />
        </T.MeshStandardMaterial>
      </T.Mesh>
    </Canvas>
  )
}
