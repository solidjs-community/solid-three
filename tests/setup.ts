import { afterEach, beforeEach, expect, vi } from "vitest"
import { cleanup } from "../src/testing/index.tsx"

// Patch console.warn to include a stack trace for "Signal was written to in an owned scope"
const _warn = console.warn.bind(console)
console.warn = (...args: any[]) => {
  _warn(...args)
  if (typeof args[0] === "string" && args[0].includes("Signal was written")) {
    console.trace("↑ stack trace for above warning")
  }
  if (typeof args[0] === "string" && args[0].includes("STRICT_READ_UNTRACKED")) {
    console.trace("↑ STRICT_READ_UNTRACKED stack trace")
  }
}

// Matches any @solidjs/signals diagnostic: [ALL_CAPS_CODE] message
const SIGNALS_WARNING = /^\[[A-Z][A-Z_]+\]/

let warnSpy: ReturnType<typeof vi.spyOn> | null = null

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn")
})

afterEach(() => {
  if (!warnSpy) return
  const warnings = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
  warnSpy.mockRestore()
  warnSpy = null
  const relevant = warnings.filter((w: string) => SIGNALS_WARNING.test(w))
  expect(relevant, `Dev warnings emitted during test:\n${relevant.join("\n")}`).toEqual([])
})

// Free WebGL contexts after each test. Browsers cap concurrent contexts
// (~16 in Chromium) — without this the suite crashes the page mid-run.
afterEach(() => cleanup())
