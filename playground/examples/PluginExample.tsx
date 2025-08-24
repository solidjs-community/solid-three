import type { InferPluginsFromT } from "create-t.tsx"
import * as THREE from "three"
import type { InferPluginProps, Plugin } from "types.ts"
import { createT, Resource, useFrame, useThree } from "../../src/index.ts"
import { OrbitControls } from "../controls/OrbitControls.tsx"

const Plugin1 = (() => {
  return function <U>(element: U) {
    return {
      lookAt: (target: THREE.Object3D) => {
        useFrame(() => {
          ;(element as THREE.Object3D).lookAt(target.position)
        })
      },
    }
  }
}) satisfies Plugin

const { T, Canvas } = createT(THREE, [Plugin1 /* EventPlugin */])

type X = InferPluginsFromT<typeof T>
type Y = InferPluginProps<THREE.Mesh, X>

export function PluginExample() {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
    >
      <OrbitControls />
      <T.Mesh
        lookAt={useThree().currentCamera}
        // onMouseMove={event => console.info("mousemove!", event)}
        // onMouseDown={event => console.info("mousedown!", event)}
      >
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
