import {
  type Accessor,
  createContext,
  createRenderEffect,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"
import type { Context } from "./types.ts"

/**
 * The in-scene XR state distributed by `createXR().Provider` and read by
 * [`useXR`](#useXR). It is the read/control slice scene code needs — not the
 * full `createXR` instance, whose `connect`/`enter` are meaningless in-scene.
 */
export type XRState = {
  isPresenting: Accessor<boolean>
  session: Accessor<XRSession | undefined>
  exit: () => Promise<void>
}

const xrContext = createContext<XRState>()

/**
 * Reads the XR state supplied by `createXR().Provider`. Use it in a scene
 * component (descendant of `<xr.Provider>`) to react to session state or drive
 * in-world UI — e.g. a mesh whose `onClick` calls `exit()`, since the DOM exit
 * button is not rendered while an immersive session is presenting.
 *
 * @throws if used outside a `<xr.Provider>`.
 */
export function useXR(): XRState {
  const state = useContext(xrContext)
  if (!state) {
    throw new Error("S3: useXR must be used within <xr.Provider> (from createXR())")
  }
  return state
}

/**
 * What `createXR` needs from a scene to drive a session: the renderer (`gl`) and
 * solid-three's per-frame callback (`render`, installed as the XR animation
 * loop). A full [`Context`](./types.ts) satisfies it, so the usual wiring is
 * `<Canvas ref={xr.connect}>` — but `connect` isn't tied to `<Canvas>` or its
 * ref; any `{ gl, render }` works.
 */
export type XRContext = Pick<Context, "gl" | "render">

/**
 * The structural slice of a renderer that `createXR` drives. WebGLRenderer's
 * `WebXRManager` and WebGPURenderer's `XRManager` expose the same runtime XR
 * surface but with differently-typed event maps, so their union is not callable
 * (`addEventListener` has no compatible combined signature). Narrowing to this
 * slice sidesteps that — the same tactic `create-three.tsx` uses for its own
 * `sessionend` listener (`gl as { xr?: EventTarget }`).
 */
type XRRenderer = {
  setAnimationLoop(callback: ((time: number, frame?: XRFrame) => void) | null): void
  xr: {
    enabled: boolean
    setSession(session: XRSession): Promise<void>
    addEventListener(type: string, listener: () => void): void
    removeEventListener(type: string, listener: () => void): void
  }
}

/**
 * Consumer-owned WebXR entry primitive. Call it in a component body (it owns a
 * reactive effect), then connect it to the renderer with
 * `<Canvas ref={xr.connect}>`. It absorbs the three sharp edges of the
 * decoupled XR contract:
 *   1. `setAnimationLoop(render)` is installed BEFORE `setSession` — required by
 *      WebGPURenderer's XRManager, which snapshots the loop at setSession time.
 *   2. `setAnimationLoop(null)` on `sessionend` — stops three re-driving
 *      `context.render` after exit (which, alongside core's resumed window loop,
 *      would double-render every frame).
 *   3. `requestSession` is called first, with nothing awaited before it, to keep
 *      the immersive request inside transient user activation.
 *
 * Built only on the public [`XRContext`](#XRContext) (`gl` + `render`) and the
 * renderer's `xr` event target — no core internals, no WebGL-vs-WebGPU branching.
 */
export function createXR() {
  const [context, setContext] = createSignal<XRContext>()
  const [presenting, setPresenting] = createSignal(false)
  const [session, setSession] = createSignal<XRSession>()

  // `context.gl` is a reactive getter, so this re-runs on renderer swap;
  // onCleanup detaches the previous manager's listeners. Clearing context()
  // (via connect's disconnect) cascades through here to tear everything down.
  createRenderEffect(() => {
    const ctx = context()
    const gl = ctx ? (ctx.gl as unknown as XRRenderer) : undefined
    const xr = gl?.xr
    if (!gl || !xr || typeof xr.addEventListener !== "function") return
    const onStart = () => setPresenting(true)
    const onEnd = () => {
      setPresenting(false)
      setSession(undefined)
      gl.setAnimationLoop(null) // edge 2: stop three re-driving render post-exit
      gl.xr.enabled = false
    }
    xr.addEventListener("sessionstart", onStart)
    xr.addEventListener("sessionend", onEnd)
    onCleanup(() => {
      xr.removeEventListener("sessionstart", onStart)
      xr.removeEventListener("sessionend", onEnd)
    })
  })

  function connect(value: XRContext) {
    setContext(value)
    return () => setContext(undefined)
  }

  function requestSession(mode: XRSessionMode, init?: XRSessionInit) {
    if (!navigator.xr) {
      throw new Error("S3: WebXR unavailable (navigator.xr is undefined)")
    }
    return navigator.xr.requestSession(mode, init)
  }

  async function enter(arg: XRSessionMode | XRSession, init?: XRSessionInit): Promise<XRSession> {
    const ctx = context()
    if (!ctx) {
      throw new Error("S3: createXR().enter() called before <Canvas ref={xr.connect}> connected")
    }
    const gl = ctx.gl as unknown as XRRenderer
    if (!gl.xr) {
      throw new Error("S3: the active renderer has no xr manager")
    }

    // Edge 3: requestSession FIRST — nothing awaited before it (transient activation).
    const xrSession = typeof arg === "string" ? await requestSession(arg, init) : arg

    // Edge 1: setAnimationLoop(render) BEFORE setSession (WebGPU snapshots here).
    gl.setAnimationLoop(ctx.render)
    gl.xr.enabled = true
    await gl.xr.setSession(xrSession)
    setSession(xrSession)
    return xrSession
  }

  async function exit() {
    // Ending the session fires `sessionend`; the listener effect does all teardown.
    await session()?.end()
  }

  function isSupported(mode: XRSessionMode): Promise<boolean> {
    return navigator.xr?.isSessionSupported(mode) ?? Promise.resolve(false)
  }

  return { connect, enter, exit, isSupported, isPresenting: presenting, session }
}
