# Hero splash REPL — design

The site's index page (`site/src/routes/index.mdx`) is a three-line stub.
Replace it with a hero that loads fast, looks polished, and double-functions
as an editable REPL: visitors see a 3D scene immediately, can click letters to
interact, and can open an editor toggle to live-edit the scene's source.

## Goals

- **Eye-candy first paint.** No Babel/esm.sh bootstrap on the critical path.
  The hero scene renders on the parent page using the site's own bundled
  solid-three.
- **Editable on demand.** A toggle button opens the existing `<Demo>`
  editor + iframe split. The same source code feeds both surfaces — one
  file is the source of truth.
- **On-brand.** The scene spells `SOLID THREE` in falling, colliding 3D
  letters; the pun ("solid characters") doubles as the visual hook.

## Non-goals

- Recycling/infinite rain. Letters drop once and settle.
- Custom physics. We use a library (`cannon-es`).
- Custom font work or icon assets. Use three's built-in `helvetiker_bold`
  JSON font and procedural environment.

## Single source of truth

The hero snippet lives at `site/src/snippets/hero.tsx`. It exports a default
Solid component. The wrapper component imports it two ways:

```ts
import HeroScene from "~/snippets/hero"
import heroSource from "~/snippets/hero?raw"
```

`HeroScene` is rendered directly in a `<Canvas>` on the parent page (fast
first paint, no iframe). `heroSource` is passed to a lazy-mounted `<Demo>`
when the user opens the editor.

Constraint: `hero.tsx` must be importable identically by parent and iframe.
That means **only bare specifiers** the iframe's import map knows about:
`solid-three`, `three`, `three/examples/jsm/...`, `solid-js`, `cannon-es`.
No relative imports, no Vite aliases.

## Scene

### Letters

Ten 3D-extruded letters spelling `SOLID THREE` (no dash; the space is just
spacing in initial x-positions). Rendered with `TextGeometry` + `FontLoader`
loading three's bundled `helvetiker_bold.typeface.json` from
`three/examples/fonts/...` via the existing `three/` import-map prefix.

Each letter is a single mesh with a `MeshStandardMaterial`:

- `SOLID` glyphs: color `#2c4f7c` (Solid blue).
- `THREE` glyphs: color `#f4f4f4` (warm off-white).
- Both: `metalness: 0.85`, `roughness: 0.2`. Mirror-y, not chrome.

Letters spawn above the camera frame at randomized x/z within a band, with
randomized initial yaw/pitch and small angular velocity, then drop under
gravity.

### Physics

`cannon-es`. Pure JS, synchronous init, ~10 dynamic bodies — well within its
comfort zone.

Each letter gets a `Body` with a `Box` shape sized to the glyph's bounding
box (close enough; perfect collision shape is not the point). Bodies are
stepped each frame from solid-three's `useFrame`. Each frame we copy
`body.position` and `body.quaternion` onto the corresponding mesh.

Ground: an invisible static `Plane` body at y=0. Letters settle on it.

### Environment & lighting

- `RoomEnvironment` from `three/examples/jsm/environments/RoomEnvironment.js`,
  passed through `PMREMGenerator`, set as the scene's `environment`. Gives a
  studio-ish reflection on the metalness without any HDR fetch.
- One `HemisphereLight` for ambient fill.
- One `DirectionalLight` from upper-left. No shadow maps — we render a
  cheap fake contact shadow per letter — a flat dark `CircleGeometry` mesh
  laid on the ground plane, positioned at the letter's xz, with opacity
  and scale modulated by the letter's height above ground (closer = darker
  and smaller). Keeps frame budget low; no shadow map passes.

### Camera

`PerspectiveCamera`, fixed position, looking slightly down (~10°). Very
slow horizontal drift (≈ 0.05 rad/s sinusoidal sweep) for parallax. No
`OrbitControls` — the hero must not fight scroll.

### Interaction

- **Cursor repulsion (desktop only).** Each frame, raycast cursor NDC onto
  the ground plane to get a world point. Apply an outward radial force to
  any letter body within a fixed radius. Force falls off with distance.
  Pointer-leave: zero the force.
- **Click to punch.** `onPointerDown` on each letter mesh applies an
  upward + small outward impulse to its body. Lets visitors mess with the
  pile.
- **Touch.** Same `onPointerDown` works for taps. Cursor repulsion is
  skipped on coarse pointers (`matchMedia("(pointer: coarse)")`).

### Background

Canvas is transparent. The hero's HTML/CSS background (subtle gradient
matching the site theme) shows through, so letters appear to settle on
the page itself.

## Hero component

### Files

- `site/src/snippets/hero.tsx` — the snippet (default export, ~150 lines).
- `site/src/components/hero.tsx` — the wrapper. Renders `<HeroScene />`
  directly, exposes the editor toggle, lazy-mounts `<Demo>`.
- `site/src/routes/index.mdx` — imports `<Hero />`, drops it at the top,
  adds title/tagline/CTA overlay.

### Layout

- Full-width landing layout. Drop the SolidBase sidebar for `/` only.
  Mechanism: prefer SolidBase's built-in landing/home layout frontmatter
  if it exists in the installed version; otherwise hide the sidebar on
  `/` via a targeted CSS rule scoped to the route and let the hero
  span the full viewport width. Sidebar returns inside `/tutorial` and
  `/api`.
- Hero height: ~70vh.
- Canvas fills the hero region absolutely. Title (`solid-three`), tagline
  ("A SolidJS renderer for three.js"), and CTA buttons (Start the tutorial,
  API reference) overlay the canvas in a normal flow with
  `pointer-events: none` on the text layer. CTA buttons re-enable
  pointer events so they're clickable.

### Editor toggle

- Small floating button in the bottom-right of the hero, labeled "Edit"
  with a code/pencil icon.
- Click: lazy-import the existing `<Demo>` and mount it in an absolutely
  positioned overlay covering the hero region. `<Demo>` renders its
  default editor-left / canvas-right split (on narrow viewports it uses
  its built-in tab switch).
- The direct `<HeroScene />` stays mounted underneath, just visually
  hidden by the overlay. Closing the editor unmounts/hides the overlay
  and reveals the original (still-running, still-physics-stepping) scene
  — no reload, no flicker.

### Mobile

- Canvas renders. No cursor force; click/tap punch still works.
- Toggle button still present; opens `<Demo>` in its narrow-mode tabs
  layout.

## Plumbing in `demo.tsx`

`resolveBareSpecifier` already falls through to esm.sh for unknown
specifiers, so `cannon-es` works without code changes. Pin a version in
`externalDepsParam`:

```
external=solid-js,three&deps=solid-js@1.8,three@0.181,cannon-es@0.20
```

`three/examples/jsm/...` paths already resolve through the existing
`"three/": "https://esm.sh/three@0.181/"` import-map prefix. No change.

## Failure modes

- **Font load fails.** `FontLoader` errors → render nothing rather than
  throwing. Hero shows an empty (transparent) canvas; site is still
  usable. Logged to console.
- **WebGL unavailable.** solid-three's `<Canvas>` falls back to its own
  error path. The text overlay still shows, hero just has no scene.
- **Snippet edit produces an error.** `<Demo>`'s existing `errorModule`
  path renders a red `<pre>` inside the iframe. The direct-render
  underneath is unaffected.

## Testing

- Visual smoke: load `/`, see letters drop and settle within ~2s. Click a
  letter — it punches up. Move cursor through pile — letters drift away.
- Open editor → snippet text matches `hero.tsx` on disk. Edit a color
  literal → iframe canvas updates. Close editor → original scene visible
  again, still running.
- Mobile: canvas renders, no cursor force, tap-to-punch works.
- Sidebar gone on `/`, present on `/tutorial/01-...`.

## Open follow-ups (out of scope for this spec)

- Real shadows / SSAO once perf budget is measured.
- Accent color for `THREE` may want tuning against the actual theme
  background (light/dark).
- A "shuffle" button that re-drops the letters is a small win but not
  required for v1.
