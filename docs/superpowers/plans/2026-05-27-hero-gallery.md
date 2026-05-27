# Hero Demo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's single hero demo with a randomly-picked gallery of tiny demos, and add a Rubik's cube demo that spells **S O L I D 3** across its six faces with a continuous solved → scramble → solve loop.

**Architecture:** New `site/src/snippets/gallery/` directory; each file is a self-contained Solid component that renders its own `<Canvas>`. A glob-based `index.ts` discovers demos and their raw source. `components/hero.tsx` picks one random demo at client mount and feeds its source to the existing live editor overlay.

**Tech Stack:** SolidJS, SolidStart 2, solid-three, three.js, Vite (`import.meta.glob` for discovery + `?raw` for editor source).

**Source spec:** [`docs/superpowers/specs/2026-05-27-hero-gallery-design.md`](../specs/2026-05-27-hero-gallery-design.md)

**Note on testing:** The site package has no automated test suite for hero scenes today, and the spec explicitly keeps it that way. Each task ends with a manual verification step (dev server) instead of a unit test. Commit only when the verification passes.

---

## Task 1: Move existing hero scene into the gallery directory

Rename the current single hero snippet to its new home so the rest of the work happens against the gallery shape from the start.

**Files:**
- Create: `site/src/snippets/gallery/letter-drop.tsx` (content = current `site/src/snippets/hero.tsx` verbatim)
- Delete: `site/src/snippets/hero.tsx`
- Modify: `site/src/components/hero.tsx` (update two import paths)

- [ ] **Step 1: Move the file via `git mv`**

```bash
mkdir -p site/src/snippets/gallery
git mv site/src/snippets/hero.tsx site/src/snippets/gallery/letter-drop.tsx
```

- [ ] **Step 2: Update the two references in `site/src/components/hero.tsx`**

Change:

```ts
import heroSource from "../snippets/hero.tsx?raw"

const LazyHeroScene = clientOnly(() => import("../snippets/hero"))
```

to:

```ts
import heroSource from "../snippets/gallery/letter-drop.tsx?raw"

const LazyHeroScene = clientOnly(() => import("../snippets/gallery/letter-drop"))
```

- [ ] **Step 3: Verify dev server still renders the hero identically**

Run: `pnpm --filter site dev`
Expected: home page `/` shows the same letter-drop animation, Edit button still opens the editor with the same source. No console errors.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/gallery/letter-drop.tsx site/src/components/hero.tsx
git commit -m "refactor(site): move hero snippet into snippets/gallery/letter-drop"
```

---

## Task 2: Add the gallery registry (`index.ts`)

Auto-discover demo modules and their raw source via Vite's `import.meta.glob`. Expose `demos` and `pickRandomDemo()`.

**Files:**
- Create: `site/src/snippets/gallery/index.ts`

- [ ] **Step 1: Write `index.ts` exactly**

```ts
import type { Component } from "solid-js"

const modules = import.meta.glob<{ default: Component }>("./*.tsx")
const sources = import.meta.glob("./*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export interface Demo {
  id: string
  load: () => Promise<{ default: Component }>
  source: string
}

export const demos: Demo[] = Object.keys(modules)
  .sort()
  .map(path => {
    const id = path.match(/\.\/(.+)\.tsx$/)?.[1]
    if (!id) throw new Error(`gallery: unexpected path ${path}`)
    const source = sources[path]
    if (!source) throw new Error(`gallery: missing raw source for ${path}`)
    return { id, load: modules[path], source }
  })

export function pickRandomDemo(): Demo {
  if (demos.length === 0) throw new Error("gallery: no demos registered")
  return demos[Math.floor(Math.random() * demos.length)]
}
```

- [ ] **Step 2: Type-check the site package**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add site/src/snippets/gallery/index.ts
git commit -m "feat(site): add gallery registry for hero demos"
```

---

## Task 3: Rewire `components/hero.tsx` to use the gallery

Switch the hero to render whichever demo `pickRandomDemo()` returns, with the editor reading that demo's source. With only `letter-drop.tsx` in the gallery the user-visible behavior is unchanged; this isolates the rewiring step.

**Files:**
- Modify: `site/src/components/hero.tsx` (full rewrite)

- [ ] **Step 1: Replace `site/src/components/hero.tsx` with the new version**

```tsx
import { clientOnly } from "@solidjs/start"
import { createMemo, createSignal, Show } from "solid-js"
import { pickRandomDemo, type Demo } from "../snippets/gallery"

const LazyDemo = clientOnly(() => import("./demo"))

function ChosenScene(props: { onPick: (demo: Demo) => void }) {
  const demo = pickRandomDemo()
  props.onPick(demo)
  const LazyScene = clientOnly(demo.load)
  return <LazyScene />
}

const LazyChosenScene = clientOnly(() =>
  Promise.resolve({ default: ChosenScene as any }),
)

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [chosen, setChosen] = createSignal<Demo | undefined>()
  const source = createMemo(() => chosen()?.source ?? "")

  return (
    <div class="hero">
      <div class="hero-canvas">
        <LazyChosenScene onPick={setChosen} />
      </div>
      <div class="hero-overlay">
        <h1 class="hero-title">solid-three</h1>
        <p class="hero-tagline">A SolidJS renderer for three.js.</p>
        <div class="hero-ctas">
          <a class="hero-cta hero-cta-primary" href="/tutorial/01-your-first-scene">
            Start the tutorial
          </a>
          <a class="hero-cta" href="/api">
            API reference
          </a>
        </div>
      </div>
      <Show when={chosen()}>
        <button
          type="button"
          class="hero-edit-toggle"
          onClick={() => setEditorOpen(value => !value)}
        >
          {editorOpen() ? "Close editor" : "Edit"}
        </button>
      </Show>
      <Show when={editorOpen() && source()}>
        <div class="hero-editor-overlay">
          <LazyDemo code={source()} />
        </div>
      </Show>
    </div>
  )
}
```

Why this shape: `ChosenScene` runs inside `clientOnly`, so `pickRandomDemo()` is guaranteed to execute only in the browser — no hydration mismatch is possible. The Edit button is hidden until a demo has been picked, so it always has a source to show.

- [ ] **Step 2: Type-check**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify dev server**

Run: `pnpm --filter site dev`
Expected: home page renders letter-drop demo (the only demo in the gallery). Edit button still toggles the editor and shows the letter-drop source. No console errors. Reload several times — same demo every time (still the only one).

- [ ] **Step 4: Commit**

```bash
git add site/src/components/hero.tsx
git commit -m "feat(site): pick hero demo from gallery registry"
```

---

## Task 4: Add Rubik's cube scaffold — static solved state

Stand up the cube demo file with the data model and a static solved render. No animation yet. This task ends with a working second demo in the gallery; random selection becomes visible.

**Files:**
- Create: `site/src/snippets/gallery/rubiks.tsx`

- [ ] **Step 1: Write `rubiks.tsx` with the cube model, sticker textures, and a static scene**

```tsx
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
          // Slice the face texture into the cubie's 1/9 region.
          const tex = faceTextures[face.glyph].clone()
          tex.needsUpdate = true
          tex.repeat.set(1 / 3, 1 / 3)
          // Which third of the face does this cubie occupy?
          // For each face we need the two in-face axes. Mapping below
          // chooses the offset so the glyph reads upright when viewed
          // from outside the cube.
          const u = uvOffset(face, x, y, z).u
          const v = uvOffset(face, x, y, z).v
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
  // Each face has two in-plane axes; pick them and translate
  // the cubie coordinate (-1, 0, 1) into a tile index (0, 1, 2).
  const tile = (coord: number) => (coord + 1) / 3
  if (face.axis === "x") {
    // +X face: in-plane axes are z (horizontal, flipped) and y (vertical)
    const u = face.layer === 1 ? tile(-z) : tile(z)
    const v = tile(y)
    return { u, v }
  }
  if (face.axis === "y") {
    // +Y face: in-plane axes are x (horizontal) and z (vertical, flipped)
    const u = tile(x)
    const v = face.layer === 1 ? tile(-z) : tile(z)
    return { u, v }
  }
  // z faces: in-plane axes are x (horizontal) and y (vertical)
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify dev server**

Run: `pnpm --filter site dev`
Expected: reload `/` repeatedly. About half the time you see the letter-drop, the other half you see a static Rubik's cube slowly orbiting. Each of the six faces shows one readable glyph: S, O, L, I, D, 3. The Edit button on the cube view opens the editor with the cube's source.

If a glyph is mirrored or upside-down, fix the corresponding case in `uvOffset` (swap `tile(coord)` with `tile(-coord)`) before committing.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/gallery/rubiks.tsx
git commit -m "feat(site): add static Rubik's cube hero demo"
```

---

## Task 5: Add the scramble engine (pure data)

Pure functions that operate on cubie state — no Three.js types. Separated from the scene so it stays easy to reason about.

**Files:**
- Create: `site/src/snippets/gallery/rubiks-engine.ts`

- [ ] **Step 1: Write `rubiks-engine.ts`**

```ts
export type Axis = "x" | "y" | "z"
export type Layer = -1 | 1
export type Dir = 1 | -1

export interface Move {
  axis: Axis
  layer: Layer
  dir: Dir
}

export interface CubieState {
  id: number
  // Logical integer position in [-1, 0, 1]^3.
  position: [number, number, number]
  // Orientation as a unit quaternion [x, y, z, w].
  orientation: [number, number, number, number]
}

export function initialCubies(): CubieState[] {
  const cubies: CubieState[] = []
  let id = 0
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        cubies.push({ id: id++, position: [x, y, z], orientation: [0, 0, 0, 1] })
      }
    }
  }
  return cubies
}

export function cubiesOnLayer(state: CubieState[], move: Move): CubieState[] {
  const axisIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2
  return state.filter(cubie => cubie.position[axisIndex] === move.layer)
}

// Rotate a 3-vector 90° around an axis in `dir` direction (right-handed).
function rotateVec(
  v: [number, number, number],
  axis: Axis,
  dir: Dir,
): [number, number, number] {
  const [x, y, z] = v
  if (axis === "x") return [x, -dir * z, dir * y]
  if (axis === "y") return [dir * z, y, -dir * x]
  return [-dir * y, dir * x, z]
}

// Multiply two unit quaternions: a * b. Order is "apply b, then a".
function quatMul(
  a: [number, number, number, number],
  b: [number, number, number, number],
): [number, number, number, number] {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

function quatFromAxisAngle(
  axis: Axis,
  angle: number,
): [number, number, number, number] {
  const s = Math.sin(angle / 2)
  const c = Math.cos(angle / 2)
  if (axis === "x") return [s, 0, 0, c]
  if (axis === "y") return [0, s, 0, c]
  return [0, 0, s, c]
}

export function applyMove(state: CubieState[], move: Move): CubieState[] {
  const angle = (move.dir * Math.PI) / 2
  const turnQuat = quatFromAxisAngle(move.axis, angle)
  const axisIndex = move.axis === "x" ? 0 : move.axis === "y" ? 1 : 2
  return state.map(cubie => {
    if (cubie.position[axisIndex] !== move.layer) return cubie
    return {
      ...cubie,
      position: rotateVec(cubie.position, move.axis, move.dir),
      orientation: quatMul(turnQuat, cubie.orientation),
    }
  })
}

export function invertMove(move: Move): Move {
  return { ...move, dir: (-move.dir) as Dir }
}

export function generateScramble(count: number, rng: () => number = Math.random): Move[] {
  const axes: Axis[] = ["x", "y", "z"]
  const layers: Layer[] = [-1, 1]
  const dirs: Dir[] = [-1, 1]
  const moves: Move[] = []
  let last: Axis | undefined
  for (let i = 0; i < count; i++) {
    let axis: Axis
    do {
      axis = axes[Math.floor(rng() * 3)]
    } while (axis === last)
    last = axis
    const layer = layers[Math.floor(rng() * 2)]
    const dir = dirs[Math.floor(rng() * 2)]
    moves.push({ axis, layer, dir })
  }
  return moves
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-check the engine in a node REPL**

Run:

```bash
node --input-type=module -e "
import('./site/src/snippets/gallery/rubiks-engine.ts').catch(() => {
  // tsx isn't loaded; use a transpile-on-the-fly approach instead.
});
"
```

If that import fails because TS isn't transpiled, skip — the next task exercises the engine in the browser. Either way, manually trace one move on paper: starting from `position: [1, 1, 1]` and applying `{axis: 'y', layer: 1, dir: 1}`, `rotateVec` should produce `[1, 1, -1]`. Confirm by reading the function. If wrong, fix the sign convention before committing.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/gallery/rubiks-engine.ts
git commit -m "feat(site): add pure Rubik's cube scramble engine"
```

---

## Task 6: Wire the engine into the scene with animated slice turns

Replace the static cubie render with stateful cubies whose positions and orientations are driven by the engine. Each move animates the affected 9 cubies through a `THREE.Group` over 250ms, then commits the new positions.

**Files:**
- Modify: `site/src/snippets/gallery/rubiks.tsx`

- [ ] **Step 1: Restructure the file to use the engine**

Replace the body of `rubiks.tsx` from `export default function Rubiks()` onwards. Keep the earlier helpers (`makeGlyphTexture`, `uvOffset`, `EnvironmentSetup`, `OrbitCamera`, `FACES`, `MATERIAL_SLOT`, `SOLID_BLUE`, `WARM_WHITE`) as-is.

The cubie render is now driven from refs we control imperatively, so each cubie keeps a stable `THREE.Mesh` across moves and we can detach/attach it to slice groups.

Add these imports at the top of the file (alongside the existing ones):

```ts
import { createSignal } from "solid-js"
import {
  applyMove,
  cubiesOnLayer,
  generateScramble,
  initialCubies,
  invertMove,
  type CubieState,
  type Move,
} from "./rubiks-engine"
```

Delete the old `buildCubies` function and the inline `<For>` render in the default export.

Replace `export default function Rubiks()` with:

```tsx
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
    color: "#111111",
    metalness: 0.2,
    roughness: 0.6,
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
      metalness: 0.2,
      roughness: 0.5,
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

  // Stable runtime state: 27 cubies, each with a mesh ref filled in on mount.
  const runtime = initialCubies().map<CubieRuntime>(state => ({ state, mesh: undefined }))
  const [cubieListVersion, bumpCubies] = createSignal(0)

  return (
    <Canvas camera={{ position: [6, 2.5, 6], fov: 35 }}>
      <EnvironmentSetup />
      <OrbitCamera />
      <T.AmbientLight intensity={0.5} />
      <T.DirectionalLight position={[4, 6, 5]} intensity={0.9} />
      <SceneController
        runtime={runtime}
        faceTextures={faceTextures()}
        onAdvance={bumpCubies}
      />
      <For each={runtime}>
        {cubie => {
          // cubieListVersion ensures re-render when materials change post-scramble snap.
          cubieListVersion()
          const materials = buildMeshMaterials(cubie.state, faceTextures())
          return (
            <T.Mesh
              ref={mesh => (cubie.mesh = mesh)}
              position={cubie.state.position}
              material={materials}
            >
              <T.BoxGeometry args={[0.95, 0.95, 0.95]} />
            </T.Mesh>
          )
        }}
      </For>
    </Canvas>
  )
}

type Phase =
  | { kind: "solved-hold"; until: number }
  | { kind: "turning"; move: Move; queue: Move[]; nextPhase: "scrambled-hold" | "solved-hold"; startedAt: number }
  | { kind: "scrambled-hold"; until: number; solveQueue: Move[] }

function SceneController(props: {
  runtime: CubieRuntime[]
  faceTextures: Record<string, THREE.CanvasTexture>
  onAdvance: () => void
}) {
  const three = useThree()
  let phase: Phase = { kind: "solved-hold", until: performance.now() + SOLVED_HOLD_MS }
  let sliceGroup: THREE.Group | undefined

  function startTurn(move: Move, queue: Move[], nextPhase: "scrambled-hold" | "solved-hold") {
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
    // Snap rotation to exactly ±90° to avoid float drift.
    sliceGroup.rotation.set(0, 0, 0)
    setAxisAngle(sliceGroup, move.axis, (move.dir * Math.PI) / 2)
    // Detach children back to scene root with world transform preserved.
    const children = [...sliceGroup.children]
    for (const child of children) three.scene.attach(child)
    three.scene.remove(sliceGroup)
    sliceGroup = undefined

    // Update logical state.
    const next = applyMove(
      props.runtime.map(cubie => cubie.state),
      move,
    )
    for (let i = 0; i < props.runtime.length; i++) props.runtime[i].state = next[i]

    // Snap each cubie's transform to match its new logical state, in case
    // the manipulated group accumulated tiny drift.
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
        const queue = generateScramble(SCRAMBLE_LENGTH)
        const [first, ...rest] = queue
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
    // turning
    const t = Math.min(1, (now - phase.startedAt) / TURN_DURATION_MS)
    const angle = t * (phase.move.dir * Math.PI) / 2
    if (sliceGroup) setAxisAngle(sliceGroup, phase.move.axis, angle)
    if (t >= 1) {
      const completedMove = phase.move
      const remaining = phase.queue
      const nextPhase = phase.nextPhase
      commitTurn(completedMove)
      props.onAdvance()
      if (remaining.length > 0) {
        // Continue current sequence (more scramble or solve moves to play).
        const [first, ...rest] = remaining
        startTurn(first, rest, nextPhase)
        return
      }
      // Sequence finished — transition to the next hold.
      if (nextPhase === "scrambled-hold") {
        // We just finished scrambling; build the solve sequence as the
        // inverse of the moves we just applied. Easiest path: re-derive
        // the scramble from the visited positions. We instead snapshot
        // the sequence by tracking it.
        // Simpler: regenerate inverse from completed sequence. We need
        // to have remembered the scramble; track it in phase.queue prior.
        // Because we already drained `queue`, derive the solve queue
        // from a per-cycle stash stored at scramble start. See note.
        phase = { kind: "scrambled-hold", until: now + SCRAMBLED_HOLD_MS, solveQueue: solveQueueRef.queue }
      } else {
        phase = { kind: "solved-hold", until: now + SOLVED_HOLD_MS }
      }
    }
  })
}

function setAxisAngle(obj: THREE.Object3D, axis: Axis, angle: number) {
  obj.rotation.set(0, 0, 0)
  if (axis === "x") obj.rotation.x = angle
  else if (axis === "y") obj.rotation.y = angle
  else obj.rotation.z = angle
}
```

Note about `solveQueueRef`: the snippet above has a forward reference that the actual implementation must resolve. Replace the placeholder with this concrete mechanism: stash the scramble sequence at the moment of generation, then map it to inverses when transitioning to `scrambled-hold`. The minimal patch:

Inside `SceneController`, immediately after `const three = useThree()`, add:

```ts
let lastScramble: Move[] = []
```

In the `solved-hold` branch, replace the scramble-start block with:

```ts
if (now >= phase.until) {
  lastScramble = generateScramble(SCRAMBLE_LENGTH)
  const [first, ...rest] = lastScramble
  startTurn(first, rest, "scrambled-hold")
}
return
```

And in the `nextPhase === "scrambled-hold"` branch at the end of `turning`, replace the line that uses `solveQueueRef.queue` with:

```ts
const solveQueue = [...lastScramble].reverse().map(invertMove)
phase = { kind: "scrambled-hold", until: now + SCRAMBLED_HOLD_MS, solveQueue }
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify dev server**

Run: `pnpm --filter site dev`
Expected (force the cube by reloading until it appears, or temporarily change `pickRandomDemo` to return `demos.find(d => d.id === "rubiks")!` during testing — revert before committing):

- Cube starts solved (all six glyphs readable).
- After ~1.5s, faces begin rotating one at a time. Each turn takes ~250ms.
- After 20 turns the cube holds in a scrambled state for ~0.8s.
- The scramble then unwinds in reverse, ending on a solved cube.
- Loop repeats indefinitely with no visible drift between cycles.
- No console errors.

If you see drift (gaps between cubies, misaligned slices), the `commitTurn` snap is wrong — verify that `axis-angle` rotation directions match `applyMove`'s sign convention.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/gallery/rubiks.tsx
git commit -m "feat(site): animate Rubik's cube scramble/solve loop"
```

---

## Task 7: Final verification across the whole gallery

Confirm the gallery composes cleanly: random selection works, both demos render, the editor opens both sources, and the production build succeeds.

**Files:** none modified.

- [ ] **Step 1: Dev-server smoke test**

Run: `pnpm --filter site dev`
Hard-reload `/` at least 10 times. Expected: roughly even split between letter-drop and rubiks. On each load:

- Scene renders within ~1s.
- Clicking Edit opens the editor and shows the source for whichever demo is showing (look at the first few lines — `import * as CANNON` for letter-drop, `import * as THREE` for rubiks).
- Closing the editor returns to the scene with no console errors.

- [ ] **Step 2: Type-check the site package**

Run: `pnpm --filter site exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `pnpm --filter site build`
Expected: build completes with no SSR/hydration warnings related to the hero. Any warnings unrelated to this work can be ignored.

- [ ] **Step 4: Preview build**

Run: `pnpm --filter site preview`
Open the printed URL and confirm the home page renders one of the two demos. Reload several times to confirm random selection works in the production bundle.

- [ ] **Step 5: No code commit needed — work is complete.**

If any step above failed, return to the relevant task and fix before declaring done.

---

## Out of scope (tracked in spec)

- Additional demos beyond letter-drop and rubiks.
- Contributor credit chip in the hero bottom-right.
- "Next demo" cycle button.
- Drag-to-rotate cube interaction.
- Per-demo titles/captions in the hero overlay.
