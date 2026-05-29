# Lazy Tutorial Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Defer loading TypeScript and Babel from esm.sh until the user actually edits a snippet. Initial Demo preview renders in an iframe that loads a per-snippet ESM chunk emitted via `@lightningjs/vite-plugin-import-chunk-url`.

**Architecture:** A single `Demo` component owns one iframe element throughout its lifetime. A memo computes `iframeSrc` from a `hasEdited` latch: false → a blob URL whose HTML imports the snippet's chunk URL directly (no TS, no Babel); true → today's repl-managed blob URL. The compiler (TS + Babel) is gated behind a `createResource` that only fires once `hasEdited` flips true. A first-party helper `snippet-runtime.tsx` bridges Solid's `render()` so the iframe bootstrap and the snippet share a single solid-js runtime via the same Vite/Rollup chunk graph.

**Tech Stack:** Vite 8, SolidStart 2, `@lightningjs/vite-plugin-import-chunk-url`, `@bigmistqke/repl`, MDX.

**Source spec:** [`docs/superpowers/specs/2026-05-27-tutorial-lazy-editor-design.md`](../specs/2026-05-27-tutorial-lazy-editor-design.md)

**Note on testing:** The site has no automated tests for Demo behaviour today, and the spec keeps it that way. Each task ends with a concrete manual verification (browser, DevTools, or a build command) plus a commit. **Commit only after verification passes.**

---

## File map

- **Create**: `site/src/components/snippet-runtime.tsx` — `mount(Snippet, root)` helper.
- **Modify**: `site/src/components/demo.tsx` — gain `url` prop, `hasEdited` latch, mode-A blob bootstrap, `createResource`-gated compiler load.
- **Modify**: `site/src/snippets/gallery/index.ts` — `Demo` interface gains `url: string`.
- **Modify**: `site/src/components/hero.tsx` — pass `url`, hide background scene while overlay open.
- **Modify**: `site/vite.config.ts` — register `importChunkUrl()` plugin.
- **Modify**: `site/src/global.d.ts` — triple-slash reference for plugin types.
- **Modify**: `site/src/theme/style.css` — `.demo-loading` spinner + `.demo-canvas-wrapper`.
- **Modify**: 9 tutorial MDX files in `site/src/routes/tutorial/`.
- **Modify**: `site/package.json` — new devDependency.

The plan keeps `site/src/components/demo.tsx` as a single file. No extraction of a separate `ReplIframe` component — the spec mandates one iframe element with a reactive `src` driven by `hasEdited`, which is simplest expressed inline.

---

## Task 1: Install plugin and verify it works end-to-end

Validate the `?importChunkUrl` path in both dev and build before depending on it anywhere else.

**Files:**
- Modify: `site/package.json` (add devDependency)
- Modify: `site/vite.config.ts` (register plugin)
- Modify: `site/src/global.d.ts` (add client types reference)
- Temporary: `site/src/components/__chunk-url-probe.tsx` (test, deleted before commit)

- [ ] **Step 1: Install the plugin**

```bash
pnpm --filter site add -D @lightningjs/vite-plugin-import-chunk-url
```

Expected: package.json shows the new devDependency.

- [ ] **Step 2: Add the plugin import and call in `site/vite.config.ts`**

At the top of the existing import block:

```ts
import { importChunkUrl } from "@lightningjs/vite-plugin-import-chunk-url"
```

In the `plugins: [...]` array, add `importChunkUrl()` as the FIRST entry:

```ts
plugins: [
  importChunkUrl(),
  // ...existing plugins unchanged
],
```

- [ ] **Step 3: Add the client types reference**

At the top of `site/src/global.d.ts`, add:

```ts
/// <reference types="@lightningjs/vite-plugin-import-chunk-url/client" />
```

This declares `*?importChunkUrl` modules so TS recognises the query.

- [ ] **Step 4: Write a probe to verify both dev and build behavior**

Create `site/src/components/__chunk-url-probe.tsx`:

```tsx
import probeUrl from "../snippets/01-create-t.tsx?importChunkUrl"

export default function ChunkUrlProbe() {
  return (
    <div style={{ padding: "1rem", "font-family": "monospace" }}>
      <strong>?importChunkUrl probe:</strong>
      <pre>{probeUrl}</pre>
    </div>
  )
}
```

- [ ] **Step 5: Mount the probe temporarily on the home route**

Find the home route file: `find site/src/routes -maxdepth 2 -name 'index.*'`.

Add at the bottom of that file:

```mdx
import ChunkUrlProbe from "../components/__chunk-url-probe"

<ChunkUrlProbe />
```

If the file isn't MDX, render `<ChunkUrlProbe />` at the bottom of its returned JSX.

- [ ] **Step 6: Verify dev behavior**

Run: `pnpm --filter site dev`

Open the home route in a browser. Expected: the probe block shows a same-origin URL like `/src/snippets/01-create-t.tsx`. In DevTools → Network, the URL responds 200 with `Content-Type: text/javascript` and body containing `_$createComponent` (not raw TSX).

Stop dev.

- [ ] **Step 7: Verify build behavior**

Run: `pnpm --filter site build`

Search the output:

```bash
ls site/.output/public/_build/assets/ | grep "01-create"
```

Expected: a file like `01-create-t-<hash>.js`.

Run: `pnpm --filter site preview`. Open the home route. Expected: the probe URL points to `/_build/assets/01-create-t-<hash>.js`. In DevTools the URL responds 200 with compiled JS (NOT a `data:application/octet-stream` URL).

Stop preview.

- [ ] **Step 8: Remove the probe**

```bash
rm site/src/components/__chunk-url-probe.tsx
```

Remove the import and `<ChunkUrlProbe />` from the home route file.

- [ ] **Step 9: Commit**

```bash
git add site/package.json site/pnpm-lock.yaml site/vite.config.ts site/src/global.d.ts
git commit -m "feat(site): install @lightningjs/vite-plugin-import-chunk-url"
```

---

## Task 2: Add the `snippet-runtime.tsx` first-party helper

The iframe bootstrap can't import `solid-js/web` via `?importChunkUrl` directly (plugin only handles relative paths). This helper bridges that — see spec section 3.

**Files:**
- Create: `site/src/components/snippet-runtime.tsx`

- [ ] **Step 1: Create the file with this exact content**

```tsx
import { render } from "solid-js/web"
import type { Component } from "solid-js"

export function mount(Snippet: Component, root: HTMLElement): () => void {
  return render(() => <Snippet />, root)
}
```

- [ ] **Step 2: Verify it type-checks**

From `site/`: `CI=true pnpm exec tsc --noEmit 2>&1 | grep "snippet-runtime" || echo "no errors in snippet-runtime"`

Expected: "no errors in snippet-runtime".

- [ ] **Step 3: Commit**

```bash
git add site/src/components/snippet-runtime.tsx
git commit -m "feat(site): add snippet-runtime helper for iframe bootstrap"
```

---

## Task 3: Refactor `demo.tsx` — `url` prop, `hasEdited` latch, dual-mode iframe src

The whole behavioural change happens in this single file: Demo gains a `url` prop, a `hasEdited` latch, a mode-A blob URL that imports the snippet's chunk directly, and `createResource`-gated compiler load. The iframe element is constant; only its `src` attribute changes.

**Files:**
- Modify: `site/src/components/demo.tsx`

This task is intricate but localised. The full replacement file content is below.

- [ ] **Step 1: Read the current `demo.tsx`**

Run: `cat site/src/components/demo.tsx`

Confirm it matches the structure you remember — the existing `compiler` signal at module scope, `ensureCompilerLoaded`, the `tsxExtension`/`htmlExtension` declarations, the `DemoClient` body with `createFileUrlSystem` and inline iframe rendering.

- [ ] **Step 2: Replace `site/src/components/demo.tsx` with this exact content**

```tsx
import {
  babelTransform,
  createFileUrlSystem,
  createHTMLExtension,
  PathUtils,
  transformModulePaths,
  type Extension,
} from "@bigmistqke/repl"
import { clientOnly } from "@solidjs/start"
import {
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import type ts from "typescript"
import snippetRuntimeUrl from "./snippet-runtime.tsx?importChunkUrl"

// Load TypeScript from an ESM CDN on first use. Behind clientOnly at the
// import site, so this only runs in the browser. The createResource below
// is what actually decides when this fires — not earlier.
let tsPromise: Promise<typeof ts> | undefined
function loadTypeScript(): Promise<typeof ts> {
  if (!tsPromise) {
    const url = "https://esm.sh/typescript@5.9"
    tsPromise = import(/* @vite-ignore */ url).then(mod => (mod.default ?? mod) as typeof ts)
  }
  return tsPromise
}

type SnippetTransform = (source: string, path: string) => string

let babelTransformPromise: Promise<SnippetTransform> | undefined
function loadBabelTransform(): Promise<SnippetTransform> {
  if (!babelTransformPromise) {
    babelTransformPromise = babelTransform({
      // @ts-expect-error @bigmistqke/repl types `presets` as `string[]`, but
      // Babel supports `[name, options]` tuples and we need to pass options.
      presets: [["babel-preset-solid", { generate: "dom", hydratable: false }]],
    })
  }
  return babelTransformPromise
}

const TmTextarea = clientOnly(async () => {
  const solid = await import("tm-textarea/solid")
  return { default: solid.TmTextarea }
})

function useSiteTheme(): () => "dark" | "light" {
  const [isDark, setIsDark] = createSignal(false)
  onMount(() => {
    const root = document.documentElement
    const read = () => setIsDark((root.dataset.theme ?? "").includes("dark"))
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] })
    onCleanup(() => observer.disconnect())
  })
  return () => (isDark() ? "dark" : "light")
}

const externalEsmHost = "https://esm.sh"
const externalDepsParam = "external=solid-js,three&deps=solid-js@1.8,three@0.181,cannon-es@0.20"

function getLocalSolidThreeUrl(): string {
  if (typeof window === "undefined") return "/@tutorial/solid-three.js"
  return new URL("/@tutorial/solid-three.js", window.location.href).toString()
}

function resolveBareSpecifier(specifier: string): string {
  if (
    specifier === "solid-js" ||
    specifier === "three" ||
    specifier === "three/webgpu" ||
    specifier === "three/tsl"
  ) {
    return specifier
  }
  if (specifier === "solid-three") {
    return getLocalSolidThreeUrl()
  }
  if (specifier.startsWith("solid-js/")) {
    return `${externalEsmHost}/${specifier}?${externalDepsParam}`
  }
  return `${externalEsmHost}/${specifier}?${externalDepsParam}`
}

function stripTypeScript(tsModule: typeof ts, source: string): string {
  return tsModule.transpile(source, {
    jsx: tsModule.JsxEmit.Preserve,
    target: tsModule.ScriptTarget.ESNext,
    module: tsModule.ModuleKind.ESNext,
  })
}

function rewriteModulePaths({
  tsModule,
  source,
  path,
  fileUrls,
}: {
  tsModule: typeof ts
  source: string
  path: string
  fileUrls: { get(path: string): string | undefined }
}): string {
  const apply = transformModulePaths({
    ts: tsModule,
    source,
    transform: modulePath => {
      if (modulePath.startsWith(".") || modulePath.startsWith("/")) {
        return fileUrls.get(PathUtils.resolvePath(path, modulePath)) ?? modulePath
      }
      if (PathUtils.isUrl(modulePath)) {
        return modulePath
      }
      return resolveBareSpecifier(modulePath)
    },
  })
  return apply()
}

interface Compiler {
  babelTransform: SnippetTransform
  tsModule: typeof ts
}

function errorModule(message: string): string {
  const escaped = JSON.stringify(message)
  return `export default function CompileError() {
  const node = document.createElement("pre")
  node.style.cssText = "color:#ff8080;background:#0a0c12;font-family:ui-monospace,monospace;font-size:0.85rem;padding:1rem;margin:0;height:100%;white-space:pre-wrap;overflow:auto;"
  node.textContent = ${escaped}
  return node
}
`
}

function buildReplHostHtml(theme: "dark" | "light"): string {
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
    <script type="importmap">
      {
        "imports": {
          "solid-js": "https://esm.sh/solid-js@1.8",
          "solid-js/web": "https://esm.sh/solid-js@1.8/web?external=solid-js",
          "solid-js/jsx-runtime": "https://esm.sh/solid-js@1.8/jsx-runtime?external=solid-js",
          "solid-js/jsx-dev-runtime": "https://esm.sh/solid-js@1.8/jsx-dev-runtime?external=solid-js",
          "three": "https://esm.sh/three@0.181",
          "three/webgpu": "https://esm.sh/three@0.181/webgpu?external=three",
          "three/tsl": "https://esm.sh/three@0.181/tsl?external=three",
          "three/": "https://esm.sh/three@0.181/"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`
}

const replBootstrapTsx = `import { render } from "solid-js/web"
import Component from "./snippet.tsx"

const root = document.getElementById("root")
if (root) {
  render(() => <Component />, root)
}
`

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

function trimBlankLines(input: string): string {
  return input.replace(/^\n+|\n+$/g, "")
}

export interface DemoProps {
  code: string
  url: string
}

export default function Demo(props: DemoProps) {
  return <DemoClient {...props} />
}

function DemoClient(props: DemoProps) {
  const initialCode = trimBlankLines(props.code)
  const [code, setCode] = createSignal(initialCode)
  const [hasEdited, setHasEdited] = createSignal(false)
  const [pane, setPane] = createSignal<"canvas" | "editor">("canvas")
  const [isNarrow, setIsNarrow] = createSignal(false)
  const [iframeBusy, setIframeBusy] = createSignal(true)
  const editorTheme = useSiteTheme()

  onMount(() => {
    const media = window.matchMedia("(max-width: 900px)")
    setIsNarrow(media.matches)
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches)
    media.addEventListener("change", handler)
    onCleanup(() => media.removeEventListener("change", handler))
  })

  // Mode-A blob URL: built once per (url, theme) pair. Revoked on dispose.
  const initialBootstrapUrl = createMemo(() => buildInitialBootstrap(props.url, editorTheme()))
  onCleanup(() => URL.revokeObjectURL(initialBootstrapUrl()))

  // Mode-B compiler: only fires once `hasEdited` flips true.
  const [compiler] = createResource(
    () => (hasEdited() ? true : undefined),
    async () => {
      const [babelTransformFn, tsModule] = await Promise.all([
        loadBabelTransform(),
        loadTypeScript(),
      ])
      return { babelTransform: babelTransformFn, tsModule } as Compiler
    },
  )

  const tsxExtension: Extension = {
    type: "javascript",
    transform: ({ source, path, fileUrls }) => {
      return () => {
        const c = compiler()
        if (!c) return "export default function Placeholder() { return null }\n"
        try {
          const stripped = stripTypeScript(c.tsModule, source)
          const compiled = c.babelTransform(stripped, path)
          return rewriteModulePaths({ tsModule: c.tsModule, source: compiled, path, fileUrls })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return errorModule("Compile error:\n\n" + message)
        }
      }
    },
  }

  const htmlExtension = createHTMLExtension({
    transformModule: ({ source, path, fileUrls }) => {
      return () => {
        const c = compiler()
        if (!c) return source
        return rewriteModulePaths({ tsModule: c.tsModule, source, path, fileUrls })
      }
    },
  })

  const fileUrls = createFileUrlSystem({
    readFile: path => {
      if (path === "/snippet.tsx") return code()
      if (path === "/index.html") return buildReplHostHtml(editorTheme())
      if (path === "/main.tsx") return replBootstrapTsx
      return undefined
    },
    extensions: {
      tsx: tsxExtension,
      ts: tsxExtension,
      html: htmlExtension,
    },
  })

  const replBootstrapUrl = createMemo(() => fileUrls.get("/index.html"))

  const iframeSrc = createMemo(() => {
    return hasEdited() ? (replBootstrapUrl() ?? "about:blank") : initialBootstrapUrl()
  })

  let iframeRef: HTMLIFrameElement | undefined
  function postTheme(): void {
    iframeRef?.contentWindow?.postMessage({ type: "theme", value: editorTheme() }, "*")
  }
  createRenderEffect(() => {
    editorTheme() // track
    postTheme()
  })
  createRenderEffect(() => {
    iframeSrc() // track
    setIframeBusy(true)
  })

  function resetCode(): void {
    setCode(initialCode)
  }

  return (
    <div class="demo" classList={{ "demo-narrow": isNarrow() }}>
      <Show when={isNarrow()}>
        <div class="demo-tabs">
          <button
            type="button"
            onClick={() => setPane("canvas")}
            classList={{ active: pane() === "canvas" }}
          >
            Canvas
          </button>
          <button
            type="button"
            onClick={() => setPane("editor")}
            classList={{ active: pane() === "editor" }}
          >
            Editor
          </button>
        </div>
      </Show>
      <div class="demo-panes">
        <Show when={!isNarrow() || pane() === "editor"}>
          <div class="demo-editor-wrapper">
            <TmTextarea
              class="demo-editor"
              grammar="tsx"
              theme={editorTheme() === "dark" ? "github-dark" : "github-light"}
              value={code()}
              editable
              onInput={event => {
                setCode(event.currentTarget.value)
                setHasEdited(true)
              }}
            />
            <Show when={code() !== initialCode}>
              <button type="button" class="demo-reset" onClick={resetCode}>
                Reset
              </button>
            </Show>
          </div>
        </Show>
        <Show when={!isNarrow() || pane() === "canvas"}>
          <div class="demo-canvas-wrapper">
            <iframe
              ref={iframeRef}
              class="demo-canvas"
              src={iframeSrc()}
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => {
                setIframeBusy(false)
                postTheme()
              }}
            />
            <Show when={iframeBusy()}>
              <div class="demo-loading" aria-label="Loading preview" />
            </Show>
          </div>
        </Show>
      </div>
    </div>
  )
}
```

Key points about this rewrite vs the original:

- `getBabelTransformPromise` is renamed `loadBabelTransform` for symmetry with `loadTypeScript`.
- Module-scope `compiler` signal + `ensureCompilerLoaded` + `compilerLoadStarted` are removed. Replaced by per-instance `createResource` keyed on `hasEdited`.
- `tsxExtension` and `htmlExtension` are now declared inside `DemoClient` so they close over the per-instance `compiler` resource.
- A new `initialBootstrapUrl` memo builds the mode-A blob.
- The textarea `onInput` flips `hasEdited` true (in addition to updating `code`).
- The `iframeSrc` memo picks between mode A and mode B blobs based on `hasEdited`.
- One `<iframe>` element in the JSX, `src={iframeSrc()}` — same DOM node throughout the component's lifetime.
- A loading-indicator `<div class="demo-loading">` overlays the iframe while `iframeBusy()` is true.

- [ ] **Step 3: Type-check**

From `site/`: `CI=true pnpm exec tsc --noEmit 2>&1 | grep "src/components/demo" || echo "no errors in demo.tsx"`

Expected: "no errors in demo.tsx".

If TS complains about `?importChunkUrl` not being a known module declaration, Task 1's triple-slash reference in `global.d.ts` wasn't picked up — verify it's saved correctly.

- [ ] **Step 4: Update ONE MDX call site to test the new path**

Edit `site/src/routes/tutorial/01-your-first-scene.mdx`. Find:

```mdx
import createTSnippet from "../../snippets/01-create-t.tsx?raw"
```

Add immediately after:

```mdx
import createTUrl from "../../snippets/01-create-t.tsx?importChunkUrl"
```

Find the `<Demo code={createTSnippet} />` call and change to:

```mdx
<Demo code={createTSnippet} url={createTUrl} />
```

- [ ] **Step 5: Verify dev**

Run: `pnpm --filter site dev`. Open `/tutorial/01-your-first-scene`. Open DevTools → Network tab. Reload.

Expected on initial load:
- Snippet renders inside the iframe (rotating box with normal-material).
- **No** requests to `esm.sh/typescript@5.9` or `esm.sh/@babel*` packages.
- Requests for `/src/snippets/01-create-t.tsx` and `/src/components/snippet-runtime.tsx` are visible.

Click into the editor textarea and type a character. Expected:
- Loading indicator briefly appears.
- Network shows `esm.sh/typescript@5.9` and `esm.sh/babel-preset-solid` (plus dependencies) firing.
- Iframe reloads showing the edit.

Stop dev.

- [ ] **Step 6: Verify build**

Run: `pnpm --filter site build`. Expected: build succeeds.

Inspect: `ls site/.output/public/_build/assets/ | grep "01-create"` → expect a chunk file.

Run: `pnpm --filter site preview`. Open `/tutorial/01-your-first-scene`. Repeat the Network verification against the production build.

Stop preview.

- [ ] **Step 7: Commit**

```bash
git add site/src/components/demo.tsx site/src/routes/tutorial/01-your-first-scene.mdx
git commit -m "feat(site/demo): defer ts/babel until first edit via importChunkUrl"
```

---

## Task 4: Add loading indicator CSS

The indicator and canvas-wrapper class are referenced in Task 3. Add the styles.

**Files:**
- Modify: `site/src/theme/style.css`

- [ ] **Step 1: Locate the demo styles**

Run: `grep -n "demo-canvas\|demo-editor" site/src/theme/style.css | head -10`

Find the section that styles `.demo-canvas` or its siblings.

- [ ] **Step 2: Append the new styles**

Append to `site/src/theme/style.css`:

```css
.demo-canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.demo-loading {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: rgba(120, 120, 120, 0.5);
  pointer-events: none;
  animation: demo-loading-pulse 1s ease-in-out infinite;
}

@keyframes demo-loading-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
```

If `.demo-canvas-wrapper` is already styled elsewhere, only add the `.demo-loading` and `@keyframes` blocks.

- [ ] **Step 3: Verify visually**

Run: `pnpm --filter site dev`. Open `/tutorial/01-your-first-scene`. In DevTools, throttle network to "Slow 3G" to slow down CDN imports. Type a character into the textarea.

Expected: a small pulsing dot in the top-right of the preview pane during the edit→iframe-reload window; disappears once the iframe loads.

Stop dev.

- [ ] **Step 4: Commit**

```bash
git add site/src/theme/style.css
git commit -m "feat(site/demo): style the editor loading indicator"
```

---

## Task 5: Update the remaining 8 tutorial MDX files

Apply the same `?raw` + `?importChunkUrl` two-import pattern to each `<Demo>` call across the other 8 chapters. 27 call sites total (one already done in Task 3).

**Files:**
- Modify: `site/src/routes/tutorial/02-props-and-children.mdx` (5 Demos)
- Modify: `site/src/routes/tutorial/03-control-flow.mdx` (5 Demos)
- Modify: `site/src/routes/tutorial/04-pointer-events.mdx` (4 Demos)
- Modify: `site/src/routes/tutorial/05-use-frame.mdx` (3 Demos)
- Modify: `site/src/routes/tutorial/06-loaders-and-resource.mdx` (2 Demos)
- Modify: `site/src/routes/tutorial/07-portal.mdx` (2 Demos)
- Modify: `site/src/routes/tutorial/08-tetris.mdx` (3 Demos)
- Modify: `site/src/routes/tutorial/09-webgpu-peek.mdx` (3 Demos)

- [ ] **Step 1: Audit each file**

For a quick view of every Demo call site and its current `?raw` imports:

```bash
for file in site/src/routes/tutorial/0{2,3,4,5,6,7,8,9}*.mdx; do
  echo "=== $file ==="
  grep -E "tsx\\?raw|<Demo " "$file"
done
```

- [ ] **Step 2: For each MDX file, apply the same transformation as Task 3 Step 4**

For every existing `?raw` import, add a parallel `?importChunkUrl` import (suffix `Url`):

```mdx
import buttonToggleSnippet from "../../snippets/02-button-toggle.tsx?raw"
import buttonToggleUrl from "../../snippets/02-button-toggle.tsx?importChunkUrl"
```

For every `<Demo code={X} />` call, add `url={...Url}`:

```mdx
- <Demo code={buttonToggleSnippet} />
+ <Demo code={buttonToggleSnippet} url={buttonToggleUrl} />
```

Work file-by-file. After each file, run from `site/`:

```bash
CI=true pnpm exec tsc --noEmit 2>&1 | grep -E "tutorial/0[2-9]" || echo "no errors in tutorial files"
```

Resolve any errors before moving to the next file.

- [ ] **Step 3: Verify all chapters in dev**

Run: `pnpm --filter site dev`. Visit each chapter (`/tutorial/01-your-first-scene` through `/tutorial/09-webgpu-peek`).

For each:
- Snippets render identically to before.
- DevTools Network: NO `esm.sh/typescript` or `esm.sh/@babel` requests on initial chapter load.
- Typing into any snippet's textarea triggers the loading indicator. CDN requests fire exactly once across the whole tab's session (subsequent edits don't re-download).

Stop dev.

- [ ] **Step 4: Commit**

```bash
git add site/src/routes/tutorial/
git commit -m "feat(site/tutorial): pass importChunkUrl for every Demo"
```

---

## Task 6: Update hero overlay

Hero overlay shares the same `Demo` component. Gallery's `Demo` interface needs `url`, and `hero.tsx` needs to pass it + hide the background scene while the overlay is open.

**Files:**
- Modify: `site/src/snippets/gallery/index.ts`
- Modify: `site/src/components/hero.tsx`

- [ ] **Step 1: Read the current `gallery/index.ts`**

Run: `cat site/src/snippets/gallery/index.ts`. Note the existing `Demo` interface shape (`{ id, load, loadSource }`).

- [ ] **Step 2: Add the URL glob and field**

Edit `site/src/snippets/gallery/index.ts`. Add a new glob alongside the existing ones:

```ts
const urls = import.meta.glob<string>("./*.tsx", {
  query: "?importChunkUrl",
  import: "default",
  eager: true,
})
```

Add `url: string` to the `Demo` interface:

```ts
export interface Demo {
  id: string
  load: () => Promise<{ default: Component }>
  loadSource: () => Promise<string>
  url: string
}
```

Update the `demos` array construction:

```ts
export const demos: Demo[] = Object.keys(modules)
  .sort()
  .map(path => {
    const id = path.match(/\.\/(.+)\.tsx$/)?.[1]
    if (!id) throw new Error(`gallery: unexpected path ${path}`)
    const loadSource = sources[path]
    const url = urls[path]
    if (!loadSource) throw new Error(`gallery: missing raw source for ${path}`)
    if (!url) throw new Error(`gallery: missing chunk url for ${path}`)
    return { id, load: modules[path], loadSource, url }
  })
```

- [ ] **Step 3: Update `hero.tsx`**

Read `site/src/components/hero.tsx`. Two edits:

**(a)** Wrap the existing `<div class="hero-canvas">…</div>` block in a `<Show when={!editorOpen()}>`:

```tsx
<Show when={!editorOpen()}>
  <div class="hero-canvas">
    <LazyChosenScene onPick={setChosen} />
  </div>
</Show>
```

**(b)** Pass `url` to the editor:

```tsx
<Show when={editorOpen() && source()}>
  {sourceText => (
    <div class="hero-editor-overlay">
      <LazyDemo code={sourceText()} url={chosen()?.url ?? ""} />
    </div>
  )}
</Show>
```

If `chosen()?.url` typing complains, the `chosen()` accessor returns `Demo | undefined`. The `?? ""` handles the undefined case; the `editorOpen() && source()` guard above ensures `chosen()` is defined whenever the overlay renders, so the empty string fallback is unreachable in practice.

- [ ] **Step 4: Type-check**

From `site/`: `CI=true pnpm exec tsc --noEmit 2>&1 | grep -E "(hero|gallery/index)" || echo "no errors"`

Expected: "no errors".

- [ ] **Step 5: Verify dev**

Run: `pnpm --filter site dev`. Open `/`. Reload a few times until you see a gallery scene (cube or letter-drop). Click the Edit button.

Expected:
- Background scene unmounts (you see the editor overlay only).
- Editor textarea + iframe render. Iframe shows the same scene running inside it.
- DevTools Network: NO `esm.sh/typescript` or `esm.sh/@babel` requests yet.
- Type a character. Loading indicator appears. CDN requests fire. Iframe recompiles with the edit.
- Close the editor. Background scene re-mounts.

Stop dev.

- [ ] **Step 6: Commit**

```bash
git add site/src/snippets/gallery/index.ts site/src/components/hero.tsx
git commit -m "feat(site/hero): wire overlay to lazy editor, hide background while open"
```

---

## Task 7: Final whole-site verification

End-to-end check.

**Files:** none modified.

- [ ] **Step 1: Type-check the whole site**

From `site/`: `CI=true pnpm exec tsc --noEmit 2>&1 | grep -E "^src/" | grep -v "^src/snippets/09-webgpu" | grep -v "^src/solid-three.d.ts"`

Expected: no output. (Pre-existing baseline errors in webgpu snippets and `solid-three.d.ts` are excluded.)

- [ ] **Step 2: Dev server smoke test**

Run: `pnpm --filter site dev`. Open `/`. Reload until each gallery scene appears at least once. Click Edit on each, confirm CDN load + edit cycle.

Visit each tutorial chapter (01 through 09). For each chapter:
- Snippets render (no broken canvases).
- On initial load, DevTools shows NO `esm.sh/typescript@5.9` or `esm.sh/@babel*` requests.
- Editing any snippet triggers the CDN requests exactly once for the session, then no more.

Stop dev.

- [ ] **Step 3: Production build**

Run: `pnpm --filter site build`. Expected: build succeeds. Pre-existing prerender warnings (e.g. about the deferred `esm.sh/typescript@5.9` import being external) are fine — that's the lazy CDN import working as designed.

- [ ] **Step 4: Production preview**

Run: `pnpm --filter site preview`. Open the printed URL. Repeat the dev checks against the production bundle.

Verify the snippet chunks exist as `_build/assets/<snippet>-<hash>.js` and that the iframe in mode A loads them successfully (HTTP 200, `Content-Type: text/javascript`, real compiled output — NOT a `data:application/octet-stream` URL).

- [ ] **Step 5: No commit needed — verification only**

If any step failed, return to the relevant task and fix before declaring done.

---

## Out of scope (tracked in spec)

- Shared dependency chunking (three / cannon-es / solid-three across snippet chunks) — separate forthcoming spec.
- No automated tests.
- No UX changes beyond what's described.
