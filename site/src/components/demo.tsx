import {
  babelTransform,
  createFileUrlSystem,
  createHTMLExtension,
  PathUtils,
  transformModulePaths,
  type Extension,
} from "@bigmistqke/repl"
import { clientOnly } from "@solidjs/start"
import { createMemo, createRenderEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { isServer, NoHydration } from "solid-js/web"
import ts from "typescript"

// `tm-textarea` touches the DOM at import time, so it must only load
// client-side. `clientOnly` returns a Solid component that renders nothing
// on the server and dynamically imports the real one in the browser.
// The default CDN (https://esm.sh) routes /tm-themes/... and /tm-grammars/...
// to the corresponding npm packages, so no extra config is needed.
const TmTextarea = clientOnly(async () => {
  const solid = await import("tm-textarea/solid")
  return { default: solid.TmTextarea }
})

// SolidBase sets `data-theme="sdark"` or `data-theme="slight"` on <html>
// (with an "s" prefix). Mirror that into a signal so the editor's TextMate
// theme follows the site's light/dark mode.
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

// Pin versions for the externalized deps so all esm.sh modules share singletons.
const externalDepsParam = "external=solid-js,three&deps=solid-js@1.8,three@0.181,cannon-es@0.20"

/**
 * URL of the local solid-three bundle served by the Vite dev plugin. The
 * bundle keeps solid-js / solid-js/web / solid-js/store / three external so
 * the iframe's import map can pin them — this avoids singleton mismatches
 * between snippet code and solid-three internals.
 *
 * Resolved relative to the document so it works whether the tutorial is
 * served from / or a sub-path. Deferred until first access so this module is
 * safe to evaluate during SSR (where `window` is undefined).
 */
function getLocalSolidThreeUrl(): string {
  if (typeof window === "undefined") return "/@tutorial/solid-three.js"
  return new URL("/@tutorial/solid-three.js", window.location.href).toString()
}

/**
 * Map a bare specifier to a URL the iframe can load.
 *
 * solid-js and three are loaded as bare specifiers and resolved via an
 * import map in the host HTML — this keeps a single instance shared between
 * the user snippet, solid-three, and any other esm.sh modules.
 *
 * solid-three is served by the dev server as a local pre-bundled ESM file
 * so the iframe always reflects the current `src/` rather than the published
 * version on esm.sh.
 */
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
type SnippetTransform = (source: string, path: string) => string
let babelTransformPromise: Promise<SnippetTransform> | undefined
function getBabelTransformPromise(): Promise<SnippetTransform> {
  if (!babelTransformPromise) {
    babelTransformPromise = babelTransform({
      // @ts-expect-error @bigmistqke/repl types `presets` as `string[]`, but
      // Babel supports `[name, options]` tuples and we need to pass options.
      presets: [["babel-preset-solid", { generate: "dom", hydratable: false }]],
    })
  }
  return babelTransformPromise
}

function stripTypeScript(source: string): string {
  return ts.transpile(source, {
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
  })
}

function rewriteModulePaths({
  source,
  path,
  fileUrls,
}: {
  source: string
  path: string
  fileUrls: { get(path: string): string | undefined }
}): string {
  const apply = transformModulePaths({
    ts,
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

// Module-level signal that publishes the resolved Babel transform once the
// dynamic CDN imports settle. Created client-side on first call to
// `ensureBabelLoaded` so SSR never kicks off the network fetch.
const [babelSnippetTransform, setBabelSnippetTransform] = createSignal<
  SnippetTransform | undefined
>(undefined)
let babelLoadStarted = false
function ensureBabelLoaded(): void {
  if (babelLoadStarted) return
  babelLoadStarted = true
  getBabelTransformPromise()
    .then(transform => setBabelSnippetTransform(() => transform))
    .catch(error => {
      // Surface load failures in the host console; the iframe will remain
      // showing the placeholder empty module.
      console.error("[demo] Failed to load babel-preset-solid:", error)
    })
}

function errorModule(message: string): string {
  // A standalone module — no JSX, no babel — that renders a styled <pre>
  // showing the compile error. Returned in place of the user snippet when
  // babel/TypeScript fails, so the iframe stays alive while the user is
  // still typing.
  const escaped = JSON.stringify(message)
  return `export default function CompileError() {
  const node = document.createElement("pre")
  node.style.cssText = "color:#ff8080;background:#0a0c12;font-family:ui-monospace,monospace;font-size:0.85rem;padding:1rem;margin:0;height:100%;white-space:pre-wrap;overflow:auto;"
  node.textContent = ${escaped}
  return node
}
`
}

const tsxExtension: Extension = {
  type: "javascript",
  transform: ({ source, path, fileUrls }) => {
    ensureBabelLoaded()
    // Return an Accessor so the transformed source updates once Babel +
    // presets finish loading from the CDN.
    return () => {
      const transform = babelSnippetTransform()
      if (!transform) {
        // Babel not ready yet — emit a no-op default export so importers
        // (main.tsx) can still resolve; the file URL will be re-created when
        // Babel resolves and this accessor re-runs.
        return "export default function Placeholder() { return null }\n"
      }
      try {
        const stripped = stripTypeScript(source)
        const compiled = transform(stripped, path)
        return rewriteModulePaths({ source: compiled, path, fileUrls })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return errorModule("Compile error:\n\n" + message)
      }
    }
  },
}

const htmlExtension = createHTMLExtension({
  transformModule: ({ source, path, fileUrls }) =>
    transformModulePaths({
      ts,
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
    }),
})

function buildHostHtml(theme: "dark" | "light"): string {
  return `<!doctype html>
<html style="color-scheme: ${theme}">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
      canvas { display: block; }
    </style>
    <script>
      // Parent posts { type: "theme", value: "dark"|"light" } whenever the
      // site theme toggles. Mirror it into color-scheme so the browser uses
      // the right user-agent canvas behind any transparent body.
      // (Avoid && in this script — repl's HTML processor encodes & to &amp;.)
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

const bootstrapTsx = `import { render } from "solid-js/web"
import Component from "./snippet.tsx"

const root = document.getElementById("root")
if (root) {
  render(() => <Component />, root)
}
`

export interface DemoProps {
  code: string
}

export default function Demo(props: DemoProps) {
  // `@bigmistqke/repl` relies on DOMParser, which is unavailable in Node SSR.
  // Wrap the subtree in <NoHydration> so the client renders the real demo
  // fresh instead of trying to reconcile its DOM against the SSR placeholder
  // (which would otherwise produce a hydration-mismatch error).
  return (
    <NoHydration>
      {isServer ? <div class="demo" data-demo-placeholder="" /> : <DemoClient {...props} />}
    </NoHydration>
  )
}

function trimBlankLines(input: string): string {
  return input.replace(/^\n+|\n+$/g, "")
}

function DemoClient(props: DemoProps) {
  const initialCode = trimBlankLines(props.code)
  const [code, setCode] = createSignal(initialCode)
  const [pane, setPane] = createSignal<"canvas" | "editor">("canvas")
  const [isNarrow, setIsNarrow] = createSignal(false)
  const editorTheme = useSiteTheme()

  onMount(() => {
    const media = window.matchMedia("(max-width: 900px)")
    setIsNarrow(media.matches)
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches)
    media.addEventListener("change", handler)
    onCleanup(() => media.removeEventListener("change", handler))
  })

  function resetCode(): void {
    setCode(initialCode)
  }

  const fileUrls = createFileUrlSystem({
    readFile: path => {
      if (path === "/snippet.tsx") return code()
      if (path === "/index.html") return buildHostHtml(editorTheme())
      if (path === "/main.tsx") return bootstrapTsx
      return undefined
    },
    extensions: {
      tsx: tsxExtension,
      ts: tsxExtension,
      html: htmlExtension,
    },
  })

  const iframeSrc = createMemo(() => fileUrls.get("/index.html"))

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
              onInput={event => setCode(event.currentTarget.value)}
            />
            <Show when={code() !== initialCode}>
              <button type="button" class="demo-reset" onClick={resetCode}>
                Reset
              </button>
            </Show>
          </div>
        </Show>
        <Show when={!isNarrow() || pane() === "canvas"}>
          {(() => {
            let iframeRef: HTMLIFrameElement | undefined
            function postTheme() {
              iframeRef?.contentWindow?.postMessage({ type: "theme", value: editorTheme() }, "*")
            }
            createRenderEffect(() => {
              editorTheme() // track
              postTheme()
            })
            return (
              <iframe
                ref={iframeRef}
                class="demo-canvas"
                src={iframeSrc() ?? "about:blank"}
                sandbox="allow-scripts allow-same-origin"
                onLoad={postTheme}
              />
            )
          })()}
        </Show>
      </div>
    </div>
  )
}
