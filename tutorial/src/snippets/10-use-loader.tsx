import * as THREE from "three"
import { Suspense } from "solid-js"
import { Canvas, createT, useLoader } from "solid-three"

const T = createT(THREE)

function TexturedCube() {
  const texture = useLoader(
    () => THREE.TextureLoader,
    () => "https://picsum.photos/seed/solid-three/256",
  )
  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshBasicMaterial map={texture()} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [2, 2, 2] }}>
      <Suspense>
        <TexturedCube />
      </Suspense>
    </Canvas>
  )
}
