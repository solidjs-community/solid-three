import { createRoot, createSignal } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { CanvasProps } from "../../src/canvas.tsx"
import { createXR, type XRContext } from "../../src/create-xr.tsx"

// Compile-time only: narrowing connect's param to XRContext must keep it
// assignable to `<Canvas ref={xr.connect}>` (Context satisfies XRContext).
const _connectIsAssignableToCanvasRef: CanvasProps["ref"] = (_context: XRContext) => () => {}
void _connectIsAssignableToCanvasRef

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
  return { gl, render: vi.fn() } as unknown as XRContext & {
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
    } as unknown as XRContext
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
    const ctx = { gl, render: vi.fn() } as unknown as XRContext
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

describe("createXR — enter", () => {
  it("installs setAnimationLoop(render) before setSession (snapshot order)", async () => {
    setFakeNavigatorXR()
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    await xr.enter("immersive-vr")

    const loopOrder = ctx.gl.setAnimationLoop.mock.invocationCallOrder[0]
    const sessionOrder = ctx.gl.xr.setSession.mock.invocationCallOrder[0]
    expect(loopOrder).toBeLessThan(sessionOrder)
    expect(ctx.gl.setAnimationLoop).toHaveBeenCalledWith(ctx.render)
    expect(ctx.gl.xr.enabled).toBe(true)

    dispose()
  })

  it("calls requestSession before touching the renderer (transient activation)", async () => {
    const requestSession = vi.fn(async () => makeFakeSession())
    setFakeNavigatorXR(requestSession)
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    await xr.enter("immersive-vr")

    expect(requestSession.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.gl.setAnimationLoop.mock.invocationCallOrder[0],
    )

    dispose()
  })

  it("forwards mode + sessionInit verbatim to requestSession", async () => {
    const requestSession = vi.fn(async () => makeFakeSession())
    setFakeNavigatorXR(requestSession)
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    const init = { requiredFeatures: ["local-floor"], optionalFeatures: ["hand-tracking"] }
    await xr.enter("immersive-ar", init)

    expect(requestSession).toHaveBeenCalledWith("immersive-ar", init)

    dispose()
  })

  it("enter(session) wires a provided session without calling requestSession", async () => {
    const requestSession = vi.fn(async () => makeFakeSession())
    setFakeNavigatorXR(requestSession)
    const ctx = makeFakeContext()
    const session = makeFakeSession()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)

    await xr.enter(session)

    expect(requestSession).not.toHaveBeenCalled()
    expect(ctx.gl.xr.setSession).toHaveBeenCalledWith(session)
    expect(xr.session()).toBe(session)

    dispose()
  })

  it("throws a clear error when called before connect", async () => {
    setFakeNavigatorXR()
    const { xr, dispose } = renderXR()
    await expect(xr.enter("immersive-vr")).rejects.toThrow(/before .*connect/)
    dispose()
  })

  it("throws when navigator.xr is unavailable", async () => {
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)
    // The Chromium test runner has a native navigator.xr; shadow it with
    // undefined to exercise the unavailability guard.
    Object.defineProperty(navigator, "xr", { value: undefined, configurable: true })
    await expect(xr.enter("immersive-vr")).rejects.toThrow(/WebXR unavailable/)
    dispose()
  })
})

describe("createXR — exit & isSupported", () => {
  it("exit() ends the active session", async () => {
    const session = makeFakeSession()
    setFakeNavigatorXR(vi.fn(async () => session))
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)
    await xr.enter("immersive-vr")

    await xr.exit()
    expect(session.end).toHaveBeenCalledTimes(1)

    dispose()
  })

  it("exit() is a no-op when there is no active session", async () => {
    const ctx = makeFakeContext()
    const { xr, dispose } = renderXR()
    xr.connect(ctx)
    await expect(xr.exit()).resolves.toBeUndefined()
    dispose()
  })

  it("isSupported delegates to navigator.xr.isSessionSupported", async () => {
    const fake = setFakeNavigatorXR()
    const { xr, dispose } = renderXR()
    expect(await xr.isSupported("immersive-ar")).toBe(true)
    expect(fake.isSessionSupported).toHaveBeenCalledWith("immersive-ar")
    dispose()
  })

  it("isSupported returns false when navigator.xr is undefined", async () => {
    const { xr, dispose } = renderXR()
    // Native navigator.xr exists in the runner; shadow it with undefined.
    Object.defineProperty(navigator, "xr", { value: undefined, configurable: true })
    expect(await xr.isSupported("immersive-vr")).toBe(false)
    dispose()
  })
})

describe("createXR — public export", () => {
  it("is exported from the package entry", async () => {
    const entry = await import("../../src/index.ts")
    expect(typeof entry.createXR).toBe("function")
  })
})
