import * as THREE from "three"
import type { Meta } from "types.ts"
import {
  createPlugin,
  createT,
  EventPlugin,
  Resource,
  useFrame,
  useThree,
} from "../../src/index.ts"
import { OrbitControls } from "../controls/OrbitControls.tsx"

// LookAt plugin - works for all Object3D elements
const LookAtPlugin = createPlugin()
  .extends(THREE.Object3D)
  .provide(element => ({
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

// Shake plugin - works for both Camera and Light elements
const ShakePlugin = createPlugin()
  .extends(THREE.Camera, THREE.DirectionalLight)
  .provide(element => ({
    shake: (intensity = 0.1) => {
      const originalPosition = element.position.clone()
      useFrame(() => {
        element.position.x = originalPosition.x + (Math.random() - 0.5) * intensity
        element.position.y = originalPosition.y + (Math.random() - 0.5) * intensity
        element.position.z = originalPosition.z + (Math.random() - 0.5) * intensity
      })
    },
  }))

// Custom filter plugin - works for objects with a 'material' property
const MaterialPlugin = createPlugin()
  .filter(
    (element): element is THREE.Mesh =>
      element instanceof THREE.Mesh && element.material !== undefined,
  )
  .provide(element => ({
    highlight: (color: string = "yellow") => {
      const material = element.material as THREE.MeshBasicMaterial
      material.color.set(color)
    },
    setColor: (color: string) => {
      const material = element.material as THREE.MeshBasicMaterial
      material.color.setHex(parseInt(color.replace("#", ""), 16))
    },
  }))

const { T, Canvas } = createT(THREE, [LookAtPlugin, ShakePlugin, MaterialPlugin, EventPlugin])

export function PluginExample() {
  let cubeRef: Meta<THREE.Mesh>
  let cameraRef: Meta<THREE.PerspectiveCamera>

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }}
    >
      <OrbitControls />

      {/* Mesh with lookAt (from LookAtPlugin) and material methods (from MaterialPlugin) */}
      <T.Mesh
        ref={cubeRef!}
        position={[0, 0, 0]}
        lookAt={useThree().currentCamera}
        setColor="#ff6600"
        onMouseDown={console.info}
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

      {/* Camera with shake (from ShakePlugin) */}
      <T.PerspectiveCamera ref={cameraRef!} position={[10, 10, 10]} shake={0.05} />

      
        These would cause TypeScript errors:
        <T.Mesh shake={0.1} />         // ❌ Mesh doesn't have shake (Camera/Light only)
        <T.DirectionalLight shake={0.1} />  // ❌ Light doesn't have shake (Camera/Light only but DirectionalLight not included)
        <T.DirectionalLight lookAt={cubeRef}! />  // ❌ Light doesn't inherit from Object3D in our type system
        <T.DirectionalLight setColor="#ff0000" />  // ❌ Light doesn't have material (MaterialPlugin filter)
     

      <T.DirectionalLight position={[5, 5, 5]} intensity={1} />
      <T.AmbientLight intensity={0.5} />
    </Canvas>
  )
}
