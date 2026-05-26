import * as THREE from "three"
import * as CANNON from "cannon-es"
import { Canvas, createT, useFrame, useThree } from "solid-three"
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js"
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

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

function EnvironmentSetup() {
  const three = useThree()
  onMount(() => {
    const { scene, gl } = three
    const pmrem = new THREE.PMREMGenerator(gl)
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
      <EnvironmentSetup />
      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[3, 6, 4]} intensity={1.1} />
      <Show when={world()}>
        {worldRef => <Scene state={worldRef()} />}
      </Show>
    </Canvas>
  )
}

function Scene(props: { state: { world: CANNON.World; letters: LetterState[] } }) {
  const three = useThree()
  const startTime = performance.now()
  const meshes: (THREE.Mesh | undefined)[] = []
  const shadowMeshes: (THREE.Mesh | undefined)[] = []
  const cursor = new THREE.Vector3()
  let cursorActive = false
  let isCoarsePointer = false
  const raycaster = new THREE.Raycaster()
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  onMount(() => {
    isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
    if (isCoarsePointer) return
    const onMove = (event: PointerEvent) => {
      const ndc = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, three.camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        cursor.copy(hit)
        cursorActive = true
      }
    }
    const onLeave = () => {
      cursorActive = false
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerleave", onLeave)
    onCleanup(() => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerleave", onLeave)
    })
  })

  useFrame(() => {
    if (cursorActive && !isCoarsePointer) {
      const radius = 1.5
      props.state.letters.forEach(letter => {
        const dx = letter.body.position.x - cursor.x
        const dz = letter.body.position.z - cursor.z
        const distSq = dx * dx + dz * dz
        if (distSq > radius * radius || distSq < 1e-4) return
        const dist = Math.sqrt(distSq)
        const falloff = (radius - dist) / radius
        const strength = 30 * falloff
        letter.body.applyForce(
          new CANNON.Vec3((dx / dist) * strength, 0, (dz / dist) * strength),
          letter.body.position,
        )
      })
    }
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
    props.state.letters.forEach((letter, i) => {
      const shadow = shadowMeshes[i]
      if (!shadow) return
      const height = Math.max(0, letter.body.position.y)
      const opacity = Math.max(0, 0.45 - height * 0.15)
      const scale = 1 - Math.min(0.6, height * 0.1)
      shadow.position.set(letter.body.position.x, 0.01, letter.body.position.z)
      shadow.scale.setScalar(scale)
      ;(shadow.material as THREE.MeshBasicMaterial).opacity = opacity
    })
    const t = (performance.now() - startTime) / 1000
    const angle = Math.sin(t * 0.05) * 0.3
    three.camera.position.x = Math.sin(angle) * 6
    three.camera.position.z = Math.cos(angle) * 6
    three.camera.lookAt(0, 0.5, 0)
  })

  onCleanup(() => {
    props.state.letters.forEach(letter => letter.geometry.dispose())
  })

  return (
    <For each={props.state.letters}>
      {(letter, i) => (
        <>
          <T.Mesh
            ref={mesh => (shadowMeshes[i()] = mesh)}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <T.CircleGeometry args={[letter.halfExtents.x * 1.6, 16]} />
            <T.MeshBasicMaterial color="#000000" transparent opacity={0.45} />
          </T.Mesh>
          <T.Mesh
            ref={mesh => (meshes[i()] = mesh)}
            geometry={letter.geometry}
            onPointerDown={() => {
              const upward = 5 + Math.random() * 2
              const sideways = (Math.random() - 0.5) * 3
              letter.body.applyImpulse(
                new CANNON.Vec3(sideways, upward, sideways),
                new CANNON.Vec3(0, 0, 0),
              )
            }}
          >
            <T.MeshStandardMaterial color={letter.color} metalness={0.85} roughness={0.2} />
          </T.Mesh>
        </>
      )}
    </For>
  )
}
