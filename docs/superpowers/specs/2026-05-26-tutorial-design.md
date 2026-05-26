# solid-three tutorial — design

## Purpose

Replace the playground's role as the primary learning surface with a dedicated tutorial that reads as a continuous story of incremental discovery. Each chapter introduces exactly one new concept on top of the last; readers can pick the library up by reading top-to-bottom.

The existing `playground/` (sidebar + canvas + `<details>`) stays intact during this work as a reference surface; eventual removal is out of scope for this design.

## Surface

A new top-level **`tutorial/`** project at the repo root, a sibling to `playground/`. Built on **SolidStart + SolidBase** (`@kobalte/solidbase`).

- SolidStart-based; its own `app.config.ts` / `vite.config.ts`
- Imports `../src` directly (via a Vite plugin that bundles the workspace solid-three)
- Deploys independently of `playground/`
- **Extensibility note:** SolidBase is designed for documentation; later we plan to host reference docs alongside the tutorial in the same site.

> **History:** An earlier iteration of this spec specified a plain Vite + custom-sidebar + long-scroll site. We pivoted to SolidBase because (a) it would let us host reference docs in the same project later, and (b) the MDX/Solid wiring it ships with is more robust than the custom integration. The long-scroll reading model was the cost of the pivot — see "Reading model" below.

## Reading model

**Page-per-chapter**, with prominent prev/next navigation and a sidebar listing every chapter. Each chapter is its own `.mdx` route. Read linearly via prev/next, like the Svelte / Vue interactive tutorials.

- Sidebar (left) lists Parts → Chapters (grouped via SolidBase's `sidebar` config).
- Active chapter highlighted; prev/next buttons at the bottom of each chapter.
- Reading column constrained to SolidBase's default content width. Inline REPL blocks may break out wider when useful.
- When the viewport is too narrow to show editor and canvas side-by-side, each `<Demo>` switches to a single-pane mode with a toggle (canvas ⇄ editor). Wide viewports show both at once.

The narrative continuity (the spine of this design) is preserved by: a single ordered chapter list, clear prev/next, and prose that explicitly hands off from one chapter to the next.

## Page layout

Prose flows top-to-bottom. Between paragraphs, **inline `<Demo>` blocks** show:

- An editable TSX editor (full source, **imports included** — readers see real code they would write)
- A live canvas rendered from that snippet
- A "reset" button
- Per-snippet edit persistence in `localStorage` (so scrolling away doesn't lose work)

No sticky canvas, no split panes. The story is the spine; demos are figures.

## REPL integration

Built on **`@bigmistqke/repl`** (sibling repo at `../repl`), consumed via `link:../repl`.

`@bigmistqke/repl`'s existing `transformModulePaths` API supports per-specifier import resolution — no upstream changes needed for this design.

Local `solid-three` is exposed to iframe snippets via a custom Vite plugin that bundles `../src/index.ts` (externalising `solid-js`, `solid-js/web`, `solid-js/store`, `three`) and serves it at `/@tutorial/solid-three.js`. The iframe's import map pins `solid-js` and `three` to esm.sh so singletons match across snippet code and solid-three internals.

A thin `<Demo>` wrapper inside `tutorial/src/components/` provides:

- A unified API (`<Demo code={...} />`)
- The Vite-plugin-served local solid-three bundle as the resolution target for `import "solid-three"`
- localStorage persistence per snippet; reset button

## Chapter outline

Six parts, 17 chapters. Each chapter introduces one concept.

The arc is built around what the reader **feels** in each part, not the API surface ticked off. Each chapter introduces at most one new idea.

### Part 1 — It's just Solid

You already know how to read this. JSX nesting becomes a scene graph.

1. **Your first scene** — `<Canvas>` + introduction to both `<Entity>` and `createT` (including the tree-shaking tradeoff)
2. **Nesting & transforms** — JSX nesting maps to parent/child; `position` / `rotation` / `scale`
3. **Smart props** — `position={[x,y,z]}`, color strings, `args`, `set` / `setScalar` inference

### Part 2 — Signals are the animation loop

Reactivity drives the scene; no `useEffect` needed to animate.

4. **Signals drive the scene** — a rotating cube driven by `createSignal`
5. **`useFrame`** — animating per-frame without re-rendering
6. **`useThree`** — reading `gl`, `camera`, `size`, `clock`

### Part 3 — The scene talks back

The scene reacts to the user, not just to props.

7. **Pointer events** — `onClick`, `onPointerOver`, `onClickMissed`
8. **Configuring the raycaster** — layers, thresholds

### Part 4 — Stuff that's not in the scene

Async, lifecycle, ownership.

9. **Loaders & `Resource`** — async assets and suspense
10. **`autodispose` & `meta`** — lifecycle and resource ownership

### Part 5 — Compose your own

Going from consumer to library author.

11. **`Portal`** — rendering into another scene/target
12. **`useProps` & custom components** — building reusable helpers

### Part 6 — Ship something real

The climax: an interactive 3D scene that feels like a real Solid app.

13. **An interactive scene** — clickable + hoverable objects, signal-driven UI panel, end-to-end build (absorbs the old solar-system and environment-scene examples as ingredients)

### Encore

14. **A peek at WebGPU** — short, optional, "where this is going" (TSL primer)

## Authoring format — MDX

Chapters are written in **MDX** (`.mdx`). MDX support is built into SolidBase. Prose is plain Markdown; demos are JSX components embedded in the same file:

```mdx
# Hello, Canvas

Every solid-three app starts by mounting a `<Canvas>`.

<Demo>{`
  import { Canvas } from "solid-three"
  export default () => <Canvas />
`}</Demo>

The canvas is empty — we haven't put anything in the scene yet.
```

Build setup:

- MDX handled by SolidBase's built-in pipeline (no manual `@mdx-js/rollup` wiring required).
- A custom **theme `componentsPath`** exports `<Demo>` as a named export — SolidBase injects it globally into all MDX, so no per-chapter import.
- Frontmatter carries chapter metadata (`title`, etc.). Sidebar grouping is configured in `app.config.ts` / `vite.config.ts`.

## File / directory shape

```
tutorial/
  app.config.ts                       # SolidStart + SolidBase config (sidebar lives here)
  vite.config.ts                      # additional Vite plugins (solid-three pre-bundle)
  package.json
  tsconfig.json
  src/
    app.tsx                           # SolidStart root, wraps with <SolidBaseRoot>
    entry-client.tsx
    entry-server.tsx
    components/
      demo.tsx                        # <Demo> wrapper around @bigmistqke/repl
    theme/
      mdx-components.tsx              # exports <Demo> globally for MDX
      style.css                       # any theme overrides
    routes/
      index.mdx                       # landing page
      01-hello-canvas.mdx
      02-t-proxy.mdx
      ...
      17-environment-scene.mdx
```

Each chapter `.mdx` lives at `src/routes/NN-<id>.mdx`, becomes a route, and contains prose + `<Demo>` blocks + frontmatter. The sidebar order and grouping (Parts I-VI) is configured in `app.config.ts` / `vite.config.ts`.

## Out of scope

- Removing or rewriting the existing `playground/`
- Publishing the tutorial as a standalone site (deploy pipeline TBD by user)
- Search / table-of-contents beyond the sidebar
- i18n
- Mobile-specific layout (acceptable to require desktop for v1)

## Dependencies on `../repl`

`@bigmistqke/repl` is consumed via `link:../repl`. Its existing `transformModulePaths` API satisfies the tutorial's needs without upstream changes. Tarball-based releases remain a known gap for `../repl` but are not required for this tutorial design (deferred to whatever publishes the tutorial as a static site).
