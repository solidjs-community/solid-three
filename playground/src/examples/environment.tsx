import * as THREE from "three"
import { Resource } from "../../../src/components.tsx"
import { Canvas, createT } from "../../../src/index.ts"
import { OrbitControls } from "../../controls/orbit-controls.tsx"

const T = createT(THREE)

export default function () {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{ position: new THREE.Vector3(0, 0, 30) }}
      onClick={event => console.debug("canvas clicked", event)}
      onClickMissed={event => console.debug("canvas click missed", event)}
      onPointerLeave={event => console.debug("canvas pointer leave", event)}
      onPointerEnter={event => console.debug("canvas pointer enter", event)}
    >
      <OrbitControls />
      <T.Mesh>
        <T.TorusKnotGeometry args={[1, 0.5, 128, 32]} />
        <T.MeshStandardMaterial metalness={1} roughness={0} color="white">
          <Resource
            loader={THREE.CubeTextureLoader}
            attach="envMap"
            base="https://rawcdn.githack.com/mrdoob/three.js/54ac263593c81b669ca9a089491ddd9e240427d2/examples/textures/cube/Bridge2/"
            url={["posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", "posz.jpg", "negz.jpg"]}
          />
        </T.MeshStandardMaterial>
      </T.Mesh>
    </Canvas>
  )
}
