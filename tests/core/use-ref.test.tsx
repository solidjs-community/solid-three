import { createRoot } from "solid-js"
import { describe, expect, it, vi } from "vitest"
import type { CanvasProps } from "../../src/canvas.tsx"
import type { Context } from "../../src/types.ts"
import { useRef } from "../../src/utils.ts"

// Compile-time only: a cleanup-returning ref must be assignable to Canvas's ref.
// This line fails to typecheck if CanvasProps.ref was not widened.
const _cleanupRefIsAssignable: CanvasProps["ref"] = (_context: Context) => () => {}
void _cleanupRefIsAssignable

describe("useRef", () => {
  it("invokes a function ref with the value", () => {
    const ref = vi.fn()
    createRoot(dispose => {
      useRef<number>({ ref }, 42)
      dispose()
    })
    expect(ref).toHaveBeenCalledWith(42)
  })

  it("runs a ref's returned cleanup on dispose", () => {
    const cleanup = vi.fn()
    const ref = vi.fn(() => cleanup)
    const dispose = createRoot(d => {
      useRef<number>({ ref }, 42)
      return d
    })
    expect(cleanup).not.toHaveBeenCalled()
    dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("assigns to a non-function ref slot", () => {
    const props: { ref?: number } = {}
    createRoot(dispose => {
      useRef(props, 7)
      dispose()
    })
    expect(props.ref).toBe(7)
  })
})
