import * as THREE from "three"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

// Two useFrame callbacks coordinated via `priority`: the cube updates first
// (priority 0), then the camera reads the cube's *new* position to follow it
// (priority 1). Without the explicit ordering, the camera would see the cube
// one frame behind.

function MovingCube(props: { meshRef: (mesh: THREE.Mesh) => void }) {
  let mesh: THREE.Mesh | undefined
  useFrame(
    context => {
      if (!mesh) return
      mesh.position.x = Math.sin(context.clock.elapsedTime) * 1.5
    },
    { priority: 0 },
  )
  return (
    <T.Mesh
      ref={node => {
        mesh = node
        props.meshRef(node)
      }}
    >
      <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

function CameraFollow(props: { target: () => THREE.Mesh | undefined }) {
  useFrame(
    context => {
      const target = props.target()
      if (!target) return
      context.camera.position.x = target.position.x
      context.camera.lookAt(target.position)
    },
    { priority: 1 },
  )
  return null
}

export default function App() {
  let cubeMesh: THREE.Mesh | undefined
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <MovingCube meshRef={node => (cubeMesh = node)} />
      <CameraFollow target={() => cubeMesh} />
    </Canvas>
  )
}
