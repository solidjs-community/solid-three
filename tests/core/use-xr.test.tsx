import { createRoot } from "solid-js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createXR, useXR, type XRState } from "../../src/create-xr.tsx"

describe("useXR", () => {
  it("throws when used outside <xr.Provider>", () => {
    createRoot(dispose => {
      expect(() => useXR()).toThrow(/useXR must be used within/)
      dispose()
    })
  })
})

/* -------------------------------- fakes -------------------------------- */
// three's EventDispatcher dispatches plain `{ type }` objects and exposes
// add/removeEventListener — mirror that, not DOM EventTarget.
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
function makeFakeContext(gl = makeFakeGl()) {
  return { gl, render: vi.fn() } as any
}
function makeFakeSession() {
  return { end: vi.fn(async () => {}) } as unknown as XRSession
}
function setFakeNavigatorXR(requestSession = vi.fn(async () => makeFakeSession())) {
  const xr = { requestSession, isSessionSupported: vi.fn(async () => true) }
  Object.defineProperty(navigator, "xr", { value: xr, configurable: true, writable: true })
  return xr
}

// createXR owns an effect, so it must run in an owner. Render a Probe under the
// provider; `api` is captured synchronously when the JSX is created.
function renderUseXR(ctx = makeFakeContext()) {
  let api!: XRState
  let xr!: ReturnType<typeof createXR>
  const dispose = createRoot(d => {
    xr = createXR()
    xr.connect(ctx)
    function Probe() {
      api = useXR()
      return null
    }
    void (<xr.Provider><Probe /></xr.Provider>)
    return d
  })
  return {
    xr,
    ctx,
    get api() {
      return api
    },
    dispose,
  }
}

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "xr")
})

describe("createXR().Provider + useXR", () => {
  it("distributes reactive isPresenting to consumers under the provider", () => {
    const { ctx, api, dispose } = renderUseXR()
    expect(api.isPresenting()).toBe(false)
    ctx.gl.xr.dispatch("sessionstart")
    expect(api.isPresenting()).toBe(true)
    ctx.gl.xr.dispatch("sessionend")
    expect(api.isPresenting()).toBe(false)
    dispose()
  })

  it("exposes session() and exit() through useXR", async () => {
    const session = makeFakeSession()
    setFakeNavigatorXR(vi.fn(async () => session))
    const { xr, api, dispose } = renderUseXR()
    await xr.enter("immersive-vr")
    expect(api.session()).toBe(session)
    await api.exit()
    expect((session as unknown as { end: ReturnType<typeof vi.fn> }).end).toHaveBeenCalled()
    dispose()
  })
})

describe("package entry", () => {
  it("re-exports useXR from solid-three", async () => {
    const mod = await import("../../src/index.ts")
    expect(typeof mod.useXR).toBe("function")
  })
})
