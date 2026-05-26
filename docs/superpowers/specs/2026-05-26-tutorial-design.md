# solid-three tutorial — design

## Purpose

Replace the playground's role as the primary learning surface with a dedicated tutorial that reads as a continuous story of incremental discovery. Each chapter introduces exactly one new concept on top of the last; readers can pick the library up by reading top-to-bottom.

The existing `playground/` (sidebar + canvas + `<details>`) stays intact during this work as a reference surface; eventual removal is out of scope for this design.

## Surface

A new top-level **`tutorial/`** project at the repo root, a sibling to `playground/`.

- Own `vite.config.ts`, `index.html`, `App.tsx`
- Imports `../src` directly (same pattern as `playground/`)
- Added as a workspace target so `pnpm --filter tutorial dev` works
- Deploys independently of `playground/`

## Reading model

One long-scroll page contains every chapter in order.

- Sidebar (left) lists Parts → Chapters. Clicking scrolls to that anchor.
- URL hash (e.g. `#scene-graph`) updates as the reader scrolls, so deep links are shareable.
- Each chapter has an `<h2>` anchor; subsections use `<h3>`.
- Reading column is constrained to a comfortable text width (~70ch). Inline REPL blocks may break out wider when useful.

## Page layout

Prose flows top-to-bottom. Between paragraphs, **inline `<Demo>` blocks** show:

- An editable TSX editor (full source, **imports included** — readers see real code they would write)
- A live canvas rendered from that snippet
- A "reset" button
- Per-snippet edit persistence in `localStorage` (so scrolling away doesn't lose work)

No sticky canvas, no split panes. The story is the spine; demos are figures.

## REPL integration

Built on **`@bigmistqke/repl`** (sibling repo at `../repl`).

Two prerequisites are NOT supported by `@bigmistqke/repl` today and must be added there as part of this work:

1. **Workspace-relative import resolution.** Snippets must be able to write `import { Canvas } from "solid-three"` (or similar) and have the REPL resolve to the local `../src`, not a published version.
2. **Continuous releases via tarball.** So `tutorial/` can depend on the local `@bigmistqke/repl` build during development without publishing.

Both are upstream work in `../repl`. This design assumes that work happens in tandem; the tutorial scaffolding can begin in parallel using a stub `<Demo>` component.

A thin `<Demo>` wrapper inside `tutorial/` provides:

- A unified API (`<Demo code={...} />` or `<Demo>{raw-string}</Demo>`)
- Pre-wired Vite config for resolving `solid-three`, `three` against the workspace
- The reset / persistence behavior described above

## Chapter outline

Six parts, 17 chapters. Each chapter introduces one concept.

### Part I — Foundations

1. **Hello, Canvas** — mount a `<Canvas>`, see an empty scene
2. **The T proxy** — `createT(THREE)`; render a `T.Mesh` with `T.BoxGeometry` + `T.MeshBasicMaterial`
3. **Scene graph** — JSX nesting maps to parent/child; transforms (`position`, `rotation`, `scale`)
4. **Smart props** — `position={[x,y,z]}`, color strings, `args` for constructor params, `set` / `setScalar` inference

### Part II — Reactivity

5. **Signals drive the scene** — a rotating cube driven by `createSignal`
6. **`useFrame`** — animating without re-rendering
7. **`useThree`** — reading `gl`, `camera`, `size`, `clock`

### Part III — Beyond primitives

8. **`Entity`** — using arbitrary three classes / custom subclasses
9. **`Resource` + `useLoader`** — async assets, suspense boundaries
10. **`autodispose` & `meta`** — lifecycle and resource ownership

### Part IV — Interaction

11. **Pointer events** — `onClick`, `onPointerOver`, `onClickMissed`
12. **The raycaster** — configuring layers / thresholds

### Part V — Composition

13. **`Portal`** — rendering into another scene/target
14. **`useProps`** — building your own helper components
15. **Custom renderers** — swapping `gl` for WebGPU; a peek at TSL

### Part VI — Putting it together

16. **A solar system** — built from scratch, step by step (reuses the existing `examples/solar.tsx` material)
17. **An environment scene** — loaders + lighting + post

## File / directory shape

```
tutorial/
  index.html
  vite.config.ts
  package.json
  tsconfig.json
  src/
    main.tsx
    App.tsx
    sidebar.tsx
    demo.tsx                 # the <Demo> wrapper around @bigmistqke/repl
    chapters/
      01-hello-canvas.tsx
      02-t-proxy.tsx
      03-scene-graph.tsx
      ...
      17-environment-scene.tsx
    index.css
```

Each chapter file exports a Solid component containing its prose + `<Demo>` blocks. `App.tsx` imports them in order and renders them as one long page. The sidebar is generated from chapter metadata (id, title, part).

## Out of scope

- Removing or rewriting the existing `playground/`
- Publishing the tutorial as a standalone site (deploy pipeline TBD by user)
- Search / table-of-contents beyond the sidebar
- i18n
- Mobile-specific layout (acceptable to require desktop for v1)

## Dependencies on `../repl`

The tutorial's REPL story depends on changes landing in `../repl`:

- **Workspace import resolution** — REPL must accept a resolver/config mapping import specifiers to local files
- **Tarball release flow** — so `tutorial/`'s `package.json` can depend on a built tarball during development

These are tracked as part of the implementation plan, not this design.
