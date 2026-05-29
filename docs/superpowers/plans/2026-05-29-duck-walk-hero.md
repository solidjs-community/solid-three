# Duck-walk Hero Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auto-registered gallery hero demo: the Solid logo built as a duck that walks in place on a scrolling grid treadmill, viewed from a slow turntable camera.

**Architecture:** A single new file `site/src/snippets/gallery/duck-walk.tsx` that default-exports a solid-three `<Canvas>` component. The melty-karts `createSolidLogo()` model is reproduced declaratively with `<T.*>`. Two procedural `THREE.Shape`s (teardrop body, triangle beak/foot) are computed once in module scope and passed as geometry args. Legs are wrapped in hip groups so they pivot from the joint; a single `useFrame` phase clock drives leg swing, body bob, waddle, grid scroll, and camera orbit.

**Tech Stack:** SolidJS, solid-three (`createT`, `Canvas`, `useFrame`, `useThree`), three.js (`SVGLoader`, `ExtrudeGeometry`, `GridHelper`).

---

## File Structure

- Create: `site/src/snippets/gallery/duck-walk.tsx` — the entire demo. No other files change; the gallery glob in `site/src/snippets/gallery/index.ts` picks it up automatically.

## Reference facts (from melty-karts `SolidLogo.ts`)

- SVG path (teardrop body):
  `m 135.55266,65.650453 a 45,45 0 0 0 -48.000001,-15 l -62,20 c 0,0 53,40.000007 94.000001,29.999997 l 3,-0.999997 c 17,-5 23,-21 13,-34 z`
- Body extrude opts: `{ depth: 50, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }`, geometry `.center()`, mesh scale `0.006`.
  - Teardrop 1: `#518ac8` at `(-0.05, 0.16, 0)`.
  - Teardrop 2: `#76b3e1` at `(0.05, -0.16, 0)`, `rotation.z = π`.
  - Body group `rotation.x = π`.
- Beak: triangle `moveTo(5,0) → lineTo(-4,6) → lineTo(-4,-3)`, extrude `{ depth: 50.8, bevelEnabled: false }`, `.center()`, scale `0.006`, color `#ffdd00`, at `(0.375, 0.14, 0)`.
- Eyes: white `#ffffff` spheres `r=0.1` at `(0, 0.16, ±0.15)`; black `#000000` pupils `r=0.03` at eye position with `z` nudged `+0.1` toward front, mirrored.
- Legs: yellow `#ffdd00`. Cylinder `r=0.03`, height `0.3`; foot triangle `moveTo(-0.14,0) → lineTo(0.2,0.08) → lineTo(0.2,-0.08)`, extrude `{ depth: 0.04, bevelEnabled: false }`, `rotateX(π/2)`. Legs mirrored across lateral axis at `±0.1`.
- Outer: assembled group `rotateY(-π/2)`, positioned `(0, 0.55, 0)`.

Imports use `three/examples/jsm/...` (matching `letter-drop.tsx`), NOT `three/addons/...`.

---

### Task 1: Static duck renders in the gallery

**Files:**
- Create: `site/src/snippets/gallery/duck-walk.tsx`

- [ ] **Step 1: Create the file with module-scope shapes, the duck component, and a Canvas**

```tsx
import { onCleanup } from "solid-js"
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

  onCleanup(() => {
    teardropGeometry.dispose()
    beakGeometry.dispose()
    footGeometry.dispose()
  })

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
```

- [ ] **Step 2: Typecheck**

Run: `cd site && npx tsc --noEmit`
Expected: no errors in `duck-walk.tsx`. (If `geometry.center()` typing complains, it returns the geometry; the helper return type already declares `THREE.ExtrudeGeometry`.)

- [ ] **Step 3: Visual check in the dev server**

Run: `cd site && npm run dev`
Open `/`, reload until the hero picks `duck-walk` (or temporarily force it — see note below). Confirm: the duck assembles as the Solid logo with two blue teardrops, yellow beak, two white eyes with black pupils facing the camera, two yellow legs with feet on/near the grid, no console errors.

Note for forcing the demo during dev only (revert before commit): in `site/src/components/hero.tsx` the initial pick comes from `pickRandomDemo()`. You can temporarily filter to the duck, but DO NOT commit that change.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/gallery/duck-walk.tsx
git commit -m "feat(site): add static solid-duck gallery demo"
```

---

### Task 2: Walking animation (legs, bob, waddle)

**Files:**
- Modify: `site/src/snippets/gallery/duck-walk.tsx`

- [ ] **Step 1: Add a `useFrame` animator component that drives the captured refs**

Add this component above `DuckWalk` (it reads the refs via props getters). Replace the `<Duck ... />` usage with the duck plus this animator, sharing the same refs.

```tsx
const STEP_OMEGA = 3.2 // radians/sec of the step cycle
const LEG_SWING = 0.5 // radians
const BODY_BOB = 0.04 // units
const WADDLE = 0.08 // radians of roll

function DuckAnimator(props: {
  duckRoot: () => THREE.Group | undefined
  leftHip: () => THREE.Group | undefined
  rightHip: () => THREE.Group | undefined
}) {
  const baseY = 0.55
  // useFrame's callback receives (context, delta). Read the engine clock's
  // `elapsedTime` PROPERTY (not getElapsedTime(), which calls getDelta() and
  // would corrupt the render loop's own getDelta() at create-three.tsx:188).
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
  })
  return null
}
```

- [ ] **Step 2: Wire the animator into the Canvas using shared refs**

Change `DuckWalk`'s returned JSX to pass getter functions and mount the animator:

```tsx
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
      <DuckAnimator
        duckRoot={() => duckRoot}
        leftHip={() => leftHip}
        rightHip={() => rightHip}
      />
    </Canvas>
  )
```

- [ ] **Step 3: Typecheck**

Run: `cd site && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run: `cd site && npm run dev` (reload to the duck demo).
Confirm: legs alternate fore/aft, body bobs gently, duck rocks side to side. If the legs swing sideways (splaying out) instead of fore/aft, the swing axis is wrong for the final orientation — switch `rotation.z` to `rotation.x` on the hips (and adjust sign) until the swing is along the walking direction. If the duck rolls the wrong way, flip the sign on the `WADDLE` term. Tune `STEP_OMEGA`/`LEG_SWING`/`BODY_BOB`/`WADDLE` until it reads as a natural waddle.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/gallery/duck-walk.tsx
git commit -m "feat(site): animate the solid duck walk cycle"
```

---

### Task 3: Grid treadmill + turntable camera

**Files:**
- Modify: `site/src/snippets/gallery/duck-walk.tsx`

- [ ] **Step 1: Capture a ref on the grid and scroll it; orbit the camera**

Add a `grid` ref in `DuckWalk` and pass a getter to the animator. Extend `DuckAnimator` to scroll the grid and orbit the camera.

In `DuckWalk`, add alongside the other refs:

```tsx
  let grid: THREE.GridHelper | undefined
```

Give the grid a ref and pass the getter to the animator:

```tsx
      <T.GridHelper ref={el => (grid = el)} args={[12, 24]} />
      ...
      <DuckAnimator
        duckRoot={() => duckRoot}
        leftHip={() => leftHip}
        rightHip={() => rightHip}
        grid={() => grid}
      />
```

- [ ] **Step 2: Extend `DuckAnimator` with treadmill + turntable**

Add `grid` to its props and append to the `useFrame` body. The grid divisions are 24 over size 12, so one cell is `12 / 24 = 0.5`; wrap the scroll by `0.5` for a seamless loop. The camera orbits the duck on a fixed radius.

```tsx
const GRID_CELL = 0.5 // 12 / 24
const TREADMILL_SPEED = 0.6 // units/sec, tune to match stride
const ORBIT_RADIUS = 4
const ORBIT_HEIGHT = 1.8
const ORBIT_OMEGA = 0.25 // radians/sec
```

Updated `DuckAnimator` (full replacement):

```tsx
function DuckAnimator(props: {
  duckRoot: () => THREE.Group | undefined
  leftHip: () => THREE.Group | undefined
  rightHip: () => THREE.Group | undefined
  grid: () => THREE.GridHelper | undefined
}) {
  const three = useThree()
  const baseY = 0.55
  // Read clock.elapsedTime (property), not getElapsedTime() — see Task 2 note.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phase = t * STEP_OMEGA
    const left = props.leftHip()
    const right = props.rightHip()
    const root = props.duckRoot()
    if (left) left.rotation.z = Math.sin(phase) * LEG_SWING
    if (right) right.rotation.z = -Math.sin(phase) * LEG_SWING
    if (root) {
      root.position.y = baseY + Math.abs(Math.sin(phase)) * BODY_BOB
      root.rotation.x = Math.sin(phase) * WADDLE
    }
    // Treadmill: scroll the grid opposite the duck's heading, wrapping by one cell.
    const grid = props.grid()
    if (grid) grid.position.z = (t * TREADMILL_SPEED) % GRID_CELL
    // Turntable: orbit the camera around the duck.
    const angle = t * ORBIT_OMEGA
    three.camera.position.set(
      Math.sin(angle) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.cos(angle) * ORBIT_RADIUS,
    )
    three.camera.lookAt(0, 0.55, 0)
  })
  return null
}
```

- [ ] **Step 3: Typecheck**

Run: `cd site && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual check**

Run: `cd site && npm run dev` (reload to the duck demo).
Confirm: grid scrolls smoothly under the duck with no visible seam at the wrap, the camera orbits all the way around showing every side, the duck stays centered and framed, and the scroll direction matches the duck's facing (forward). If the grid appears to scroll backward relative to the walk, negate the sign of the `grid.position.z` term. Tune `TREADMILL_SPEED` so the ground speed reads as matching the stride. Check the console for errors and confirm the editor toggle shows clean source.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/gallery/duck-walk.tsx
git commit -m "feat(site): scroll grid treadmill and orbit camera for duck demo"
```

---

## Self-Review

- **Spec coverage:** declarative rebuild (Task 1), faithful geometry/colors/transforms (Task 1, reference facts), hip-group leg restructure (Task 1 `Leg`), leg swing + body bob + waddle (Task 2), grid treadmill + turntable camera (Task 3), ambient-only / no physics / no travel (no interaction or cannon-es anywhere), auto-registration (no change to `index.ts`), browser verification (each task's visual-check step). RoomEnvironment was marked optional in the spec ("if surfaces look flat") — intentionally omitted; add it only if the visual check shows flat plastic.
- **Placeholder scan:** none — every code step contains full code; tuning constants are real defaults, not placeholders.
- **Type/name consistency:** `teardropGeometry`, `beakGeometry`, `footGeometry`, `Leg`, `Duck`, `DuckAnimator`, and the ref getter prop names (`duckRoot`/`leftHip`/`rightHip`/`grid`) are used consistently across tasks. `STEP_OMEGA`, `LEG_SWING`, `BODY_BOB`, `WADDLE` defined in Task 2 and reused in Task 3's full `DuckAnimator` replacement.
