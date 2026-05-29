import { Canvas, createT, useFrame, useThree } from "solid-three"
import * as THREE from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"

const T = createT(THREE)

const SOLID_BLUE = "#518ac8"
const SOLID_BLUE_LIGHT = "#76b3e1"
const SOLID_YELLOW = "#ffdd00"

const SOLID_PATH =
  "m 135.55266,65.650453 a 45,45 0 0 0 -48.000001,-15 l -62,20 c 0,0 53,40.000007 94.000001,29.999997 l 3,-0.999997 c 17,-5 23,-21 13,-34 z"

const BODY_SCALE = 0.006
const BODY_DEPTH = 50

// The geometries below are module-scope singletons, shared across every mount
// of this demo (the gallery caches the module). They are intentionally never
// disposed: their lifetime is the module's, not the component's — disposing on
// unmount would break the meshes when the gallery returns to this demo.

// Fixed single-path SVG, so it yields exactly one path and one shape.
const teardropShape = SVGLoader.createShapes(
  new SVGLoader().parse(`<svg><path d="${SOLID_PATH}"/></svg>`).paths[0],
)[0]

const bodyExtrudeOptions = {
  depth: BODY_DEPTH,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 3,
}

function makeCenteredExtrude(
  shape: THREE.Shape,
  options: THREE.ExtrudeGeometryOptions,
): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, options)
  geometry.center()
  return geometry
}

const teardropGeometry = makeCenteredExtrude(teardropShape, bodyExtrudeOptions)

const beakShape = new THREE.Shape()
beakShape.moveTo(5, 0)
beakShape.lineTo(-4, 6)
beakShape.lineTo(-4, -3)
beakShape.closePath()
const beakGeometry = makeCenteredExtrude(beakShape, {
  depth: BODY_DEPTH + 0.8,
  bevelEnabled: false,
})

const footShape = new THREE.Shape()
footShape.moveTo(-0.14, 0)
footShape.lineTo(0.2, 0.08)
footShape.lineTo(0.2, -0.08)
footShape.closePath()
const footGeometry = new THREE.ExtrudeGeometry(footShape, {
  depth: 0.04,
  bevelEnabled: false,
})

function Leg(props: { lateral: number; hipRef: (group: THREE.Group) => void }) {
  // Hip group sits at the joint so rotating it swings the whole leg + foot.
  return (
    <T.Group ref={props.hipRef} position={[0, -0.25, props.lateral]}>
      <T.Mesh position={[0, -0.15, 0]}>
        <T.CylinderGeometry args={[0.03, 0.03, 0.3]} />
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>
      <T.Mesh geometry={footGeometry} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>
    </T.Group>
  )
}

function Duck(props: {
  rootRef: (group: THREE.Group) => void
  leftHipRef: (group: THREE.Group) => void
  rightHipRef: (group: THREE.Group) => void
}) {
  return (
    <T.Group ref={props.rootRef} position={[0, 0.55, 0]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Body: two teardrops, parent flipped on x like the original */}
      <T.Group rotation={[Math.PI, 0, 0]}>
        <T.Mesh geometry={teardropGeometry} position={[-0.05, 0.16, 0]} scale={BODY_SCALE}>
          <T.MeshStandardMaterial color={SOLID_BLUE} />
        </T.Mesh>
        <T.Mesh
          geometry={teardropGeometry}
          position={[0.05, -0.16, 0]}
          rotation={[0, 0, Math.PI]}
          scale={BODY_SCALE}
        >
          <T.MeshStandardMaterial color={SOLID_BLUE_LIGHT} />
        </T.Mesh>
      </T.Group>

      {/* Beak */}
      <T.Mesh geometry={beakGeometry} position={[0.375, 0.14, 0]} scale={BODY_SCALE}>
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>

      {/* Eyes + pupils, mirrored across lateral axis */}
      <T.Mesh position={[0, 0.16, 0.15]}>
        <T.SphereGeometry args={[0.1]} />
        <T.MeshStandardMaterial color="#ffffff" />
      </T.Mesh>
      <T.Mesh position={[0, 0.16, 0.25]}>
        <T.SphereGeometry args={[0.03]} />
        <T.MeshStandardMaterial color="#000000" />
      </T.Mesh>
      <T.Mesh position={[0, 0.16, -0.15]}>
        <T.SphereGeometry args={[0.1]} />
        <T.MeshStandardMaterial color="#ffffff" />
      </T.Mesh>
      <T.Mesh position={[0, 0.16, -0.25]}>
        <T.SphereGeometry args={[0.03]} />
        <T.MeshStandardMaterial color="#000000" />
      </T.Mesh>

      {/* Legs */}
      <Leg lateral={0.1} hipRef={props.leftHipRef} />
      <Leg lateral={-0.1} hipRef={props.rightHipRef} />
    </T.Group>
  )
}

export default function DuckWalk() {
  let duckRoot: THREE.Group | undefined
  let leftHip: THREE.Group | undefined
  let rightHip: THREE.Group | undefined

  return (
    <Canvas camera={{ position: [3, 1.5, 3], fov: 45 }}>
      <T.AmbientLight intensity={0.7} />
      <T.DirectionalLight position={[4, 6, 4]} intensity={1.1} />
      <T.GridHelper args={[12, 24]} />
      <Duck
        rootRef={group => (duckRoot = group)}
        leftHipRef={group => (leftHip = group)}
        rightHipRef={group => (rightHip = group)}
      />
    </Canvas>
  )
}
