import * as THREE from "three"
import { createT, Resource } from "../../src/index.ts"

const Plugin1 = () => {
  return {
    onCustom(callback: (value: "HALLO FROM PLUGIN1!") => void) {
      callback("HALLO FROM PLUGIN1!")
    },
    onYolo(callback: (value: "yolo") => void) {
      callback("yolo")
    },
  }
}

const Plugin2 = () => {
  return {
    onMouseDown(callback: (value: number) => void) {
      callback(2)
    },
  }
}

const { T, Canvas } = createT(THREE, [Plugin1])

export function PluginExample() {
  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
    >
      <T.Mesh
        plugins={[Plugin2]}
        onYolo={value => console.log(value)}
        onMouseDown={value => console.log(value)}
        onCustom={value => console.log(value)}
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
