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

1. **Custom Vite plugin** at `site/vite-plugins/snippet-bundle.ts` resolves `?snippet-bundle` queries to URLs of per-snippet ESM chunks. In dev: returns the same-origin Vite-served URL. In build: uses `this.emitFile({ type: "chunk" })` so Rollup emits a real chunk and `import.meta.ROLLUP_FILE_URL_…` resolves to its final hashed URL.

2. **Single `Demo` component**, same file (`site/src/components/demo.tsx`). One iframe element throughout the component's lifetime. The iframe's `src` changes once: from a mode-A blob (importing the snippet's chunk URL) to a mode-B blob (today's repl-driven blob). The browser tears down mode A and loads mode B inside the same iframe element — no DOM swap.

3. **MDX usage updated** to import each snippet twice — once as `?raw` for the textarea, once as `?snippet-bundle` for the iframe's initial chunk URL. The 28 existing `<Demo>` call sites are updated.

Hero overlay reuses the same `Demo` component. To prevent the hero scene from running twice (once as the page-background `<LazyChosenScene>`, once inside the overlay iframe), hero hides the background scene whenever the overlay is open.

## Section 1 — Custom Vite plugin

`site/vite-plugins/snippet-bundle.ts`:

```ts
import { relative, sep } from "node:path"
import type { Plugin, ResolvedConfig } from "vite"

const QUERY = "?snippet-bundle"

export function snippetBundlePlugin(): Plugin {
  let config: ResolvedConfig | undefined
  return {
    name: "solid-three:snippet-bundle",
    configResolved(c) {
      config = c
    },
    async resolveId(id, importer) {
      if (!id.endsWith(QUERY)) return null
      const bare = id.slice(0, -QUERY.length)
      const resolved = await this.resolve(bare, importer, { skipSelf: true })
      if (!resolved) return null
      return resolved.id + QUERY
    },
    load(id) {
      if (!id.endsWith(QUERY)) return null
      if (!config) throw new Error("snippet-bundle: config not resolved")
      const realPath = id.slice(0, -QUERY.length)
      if (config.command === "serve") {
        const relPath = relative(config.root, realPath).split(sep).join("/")
        return `export default ${JSON.stringify("/" + relPath)}`
      }
      const refId = this.emitFile({
        type: "chunk",
        id: realPath,
        preserveSignature: "exports-only",
      })
      return `export default import.meta.ROLLUP_FILE_URL_${refId}`
    },
  }
}
```

Wire it into `site/vite.config.ts` alongside the existing custom plugins.

**Dev behavior**: the `load` for `?snippet-bundle` returns the URL Vite would already serve the `.tsx` at (e.g. `/src/snippets/01-create-t.tsx`). Vite's normal transform pipeline (including `vite-plugin-solid`) handles compilation when the iframe fetches that URL.

**Build behavior**: `emitFile({ type: "chunk", id })` tells Rollup to treat the snippet as a separate entry point. Rollup compiles it through the same plugin pipeline (so `vite-plugin-solid` applies), bundles its imports, and emits a hashed chunk. `import.meta.ROLLUP_FILE_URL_<refId>` is replaced at the end of the build with the chunk's final URL.

**Singleton consistency**: in both dev and build, the snippet chunk's imports (solid-js, three, solid-three) resolve to the same chunks used by the rest of the site. The iframe loading the chunk same-origin imports those chunks directly — no duplicate runtimes.

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
- Call `render()` from `solid-js/web` using the SAME instance the snippet imports — i.e., via a same-origin Vite-served path, not esm.sh.

Approach: also expose a `solid-js/web` URL via the same plugin (handles bare specifiers). The plugin's `resolveId` already calls `this.resolve(bare, importer)`, which works for bare specifiers too, so `import solidWebUrl from "solid-js/web?snippet-bundle"` resolves correctly.

```ts
import solidWebUrl from "solid-js/web?snippet-bundle"

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
      import { render } from ${JSON.stringify(solidWebUrl)}
      import Component from ${JSON.stringify(snippetUrl)}
      render(() => Component(), document.getElementById("root"))
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
+ import createTUrl from "../../snippets/01-create-t.tsx?snippet-bundle"

- <Demo code={createTSnippet} />
+ <Demo code={createTSnippet} url={createTUrl} />
```

Files touched (9 chapter MDX files, ~28 `<Demo>` calls total): `01-your-first-scene.mdx` through `09-webgpu-peek.mdx`.

## Section 8 — Hero overlay

`hero.tsx` already passes `source` to `<LazyDemo code={source()} />`. Add the URL via the same `?snippet-bundle` query on the gallery scene:

```tsx
const [chosen, setChosen] = createSignal<Demo | undefined>()
…
<LazyDemo code={sourceText()} url={chosen()?.url ?? ""} />
```

`site/src/snippets/gallery/index.ts`'s `Demo` interface gains `url: string`, resolved at module init via:

```ts
const urls = import.meta.glob<string>("./*.tsx", {
  query: "?snippet-bundle",
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

**Vite plugin emit-time behavior in dev**: `emitFile({ type: "chunk" })` is build-only. The `config.command === "serve"` branch handles dev by returning the source URL directly. Verified via test fetch in dev that the URL resolves to compiled JS.

**Cross-origin / sandbox**: `allow-same-origin` on the iframe is required so blob-URL bootstrap can fetch parent-origin `/src/...` and `/_build/assets/...` paths. Today's iframe already uses `allow-same-origin allow-scripts`; no change.

**Singleton consistency across modes**: mode A uses same-origin Vite chunks. Mode B uses esm.sh-pinned imports via importmap. They are TWO DIFFERENT documents inside the same iframe element — no cross-mode singleton sharing. The transition discards mode A entirely. Acceptable.

**Bootstrap → snippet runtime alignment in mode A**: bootstrap and snippet both import `solid-js/web` via the same `?snippet-bundle` plugin path. Plugin resolves both to the same underlying file. Singletons match.

**Build chunk emit for bare specifiers**: when `?snippet-bundle` is used on a bare specifier like `solid-js/web`, the plugin's `this.resolve` returns the resolved node_modules path, and `emitFile({ type: "chunk", id })` emits a chunk for it. This duplicates `solid-js/web` into a separate chunk just for the iframe bootstrap to import. Vite's default chunking will keep it small (the same export the rest of the site uses). To avoid duplication, alternative: at build time the plugin emits a separate "snippet runtime" shim — but the small overhead from a duplicate `solid-js/web` chunk is acceptable for v1.

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
