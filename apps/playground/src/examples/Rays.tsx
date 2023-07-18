import { Canvas, useFrame, T } from '@solid-three/fiber'
import { createEffect } from 'solid-js'

function Torus(props) {
  let mesh
  let sphere
  // useHelper(mesh, MeshBVHVisualizer)
  useFrame((state, delta) => (mesh.rotation.x = mesh.rotation.y += delta))

  return (
    <T.Mesh
      ref={mesh}
      {...props}
      onPointerMove={(e) => sphere.position.copy(mesh.worldToLocal(e.point))}
      onPointerOver={() => (sphere.visible = true)}
      onPointerOut={() => (sphere.visible = false)}>
      <T.TorusKnotGeometry args={[1, 0.4, 200, 50]} />
      <T.MeshNormalMaterial />
      <T.Mesh raycast={() => null} ref={sphere} visible={false}>
        <T.SphereGeometry args={[0.2]} />
        <T.MeshBasicMaterial color="orange" toneMapped={false} />
      </T.Mesh>
    </T.Mesh>
  )
}

export default function App() {
  // const { enabled } = useControls({ enabled: true })
  return (
    <Canvas camera-position-z={40} camera-far={100}>
      <T.Color attach="background" args={['#202025']} />
      {/* <Perf position="bottom-right" style={{ margin: 10 }} /> */}
      {/** Anything that Bvh wraps is getting three-mesh-bvh's acceleratedRaycast.
           Click on "enabled" to see what normal raycast performance in threejs looks like. */}
      {/* <Bvh firstHitOnly enabled={enabled}> */}
      <Rays>
        <Torus />
      </Rays>
      {/* </Bvh> */}
      {/* <OrbitControls /> */}
    </Canvas>
  )
}

import * as THREE from 'three'

const pointDist = 25
const raycaster = new THREE.Raycaster()
const origVec = new THREE.Vector3()
const dirVec = new THREE.Vector3()
const cyl = new THREE.CylinderGeometry(0.02, 0.02)
const sph = new THREE.SphereGeometry(0.25, 20, 20)
const bas = new THREE.MeshBasicMaterial()
const tra = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25 })

export const Rays = (props) => {
  let ref
  // const { count } = useControls({ count: { value: 100, min: 0, max: 500 } })
  return (
    <>
      <T.Group ref={ref} {...props} />
      {Array.from({ length: 10 }, (_, id) => {
        return <Ray target={ref} />
      })}
    </>
  )
}

const Ray = ({ target }) => {
  let objRef
  let origMesh
  let hitMesh
  let cylinderMesh

  createEffect(() => {
    hitMesh.scale.multiplyScalar(0.5)
    origMesh.position.set(pointDist, 0, 0)
    objRef.rotation.x = Math.random() * 10
    objRef.rotation.y = Math.random() * 10
  })

  const xDir = Math.random() - 0.5
  const yDir = Math.random() - 0.5

  useFrame((state, delta) => {
    const obj = objRef
    obj.rotation.x += xDir * delta
    obj.rotation.y += yDir * delta
    origMesh.updateMatrixWorld()
    origVec.setFromMatrixPosition(origMesh.matrixWorld)
    dirVec.copy(origVec).multiplyScalar(-1).normalize()
    raycaster.set(origVec, dirVec)
    raycaster.firstHitOnly = true
    const res = raycaster.intersectObject(target, true)
    const length = res.length ? res[0].distance : pointDist
    hitMesh.position.set(pointDist - length, 0, 0)
    cylinderMesh.position.set(pointDist - length / 2, 0, 0)
    cylinderMesh.scale.set(1, length, 1)
    cylinderMesh.rotation.z = Math.PI / 2
  })

  return (
    <T.Group ref={objRef}>
      <T.Mesh ref={origMesh} geometry={sph} material={bas} />
      <T.Mesh ref={hitMesh} geometry={sph} material={bas} />
      <T.Mesh ref={cylinderMesh} geometry={cyl} material={tra} />
    </T.Group>
  )
}
