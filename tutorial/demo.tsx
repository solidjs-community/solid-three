import {
  createFileUrlSystem,
  createHTMLExtension,
  PathUtils,
  transformModulePaths,
  type Extension,
} from "@bigmistqke/repl"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import ts from "typescript"

const externalEsmHost = "https://esm.sh"

// Pin versions for the externalized deps so all esm.sh modules share singletons.
const externalDepsParam = "external=solid-js,three&deps=solid-js@1.8,three@0.181"

/**
 * URL of the local solid-three bundle served by the Vite dev plugin. The
 * bundle keeps solid-js / solid-js/web / solid-js/store / three external so
 * the iframe's import map can pin them — this avoids singleton mismatches
 * between snippet code and solid-three internals.
 *
 * Resolved relative to the document so it works whether the tutorial is
 * served from / or a sub-path.
 */
const localSolidThreeUrl = new URL(
  "/@tutorial/solid-three.js",
  window.location.href,
).toString()

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
  if (specifier === "solid-js" || specifier === "three") {
    return specifier
  }
  if (specifier === "solid-three") {
    return localSolidThreeUrl
  }
  if (specifier.startsWith("solid-js/")) {
    return `${externalEsmHost}/${specifier}?${externalDepsParam}`
  }
  return `${externalEsmHost}/${specifier}?${externalDepsParam}`
}

const tsxExtension: Extension = {
  type: "javascript",
  transform: ({ source, path, fileUrls }) => {
    const transpiled = ts.transpile(source, {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    })
    // Run a second pass to compile JSX (preserve -> react-jsx-ish via solid).
    // We use Solid's JSX compilation by post-processing through TypeScript's
    // JSX=react-jsx mode targeting solid-js/h, which is good enough for the
    // tutorial snippets that lean on <T.mesh /> style proxies.
    const jsxCompiled = ts.transpile(transpiled, {
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: "solid-js",
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    })
    return transformModulePaths({
      ts,
      source: jsxCompiled,
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

const hostHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; }
      canvas { display: block; }
    </style>
    <script type="importmap">
      {
        "imports": {
          "solid-js": "https://esm.sh/solid-js@1.8?bundle",
          "solid-js/web": "https://esm.sh/solid-js@1.8/web?external=solid-js&bundle",
          "solid-js/jsx-runtime": "https://esm.sh/solid-js@1.8/jsx-runtime?external=solid-js&bundle",
          "solid-js/jsx-dev-runtime": "https://esm.sh/solid-js@1.8/jsx-dev-runtime?external=solid-js&bundle",
          "three": "https://esm.sh/three@0.181?bundle"
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

const bootstrapTsx = `import { render } from "solid-js/web"
import Component from "./snippet.tsx"

const root = document.getElementById("root")
if (root) {
  render(() => <Component />, root)
}
`

export interface DemoProps {
  code: string
  id?: string
}

const STORAGE_PREFIX = "solid-three-tutorial-demo:"

function hashString(input: string): string {
  let hash = 0
  for (let index = 0; index < input.length; index++) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return hash.toString(36)
}

function storageKey(props: DemoProps): string {
  return STORAGE_PREFIX + (props.id ?? hashString(props.code))
}

export function Demo(props: DemoProps) {
  const initialCode = (): string => {
    try {
      const stored = localStorage.getItem(storageKey(props))
      return stored ?? props.code
    } catch {
      return props.code
    }
  }

  const [code, setCode] = createSignal(initialCode())
  const [pane, setPane] = createSignal<"canvas" | "editor">("canvas")
  const [isNarrow, setIsNarrow] = createSignal(false)

  onMount(() => {
    const media = window.matchMedia("(max-width: 900px)")
    setIsNarrow(media.matches)
    const handler = (event: MediaQueryListEvent) => setIsNarrow(event.matches)
    media.addEventListener("change", handler)
    onCleanup(() => media.removeEventListener("change", handler))
  })

  function updateCode(next: string): void {
    setCode(next)
    try {
      localStorage.setItem(storageKey(props), next)
    } catch {
      // ignore quota errors
    }
  }

  function resetCode(): void {
    try {
      localStorage.removeItem(storageKey(props))
    } catch {
      // ignore
    }
    setCode(props.code)
  }

  const files: Record<string, string> = {
    "/index.html": hostHtml,
    "/main.tsx": bootstrapTsx,
  }

  const fileUrls = createFileUrlSystem({
    readFile: path => {
      if (path === "/snippet.tsx") return code()
      return files[path]
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
          <textarea
            class="demo-editor"
            spellcheck={false}
            value={code()}
            onInput={event => updateCode(event.currentTarget.value)}
          />
        </Show>
        <Show when={!isNarrow() || pane() === "canvas"}>
          <iframe
            class="demo-canvas"
            src={iframeSrc() ?? "about:blank"}
            sandbox="allow-scripts"
          />
        </Show>
      </div>
      <div class="demo-controls">
        <button type="button" onClick={resetCode}>
          Reset
        </button>
      </div>
    </div>
  )
}
