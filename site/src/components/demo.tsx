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

// Load Babel + babel-preset-solid lazily from esm.sh. We want the real Solid
// JSX transform (which compiles JSX to `_$template` / `_$insert` calls)
// rather than the React JSX runtime — Solid's `jsx-runtime` doesn't export a
// `jsx` function.
//
// TS syntax is stripped first via `ts.transpile` with `JsxEmit.Preserve` so
// Babel only has to worry about JSX. (`@babel/preset-typescript` requires a
// `filename` option that `babelTransform` doesn't forward, so doing the TS
// strip up-front sidesteps that.)
//
// The promise is created on first access (client-only) so SSR never triggers
// the CDN imports.

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
  // The iframe loads from a blob: URL, whose scheme isn't hierarchical and
  // can't resolve absolute-path module specifiers. Inlining a <base> tag
  // pinned to the parent origin lets `/src/...` paths resolve correctly.
  const origin = window.location.origin
  const absoluteRuntimeUrl = new URL(snippetRuntimeUrl, origin).toString()
  const absoluteSnippetUrl = new URL(snippetUrl, origin).toString()
  const html = `<!doctype html>
<html style="color-scheme: ${theme}">
  <head>
    <meta charset="utf-8" />
    <base href="${origin}/" />
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
      import { mount } from ${JSON.stringify(absoluteRuntimeUrl)}
      import Snippet from ${JSON.stringify(absoluteSnippetUrl)}
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
  editorHidden?: boolean
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

  // Mode-A blob URL. Previous blob is revoked whenever the memo
  // re-evaluates (e.g. on theme toggle) so we don't leak across re-runs.
  let previousInitialBootstrapUrl: string | undefined
  const initialBootstrapUrl = createMemo(() => {
    if (previousInitialBootstrapUrl) URL.revokeObjectURL(previousInitialBootstrapUrl)
    previousInitialBootstrapUrl = buildInitialBootstrap(props.url, editorTheme())
    return previousInitialBootstrapUrl
  })
  onCleanup(() => {
    if (previousInitialBootstrapUrl) URL.revokeObjectURL(previousInitialBootstrapUrl)
  })

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
      <Show when={isNarrow() && !props.editorHidden}>
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
        <Show when={!props.editorHidden && (!isNarrow() || pane() === "editor")}>
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
        <Show when={props.editorHidden || !isNarrow() || pane() === "canvas"}>
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
