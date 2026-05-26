# Hero Splash REPL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-line `index.mdx` stub with a hero splash where 3D
letters spelling `SOLID THREE` fall, settle, and react to clicks — with a
toggle that opens the existing `<Demo>` editor over the same snippet.

**Architecture:** A single snippet file (`site/src/snippets/hero.tsx`) is the
source of truth. The hero wrapper imports it twice — directly (component) for
instant first paint on the parent page, and as `?raw` text fed to a lazily-
mounted `<Demo>` when the user opens the editor. Physics by `cannon-es`,
text geometry from three's bundled `helvetiker_bold` font fetched over esm.sh
so the same code path works in both parent and iframe. SolidBase's
`layout: home` frontmatter drops the sidebar on `/`.

**Tech Stack:** Solid 1.9, solid-three (workspace), three 0.181, cannon-es
0.20, SolidBase 0.6, Vite 8, @bigmistqke/repl (workspace), tm-textarea.

**Verification model:** This is a visual feature; each task ends with manual
verification in the dev server (`pnpm --filter solid-three-site dev`), not an
automated test. Treat the verification step as a hard gate — do not move on
or commit until the described behavior is visible in the browser.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `site/package.json` | modify | add `cannon-es` dep |
| `site/src/components/demo.tsx` | modify | pin `cannon-es@0.20` in `externalDepsParam` |
| `site/src/snippets/hero.tsx` | create | the editable hero scene snippet — single source of truth |
| `site/src/components/hero.tsx` | create | wrapper: direct-render + editor toggle + lazy `<Demo>` overlay |
| `site/src/routes/index.mdx` | modify | drop `<Hero />`, set `layout: home` frontmatter |
| `site/src/theme/style.css` | modify | hero overlay styles (title/tagline/CTAs, toggle button) |

---

## Task 1: Add `cannon-es` dependency

**Files:**
- Modify: `site/package.json`
- Modify: `site/src/components/demo.tsx`

- [ ] **Step 1: Add `cannon-es` to dependencies**

In `site/package.json`, add to the `dependencies` block (alphabetical with the
others):

```json
"cannon-es": "^0.20.0",
```

- [ ] **Step 2: Install**

Run from repo root:

```bash
pnpm --filter solid-three-site install
```

Expected: `cannon-es` added, lockfile updated, no errors.

- [ ] **Step 3: Pin `cannon-es` version in the iframe import resolver**

In `site/src/components/demo.tsx`, find the `externalDepsParam` constant:

```ts
const externalDepsParam = "external=solid-js,three&deps=solid-js@1.8,three@0.181"
```

Replace with:

```ts
const externalDepsParam = "external=solid-js,three&deps=solid-js@1.8,three@0.181,cannon-es@0.20"
```

- [ ] **Step 4: Verify dev server still starts**

```bash
pnpm --filter solid-three-site dev
```

Open `http://localhost:3000/tutorial/01-your-first-scene`. The existing demo
should still render (no regressions from the dependency add).

- [ ] **Step 5: Commit**

```bash
git add site/package.json site/pnpm-lock.yaml site/src/components/demo.tsx
git commit -m "feat(site): add cannon-es for hero physics"
```

---

## Task 2: Scaffold `hero.tsx` snippet — static letters

This task gets letters on screen as static `TextGeometry` meshes spelling
`SOLID THREE`. Physics, cursor interaction, and lighting come in later tasks.

**Files:**
- Create: `site/src/snippets/hero.tsx`

- [ ] **Step 1: Write the initial snippet**

Create `site/src/snippets/hero.tsx`:

```tsx
import * as THREE from "three"
import { Canvas, createT } from "solid-three"
import { createSignal, For, onMount } from "solid-js"
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js"
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js"

const T = createT(THREE)

// Hardcoded esm.sh URL so the same snippet works on the parent page (Vite
// fetches it at runtime) and inside the iframe REPL (same URL, same fetch).
const FONT_URL =
  "https://esm.sh/three@0.181/examples/fonts/helvetiker_bold.typeface.json"

const LETTERS = ["S", "O", "L", "I", "D", "T", "H", "R", "E", "E"] as const
const SOLID_BLUE = "#2c4f7c"
const WARM_WHITE = "#f4f4f4"

function colorFor(index: number): string {
  return index < 5 ? SOLID_BLUE : WARM_WHITE
}

function startXFor(index: number): number {
  // Spread letters across x with a gap between SOLID and THREE.
  const gap = index < 5 ? 0 : 0.6
  return (index - 4.5) * 0.9 + gap
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

  return (
    <Canvas camera={{ position: [0, 1.5, 6], fov: 45 }}>
      <T.AmbientLight intensity={0.5} />
      <For each={LETTERS}>
        {(letter, i) => {
          const f = font()
          if (!f) return null
          const geometry = new TextGeometry(letter, {
            font: f,
            size: 0.8,
            height: 0.25,
            curveSegments: 8,
            bevelEnabled: true,
            bevelSize: 0.02,
            bevelThickness: 0.02,
            bevelSegments: 2,
          })
          geometry.center()
          return (
            <T.Mesh
              geometry={geometry}
              position={[startXFor(i()), 0, 0]}
            >
              <T.MeshStandardMaterial color={colorFor(i())} />
            </T.Mesh>
          )
        }}
      </For>
    </Canvas>
  )
}
```

- [ ] **Step 2: Wire snippet into a throwaway route for visual check**

Temporarily verify by importing into an existing demo. In
`site/src/routes/index.mdx`, replace the body with:

```mdx
---
title: solid-three
---

import { Demo } from "../components/demo"
import heroSource from "../snippets/hero.tsx?raw"

<Demo code={heroSource} />
```

- [ ] **Step 3: Visual verify**

Run `pnpm --filter solid-three-site dev` and open `http://localhost:3000/`.

Expected: after ~1s (font fetch), ten white-ish/blue letters reading
`SOLIDTHREE` (with a gap between `D` and `T`) appear in a row at the origin.
Colors: first 5 blue (`#2c4f7c`), last 5 off-white (`#f4f4f4`). No physics yet
— they hang in the air.

Do not proceed until the letters are visible.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/hero.tsx site/src/routes/index.mdx
git commit -m "feat(site): scaffold hero snippet with static SOLID THREE letters"
```

(`index.mdx` is intentionally temporary; later tasks replace it.)

---

## Task 3: Add cannon-es physics — bodies, ground, gravity

This task makes the letters drop. No interaction yet, no respawn.

**Files:**
- Modify: `site/src/snippets/hero.tsx`

- [ ] **Step 1: Rewrite the snippet to add physics**

Replace `site/src/snippets/hero.tsx` with:

```tsx
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
```

- [ ] **Step 2: Visual verify**

Reload `http://localhost:3000/`. Expected: letters now spawn above the
viewport, fall under gravity, and land on the invisible ground plane around
`y=0`. Some tumble and collide; they roughly settle within ~3s.

If letters fall through the ground, check the ground body quaternion line.
If they spawn already underground, increase the `body.position.y` initial
value.

Do not proceed until the drop animation works.

- [ ] **Step 3: Commit**

```bash
git add site/src/snippets/hero.tsx
git commit -m "feat(site): drop hero letters with cannon-es physics"
```

---

## Task 4: Environment map, two-tone metal material

This task swaps the basic `MeshStandardMaterial` for a properly lit, mirror-y
look using `RoomEnvironment`.

**Files:**
- Modify: `site/src/snippets/hero.tsx`

- [ ] **Step 1: Add env map + tune materials**

In `site/src/snippets/hero.tsx`, add imports at the top:

```ts
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { useThree } from "solid-three"
```

Add a new component above `Scene`:

```tsx
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
```

In the `<Canvas>` JSX, add `<EnvironmentSetup />` as the first child:

```tsx
<Canvas camera={{ position: [0, 1.5, 6], fov: 45 }}>
  <EnvironmentSetup />
  <T.AmbientLight intensity={0.6} />
  <T.DirectionalLight position={[3, 6, 4]} intensity={1.1} />
  <Show when={world()}>
    {worldRef => <Scene state={worldRef()} />}
  </Show>
</Canvas>
```

Update the material in `Scene` to use metalness/roughness:

```tsx
<T.MeshStandardMaterial color={letter.color} metalness={0.85} roughness={0.2} />
```

- [ ] **Step 2: Visual verify**

Reload. Letters now have a soft mirror finish — the SOLID-blue letters
should reflect a subtly different shade where the env map highlights hit.
Reflection should be soft (room studio), not chrome.

If letters look flat (no reflection), check the `useThree` import and that
`scene.environment` is being assigned. If they look like chrome, raise
`roughness` toward 0.3.

- [ ] **Step 3: Commit**

```bash
git add site/src/snippets/hero.tsx
git commit -m "feat(site): give hero letters a studio reflection"
```

---

## Task 5: Camera drift + fake contact shadows

Two small polish steps in one task: slow horizontal camera sweep, and a flat
dark disc under each letter that fades with height.

**Files:**
- Modify: `site/src/snippets/hero.tsx`

- [ ] **Step 1: Add camera drift**

Inside `Scene`, after the existing `useFrame` block, add a second `useFrame`
that sweeps the camera. Replace the existing useFrame with:

```tsx
const three = useThree()
const startTime = performance.now()

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
  const t = (performance.now() - startTime) / 1000
  const angle = Math.sin(t * 0.05) * 0.3
  three.camera.position.x = Math.sin(angle) * 6
  three.camera.position.z = Math.cos(angle) * 6
  three.camera.lookAt(0, 0.5, 0)
})
```

Add `import { useThree } from "solid-three"` if not already present from
Task 4.

- [ ] **Step 2: Add fake contact shadows**

In `Scene`, add a parallel array for shadow meshes:

```tsx
const shadowMeshes: (THREE.Mesh | undefined)[] = []
```

Inside the existing `useFrame` (after the mesh sync block), update shadows:

```tsx
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
```

In the `<For>` block, wrap the mesh in a fragment and add the shadow:

```tsx
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
      >
        <T.MeshStandardMaterial
          color={letter.color}
          metalness={0.85}
          roughness={0.2}
        />
      </T.Mesh>
    </>
  )}
</For>
```

- [ ] **Step 3: Visual verify**

Reload. Letters now have soft dark shadows that grow as they fall and
solidify when they touch the floor. The camera should swing slowly side to
side (~12s period). No jitter.

- [ ] **Step 4: Commit**

```bash
git add site/src/snippets/hero.tsx
git commit -m "feat(site): add camera drift and fake contact shadows"
```

---

## Task 6: Cursor repulsion + click-to-punch

**Files:**
- Modify: `site/src/snippets/hero.tsx`

- [ ] **Step 1: Add cursor pointer tracking**

In `Scene`, add a cursor state and pointer-coarse detection:

```tsx
const cursor = new THREE.Vector3()
let cursorActive = false
let isCoarsePointer = false
onMount(() => {
  isCoarsePointer = window.matchMedia("(pointer: coarse)").matches
})
```

Add a raycaster + ground plane:

```tsx
const raycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
```

Add pointer handlers on the `<Canvas>` element — since solid-three exposes
pointer events on meshes, we'll listen at the document level via `onMount`:

```tsx
onMount(() => {
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
```

- [ ] **Step 2: Apply repulsion force each frame**

Inside the existing `useFrame`, before `world.step`, add:

```tsx
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
```

- [ ] **Step 3: Click-to-punch**

On the letter `<T.Mesh>`, add `onPointerDown`:

```tsx
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
  <T.MeshStandardMaterial
    color={letter.color}
    metalness={0.85}
    roughness={0.2}
  />
</T.Mesh>
```

- [ ] **Step 4: Visual verify**

Reload. Move the cursor through a settled pile — letters near it should
drift away. Click a letter — it should punch up and tumble. On a touch
device (or DevTools touch emulation), cursor force should be off but tap-to-
punch still works.

- [ ] **Step 5: Commit**

```bash
git add site/src/snippets/hero.tsx
git commit -m "feat(site): cursor repulsion and click-to-punch on hero letters"
```

---

## Task 7: Build the `<Hero />` wrapper component

This task creates the wrapper that direct-renders the snippet, hosts the
title/tagline overlay, and provides the editor toggle button (the lazy
`<Demo>` mount comes in Task 8).

**Files:**
- Create: `site/src/components/hero.tsx`

- [ ] **Step 1: Create the wrapper**

Create `site/src/components/hero.tsx`:

```tsx
import { createSignal, Show } from "solid-js"
import HeroScene from "../snippets/hero"

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)

  return (
    <div class="hero">
      <div class="hero-canvas">
        <HeroScene />
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
      <button
        type="button"
        class="hero-edit-toggle"
        onClick={() => setEditorOpen(value => !value)}
      >
        {editorOpen() ? "Close editor" : "Edit"}
      </button>
      <Show when={editorOpen()}>
        <div class="hero-editor-overlay">{/* lazy <Demo /> mounts in Task 8 */}</div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: Add hero styles**

In `site/src/theme/style.css`, append:

```css
.hero {
  position: relative;
  width: 100%;
  height: 70vh;
  min-height: 480px;
  overflow: hidden;
}

.hero-canvas {
  position: absolute;
  inset: 0;
}

.hero-canvas canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  pointer-events: none;
  padding: 2rem;
  gap: 1rem;
}

.hero-title {
  font-size: clamp(2.5rem, 6vw, 4rem);
  margin: 0;
}

.hero-tagline {
  font-size: clamp(1rem, 2vw, 1.25rem);
  margin: 0;
  opacity: 0.85;
}

.hero-ctas {
  display: flex;
  gap: 0.75rem;
  pointer-events: auto;
  margin-top: 1rem;
}

.hero-cta {
  padding: 0.6rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid currentColor;
  text-decoration: none;
  font-weight: 500;
}

.hero-cta-primary {
  background: var(--sb-color-text, #1a1a1a);
  color: var(--sb-color-background, #ffffff);
  border-color: transparent;
}

.hero-edit-toggle {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  padding: 0.5rem 0.9rem;
  border-radius: 0.4rem;
  border: 1px solid currentColor;
  background: var(--sb-color-background, #ffffff);
  cursor: pointer;
  z-index: 2;
}

.hero-editor-overlay {
  position: absolute;
  inset: 0;
  background: var(--sb-color-background, #ffffff);
  z-index: 1;
}
```

- [ ] **Step 3: Wire into `index.mdx` (still using Demo temporarily for now)**

Replace `site/src/routes/index.mdx` with:

```mdx
---
title: solid-three
layout: home
---

import { Hero } from "../components/hero"

<Hero />
```

- [ ] **Step 4: Visual verify**

Reload `http://localhost:3000/`. Expected: sidebar gone, hero fills the
viewport with the falling-letters scene, title "solid-three" + tagline
centered on top, two CTAs below. "Edit" button bottom-right. Clicking Edit
toggles a blank overlay (the lazy `<Demo>` mount lands in Task 8). Clicking
Close editor returns to the scene.

Sidebar should still appear on `/tutorial/01-your-first-scene`.

- [ ] **Step 5: Commit**

```bash
git add site/src/components/hero.tsx site/src/theme/style.css site/src/routes/index.mdx
git commit -m "feat(site): hero wrapper, layout, and home-page integration"
```

---

## Task 8: Lazy-mount the `<Demo>` editor overlay

Mount the existing `<Demo>` lazily when the user opens the editor, with the
hero snippet's `?raw` source as its initial code.

**Files:**
- Modify: `site/src/components/hero.tsx`

- [ ] **Step 1: Lazy-import `<Demo>` and pass the snippet source**

Replace the contents of `site/src/components/hero.tsx`:

```tsx
import { clientOnly } from "@solidjs/start"
import { createSignal, Show } from "solid-js"
import HeroScene from "../snippets/hero"
import heroSource from "../snippets/hero.tsx?raw"

const LazyDemo = clientOnly(async () => {
  const mod = await import("./demo")
  return { default: mod.Demo }
})

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)

  return (
    <div class="hero">
      <div class="hero-canvas">
        <HeroScene />
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
      <button
        type="button"
        class="hero-edit-toggle"
        onClick={() => setEditorOpen(value => !value)}
      >
        {editorOpen() ? "Close editor" : "Edit"}
      </button>
      <Show when={editorOpen()}>
        <div class="hero-editor-overlay">
          <LazyDemo code={heroSource} />
        </div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: Make the editor overlay fit the hero region**

In `site/src/theme/style.css`, append:

```css
.hero-editor-overlay .demo {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 3: Visual verify**

Reload `http://localhost:3000/`.

1. Hero scene renders. Click **Edit**.
2. The editor overlay opens with the hero snippet text on the left and the
   iframe canvas on the right.
3. Change a literal (e.g. `SOLID_BLUE` to `"#ff0066"`). The iframe canvas
   updates within ~1s. The direct-rendered hero underneath is unchanged.
4. Click **Close editor**. Overlay closes; the original hero scene is
   visible again and still running (letters in their settled positions, not
   re-dropped).
5. Reload — direct hero scene appears immediately, no iframe boot lag.

- [ ] **Step 4: Commit**

```bash
git add site/src/components/hero.tsx site/src/theme/style.css
git commit -m "feat(site): lazy-mount Demo editor over hero"
```

---

## Task 9: Cross-browser sanity + mobile pass

**Files:**
- Modify (if needed): `site/src/snippets/hero.tsx`, `site/src/theme/style.css`

- [ ] **Step 1: Dev server narrow-viewport check**

Open `http://localhost:3000/` in DevTools, switch to a mobile viewport (e.g.
iPhone 12). Expected:

- Scene renders.
- No cursor force (we gated on `pointer: coarse`).
- Tap a letter → punches up.
- Tap **Edit** → `<Demo>` opens in its narrow-mode tabs layout (Canvas /
  Editor tabs).
- Title/tagline/CTAs remain readable.

If the title overlaps the canvas in an unreadable way at narrow widths,
shrink `clamp()` lower bounds in `.hero-title` / `.hero-tagline`.

- [ ] **Step 2: Light/dark theme toggle**

Toggle the site theme (sun/moon icon in the SolidBase header). Expected:

- Title/tagline/CTAs invert correctly.
- Hero canvas background is transparent, so the page background changes
  with the theme.
- Letter colors do not change (they're scene-internal); this is fine.

- [ ] **Step 3: Cold-load timing check**

Hard-reload (`Cmd+Shift+R`). The hero canvas should paint within ~500ms
(font fetch is the long pole). The "Edit" button should be clickable
immediately.

If first paint is much slower than the rest of the site, check the
network panel for unexpected esm.sh fetches on first load — the direct
render should NOT hit esm.sh except for the font JSON.

- [ ] **Step 4: Commit (only if changes were needed)**

```bash
git add site/src/snippets/hero.tsx site/src/theme/style.css
git commit -m "fix(site): hero polish for narrow viewports and theme"
```

If no changes were needed in this task, skip the commit.

---

## Task 10: Done — final verification + cleanup

- [ ] **Step 1: Full walkthrough**

Run through the spec's acceptance behaviors end-to-end on a fresh tab:

1. `/` loads, hero canvas paints, letters drop and settle within ~3s.
2. Cursor through the pile pushes letters aside (desktop).
3. Clicking a letter punches it up.
4. "Edit" opens the `<Demo>` overlay with the hero snippet's source.
5. Editing the snippet updates the iframe canvas live.
6. "Close editor" returns to the original scene, still running.
7. Sidebar is hidden on `/`, visible on `/tutorial/01-your-first-scene`.
8. Narrow viewport: tap-to-punch works, no cursor force, `<Demo>` opens
   in tabs mode.

- [ ] **Step 2: Confirm no stray files / no console errors**

```bash
git status
```

Expected: clean. No untracked files.

Open the browser console on `/`. Expected: no errors, no warnings beyond
the usual Vite/SolidStart dev noise.

- [ ] **Step 3: Final commit if anything was missed**

If the walkthrough surfaced anything, fix and commit.

---

## Self-Review Notes

- Every spec section maps to a task: scene (Tasks 2–6), env/lighting
  (Task 4), camera/shadows (Task 5), interaction (Task 6), wrapper +
  layout + landing frontmatter (Task 7), lazy `<Demo>` (Task 8), mobile
  (Task 9), plumbing (`cannon-es` in Task 1).
- No placeholders: every code-changing step shows the code.
- Types consistent: `LetterState`, `colorFor`, `startXFor`, `Scene`,
  `EnvironmentSetup`, `Hero` are defined once and referenced by the same
  names across tasks.
- File paths are exact.
