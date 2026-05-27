# Lazy snippet compiler for tutorial Demo blocks

## Goal

Defer loading TypeScript and Babel (today fetched from esm.sh on every page that mounts a `<Demo>`) until the user actually edits a snippet. Initial preview renders by directly mounting the snippet module the MDX page already imported. Visual UX is unchanged — tm-textarea is still always loaded, layout stays the same.

## Motivation

Each tutorial chapter mounts 3–5 `<Demo>` blocks. Today every Demo's iframe boots through `@bigmistqke/repl`, which immediately fetches the TypeScript compiler (~3 MB) and Babel + babel-preset-solid (~1.5 MB) from esm.sh — even when the visitor never edits. Most readers don't edit; they just look at the running snippet. Deferring those CDN imports until first edit removes the largest unconditional cost on tutorial pages.

A forthcoming spec will address sharing three.js / cannon-es / solid-three across snippet preview bundles via chunked output. That is **not** in scope here.

## Non-goals

- No tests for the Demo component (matches today).
- No change to the editor's behaviour after the user has started editing — repl + iframe + recompile-on-input stay identical.
- No change to the tm-textarea load — it stays mounted from the start.
- No change to hero gallery rotation behaviour. Only the hero's *edit overlay* gets the new lazy-compiler path.
- No `snippet()` registry helper, no codegen Vite plugin, no `?url` query (rejected during brainstorming — Vite types don't expose literal keys, and a runtime helper would still require explicit import per call).

## Architecture overview

Two coordinated changes:

1. **A single `Demo` component**, same file (`site/src/components/demo.tsx`), gains a `Component` prop alongside the existing `code` prop. Internally it has two render modes:
   - **Mode A** (initial): renders `<props.Component />` directly into a host div. No iframe, no repl, no TS, no Babel.
   - **Mode B** (after first edit): mounts the repl-driven iframe. TS + Babel lazy-load via `createResource` keyed on the `hasEdited` latch.

   The mode-A div and mode-B iframe live in the same parent and crossfade via CSS opacity when the transition fires. Mode-A unmounts (releasing its WebGL context) only after the crossfade completes.

2. **MDX usage updates** to import each snippet twice — once as `?raw` for the textarea, once as the default-exported component for direct mount. The 28 existing `<Demo>` call sites are updated; no other MDX change.

The hero overlay reuses the same `Demo` component — gallery scenes pass through the same two-prop shape.

## Section 1 — Demo component

`site/src/components/demo.tsx` — kept as one file. Props change:

```ts
import type { Component as SolidComponent } from "solid-js"

export interface DemoProps {
  code: string
  Component: SolidComponent
}
```

State signals (inside `DemoClient`):

- `code: Accessor<string>` — initialised to `trimBlankLines(props.code)`. Tracks textarea content.
- `hasEdited: Accessor<boolean>` — one-way latch. Flips true on first textarea `onInput`. Never reverts.
- `iframeReady: Accessor<boolean>` — flips true the first time the iframe finishes its first compile + load. Drives the crossfade.
- `directMountRetired: Accessor<boolean>` — flips true after DirectMount's opacity-0 transition ends. Mode-A only unmounts when this is true.
- `iframeBusy: Accessor<boolean>` — drives the top-right loading indicator.

Render structure:

```tsx
<div class="demo" classList={{ "demo-narrow": isNarrow() }}>
  {/* tabs (unchanged) */}
  <div class="demo-panes">
    {/* editor pane: tm-textarea (unchanged) */}
    <Show when={!isNarrow() || pane() === "canvas"}>
      <div class="demo-canvas-wrapper">
        <Show when={!directMountRetired()}>
          <ErrorBoundary fallback={err => <div class="demo-error">{String(err)}</div>}>
            <DirectMount
              Component={props.Component}
              faded={iframeReady()}
              onRetire={() => setDirectMountRetired(true)}
            />
          </ErrorBoundary>
        </Show>
        <Show when={hasEdited()}>
          <ReplIframe
            code={code()}
            theme={editorTheme()}
            visible={iframeReady()}
            onBusy={setIframeBusy}
            onFirstReady={() => setIframeReady(true)}
          />
        </Show>
        <Show when={iframeBusy()}>
          <div class="demo-loading" aria-label="Loading preview" />
        </Show>
      </div>
    </Show>
  </div>
</div>
```

Both `<DirectMount>` and `<ReplIframe>` are absolutely positioned within `.demo-canvas-wrapper` and occupy the same rect.

## Section 2 — `DirectMount`

Synchronously renders the imported snippet component into a div. CSS opacity drives the crossfade.

```tsx
function DirectMount(props: { Component: SolidComponent; faded: boolean; onRetire: () => void }) {
  let container: HTMLDivElement | undefined
  onMount(() => {
    if (!container) return
    const dispose = render(() => <props.Component />, container)
    onCleanup(dispose)
  })
  return (
    <div
      ref={container}
      class="demo-canvas demo-canvas-direct"
      classList={{ faded: props.faded }}
      onTransitionEnd={event => {
        if (event.propertyName === "opacity" && props.faded) props.onRetire()
      }}
    />
  )
}
```

CSS:

```css
.demo-canvas-direct {
  position: absolute;
  inset: 0;
  opacity: 1;
  transition: opacity 200ms ease;
}
.demo-canvas-direct.faded {
  opacity: 0;
  pointer-events: none;
}
```

`onTransitionEnd` fires once `opacity` hits 0; the parent then unmounts the DirectMount (cleanup runs, WebGL context released).

## Section 3 — `ReplIframe`

The current iframe + repl pipeline, extracted into its own component so it only ever instantiates after `hasEdited` flips. Props: `{ code: string; theme: "dark" | "light"; onBusy: (busy: boolean) => void }`. Internals largely unchanged from today's `DemoClient` body — the same `tsxExtension`, `htmlExtension`, `buildHostHtml`, `bootstrapTsx`, `createFileUrlSystem` pipeline. The two changes:

1. `ensureCompilerLoaded()` is replaced by a Solid `createResource` keyed on a constant truthy source (the component only exists in mode B, so the loader fires once on mount):

   ```ts
   const [compiler] = createResource(async () => {
     const [tsModule, babelTransformFn] = await Promise.all([
       loadTypeScript(),
       loadBabelTransform(),
     ])
     return { tsModule, babelTransform: babelTransformFn }
   })
   ```

   `loadTypeScript` already exists; rename `getBabelTransformPromise` → `loadBabelTransform` for symmetry. The existing `compiler()` signal at module scope is removed in favour of the per-instance resource.

2. `onBusy` is called with `true` whenever the file URL signal re-emits (which happens on mount and on every code change), and `false` on iframe `onLoad`. The parent uses this to drive the loading indicator.

The iframe is rendered absolutely positioned, also fading in from opacity 0 to 1 with `transition: opacity 200ms` so the swap is smooth:

```css
.demo-canvas {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 200ms ease;
}
.demo-canvas.visible {
  opacity: 1;
}
```

The parent supplies `visible` via the `iframeReady` signal — the iframe stays at opacity 0 until its first compile + load completes, at which point `onFirstReady` fires and the parent flips `iframeReady` true.

## Section 4 — Loading indicator

Top-right of the canvas wrapper. Shown while `iframeBusy()` is true. `iframeBusy` covers two windows:

- From `hasEdited` flip until `ReplIframe` finishes its first compile + iframe load (the TS/Babel CDN fetch window plus the initial blob bootstrap).
- From any subsequent `code` change until the iframe reloads with new compiled content.

Indicator implementation is a small absolutely-positioned spinner; CSS only. No new dependencies.

## Section 5 — Edit cycle

- User types first character → `hasEdited` latches → `ReplIframe` mounts at opacity 0 behind/over the still-visible DirectMount → TS+Babel load → first compile completes → iframe `onLoad` fires → `onFirstReady()` → `iframeReady` flips true → iframe gets opacity 1, DirectMount gets opacity 0 (same trigger drives both via `faded={iframeReady()}` / `visible={iframeReady()}`) → 200ms crossfade → DirectMount's `transitionend` fires → unmounts.
- Subsequent edits: same iframe; recompile on each input. Indicator visible during recompile windows.
- Reset (after first edit): code reverts to initial; iframe recompiles initial; DirectMount stays unmounted.

## Section 6 — MDX migration

Every tutorial `<Demo>` call gets two static imports (one for raw source, one for the component) and passes both props. For `01-your-first-scene.mdx` the diff is:

```mdx
- import createTSnippet from "../../snippets/01-create-t.tsx?raw"
+ import createTSnippet from "../../snippets/01-create-t.tsx?raw"
+ import CreateTComponent from "../../snippets/01-create-t.tsx"

- <Demo code={createTSnippet} />
+ <Demo code={createTSnippet} Component={CreateTComponent} />
```

Files touched (9 chapter MDX files, ~28 `<Demo>` calls total):

- `site/src/routes/tutorial/01-your-first-scene.mdx`
- `site/src/routes/tutorial/02-props-and-children.mdx`
- `site/src/routes/tutorial/03-control-flow.mdx`
- `site/src/routes/tutorial/04-pointer-events.mdx`
- `site/src/routes/tutorial/05-use-frame.mdx`
- `site/src/routes/tutorial/06-loaders-and-resource.mdx`
- `site/src/routes/tutorial/07-portal.mdx`
- `site/src/routes/tutorial/08-tetris.mdx`
- `site/src/routes/tutorial/09-webgpu-peek.mdx`

The MDX import lines are static — each chapter chunks its own snippets eagerly via SolidStart's route code splitting. Heavy shared deps (three, cannon-es) chunk-split automatically across snippets.

## Section 7 — Hero overlay

`site/src/components/hero.tsx` already passes `source` to `<LazyDemo code={source()} />`. After this refactor it passes a Component too:

```tsx
<LazyDemo code={sourceText()} Component={chosen.Component} />
```

`site/src/snippets/gallery/index.ts` already exposes a `load: () => Promise<{ default: Component }>` per entry. We can either:

- **Wait for the loader** in hero before opening the overlay: when Edit is clicked, await `chosen.load()`, then mount the overlay with the resolved Component.
- **Switch the gallery glob to eager**: small bundle cost but the Component is synchronous. Today's gallery already eager-imports raw sources, so consistency favours this.

Choose the second — eager import keeps the gallery surface uniform with tutorials. `gallery/index.ts` adds an eager glob for default exports:

```ts
const modules = import.meta.glob<{ default: Component }>("./*.tsx", { eager: true })
```

`Demo` interface gains `Component: Component`. Hero passes it through.

## Section 8 — Risks and mitigations

**Runtime mismatch between modes**: Mode A's DirectMount runs the snippet against the page's bundled solid-js/three. Mode B's iframe runs against esm.sh-pinned versions (today's behavior). Both are scoped within their own component tree; no cross-pollution. Snippet behaviour stays identical for the tutorial set since they don't depend on version-specific quirks.

**DOM swap visible to the user**: crossfade covers it. Worst case is a brief overlap where both renderers run for ~200ms. Two WebGL contexts active briefly — well below browser limits. Acceptable.

**Snippet errors in mode A**: a snippet that throws on mount would propagate up to the page. Wrap `<DirectMount>` in an `<ErrorBoundary>` that shows a small error block. Same boundary covers any later runtime errors.

**Style leakage**: the snippet's rendered DOM (a Canvas, in every existing snippet) shares the page's stylesheet. Canvas elements have no inherent style sensitivity, but stray descendant rules could affect overlay UIs in future snippets. Mitigate with a scoping class on `.demo-canvas-direct > *` selectors if a leak materialises; no preemptive work here.

## Verification

Manual (no automated tests):

- `pnpm --filter site dev`, open a tutorial chapter (e.g. `/tutorial/02-props-and-children`). Confirm:
  - Snippets render visually identically to today.
  - DevTools Network tab shows NO requests to `esm.sh/typescript@…` or `esm.sh/@babel*` on initial page load.
  - tm-grammars / tm-themes requests still fire (tm-textarea is unchanged).
- Click into the textarea and type a character. Confirm:
  - Loading indicator appears top-right of canvas pane.
  - DirectMount visibly crossfades to the iframe over ~200ms.
  - DevTools shows the TypeScript + Babel CDN requests firing exactly once.
  - Subsequent edits compile in-place; no more CDN requests after first edit.
- Hero overlay: open `/`, get the cube or letter-drop, click Edit. Same lazy-load pattern applies.
- `pnpm --filter site build` succeeds, prerender completes, preview renders correctly.

## Out of scope (forthcoming spec)

- **Shared dependency chunks**: explicit `manualChunks` config (or equivalent) so three.js, cannon-es, solid-three load once and are reused across all snippet preview bundles. Vite likely handles much of this automatically via code-splitting on shared imports; the next spec audits and locks this in. Natural next step after this spec ships.
