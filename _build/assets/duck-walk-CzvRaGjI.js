var e=`import { Canvas, createT, useFrame, useThree } from "solid-three"
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

const STEP_OMEGA = 3.2 // radians/sec of the step cycle
const LEG_SWING = 0.5 // radians
const BODY_BOB = 0.04 // units
const WADDLE = 0.08 // radians of roll

const GRID_CELL = 0.5 // 12 / 24, one cell of the GridHelper
const TREADMILL_SPEED = 0.6 // units/sec the ground scrolls
const ORBIT_RADIUS = 2 // matches the framed distance the design liked
const ORBIT_HEIGHT = 0.9
const ORBIT_OMEGA = 0.1 // radians/sec of the turntable
const ORBIT_START = Math.PI / 4 // start at a three-quarter angle, not head-on

// Shapes are cheap CPU-side data, defined once. The actual geometries are
// created declaratively in JSX (and centered via the geometry's \`ref\`), so the
// renderer owns and disposes them per mount.

// Fixed single-path SVG, so it yields exactly one path and one shape.
const teardropShape = SVGLoader.createShapes(
  new SVGLoader().parse(\`<svg><path d="\${SOLID_PATH}"/></svg>\`).paths[0],
)[0]

const bodyExtrudeOptions = {
  depth: BODY_DEPTH,
  curveSegments: 48, // smooth the curved SVG outline instead of faceting it
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 3,
}

const beakShape = new THREE.Shape()
beakShape.moveTo(5, 0)
beakShape.lineTo(-4, 6)
beakShape.lineTo(-4, -3)
beakShape.closePath()

const footShape = new THREE.Shape()
footShape.moveTo(-0.14, 0)
footShape.lineTo(0.2, 0.08)
footShape.lineTo(0.2, -0.08)
footShape.closePath()

function Leg(props: { lateral: number; hipRef: (group: THREE.Group) => void }) {
  // Hip group sits at the joint so rotating it swings the whole leg + foot.
  return (
    <T.Group ref={props.hipRef} position={[0, -0.25, props.lateral]}>
      <T.Mesh position={[0, -0.15, 0]}>
        <T.CylinderGeometry args={[0.03, 0.03, 0.3]} />
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>
      <T.Mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.26, 0]}>
        <T.ExtrudeGeometry args={[footShape, { depth: 0.04, bevelEnabled: false }]} />
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>
    </T.Group>
  )
}

function Eye(props: { lateral: number }) {
  const three = useThree()
  const cameraPosition = new THREE.Vector3()
  let group: THREE.Group | undefined
  // lookAt aims the group's local -z at the camera, swivelling the pupil
  // (offset along -z) toward it. It accounts for the duck's parent rotations.
  useFrame(() => {
    if (!group) return
    three.camera.getWorldPosition(cameraPosition)
    group.lookAt(cameraPosition)
  })
  return (
    <T.Group ref={element => (group = element)} position={[0, 0.16, props.lateral]}>
      <T.Mesh>
        <T.SphereGeometry args={[0.1]} />
        <T.MeshStandardMaterial color="#ffffff" />
      </T.Mesh>
      <T.Mesh position={[0, 0, 0.09]}>
        <T.SphereGeometry args={[0.03]} />
        <T.MeshStandardMaterial color="#000000" />
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
        <T.Mesh position={[-0.05, 0.16, 0]} scale={BODY_SCALE}>
          <T.ExtrudeGeometry args={[teardropShape, bodyExtrudeOptions]} ref={geometry => geometry.center()} />
          <T.MeshPhongMaterial color={SOLID_BLUE} />
        </T.Mesh>
        <T.Mesh position={[0.05, -0.16, 0]} rotation={[0, 0, Math.PI]} scale={BODY_SCALE}>
          <T.ExtrudeGeometry args={[teardropShape, bodyExtrudeOptions]} ref={geometry => geometry.center()} />
          <T.MeshPhongMaterial color={SOLID_BLUE_LIGHT} />
        </T.Mesh>
      </T.Group>

      {/* Beak */}
      <T.Mesh position={[0.375, 0.14, 0]} scale={BODY_SCALE}>
        <T.ExtrudeGeometry
          args={[beakShape, { depth: BODY_DEPTH + 0.8, bevelEnabled: false }]}
          ref={geometry => geometry.center()}
        />
        <T.MeshStandardMaterial color={SOLID_YELLOW} />
      </T.Mesh>

      {/* Eyes track the camera, mirrored across the lateral axis */}
      <Eye lateral={0.15} />
      <Eye lateral={-0.15} />

      {/* Legs */}
      <Leg lateral={0.1} hipRef={props.leftHipRef} />
      <Leg lateral={-0.1} hipRef={props.rightHipRef} />
    </T.Group>
  )
}

function DuckAnimator(props: {
  duckRoot: () => THREE.Group | undefined
  leftHip: () => THREE.Group | undefined
  rightHip: () => THREE.Group | undefined
  grid: () => THREE.GridHelper | undefined
}) {
  const three = useThree()
  const baseY = 0.55
  // useFrame's callback receives (context, delta). Read the engine clock's
  // \`elapsedTime\` PROPERTY (not getElapsedTime(), which calls getDelta() and
  // would corrupt the render loop's own getDelta()).
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phase = t * STEP_OMEGA
    const left = props.leftHip()
    const right = props.rightHip()
    const root = props.duckRoot()
    // Legs swing fore/aft about the lateral axis (local z), opposite phase.
    if (left) left.rotation.z = Math.sin(phase) * LEG_SWING
    if (right) right.rotation.z = -Math.sin(phase) * LEG_SWING
    if (root) {
      // Body dips twice per stride as each foot plants.
      root.position.y = baseY + Math.abs(Math.sin(phase)) * BODY_BOB
      // Roll side-to-side with the stride.
      root.rotation.x = Math.sin(phase) * WADDLE
    }
    // Treadmill: scroll the grid under the duck, wrapping by one cell to loop.
    const gridHelper = props.grid()
    if (gridHelper) gridHelper.position.z = -((t * TREADMILL_SPEED) % GRID_CELL)
    // Turntable: orbit the camera around the duck, always aiming at it.
    const angle = ORBIT_START + t * ORBIT_OMEGA
    three.camera.position.set(
      Math.sin(angle) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.cos(angle) * ORBIT_RADIUS,
    )
    three.camera.lookAt(0, baseY, 0)
  })
  return null
}

export default function DuckWalk() {
  let duckRoot: THREE.Group | undefined
  let leftHip: THREE.Group | undefined
  let rightHip: THREE.Group | undefined
  let grid: THREE.GridHelper | undefined

  return (
    <Canvas camera={{ position: [1, 0.9, 1], fov: 45 }}>
      <T.AmbientLight intensity={0.7} />
      <T.DirectionalLight position={[4, 6, 4]} intensity={1.1} />
      <T.GridHelper ref={element => (grid = element)} args={[12, 24]} />
      <Duck
        rootRef={group => (duckRoot = group)}
        leftHipRef={group => (leftHip = group)}
        rightHipRef={group => (rightHip = group)}
      />
      <DuckAnimator
        duckRoot={() => duckRoot}
        leftHip={() => leftHip}
        rightHip={() => rightHip}
        grid={() => grid}
      />
    </Canvas>
  )
}
`;export{e as default};