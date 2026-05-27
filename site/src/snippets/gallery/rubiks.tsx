import { createMemo, For, onCleanup, onMount } from "solid-js"
import { Canvas, createT, useFrame, useThree } from "solid-three"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

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

interface CubieSpec {
  position: THREE.Vector3
  materials: THREE.Material[]
}

function buildCubies(faceTextures: Record<string, THREE.CanvasTexture>): CubieSpec[] {
  const blank = new THREE.MeshStandardMaterial({
    color: "#111111",
    metalness: 0.2,
    roughness: 0.6,
  })
  const cubies: CubieSpec[] = []
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const materials: THREE.Material[] = [blank, blank, blank, blank, blank, blank]
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
            metalness: 0.2,
            roughness: 0.5,
          })
        }
        cubies.push({ position: new THREE.Vector3(x, y, z), materials })
      }
    }
  }
  return cubies
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
    const angle = t * 0.06
    const radius = 6
    three.camera.position.x = Math.sin(angle) * radius
    three.camera.position.z = Math.cos(angle) * radius
    three.camera.position.y = 2.5
    three.camera.lookAt(0, 0, 0)
  })
  return null
}

export default function Rubiks() {
  const faceTextures = createMemo(() => {
    const map: Record<string, THREE.CanvasTexture> = {}
    for (const face of FACES) map[face.glyph] = makeGlyphTexture(face.glyph)
    onCleanup(() => Object.values(map).forEach(texture => texture.dispose()))
    return map
  })

  const cubies = createMemo(() => buildCubies(faceTextures()))

  return (
    <Canvas camera={{ position: [6, 2.5, 6], fov: 35 }}>
      <EnvironmentSetup />
      <OrbitCamera />
      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[4, 6, 5]} intensity={0.9} />
      <For each={cubies()}>
        {cubie => (
          <T.Mesh position={cubie.position.toArray()} material={cubie.materials}>
            <T.BoxGeometry args={[0.95, 0.95, 0.95]} />
          </T.Mesh>
        )}
      </For>
    </Canvas>
  )
}
