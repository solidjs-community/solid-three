import * as CANNON from "cannon-es"
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { Canvas, createT, useFrame, useThree } from "solid-three"
import { pointerEvents } from "solid-three/events"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"
import { Font } from "three/examples/jsm/loaders/FontLoader.js"
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js"

// Served from public/. A relative URL resolves against the document base —
// which the editor iframe pins to the deploy base — so it works under a
// subpath deploy without referencing build-time env (undefined in the blob).
// A relative ?url import would break in edit mode.
const fontTtfUrl = "zalando-sans-expanded-latin-600-normal.ttf"

const T = createT(THREE, [pointerEvents()])

const LETTERS = ["S", "O", "L", "I", "D", "T", "H", "R", "E", "E"] as const
const SOLID_BLUE = "#2c4f7c"
const WARM_WHITE = "#f4f4f4"

interface LetterState {
  index: number
  letter: string
  color: string
  geometry: THREE.BufferGeometry
  halfExtents: THREE.Vector3
  body: CANNON.Body
}

function colorFor(index: number): string {
  return index < 5 ? SOLID_BLUE : WARM_WHITE
}

const ROW_SPACING = 0.7
const ROW_Z = 0.9

function startXFor(index: number): number {
  const localIndex = index < 5 ? index : index - 5
  return (localIndex - 2) * ROW_SPACING
}

function startZFor(index: number): number {
  return index < 5 ? -ROW_Z : ROW_Z
}

function buildLetterStates(font: Font): LetterState[] {
  return LETTERS.map((letter, index) => {
    const geometry = new TextGeometry(letter, {
      font,
      size: 0.8,
      depth: 0.1,
      curveSegments: 8,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.005,
      bevelSegments: 2,
    })
    geometry.rotateX(-Math.PI / 2)
    geometry.center()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox ?? new THREE.Box3()
    const size = new THREE.Vector3()
    box.getSize(size)
    const halfExtents = size.clone().multiplyScalar(0.5)
    const shape = new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z))
    const body = new CANNON.Body({ mass: 1, shape, angularDamping: 0.6, linearDamping: 0.05 })
    body.type = CANNON.Body.KINEMATIC
    body.position.set(startXFor(index), 5, startZFor(index) + (Math.random() - 0.5) * 0.15)
    body.quaternion.setFromEuler(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
    )
    return { index, letter, color: colorFor(index), geometry, halfExtents, body }
  })
}

function createWorld(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() })
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(groundBody)
  return world
}

function EnvironmentSetup() {
  const three = useThree()
  onMount(() => {
    const { scene, gl } = three
    const pmrem = new THREE.PMREMGenerator(gl as THREE.WebGLRenderer)
    const envScene = new RoomEnvironment()
    const envTexture = pmrem.fromScene(envScene, 0.04).texture
    const previous = scene.environment
    scene.environment = envTexture
    onCleanup(() => {
      scene.environment = previous
      envTexture.dispose()
      pmrem.dispose()
    })
  })
  return null
}

function Scene(props: { state: { world: CANNON.World; letters: LetterState[] } }) {
  const three = useThree()
  const startTime = performance.now()
  const meshes: (THREE.Mesh | undefined)[] = []

  useFrame(() => {
    props.state.world.step(1 / 60)
    props.state.letters.forEach((letter, i) => {
      const mesh = meshes[i]
      if (!mesh) return
      mesh.position.set(letter.body.position.x, letter.body.position.y, letter.body.position.z)
      mesh.quaternion.set(
        letter.body.quaternion.x,
        letter.body.quaternion.y,
        letter.body.quaternion.z,
        letter.body.quaternion.w,
      )
    })
    const t = (performance.now() - startTime) / 1000
    const angle = t * 0.08
    const radius = 0.8
    three.camera.position.x = Math.sin(angle) * radius
    three.camera.position.z = Math.cos(angle) * radius + 2.5
    three.camera.lookAt(0, 0, 0)
  })

  onCleanup(() => {
    props.state.letters.forEach(letter => letter.geometry.dispose())
  })

  return (
    <>
      <T.GridHelper args={[8, 12]} />
      <For each={props.state.letters}>
        {(letter, i) => (
          <T.Mesh
            ref={mesh => (meshes[i()] = mesh)}
            geometry={letter.geometry}
            onPointerDown={() => {
              const upward = 6 + Math.random() * 2
              const sideways = (Math.random() - 0.5) * 3
              letter.body.applyImpulse(
                new CANNON.Vec3(sideways, upward, sideways),
                new CANNON.Vec3(
                  (Math.random() - 0.5) * letter.halfExtents.x,
                  0,
                  (Math.random() - 0.5) * letter.halfExtents.z,
                ),
              )
            }}
          >
            <T.MeshStandardMaterial color={letter.color} metalness={0.85} roughness={0.2} />
          </T.Mesh>
        )}
      </For>
    </>
  )
}

export default function Hero() {
  const [font, setFont] = createSignal<Font | undefined>()

  onMount(() => {
    new TTFLoader().load(
      fontTtfUrl,
      json => setFont(new Font(json)),
      undefined,
      error => console.error("[hero] font load failed", error),
    )
  })

  const world = createMemo(() => {
    const f = font()
    if (!f) return undefined
    const w = createWorld()
    const letters = buildLetterStates(f)
    letters.forEach(letter => w.addBody(letter.body))
    const timers = letters.map((letter, index) =>
      window.setTimeout(() => {
        letter.body.type = CANNON.Body.DYNAMIC
        letter.body.updateMassProperties()
        letter.body.wakeUp()
        letter.body.angularVelocity.set(0, 0, 0)
      }, index * 280),
    )
    onCleanup(() => timers.forEach(id => window.clearTimeout(id)))
    return { world: w, letters }
  })

  return (
    <Canvas camera={{ position: [0, 6, 3], fov: 40 }}>
      <EnvironmentSetup />
      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[3, 6, 4]} intensity={1.1} />
      <Show when={world()}>{worldRef => <Scene state={worldRef()} />}</Show>
    </Canvas>
  )
}
