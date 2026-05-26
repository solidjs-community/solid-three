import * as THREE from "three"
import * as CANNON from "cannon-es"
import { Canvas, createT, useFrame } from "solid-three"
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js"
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"

const T = createT(THREE)

const FONT_URL =
  "https://esm.sh/three@0.181/examples/fonts/helvetiker_bold.typeface.json"

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

function startXFor(index: number): number {
  const gap = index < 5 ? 0 : 0.6
  return (index - 4.5) * 0.9 + gap
}

function buildLetterStates(font: Font): LetterState[] {
  return LETTERS.map((letter, index) => {
    const geometry = new TextGeometry(letter, {
      font,
      size: 0.8,
      height: 0.25,
      curveSegments: 8,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
    })
    geometry.center()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox ?? new THREE.Box3()
    const size = new THREE.Vector3()
    box.getSize(size)
    const halfExtents = size.clone().multiplyScalar(0.5)
    const shape = new CANNON.Box(
      new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z),
    )
    const body = new CANNON.Body({ mass: 1, shape })
    body.position.set(startXFor(index), 4 + Math.random() * 2, (Math.random() - 0.5) * 0.5)
    body.quaternion.setFromEuler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    )
    body.angularVelocity.set(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
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

export default function Hero() {
  const [font, setFont] = createSignal<Font | undefined>()

  onMount(() => {
    new FontLoader().load(
      FONT_URL,
      loaded => setFont(loaded),
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
    return { world: w, letters }
  })

  return (
    <Canvas camera={{ position: [0, 1.5, 6], fov: 45 }}>
      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[3, 6, 4]} intensity={1.1} />
      <Show when={world()}>
        {worldRef => <Scene state={worldRef()} />}
      </Show>
    </Canvas>
  )
}

function Scene(props: { state: { world: CANNON.World; letters: LetterState[] } }) {
  const meshes: (THREE.Mesh | undefined)[] = []

  useFrame(() => {
    props.state.world.step(1 / 60)
    props.state.letters.forEach((letter, i) => {
      const mesh = meshes[i]
      if (!mesh) return
      mesh.position.set(
        letter.body.position.x,
        letter.body.position.y,
        letter.body.position.z,
      )
      mesh.quaternion.set(
        letter.body.quaternion.x,
        letter.body.quaternion.y,
        letter.body.quaternion.z,
        letter.body.quaternion.w,
      )
    })
  })

  onCleanup(() => {
    props.state.letters.forEach(letter => letter.geometry.dispose())
  })

  return (
    <For each={props.state.letters}>
      {(letter, i) => (
        <T.Mesh
          ref={mesh => (meshes[i()] = mesh)}
          geometry={letter.geometry}
        >
          <T.MeshStandardMaterial color={letter.color} />
        </T.Mesh>
      )}
    </For>
  )
}
