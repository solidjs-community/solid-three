import { afterEach } from "vitest"
import { cleanup } from "../src/testing/index.tsx"

// Patch console.warn to include a stack trace for "Signal was written to in an owned scope"
const _warn = console.warn.bind(console)
console.warn = (...args: any[]) => {
  _warn(...args)
  if (typeof args[0] === "string" && args[0].includes("Signal was written")) {
    console.trace("↑ stack trace for above warning")
  }
}

// Free WebGL contexts after each test. Browsers cap concurrent contexts
// (~16 in Chromium) — without this the suite crashes the page mid-run.
afterEach(() => cleanup())
