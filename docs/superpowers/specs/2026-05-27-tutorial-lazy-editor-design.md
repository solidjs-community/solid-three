# Lazy snippet compiler for tutorial Demo blocks

## Goal

Defer loading TypeScript and Babel (today fetched from esm.sh on every page that mounts a `<Demo>`) until the user actually edits a snippet. Initial preview is rendered in an iframe that loads a per-snippet ESM chunk emitted at build time. Visual UX is unchanged — tm-textarea is still always loaded, layout stays the same.

## Motivation

Each tutorial chapter mounts 3–5 `<Demo>` blocks. Today every Demo's iframe boots through `@bigmistqke/repl`, which immediately fetches the TypeScript compiler (~3 MB) and Babel + babel-preset-solid (~1.5 MB) from esm.sh — even when the visitor never edits. Most readers don't edit; they just look at the running snippet. Deferring those CDN imports until first edit removes the largest unconditional cost on tutorial pages.

A forthcoming spec will address sharing three.js / cannon-es / solid-three across snippet preview bundles via chunked output.

## Non-goals

- No tests for the Demo component (matches today).
- No change to the editor's behaviour after the user has started editing — repl + iframe + recompile-on-input stay identical.
- No change to the tm-textarea load — it stays mounted from the start.

## Architecture overview

Three coordinated changes:

1. **`@lightningjs/vite-plugin-import-chunk-url`** (a published Vite plugin recommended by Vite maintainers for exactly this use case — see [#14541](https://github.com/vitejs/vite/issues/14541)). Adds the `?importChunkUrl` query: in dev it piggybacks Vite's `?worker&url` URL handler; in build it uses `emitFile({ type: "chunk" })` so Rollup emits a real chunk and `import.meta.ROLLUP_FILE_URL_…` resolves to its final hashed URL.

2. **Single `Demo` component**, same file (`site/src/components/demo.tsx`). One iframe element throughout the component's lifetime. The iframe's `src` changes once: from a mode-A blob (importing the snippet's chunk URL) to a mode-B blob (today's repl-driven blob). The browser tears down mode A and loads mode B inside the same iframe element — no DOM swap.

3. **MDX usage updated** to import each snippet twice — once as `?raw` for the textarea, once as `?importChunkUrl` for the iframe's initial chunk URL. The 28 existing `<Demo>` call sites are updated.

Hero overlay reuses the same `Demo` component. To prevent the hero scene from running twice (once as the page-background `<LazyChosenScene>`, once inside the overlay iframe), hero hides the background scene whenever the overlay is open.

## Section 1 — `@lightningjs/vite-plugin-import-chunk-url`

Vite's built-in `?url` query doesn't work for source files in production (it emits the raw source as a `data:application/octet-stream;base64,…` URL — verified with a real build of this project). The canonical workaround, suggested in [vitejs/vite#14541](https://github.com/vitejs/vite/issues/14541), is [`@lightningjs/vite-plugin-import-chunk-url`](https://github.com/lightning-js/vite-plugin-import-chunk-url): a small plugin that handles both dev (piggybacks on Vite's existing `?worker&url` URL-handling) and build (`emitFile({ type: "chunk" })` + `import.meta.ROLLUP_FILE_URL_*`).

**Setup**:

```sh
pnpm --filter site add -D @lightningjs/vite-plugin-import-chunk-url
```

`site/vite.config.ts` — add the plugin alongside the existing custom plugins:

```ts
import { importChunkUrl } from "@lightningjs/vite-plugin-import-chunk-url"
// …
plugins: [
  importChunkUrl(),
  // …existing plugins
]
```

Add a triple-slash reference so the `?importChunkUrl` query string is recognised as a string-default-export by TypeScript. In `site/src/global.d.ts` (or a new `.d.ts` referenced from `tsconfig.json`):

```ts
/// <reference types="@lightningjs/vite-plugin-import-chunk-url/client" />
```

That declares:

```ts
declare module "*?importChunkUrl" {
  const src: string
  export default src
}
```

**Behavior**:

- **Dev**: `import url from "./foo.tsx?importChunkUrl"` rewrites to Vite's `?worker&url` handler — returns a same-origin URL that Vite serves the compiled source at.
- **Build**: `emitFile({ type: "chunk", id })` tells Rollup to treat the file as a separate entry; the rest of the Vite/Rollup plugin chain (including `vite-plugin-solid`) compiles it; the URL is replaced at the end of the build with the chunk's final hashed path.
- **Singleton consistency**: in both modes the snippet chunk's imports (solid-js, three, solid-three) resolve to the same chunks used by the rest of the site. The iframe loading the chunk same-origin imports those chunks directly — no duplicate runtimes.

## Section 2 — Demo component

`site/src/components/demo.tsx` keeps its file path. Props change:

```ts
export interface DemoProps {
  code: string
  url: string
}
```

State signals:

- `code: Accessor<string>` — initialised to `trimBlankLines(props.code)`. Tracks textarea content.
- `hasEdited: Accessor<boolean>` — one-way latch. Flips true on first textarea `onInput`. Never reverts.
- `iframeBusy: Accessor<boolean>` — drives the top-right loading indicator.

The iframe element is a single DOM node for the component's lifetime. Its `src` is derived from a memo:

```ts
const initialBootstrap = createMemo(() => buildInitialBootstrap(props.url, editorTheme()))
const replBootstrap = createMemo(() => fileUrls.get("/index.html"))

const iframeSrc = createMemo(() => hasEdited() ? replBootstrap() : initialBootstrap())
```

`initialBootstrap` is a blob URL built via `@bigmistqke/repl`'s `createFileUrlSystem` (or `URL.createObjectURL` over a hand-built HTML string — whichever ergonomically fits). Its document imports the snippet chunk URL and renders it.

`replBootstrap` is today's repl-driven blob — unchanged.

## Section 3 — Mode A bootstrap HTML

The mode-A iframe document needs to:
- Be same-origin with the parent (blob URLs inherit parent origin).
- Import the snippet's chunk URL.
- Call `render()` from `solid-js/web` using the SAME instance the snippet imports — i.e., the same Vite/Rollup chunk, not esm.sh.

Constraint: the lightning-js plugin only resolves relative paths (it uses `dirname(importer) + path`), not bare specifiers. So `"solid-js/web?importChunkUrl"` won't work directly. Solution: add a tiny first-party helper module that we own and can address by relative path.

`site/src/components/snippet-runtime.tsx`:

```ts
import type { Component } from "solid-js"
import { render } from "solid-js/web"

export function mount(Snippet: Component, root: HTMLElement): () => void {
  return render(() => <Snippet />, root)
}
```

Now both the snippet and the runtime are importable via `?importChunkUrl`. Vite/Rollup resolves the runtime's `solid-js/web` import through the normal chunk graph — the snippet's imports go through the same graph — so they share a runtime by construction.

```ts
import snippetRuntimeUrl from "./snippet-runtime.tsx?importChunkUrl"

function buildInitialBootstrap(snippetUrl: string, theme: "dark" | "light"): string {
  const html = `<!doctype html>
<html style="color-scheme: ${theme}">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
      canvas { display: block; }
    </style>
    <script>
      window.addEventListener("message", function (event) {
        if (!event.data || event.data.type !== "theme") return
        document.documentElement.style.colorScheme = event.data.value
      })
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import { mount } from ${JSON.stringify(snippetRuntimeUrl)}
      import Snippet from ${JSON.stringify(snippetUrl)}
      mount(Snippet, document.getElementById("root"))
    </script>
  </body>
</html>`
  return URL.createObjectURL(new Blob([html], { type: "text/html" }))
}
```

`onCleanup` revokes the blob URL.

`sandbox="allow-scripts allow-same-origin"` on the iframe ensures the blob URL inherits the parent origin so `/src/snippets/...` and `/_build/assets/...` fetches succeed.

## Section 4 — Lazy compiler load (mode B)

Replace today's `compiler` signal + `ensureCompilerLoaded` with a Solid `createResource` keyed on `hasEdited`:

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

`createResource`'s source returns `undefined` until `hasEdited` flips. The fetcher fires exactly once. The existing `tsxExtension.transform` accessor reads `compiler()` reactively; when defined, it produces real compiled output. While undefined (mode A or just-after-edit), it returns the existing placeholder — never reached during mode A because the iframe is loading the precompiled chunk URL instead.

`loadTypeScript` already exists; rename `getBabelTransformPromise` → `loadBabelTransform` for symmetry.

## Section 5 — Iframe src transition

When `hasEdited` flips:

1. `iframeSrc()` memo recomputes → returns `replBootstrap()`.
2. Iframe `src` attribute changes via Solid binding.
3. Browser tears down the mode-A document, loads the mode-B bootstrap. Brief blank period (<1s typically).
4. Mode-B bootstrap mounts repl machinery; `tsxExtension` waits for `compiler()` to resolve.
5. `createResource` fires, TS + Babel download from esm.sh.
6. Once `compiler()` defined, `tsxExtension` re-emits compiled snippet → file URL system re-emits HTML → iframe `src` updates again to the new repl blob URL.
7. Iframe `onLoad` fires → `iframeBusy` clears → loading indicator hides.

The same iframe DOM element is used throughout. The src attribute changes (twice during the transition: once mode A → mode B initial, once when compiler resolves) but the element isn't unmounted.

`onCleanup` revokes both blob URLs.

## Section 6 — Loading indicator

Top-right of the canvas pane. `iframeBusy()` is true:

- From `hasEdited` flip until the post-compiler iframe `onLoad` fires.
- From any subsequent code change until the iframe reloads with new compiled content.

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

The indicator is a CSS-only spinner overlaid top-right of `.demo-canvas-wrapper`.

## Section 7 — MDX migration

Every tutorial `<Demo>` call gets two static imports — one for raw source, one for the snippet chunk URL — and passes both props:

```mdx
- import createTSnippet from "../../snippets/01-create-t.tsx?raw"
+ import createTSnippet from "../../snippets/01-create-t.tsx?raw"
+ import createTUrl from "../../snippets/01-create-t.tsx?importChunkUrl"

- <Demo code={createTSnippet} />
+ <Demo code={createTSnippet} url={createTUrl} />
```

Files touched (9 chapter MDX files, ~28 `<Demo>` calls total): `01-your-first-scene.mdx` through `09-webgpu-peek.mdx`.

## Section 8 — Hero overlay

`hero.tsx` already passes `source` to `<LazyDemo code={source()} />`. Add the URL via the same `?importChunkUrl` query on the gallery scene:

```tsx
const [chosen, setChosen] = createSignal<Demo | undefined>()
…
<LazyDemo code={sourceText()} url={chosen()?.url ?? ""} />
```

`site/src/snippets/gallery/index.ts`'s `Demo` interface gains `url: string`, resolved at module init via:

```ts
const urls = import.meta.glob<string>("./*.tsx", {
  query: "?importChunkUrl",
  import: "default",
  eager: true,
})
```

**Avoiding scene duplication**: hero already direct-mounts the chosen scene as the page background. When the editor overlay opens, the overlay's iframe runs the same scene. Hide the background scene while the overlay is open:

```tsx
<Show when={!editorOpen()}>
  <div class="hero-canvas">
    <LazyChosenScene onPick={setChosen} />
  </div>
</Show>
```

Trade-off: the background unmounts on open and re-mounts on close — a brief WebGL context teardown. Acceptable since the overlay covers the area anyway.

## Section 9 — Risks and mitigations

**Cross-origin / sandbox**: `allow-same-origin` on the iframe is required so blob-URL bootstrap can fetch parent-origin `/src/...` and `/_build/assets/...` paths. Today's iframe already uses `allow-same-origin allow-scripts`; no change.

**Singleton consistency across modes**: mode A uses same-origin Vite chunks. Mode B uses esm.sh-pinned imports via importmap. They are TWO DIFFERENT documents inside the same iframe element — no cross-mode singleton sharing. The transition discards mode A entirely. Acceptable.

**Bootstrap → snippet runtime alignment in mode A**: both the snippet and `snippet-runtime.tsx` go through the plugin's `?importChunkUrl` path and through the normal Vite/Rollup chunk graph. The runtime's `solid-js/web` import and the snippet's `solid-js` imports resolve to the same chunks — singletons match.

**Plugin scope (relative paths only)**: the lightning-js plugin only resolves relative paths from the importer; bare specifiers don't work. Worked around by introducing `snippet-runtime.tsx` as a first-party helper.

**Site is on Vite 8, plugin tested against Vite 5**: the plugin's `peerDependencies` declares `vite: "*"`, but its README example uses Vite 5. The two underlying APIs the plugin relies on (`?worker&url` redirection in dev, `emitFile({ type: "chunk" })` + `ROLLUP_FILE_URL_*` in build) are stable Rollup/Vite primitives — should keep working on Vite 8. If it doesn't, options are: pin Vite version, fork the plugin into `site/vite-plugins/`, or open an issue upstream. Verify during implementation.

## Verification

Manual (no automated tests):

- `pnpm --filter site dev`, open a tutorial chapter. Confirm:
  - Snippets render visually identical to today.
  - DevTools Network: NO requests to `esm.sh/typescript@…` or `esm.sh/@babel*` on initial page load. tm-grammars / tm-themes still fire.
- Click into a textarea and type a character. Confirm:
  - Loading indicator appears.
  - Iframe content updates after the TS+Babel CDN imports complete.
  - Subsequent edits compile in-place; no more CDN requests.
- Hero overlay: open `/`, get a gallery scene, click Edit. Same lazy-load pattern; background scene unmounts while overlay open.
- `pnpm --filter site build` succeeds, prerender completes.
- `pnpm --filter site preview`, repeat all of the above against the production build. Verify the snippet chunks are emitted under `_build/assets/` and the iframe loads them successfully.

## Out of scope (forthcoming spec)

- **Shared dependency chunks**: explicit `manualChunks` config (or equivalent) so three.js, cannon-es, solid-three load once and are reused across all snippet preview bundles. Vite likely handles much of this automatically via code-splitting on shared imports; the next spec audits and locks this in.
