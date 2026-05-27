import { createMemo, createSignal, For, onCleanup, onMount } from "solid-js"
import { Canvas, createT, Entity, useFrame, useThree } from "solid-three"
import {
  applyMove,
  generateScramble,
  initialCubies,
  invertMove,
  type CubieState,
  type Move,
} from "./rubiks-engine"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"

const T = createT(THREE)

const SOLID_BLUE = "#2c4f7c"
const WARM_WHITE = "#f4f4f4"

type Axis = "x" | "y" | "z"

interface FaceSpec {
  axis: Axis
  layer: 1 | -1
  glyph: string
}

const FACES: FaceSpec[] = [
  { axis: "x", layer: 1, glyph: "S" },
  { axis: "x", layer: -1, glyph: "O" },
  { axis: "y", layer: 1, glyph: "L" },
  { axis: "y", layer: -1, glyph: "I" },
  { axis: "z", layer: 1, glyph: "D" },
  { axis: "z", layer: -1, glyph: "3" },
]

// Material-slot order for BoxGeometry: [+X, -X, +Y, -Y, +Z, -Z]
const MATERIAL_SLOT: Record<`${Axis}${1 | -1}`, number> = {
  x1: 0,
  "x-1": 1,
  y1: 2,
  "y-1": 3,
  z1: 4,
  "z-1": 5,
}

function makeGlyphTexture(glyph: string): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("rubiks: 2d context unavailable")
  ctx.fillStyle = SOLID_BLUE
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = WARM_WHITE
  ctx.font = `bold ${size * 0.78}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(glyph, size / 2, size / 2 + size * 0.04)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// For each face, map cubie coordinates to UV offsets within the
// face's 3x3 sticker grid. UV origin is bottom-left; offset selects
// the sticker tile, with `repeat = 1/3` already applied by the caller.
function uvOffset(
  face: FaceSpec,
  x: number,
  y: number,
  z: number,
): { u: number; v: number } {
  const tile = (coord: number) => (coord + 1) / 3
  if (face.axis === "x") {
    const u = face.layer === 1 ? tile(-z) : tile(z)
    const v = tile(y)
    return { u, v }
  }
  if (face.axis === "y") {
    const u = tile(x)
    const v = face.layer === 1 ? tile(-z) : tile(z)
    return { u, v }
  }
  const u = face.layer === 1 ? tile(x) : tile(-x)
  const v = tile(y)
  return { u, v }
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

function OrbitCamera() {
  const three = useThree()
  const start = performance.now()
  useFrame(() => {
    const t = (performance.now() - start) / 1000
    const radius = 11
    // Spherical orbit with incommensurate azimuth/elevation periods so
    // every face passes through view eventually.
    const azimuth = t * 0.18
    const elevation = Math.sin(t * 0.11) * (Math.PI / 2 - 0.15)
    const horizontal = Math.cos(elevation) * radius
    three.camera.position.x = Math.sin(azimuth) * horizontal
    three.camera.position.z = Math.cos(azimuth) * horizontal
    three.camera.position.y = Math.sin(elevation) * radius
    three.camera.lookAt(0, 0, 0)
  })
  return null
}

const TURN_DURATION_MS = 250
const SOLVED_HOLD_MS = 1500
const SCRAMBLED_HOLD_MS = 800
const SCRAMBLE_LENGTH = 20

interface CubieRuntime {
  state: CubieState
  mesh: THREE.Mesh | undefined
}

function buildMeshMaterials(
  state: CubieState,
  faceTextures: Record<string, THREE.CanvasTexture>,
): THREE.Material[] {
  const blank = new THREE.MeshStandardMaterial({
    color: "#000000",
    metalness: 0,
    roughness: 1,
  })
  const materials: THREE.Material[] = [blank, blank, blank, blank, blank, blank]
  const [x, y, z] = state.position
  for (const face of FACES) {
    const coord = face.axis === "x" ? x : face.axis === "y" ? y : z
    if (coord !== face.layer) continue
    const slot = MATERIAL_SLOT[`${face.axis}${face.layer}`]
    const tex = faceTextures[face.glyph].clone()
    tex.needsUpdate = true
    tex.repeat.set(1 / 3, 1 / 3)
    const { u, v } = uvOffset(face, x, y, z)
    tex.offset.set(u, v)
    materials[slot] = new THREE.MeshStandardMaterial({
      map: tex,
      metalness: 0.7,
      roughness: 0.25,
      envMapIntensity: 1.4,
    })
  }
  return materials
}

export default function Rubiks() {
  const faceTextures = createMemo(() => {
    const map: Record<string, THREE.CanvasTexture> = {}
    for (const face of FACES) map[face.glyph] = makeGlyphTexture(face.glyph)
    onCleanup(() => Object.values(map).forEach(texture => texture.dispose()))
    return map
  })

  const runtime = initialCubies().map<CubieRuntime>(state => ({ state, mesh: undefined }))
  const [cubieListVersion, bumpCubies] = createSignal(0)

  // Shared geometry — every cubie is identical, 4 corner segments for the bevel.
  const cubieGeometry = new RoundedBoxGeometry(0.95, 0.95, 0.95, 4, 0.08)
  onCleanup(() => cubieGeometry.dispose())

  return (
    <Canvas camera={{ position: [0, 0, 11], fov: 35 }}>
      <EnvironmentSetup />
      <OrbitCamera />
      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[4, 6, 5]} intensity={0.9} />
      <SceneController
        runtime={runtime}
        faceTextures={faceTextures()}
        onAdvance={() => bumpCubies(value => value + 1)}
      />
      <For each={runtime}>
        {cubie => {
          cubieListVersion()
          const materials = buildMeshMaterials(cubie.state, faceTextures())
          return (
            <T.Mesh
              ref={mesh => (cubie.mesh = mesh)}
              position={cubie.state.position}
              material={materials}
            >
              <Entity from={cubieGeometry} attach="geometry" />
            </T.Mesh>
          )
        }}
      </For>
    </Canvas>
  )
}

type Phase =
  | { kind: "solved-hold"; until: number }
  | {
      kind: "turning"
      move: Move
      queue: Move[]
      nextPhase: "scrambled-hold" | "solved-hold"
      startedAt: number
    }
  | { kind: "scrambled-hold"; until: number; solveQueue: Move[] }

function SceneController(props: {
  runtime: CubieRuntime[]
  faceTextures: Record<string, THREE.CanvasTexture>
  onAdvance: () => void
}) {
  const three = useThree()
  let phase: Phase = { kind: "solved-hold", until: performance.now() + SOLVED_HOLD_MS }
  let sliceGroup: THREE.Group | undefined
  let lastScramble: Move[] = []

  function startTurn(
    move: Move,
    queue: Move[],
    nextPhase: "scrambled-hold" | "solved-hold",
  ) {
    const axisIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2
    const group = new THREE.Group()
    three.scene.add(group)
    for (const cubie of props.runtime) {
      if (cubie.state.position[axisIndex] !== move.layer) continue
      if (cubie.mesh) group.attach(cubie.mesh)
    }
    sliceGroup = group
    phase = { kind: "turning", move, queue, nextPhase, startedAt: performance.now() }
  }

  function commitTurn(move: Move) {
    if (!sliceGroup) return
    setAxisAngle(sliceGroup, move.axis, (move.dir * Math.PI) / 2)
    const children = [...sliceGroup.children]
    for (const child of children) three.scene.attach(child)
    three.scene.remove(sliceGroup)
    sliceGroup = undefined

    const next = applyMove(
      props.runtime.map(cubie => cubie.state),
      move,
    )
    for (let i = 0; i < props.runtime.length; i++) props.runtime[i].state = next[i]

    for (const cubie of props.runtime) {
      if (!cubie.mesh) continue
      cubie.mesh.position.set(...cubie.state.position)
      const [qx, qy, qz, qw] = cubie.state.orientation
      cubie.mesh.quaternion.set(qx, qy, qz, qw)
    }
  }

  useFrame(() => {
    const now = performance.now()
    if (phase.kind === "solved-hold") {
      if (now >= phase.until) {
        lastScramble = generateScramble(SCRAMBLE_LENGTH)
        const [first, ...rest] = lastScramble
        startTurn(first, rest, "scrambled-hold")
      }
      return
    }
    if (phase.kind === "scrambled-hold") {
      if (now >= phase.until) {
        const [first, ...rest] = phase.solveQueue
        startTurn(first, rest, "solved-hold")
      }
      return
    }
    const t = Math.min(1, (now - phase.startedAt) / TURN_DURATION_MS)
    const angle = (t * phase.move.dir * Math.PI) / 2
    if (sliceGroup) setAxisAngle(sliceGroup, phase.move.axis, angle)
    if (t >= 1) {
      const completedMove = phase.move
      const remaining = phase.queue
      const nextPhase = phase.nextPhase
      commitTurn(completedMove)
      props.onAdvance()
      if (remaining.length > 0) {
        const [first, ...rest] = remaining
        startTurn(first, rest, nextPhase)
        return
      }
      if (nextPhase === "scrambled-hold") {
        const solveQueue = [...lastScramble].reverse().map(invertMove)
        phase = { kind: "scrambled-hold", until: now + SCRAMBLED_HOLD_MS, solveQueue }
      } else {
        phase = { kind: "solved-hold", until: now + SOLVED_HOLD_MS }
      }
    }
  })
  return null
}

function setAxisAngle(obj: THREE.Object3D, axis: Axis, angle: number) {
  obj.rotation.set(0, 0, 0)
  if (axis === "x") obj.rotation.x = angle
  else if (axis === "y") obj.rotation.y = angle
  else obj.rotation.z = angle
}
