import { afterEach } from "vitest"
import type { Renderer } from "../src/types.ts"
import { cleanup } from "../src/testing/index.tsx"

// Widen ResolvedRenderer to the full `Renderer` union for tests. The
// production default is `WebGLRenderer`, but several test suites build mock
// renderers that only satisfy `RendererLike` and pass them to `<Canvas gl>` —
// without widening, those mocks fail the WebGLRenderer constraint.
declare module "../src/types.ts" {
  interface Register {
    renderer: Renderer
  }
}

// Patch console.warn to include a stack trace for "Signal was written to in an owned scope"
const _warn = console.warn.bind(console)
console.warn = (...args: any[]) => {
  _warn(...args)
  if (typeof args[0] === "string" && args[0].includes("Signal was written")) {
    // console.trace is the whole point here: surface where the owned-scope write happened.
    // eslint-disable-next-line no-console
    console.trace("↑ stack trace for above warning")
  }
}

// Free WebGL contexts after each test. Browsers cap concurrent contexts
// (~16 in Chromium) — without this the suite crashes the page mid-run.
afterEach(() => cleanup())
