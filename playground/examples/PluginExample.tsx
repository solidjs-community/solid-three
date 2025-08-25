import * as THREE from "three"
import type { Meta, Plugin } from "types.ts"
import {
  createT,
  Entity,
  EventPlugin,
  plugin,
  Resource,
  useFrame,
  useThree,
} from "../../src/index.ts"
import { OrbitControls } from "../controls/OrbitControls.tsx"

// LookAt plugin - works for all Object3D elements
const LookAtPlugin = plugin([THREE.Object3D], element => ({
  lookAt: (target: THREE.Object3D | [number, number, number]) => {
    useFrame(() => {
      if (Array.isArray(target)) {
        element.lookAt(...target)
      } else {
        element.lookAt(target.position)
      }
    })
  },
}))

// Shake plugin - works for both Camera and Light elements using array syntax
const ShakePlugin = plugin([THREE.Camera, THREE.DirectionalLight, THREE.Mesh], element => ({
  shake: (intensity = 0.1) => {
    const originalPosition = element.position.clone()
    useFrame(() => {
      element.position.x = originalPosition.x + (Math.random() - 0.5) * intensity
      element.position.y = originalPosition.y + (Math.random() - 0.5) * intensity
      element.position.z = originalPosition.z + (Math.random() - 0.5) * intensity
    })
  },
}))

// Custom filter plugin - works for objects with a 'material' property using type guard
const MaterialPlugin = plugin(
  (element: any): element is THREE.Mesh =>
    element instanceof THREE.Mesh && element.material !== undefined,
  element => ({
    highlight: (color: string = "yellow") => {
      const material = element.material as THREE.MeshBasicMaterial
      material.color.set(color)
    },
    setColor: (color: string) => {
      const material = element.material as THREE.MeshBasicMaterial
      material.color.setHex(parseInt(color.replace("#", ""), 16))
    },
  }),
)

// Global plugin - applies to all elements using single argument
const GlobalPlugin: Plugin<{
  (element: THREE.Material): { log(message: number): void }
  (element: THREE.Mesh): { log(message: string): void }
}> = plugin(element => ({
  log: (message: string | number) => {
    console.info(`[${element.constructor.name}] ${message}`)
  },
}))

// Example with setup - plugin that needs context from setup function
const ContextPlugin = plugin
  .setup(context => {
    return { scene: context.scene }
  })
  .then((element, context) => ({
    addToScene: () => {
      // This plugin has access to the context from setup
      console.info("Adding to scene", element, context.scene)
    },
  }))

const { T, Canvas } = createT(THREE, [
  LookAtPlugin,
  ShakePlugin,
  EventPlugin,
  MaterialPlugin,
  GlobalPlugin,
  ContextPlugin,
])

export function PluginExample() {
  let cubeRef: Meta<THREE.Mesh>
  let cameraRef: Meta<THREE.PerspectiveCamera>

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
      onClick={() => console.info("click missed")}
    >
      <OrbitControls />
      <Entity from={THREE.Mesh} />
      {/* Mesh with lookAt (from LookAtPlugin) and material methods (from MaterialPlugin) */}
      <T.Mesh
        ref={cubeRef!}
        position={[0, 0, 0]}
        highlight="red"
        lookAt={useThree().currentCamera}
        log="Mesh rendered!"
        shake={0.1}
        onClick={event => event.stopPropagation()}
      >
        <T.TorusKnotGeometry args={[1, 0.5, 128, 32]} />
        <T.MeshStandardMaterial metalness={1} roughness={0} color="white" log={0}>
          <Resource
            loader={THREE.CubeTextureLoader}
            attach="envMap"
            path="https://rawcdn.githack.com/mrdoob/three.js/54ac263593c81b669ca9a089491ddd9e240427d2/examples/textures/cube/Bridge2/"
            url={["posx.jpg", "negx.jpg", "posy.jpg", "negy.jpg", "posz.jpg", "negz.jpg"]}
          />
        </T.MeshStandardMaterial>
      </T.Mesh>
      {/* Camera with shake (from ShakePlugin) */}
      <T.PerspectiveCamera ref={cameraRef!} position={[10, 10, 10]} shake={0.05} />

      <T.DirectionalLight position={[5, 5, 5]} intensity={1} />
      <T.AmbientLight intensity={0.5} />
    </Canvas>
  )
}
