import * as THREE from "three"
import { createT, EventPlugin, useThree } from "../../src/index.ts"
import { OrbitControls } from "../controls/OrbitControls.tsx"

const { Canvas } = createT(THREE, [EventPlugin])

export function VanillaExample() {
  return (
    <Canvas defaultCamera={{ position: new THREE.Vector3(0, 0, 30) }} contexts={[EventPlugin]}>
      {(() => {
        const three = useThree()

        const geometry = new THREE.BoxGeometry()
        const material = new THREE.MeshBasicMaterial({ color: "red" })
        const mesh = new THREE.Mesh(geometry, material)

        three.scene.add(mesh)

        return null!
      })()}
      <OrbitControls />
    </Canvas>
  )
}
