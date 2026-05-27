# Hero demo gallery + Rubik's cube demo

## Goal

Turn the single hero scene on the site home page into a gallery of tiny demos. On every page load a random demo is shown. v1 ships two demos: the existing letter-drop and a new Rubik's cube that spells **S O L I D 3** across its six faces.

## Motivation

The hero today shows one cannon-es letter-drop scene. Replacing it with a rotating gallery does two things:

- Shows visitors more of what solid-three can do without burying it in the tutorial.
- Gives us a low-friction place to add small demos over time (one file per demo).

## Non-goals

- No demo carousel UI (no "next" button, no thumbnails). Random on each load is the whole interaction.
- No persistence of the chosen demo across reloads.
- No tests for the hero scenes (matches today's behavior).
- No interactive Rubik's cube (no drag-to-rotate); cube is purely an autonomous scramble/solve loop.

## Architecture

### Gallery registry

New directory `site/src/snippets/gallery/` with one file per demo. Each file is a self-contained Solid component that renders its own `<Canvas>` and scene.

```
site/src/snippets/
  hero.tsx            (deleted — moved into gallery/)
  gallery/
    letter-drop.tsx   (former hero, unchanged scene logic)
    rubiks.tsx        (new)
    index.ts          (glob discovery + random pick)
```

`index.ts` uses Vite's `import.meta.glob` to discover modules and their raw source in one pass:

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

export const demos: Demo[] = Object.keys(modules).map(path => {
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

### Demo contract

A demo file:

- Has a default export: a Solid `Component` that renders a `<Canvas>`-rooted scene.
- Owns its own Canvas, lights, environment, camera setup, cleanup.
- Has no other required exports.

This keeps demos self-contained — no shared `<Canvas>` wrapper to keep in sync, and a demo file dropped in `gallery/` is automatically picked up.

### Hero integration

`site/src/components/hero.tsx` changes:

- Replace `LazyHeroScene = clientOnly(() => import("../snippets/hero"))` and `import heroSource from "../snippets/hero.tsx?raw"` with a single `LazyGallery` clientOnly component.
- `LazyGallery` calls `pickRandomDemo()` once at mount, lazy-loads that demo's module, and renders it. The chosen `Demo` is passed up (via context, prop callback, or signal) so the Edit button can read `chosen.source`.
- Editor overlay and CTA layout unchanged.

Concretely the simplest wiring: the gallery component accepts a `setSource: (s: string) => void` prop (or exposes the source through a context). Hero stores `source` in a signal and passes it to `LazyDemo` when the editor is open.

### Random selection / SSR

The hero canvas is already `clientOnly`, so SSR renders nothing for the scene. Random selection happens at client mount — no hydration mismatch is possible.

## Rubik's cube demo (`gallery/rubiks.tsx`)

### Model

A 3×3×3 cube of 27 cubies (the center cubie is never visible but kept for indexing symmetry). Each cubie is a `T.Mesh` with `BoxGeometry` and an array of 6 materials, one per face slot (+X, -X, +Y, -Y, +Z, -Z).

A logical face is the set of 9 cubies whose coordinate on a given axis equals +1 or -1.

### Stickers and letter mapping

The six faces are labeled:

| Axis | Glyph |
| ---- | ----- |
| +X   | S     |
| -X   | O     |
| +Y   | L     |
| -Y   | I     |
| +Z   | D     |
| -Z   | 3     |

For each face we render the glyph onto a 512×512 `CanvasTexture` (white glyph on `#2c4f7c` background, matching the existing brand color from `letter-drop.tsx`). Each cubie's outward sticker uses UV offset+repeat (1/3, 1/3) to display its 1/9 slice of the parent face texture.

When a face turn permutes the cubies, the stickers they carry travel with them. While scrambled, you see fragmented letter scraps; the solved state reassembles each glyph.

### Scramble engine

Pure data, no Three.js types:

- `type Move = { axis: "x" | "y" | "z"; layer: -1 | 1; dir: 1 | -1 }`
- `state: Cubie[]` where each `Cubie` carries `{ position: Vec3, orientation: Quaternion }` (logical, not Three objects).
- `applyMove(state, move)` rotates the 9 cubies on the layer by 90° around the axis; updates both their logical position and orientation.

Scramble = generate ~20 random moves; solve = play the inverse sequence in reverse order.

### Animation loop

Driven by a state machine inside `useFrame`:

1. **Solved hold** — 1.5s.
2. **Scrambling** — for each queued move, smoothly rotate the affected slice group around its axis from 0 → ±90° over 250ms. On completion, "commit": reparent the 9 cubies back to the root, snap their logical positions, and pop the next move.
3. **Scrambled hold** — 0.8s.
4. **Solving** — same per-move animation, replaying inverse moves in reverse order.
5. Loop back to step 1.

Implementation detail: keep a transient `THREE.Group` as the slice container during a move; on commit, detach children back to the cube root using `attach()` so world transforms are preserved.

### Camera

Reused from current letter-drop: orbit on a Y-axis circle (`Math.sin/cos` of `t * speed`), with a small downward tilt so the +Y "L" face is visible. `lookAt(0, 0, 0)`. Slower than the letter-drop orbit (≈0.06 rad/s).

### Lighting

`PMREMGenerator` + `RoomEnvironment` for IBL (same pattern as `letter-drop.tsx`) plus a single directional key light. No shadow plane — cube floats centered.

### File layout

Single file `gallery/rubiks.tsx`. If the move animation logic grows past ~150 lines, extract to `gallery/rubiks-engine.ts` (pure data, no Three imports).

## Editor wiring

The existing "Edit" button toggles `LazyDemo code={...}` with the raw source. v1 wires it to the currently-shown gallery demo's `source`. Cube source is included in the editor like any other demo — even if it's long, that's fine; visitors can scroll.

## Verification

Manual only (no automated tests):

- `pnpm --filter site dev`, open `/`, hard-reload several times, confirm random selection across both demos.
- Confirm letter-drop still behaves identically (interactions, font load).
- Confirm cube faces are readable when solved, fragmented when scrambled, and re-readable after solving.
- Confirm Edit button opens the correct source for whichever demo is showing.
- Confirm SSR build (`pnpm --filter site build`) produces no client/server mismatch warnings.

## Out of scope (future)

- More demos (particles, instanced fields, springs, etc.) — drop a file into `gallery/`.
- "Next demo" UI for cycling without reload.
- Drag-to-rotate Rubik's cube interaction.
- Per-demo titles/captions in the hero overlay.
- Contributor credit label in the bottom-right of the hero, linking to the author's site for whichever demo is showing. Each demo would declare its author (name + URL) as a named export, and the hero would render a small link chip. Goal: surface community contributions and make the gallery feel like a shared space.
