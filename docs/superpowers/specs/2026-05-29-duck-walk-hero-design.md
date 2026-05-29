# Duck-walk hero demo — design

**Date:** 2026-05-29
**Status:** approved (design), pending spec review

## Goal

Add a new gallery hero demo: the Solid logo, built as a little duck, doing a
looping walk-in-place animation on a scrolling grid "treadmill", viewed from a
slowly orbiting turntable camera. Ambient only — no pointer interaction.

The demo joins the existing rotation in `site/src/components/hero.tsx`, which
picks a random demo from `site/src/snippets/gallery/*.tsx` and renders it (and
shows its source in the editor toggle). The source must therefore read as
idiomatic, declarative solid-three.

## Source of truth for the model

The duck geometry is ported from melty-karts'
`apps/melty-karts/src/models/SolidLogo.ts` (`createSolidLogo()`), which builds
the Solid logo procedurally. We reproduce its geometry, colors, and transforms
faithfully, but express the scene graph declaratively with solid-three's `<T.*>`
proxy instead of imperative `THREE.Group` assembly.

### Model breakdown (from the original)

- **Body:** two SVG-extruded teardrops forming the Solid swoosh.
  - SVG path: `m 135.55266,65.650453 a 45,45 0 0 0 -48.000001,-15 l -62,20 c 0,0 53,40.000007 94.000001,29.999997 l 3,-0.999997 c 17,-5 23,-21 13,-34 z`
  - Extrude opts: `{ depth: 50, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }`, geometry `.center()`, mesh `scale = 0.006`.
  - Teardrop 1: color `#518ac8`, position `(-0.05, 0.16, 0)`.
  - Teardrop 2: color `#76b3e1`, position `(0.05, -0.16, 0)`, `rotation.z = π`.
  - Parent group has `rotation.x = π`.
- **Beak:** extruded triangle, color `#ffdd00`. Shape `moveTo(5,0) → (-4,6) → (-4,-3)`, extrude depth `50.8`, `bevelEnabled: false`, `.center()`, `scale = 0.006`, position `(0.375, 0.14, 0)`.
- **Eyes:** white (`#ffffff`) spheres `r = 0.1` at `(0, 0.16, ±0.15)`; black (`#000000`) pupils `r = 0.03` copied to eye position then `z += 0.1` toward the front, mirrored to the other side.
- **Legs (×2):** yellow (`#ffdd00`). Cylinder `r = 0.03`, height `0.3`; foot = extruded triangle `moveTo(-0.14,0) → (0.2,0.08) → (0.2,-0.08)`, depth `0.04`, `rotateX(π/2)`. Leg group mirrored across `z` (`z = ±0.1`).
- **Outer transforms:** the assembled `group2` is `rotateY(-π/2)` and positioned at `(0, 0.55, 0)`.

## Declarative rebuild

The two procedural shapes (`teardropShape`, beak/foot `THREE.Shape`s) are
computed once in module scope and passed as constructor args:

```tsx
const teardropShape = SVGLoader.createShapes(
  new SVGLoader().parse(`<svg><path d="${SOLID_PATH}"/></svg>`).paths[0],
)[0]
```

Imports follow the convention already used by `letter-drop.tsx`
(`three/examples/jsm/...`), not melty-karts' `three/addons/...`.

Everything is composed with nested `<T.Group>` mirroring the original
`group → group2 → group3` nesting so orientation matches. Meshes use
`<T.ExtrudeGeometry args={[shape, opts]} />`, `<T.SphereGeometry>`,
`<T.CylinderGeometry>` + `<T.MeshStandardMaterial color=... />`.

### Leg restructure for animation

The original cylinder is centered on its own origin. To swing a leg from the
hip, each leg is wrapped in a **hip group** positioned at the joint, with the
cylinder offset downward by half its height (and the foot at the bottom) so that
rotating the hip group around the lateral axis swings the whole leg + foot from
the top. This is the only structural deviation from the original; geometry and
colors are unchanged.

## Animation (`useFrame`)

A single phase clock `t` drives everything:

- **Leg swing:** the two hip groups rotate around the lateral axis in opposite
  phase, `±A·sin(ωt)`.
- **Body bob:** small vertical offset on the duck root at `2ω` (body dips as
  each foot plants), amplitude a few hundredths of a unit.
- **Waddle:** gentle roll (rotation around the forward axis) at `ω`, small
  amplitude, so the duck rocks side to side with the steps.
- **Grid treadmill:** a `<T.GridHelper>` ground scrolls along the duck's facing
  direction at a speed tuned to the step cadence, wrapping by one grid cell so
  it loops seamlessly — this conveys forward motion while the duck stays in
  place.
- **Turntable camera:** the camera orbits the duck slowly (same technique as the
  camera drift already in `letter-drop.tsx`), so all sides are visible.

Magnitudes (amplitudes, ω, orbit radius, grid size/scroll speed) are tuning
constants chosen during implementation to look good; they are not load-bearing
for the design.

## Lighting

Soft `<T.AmbientLight>` + a `<T.DirectionalLight>` keyed to the duck, matching
the lit-plastic feel of the other gallery demos. A neutral environment
(`RoomEnvironment` via PMREM, as in `letter-drop.tsx`) may be added if the
MeshStandardMaterial surfaces look flat; optional, decided visually.

## Non-goals

- No pointer interaction.
- No physics (no cannon-es).
- No travel through space — walk is in place; only the grid + camera move.
- No changes to `hero.tsx` or the gallery registration mechanism (the new file
  is picked up automatically by the glob).

## Verification

Browser-only (this project's test setup runs in real Chromium; there is no
jsdom). The demo is verified by running the site dev server and watching the
hero: duck assembles correctly, legs alternate, body bobs, grid scrolls without
visible seams, camera orbits, no console errors, and the editor toggle shows
clean solid-three source.
