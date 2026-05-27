# Lazy snippet compiler for tutorial Demo blocks

## Goal

Defer loading TypeScript and Babel (today fetched from esm.sh on every page that mounts a `<Demo>`) until the user actually edits a snippet. Initial render uses the snippet's Vite-precompiled bundle directly. The visual UX is unchanged — tm-textarea is still always loaded, layout stays the same.

## Motivation

Each tutorial chapter mounts 3–5 `<Demo>` blocks. Today every Demo's iframe boots through `@bigmistqke/repl`, which immediately fetches the TypeScript compiler (~3 MB) and Babel + babel-preset-solid (~1.5 MB) from esm.sh — even when the visitor never edits anything. Most readers don't edit; they just look at the running snippet. Deferring those CDN imports until first edit removes the largest unconditional cost on tutorial pages.

A separate forthcoming spec will address sharing three.js / cannon-es / solid-three across snippets via chunked output. That is **not** in scope here.

## Non-goals

- No tests for the Demo component (matches today).
- No change to the editor's behaviour after the user has started editing — repl + iframe + recompile-on-input stay identical.
- No change to the tm-textarea load — it stays mounted from the start.
- No change to hero gallery rotation behaviour. Only the hero's *edit overlay* gets the new lazy-compiler path.
- No build-time pre-compilation pipeline (option 3 from brainstorming). We rely on Vite's `?url` for the initial bundle.

## Architecture overview

Three coordinated changes:

1. **A `snippet(filename)` helper** at `site/src/snippets/index.ts` returns `{ code, url }` — raw source string + Vite-served compiled module URL. Filename-keyed (e.g. `"02-button-toggle.tsx"`), with collision detection at module load.

2. **A single `Demo` component** owns one iframe element throughout its lifetime. Two iframe `src` modes:
   - **Mode A** (initial): a tiny bootstrap blob URL whose HTML imports `${url}` directly. No repl, no TS, no Babel.
   - **Mode B** (after first edit): today's repl-managed blob URL. TS + Babel lazy-loaded via `createResource` keyed on a `hasEdited` latch.

3. **MDX usage updated** to `<Demo {...snippet("02-button-toggle.tsx")} />`. The 28 existing `?raw` imports are removed in favour of one `snippet` import per MDX file.

The hero overlay reuses the same `Demo` component — gallery scenes pass through `snippet(...)` too.

## Section 1 — `snippet()` helper

`site/src/snippets/index.ts`:

```ts
const sources = import.meta.glob<string>("./**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
})

const urls = import.meta.glob<string>("./**/*.tsx", {
  query: "?url",
  import: "default",
  eager: true,
})

const sourcesByName: Record<string, string> = {}
const urlsByName: Record<string, string> = {}
for (const path of Object.keys(sources)) {
  const filename = path.split("/").at(-1)
  if (!filename) continue
  if (sourcesByName[filename]) {
    throw new Error(`snippet: duplicate filename "${filename}" in registry`)
  }
  sourcesByName[filename] = sources[path]
  urlsByName[filename] = urls[path]
}

export interface SnippetEntry {
  code: string
  url: string
}

export function snippet(filename: string): SnippetEntry {
  const code = sourcesByName[filename]
  const url = urlsByName[filename]
  if (!code || !url) throw new Error(`snippet: no entry named "${filename}"`)
  return { code, url }
}
```

The generic `<string>` parameter to `import.meta.glob` types the default-imported value, so both `sources` and `urls` infer as `Record<string, string>` directly — no cast.

Filename collisions throw at module load — fail fast.

The glob covers `snippets/**/*.tsx`, which includes the existing `snippets/gallery/*.tsx` scenes used by the hero. No directory partitioning needed because the existing prefix conventions (numbered tutorial files, descriptive gallery names) already keep filenames globally unique.

## Section 2 — Single `Demo` component

`site/src/components/demo.tsx` keeps its file path but the props change.

**Props**:

```ts
export interface DemoProps {
  code: string
  url: string
}
```

**State** (inside `DemoClient`):

- `code: Accessor<string>` — initialized to `trimBlankLines(props.code)`. Tracks textarea content.
- `hasEdited: Accessor<boolean>` — one-way latch. Flips true on first `onInput`. Never reverts.
- `iframeBusy: Accessor<boolean>` — true between any iframe content change request and the iframe's `onLoad`. Drives the loading indicator.

**Render**:

- Tab UI (narrow viewport): unchanged.
- tm-textarea pane: unchanged. Still always rendered.
- Canvas pane: a single `<iframe>` element with `src={iframeSrc()}`. Same DOM node for the component's lifetime.
- Loading indicator: a small spinner overlay top-right of the canvas pane, shown while `iframeBusy()`.

**`iframeSrc` derivation**:

```ts
const initialBootstrapUrl = createMemo(() => buildInitialBootstrapBlob(props.url, editorTheme()))
const replBootstrapUrl = createMemo(() => fileUrls.get("/index.html"))

const iframeSrc = createMemo(() =>
  hasEdited() ? replBootstrapUrl() : initialBootstrapUrl(),
)
```

The iframe's `src` changes once — from initial bootstrap blob to repl bootstrap blob — at the moment `hasEdited` flips. The element itself doesn't unmount.

## Section 3 — Initial bootstrap blob

Mode A's bootstrap is a static HTML page built once on Demo mount:

```ts
function buildInitialBootstrapHtml(snippetUrl: string, theme: "dark" | "light"): string {
  return `<!doctype html>
<html style="color-scheme: ${theme}">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
      canvas { display: block; }
    </style>
    <script>
      window.addEventListener("message", function (event) {
        var data = event.data
        if (!data) return
        if (data.type !== "theme") return
        document.documentElement.style.colorScheme = data.value
      })
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import { render } from "https://esm.sh/solid-js@1.8/web?external=solid-js"
      import Component from ${JSON.stringify(snippetUrl)}
      render(() => Component(), document.getElementById("root"))
    </script>
  </body>
</html>`
}

function buildInitialBootstrapBlob(snippetUrl: string, theme: "dark" | "light"): string {
  const blob = new Blob([buildInitialBootstrapHtml(snippetUrl, theme)], { type: "text/html" })
  return URL.createObjectURL(blob)
}
```

**Why same-origin import works**: Vite's `?url` returns a same-origin URL (dev: `/src/snippets/...`, prod: `/_build/.../snippet.js`). The iframe sandbox is `allow-scripts allow-same-origin`, so the iframe can fetch the URL. The Vite-compiled module's own imports (solid-js, three) resolve via the URLs Vite emitted — also same-origin in prod, dev-server-served in dev.

**Why solid-js/web is imported from esm.sh in the bootstrap**: the bootstrap itself can't use bare specifiers without an importmap; it needs an absolute URL. esm.sh provides a stable URL. The compiled snippet module loaded inside `Component` uses its own (Vite-resolved) solid-js import. There are momentarily two solid-js runtimes inside the iframe — bootstrap's esm.sh copy and Vite's copy — but they don't share any state, the bootstrap only uses `render()` once. Acceptable.

**Cleanup**: revoke the blob URL on component dispose:

```ts
onCleanup(() => URL.revokeObjectURL(initialBootstrapUrl()))
```

## Section 4 — Lazy compiler load

Replace today's `compiler` signal + `ensureCompilerLoaded` with a Solid `createResource`:

```ts
const [compiler] = createResource(
  () => (hasEdited() ? true : undefined),
  async () => {
    const [tsModule, babelTransformFn] = await Promise.all([
      loadTypeScript(),
      loadBabelTransform(),
    ])
    return { tsModule, babelTransform: babelTransformFn }
  },
)
```

`createResource`'s source returns `undefined` until `hasEdited` flips, then `true`. The fetcher fires exactly once. After it resolves, `compiler()` is defined and the existing `tsxExtension.transform` accessor re-emits to produce real compiled output.

While `hasEdited` is false, `compiler()` is `undefined` — but in mode A we don't consult `compiler()` at all (the iframe is loading the precompiled URL).

While `hasEdited` is true but `compiler()` is still loading (the brief window between first edit and TS+Babel landing): `tsxExtension.transform` returns the existing placeholder (`export default function Placeholder() { return null }`), and the iframe shows a blank scene. The loading indicator covers this window.

`loadTypeScript` and `loadBabelTransform` here refer to the existing helpers in `demo.tsx`: `loadTypeScript()` (already present) and `getBabelTransformPromise()` (rename to `loadBabelTransform()` for symmetry). They stay as-is but lose their `ensureCompilerLoaded` orchestration.

## Section 5 — Loading indicator

A small spinner pinned top-right of the canvas pane:

```tsx
<Show when={iframeBusy()}>
  <div class="demo-loading" aria-label="Loading preview" />
</Show>
```

`iframeBusy` tracks:
- `hasEdited` flip → true (iframe is about to swap to repl mode)
- Each subsequent `iframeSrc()` change → true (any time the repl rebuilds the bootstrap, the iframe reloads)
- Iframe `onLoad` → false

Concretely:

```ts
const [iframeBusy, setIframeBusy] = createSignal(false)
createRenderEffect(() => {
  iframeSrc() // track
  setIframeBusy(true)
})
function handleIframeLoad() {
  setIframeBusy(false)
  postTheme()
}
```

CSS keeps it minimal: an absolute-positioned 16×16 pulsing circle in the corner of `.demo-canvas-wrapper`.

## Section 6 — MDX migration

Every tutorial MDX file changes from this pattern:

```mdx
import buttonToggleSnippet from "../../snippets/02-button-toggle.tsx?raw"

<Demo code={buttonToggleSnippet} />
```

to:

```mdx
import { snippet } from "../../snippets"

<Demo {...snippet("02-button-toggle.tsx")} />
```

Per MDX file: one `snippet` import replaces N `?raw` imports. Per `<Demo>` call: `{...snippet("...")}` replaces `code={...}`.

Files touched (9 chapter MDX files plus the index, ~28 `<Demo>` calls total):

- `site/src/routes/tutorial/01-your-first-scene.mdx`
- `site/src/routes/tutorial/02-props-and-children.mdx`
- `site/src/routes/tutorial/03-control-flow.mdx`
- `site/src/routes/tutorial/04-pointer-events.mdx`
- `site/src/routes/tutorial/05-use-frame.mdx`
- `site/src/routes/tutorial/06-loaders-and-resource.mdx`
- `site/src/routes/tutorial/07-portal.mdx`
- `site/src/routes/tutorial/08-tetris.mdx`
- `site/src/routes/tutorial/09-webgpu-peek.mdx`

## Section 7 — Hero overlay

`site/src/components/hero.tsx` and `site/src/snippets/gallery/index.ts` adapt:

- `Demo` interface in `gallery/index.ts` adds `url: string` (looked up via the same `?url` glob the gallery already does internally, or simply via `snippet(demo.id + ".tsx")` after the helper is in place).
- `hero.tsx` passes `{ code: chosen.source, url: chosen.url }` to `Demo` instead of just `code`.

Since the gallery filenames are unique within the global namespace and the helper covers `**/*.tsx`, the gallery's existing registry could be reduced to just the random-pick logic. That cleanup is included.

## Section 8 — Risks and mitigations

**Vite `?url` semantics for `.tsx` files**: Vite emits a transformed-module URL — confirmed working in Vite 8 (current site dep). If this turns out not to work as expected, fallback is to use a Vite plugin that explicitly emits per-snippet bundles. Plugin work is out of scope for v1; if `?url` misbehaves, escalate.

**Runtime mismatch between modes**: Mode A's iframe runs the snippet against Vite-bundled solid-js/three (page's versions). Mode B runs against esm.sh-pinned versions. Both runtimes are iframe-local; no cross-pollution with the parent page. Snippets that rely on a specific three version aren't a concern (all snippets target the current `^0.181`).

**Iframe reload blip on transition**: when `iframeSrc()` changes from mode A blob to mode B blob, the browser tears down iframe content and reloads. There's a brief blank or white flash. The loading indicator covers this; the transition happens at most once per Demo per session, only when the user actively starts editing.

**Snippet errors in mode A**: if a snippet throws on mount, the iframe shows whatever the browser shows for an uncaught error (typically a blank canvas). No try/catch needed at this layer — same as today's behavior for the repl-mode preview.

## Verification

Manual (no automated tests):

- `pnpm --filter site dev`, open a tutorial chapter (e.g. `/tutorial/02-props-and-children`). Confirm:
  - Snippets render visually identically to today.
  - Browser DevTools Network tab shows NO requests to `esm.sh/typescript` or `esm.sh/@babel` on initial page load.
  - tm-grammars / tm-themes requests still fire (tm-textarea is unchanged).
- Click into the textarea and type a character. Confirm:
  - Loading indicator appears top-right of canvas pane.
  - Within ~1–3s (uncached) or sub-second (cached), iframe reloads and shows the now-recompiled snippet.
  - DevTools shows the TypeScript and Babel CDN requests firing exactly once.
  - Subsequent edits compile in-place; no more CDN requests after first edit.
- Hero overlay: open `/`, get the cube or letter-drop, click Edit. Same lazy-load pattern applies.
- `pnpm --filter site build` succeeds, prerender completes, preview renders correctly.

## Out of scope (forthcoming spec)

- **Shared dependency chunks**: explicit `manualChunks` config (or equivalent) so three.js, cannon-es, solid-three load once and are reused across all snippet preview bundles. Today Vite handles some of this automatically via code-splitting on shared imports; the next spec audits and locks this in. This is the natural next step after the present spec ships.
