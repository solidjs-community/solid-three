import { createRoot, createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createXR } from "../../src/create-xr.tsx"
import type { Context } from "../../src/types.ts"

/* -------------------------------- fakes -------------------------------- */

// three's EventDispatcher dispatches plain `{ type }` objects (not DOM Events),
// and exposes add/removeEventListener — mirror that, not DOM EventTarget.
function makeFakeXR() {
  const listeners: Record<string, Set<(e: { type: string }) => void>> = {}
  return {
    enabled: false,
    isPresenting: false,
    setSession: vi.fn(async (_session: XRSession) => {}),
    addEventListener: vi.fn((type: string, l: (e: { type: string }) => void) => {
      ;(listeners[type] ??= new Set()).add(l)
    }),
    removeEventListener: vi.fn((type: string, l: (e: { type: string }) => void) => {
      listeners[type]?.delete(l)
    }),
    dispatch(type: string) {
      listeners[type]?.forEach(l => l({ type }))
    },
  }
}

function makeFakeGl(xr = makeFakeXR()) {
  return { xr, setAnimationLoop: vi.fn() }
}

type FakeGl = ReturnType<typeof makeFakeGl>

function makeFakeContext(gl: FakeGl = makeFakeGl()) {
  return { gl, render: vi.fn() } as unknown as Context & {
    gl: FakeGl
    render: ReturnType<typeof vi.fn>
  }
}

function makeFakeSession() {
  return { end: vi.fn(async () => {}) } as unknown as XRSession
}

// createXR owns a reactive effect, so it must run in an owner. Keep the root
// alive across async enter() and return an explicit dispose.
function renderXR() {
  let xr!: ReturnType<typeof createXR>
  const dispose = createRoot(d => {
    xr = createXR()
    return d
  })
  return { xr, dispose }
}

// Stub navigator.xr (Chromium test runner has no WebXR).
function setFakeNavigatorXR(requestSession = vi.fn(async () => makeFakeSession())) {
  const xr = { requestSession, isSessionSupported: vi.fn(async () => true) }
  Object.defineProperty(navigator, "xr", { value: xr, configurable: true, writable: true })
  return xr
}

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "xr")
})

/* ------------------------------- tests --------------------------------- */

describe("createXR — state & wiring", () => {
  it("tracks isPresenting from sessionstart/sessionend", () => {
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    expect(xr.isPresenting()).toBe(false)
    ctx.gl.xr.dispatch("sessionstart")
    expect(xr.isPresenting()).toBe(true)
    ctx.gl.xr.dispatch("sessionend")
    expect(xr.isPresenting()).toBe(false)

    dispose()
  })

  it("nulls the animation loop and clears enabled on sessionend (no post-exit double render)", () => {
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    ctx.gl.xr.dispatch("sessionend")
    expect(ctx.gl.setAnimationLoop).toHaveBeenCalledWith(null)
    expect(ctx.gl.xr.enabled).toBe(false)

    dispose()
  })

  it("re-attaches listeners on renderer swap and detaches the old", () => {
    const first = makeFakeGl()
    const second = makeFakeGl()
    const [gl, setGl] = createSignal<FakeGl>(first)
    const ctx = {
      get gl() {
        return gl()
      },
      render: vi.fn(),
    } as unknown as Context
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    expect(first.xr.addEventListener).toHaveBeenCalledWith("sessionstart", expect.any(Function))

    setGl(second)
    expect(first.xr.removeEventListener).toHaveBeenCalledWith("sessionstart", expect.any(Function))
    expect(second.xr.addEventListener).toHaveBeenCalledWith("sessionstart", expect.any(Function))

    dispose()
  })

  it("does not crash for an xr manager lacking addEventListener", () => {
    const gl = { xr: { enabled: false }, setAnimationLoop: vi.fn() }
    const ctx = { gl, render: vi.fn() } as unknown as Context
    const { xr, dispose } = renderXR()
    expect(() => xr.connect(ctx)).not.toThrow()
    dispose()
  })

  it("connect returns a disconnect that clears the context", () => {
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    const disconnect = xr.connect(ctx)
    disconnect()
    expect(ctx.gl.xr.removeEventListener).toHaveBeenCalledWith("sessionstart", expect.any(Function))
    dispose()
  })
})
