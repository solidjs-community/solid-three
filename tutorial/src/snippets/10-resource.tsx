import * as THREE from "three"
import { Suspense } from "solid-js"
import { Canvas, createT, Resource } from "solid-three"

const T = createT(THREE)

export default function App() {
  return (
    <Canvas camera={{ position: [2, 2, 2] }}>
      <Suspense>
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshBasicMaterial>
            <Resource
              loader={THREE.TextureLoader}
              url="https://picsum.photos/seed/solid-three/256"
              attach="map"
            />
          </T.MeshBasicMaterial>
        </T.Mesh>
      </Suspense>
    </Canvas>
  )
}
