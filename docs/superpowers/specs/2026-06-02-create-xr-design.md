# `createXR`: a consumer-owned XR entry primitive — design

**Date:** 2026-06-02
**Area:** new `src/create-xr.tsx`, small edit to `src/canvas.tsx`, `src/index.ts`, `src/types.ts`
**Status:** design approved, pending spec review
**Depends on:** the XR frameloop decoupling (`docs/superpowers/specs/2026-05-29-xr-frameloop-decoupling-design.md`) — this is the consumer-side counterpart to that core change.

## Problem

The frameloop decoupling moved XR session ownership out of core: core no longer drives the WebXR loop, it only yields its window loop while `xr.isPresenting` is true and resumes on `sessionend`. The consumer now owns the wiring — and that wiring has two sharp edges they must get exactly right, or XR breaks silently.

**Edge 1 — the snapshot order.** `renderer.setAnimationLoop(render)` must be installed *before* `renderer.xr.setSession(session)`, because `WebGPURenderer`'s `XRManager` snapshots the animation loop at `setSession` time (`three.webgpu.js:54525`) rather than reading it live. Install it late — e.g. by reacting to `sessionstart` — and the WebGPU manager has already snapshotted the wrong loop; the headset hangs. This is the bug the decoupling diagnosed.

**Edge 2 — the double-drive after exit (newly identified).** Because three *snapshots* the loop on entry, it also *restores* it on exit: `onSessionEnd` runs `setAnimationLoop(_currentAnimationLoop); start()` (`three.webgpu.js:55012-55015`) before dispatching `sessionend` (`:55020`). If the consumer installed `context.render` as that loop, three now drives `context.render` every frame — and core's own `sessionend` resume listener *also* restarts its window loop driving `context.render`. Result: `context.render` fires twice per frame after the first XR exit, `getDelta()` returns a real delta on the first call and ~0 on the second, and every `useFrame` listener double-fires with a garbage delta. The documented raw contract (`setAnimationLoop` → `enabled` → `setSession`) does not mention cleanup, so it carries this latent bug.

**Edge 3 — transient activation.** Immersive `navigator.xr.requestSession` is gated on transient user activation (a time-boxed, ~5s, consumable window-global flag set by a user gesture). It must be the first thing the enter flow does, with nothing awaited before it — not because a single `await` is always fatal (transient activation is time-based, not task-bound), but because awaiting anything slow beforehand risks blowing past the window, Chromium's WebXR path has historically been stricter than the pure spec, and the chaining semantics are an open question upstream (immersive-web/webxr#779). Request-first is the only robust-across-engines ordering.

A correct consumer must get all three right, every time, and also bridge a structural gap: the renderer `Context` (which the wiring needs) is born inside `<Canvas>`, while the "Enter XR" button that triggers `enter()` is a DOM element *outside* it.

**Goal:** ship one small primitive that encapsulates all three edges and the structural gap, built entirely on solid-three's public surface — proving the decoupled contract is sufficient — so consumers cannot trip any of the edges.

## Key insight: pull the Context outward, don't push the control outward

There is exactly one hard constraint: the control logic needs `context.gl` and `context.render`, which exist only after `<Canvas>` mounts, but `enter()` is called from a DOM gesture handler outside Canvas. Reactivity is *not* the problem — `isPresenting()` is a signal and reads correctly anywhere it is referenced. The only thing to bridge is getting a `Context` handle to logic that lives outside Canvas.

Two directions bridge it:

1. **Pull the Context outward** — the XR logic lives outside Canvas; Canvas hands its `Context` out (via the `ref` it already exposes).
2. **Push the control outward** — the XR logic lives inside Canvas (where `useThree` works), and `enter`/`exit`/state are lifted out to the DOM by hand.

Direction 1 wins because when you pull the Context out, the control surface (`enter`, `exit`, `isPresenting`) is *already* in the outer scope where the button is. The thing threaded is the boring handle, not the interesting API. Direction 2 is the bridge-component boilerplate, awkward precisely because it hoists functions and signals out of a component manually.

So the primitive is: **the consumer creates the XR handle in their component, and Canvas connects its `Context` into it.**

```tsx
const xr = createXR()                       // signals live here, in the component's owner scope
<button onClick={() => xr.enter("immersive-vr")}>Enter VR</button>
<Canvas ref={xr.connect}>
  <Scene />
</Canvas>
```

No provider, no new Canvas prop, no `createSignal` juggling. The button closes over `xr` — the natural Solid idiom. In-scene needs (controller/hand poses) are already served by `useFrame((ctx, delta, frame) => …)`, whose `frame` the decoupling now forwards, so this primitive optimizes for the DOM-button + reactive-`isPresenting` case and does not over-invest in in-scene access. A provider can be layered on later without changing this core.

## Public API

`createXR()` is a Solid primitive, called in a component body (it owns one reactive effect, so it needs an owner — like `createSignal`). It is **not** named `useXR`: the `use*` hooks in this library (`useThree`, `useFrame`, `useLoader`) all throw outside `<Canvas>`, whereas this is created outside Canvas. `use*` is reserved for a future provider-reading hook.

```ts
const xr = createXR()

xr.connect              // Ref<XRContext> — pass to <Canvas ref={xr.connect}>; returns a cleanup
xr.enter(mode, init?)   // request a session + wire it           → Promise<XRSession>
xr.enter(session)       // escape hatch: wire a session you made  → Promise<XRSession>
xr.exit()               // end the active session                 → Promise<void>
xr.isPresenting()       // Accessor<boolean>  — driven by three's xr events
xr.session()            // Accessor<XRSession | undefined>
xr.isSupported(mode)    // Promise<boolean>   — thin guard over navigator.xr.isSessionSupported
```

Module: new `src/create-xr.tsx`, exported from `src/index.ts`. Built only on the public `Context` (`context.gl`, `context.render`) and the renderer's standard `xr` event target. No core internals, no WebGL-vs-WebGPU branching.

## Internals

### State and the single reactive effect

```ts
export function createXR() {
  const [context, setContext] = createSignal<Context>()
  const [presenting, setPresenting] = createSignal(false)
  const [session, setSession] = createSignal<XRSession>()

  // The only moving part. context.gl is a reactive getter (create-three.tsx:389),
  // so reading it here re-runs the effect on renderer swap; onCleanup detaches the
  // previous manager's listeners. Clearing context() (on Canvas unmount) cascades
  // through here to tear everything down.
  createRenderEffect(() => {
    const gl = context()?.gl
    const xr = gl?.xr
    if (!gl || !xr || typeof xr.addEventListener !== "function") return
    const onStart = () => setPresenting(true)
    const onEnd = () => {
      setPresenting(false)
      setSession(undefined)
      gl.setAnimationLoop(null)   // Edge 2: stop three re-driving context.render post-exit
      gl.xr.enabled = false        // symmetric: we set it on enter, we clear it here
    }
    xr.addEventListener("sessionstart", onStart)
    xr.addEventListener("sessionend", onEnd)
    onCleanup(() => {
      xr.removeEventListener("sessionstart", onStart)
      xr.removeEventListener("sessionend", onEnd)
    })
  })

  // ... connect / enter / exit / isSupported below ...

  return { connect, enter, exit, isSupported, isPresenting: presenting, session }
}
```

`isPresenting()` is driven by three's authoritative `sessionstart`/`sessionend` events (the decision over a hook-local boolean), so it reflects the renderer's actual state even if a session starts or ends outside `enter`/`exit`, and stays consistent with core's own `sessionend` listener. `session()` is the handle: set in `enter` once obtained, cleared on `sessionend`.

### `connect` — minimal `Ref<XRContext>` with a cleanup return

```ts
// XRContext = Pick<Context, "gl" | "render"> — the only fields createXR reads.
function connect(context: XRContext) {
  setContext(context)
  return () => setContext(undefined)   // Canvas unmount → clear → cascades teardown via the effect
}
```

`connect` does nothing but stash the context and hand back a disconnect. It reads no members itself; the effect and `enter`/`exit` read `context.gl`/`context.render` lazily. The parameter is narrowed to `XRContext` (`Pick<Context, "gl" | "render">`) so the type states the real dependency: `createXR` needs the renderer and solid-three's per-frame callback, nothing else. A full `Context` satisfies it, so `<Canvas ref={xr.connect}>` is unchanged — but `connect` isn't tied to `<Canvas>` or its ref; any `{ gl, render }` works. The single requirement `connect` imposes lands on `createXR`, not itself: the effect needs a reactive owner, so `createXR()` is a component-body primitive.

### `enter` — request-first, then snapshot-safe wiring

```ts
async function enter(arg: XRSessionMode | XRSession, init?: XRSessionInit): Promise<XRSession> {
  const ctx = context()
  if (!ctx) throw new Error("S3: createXR().enter() called before <Canvas ref={xr.connect}> connected")
  const gl = ctx.gl
  if (!gl?.xr) throw new Error("S3: active renderer has no xr manager")

  const session = typeof arg === "string"
    ? await requestSession(arg, init)   // Edge 3: FIRST. nothing awaited before this.
    : arg                                // escape hatch: activation was the caller's concern

  gl.setAnimationLoop(ctx.render)        // Edge 1: before setSession (the snapshot rule)
  gl.xr.enabled = true
  await gl.xr.setSession(session)         // three sets isPresenting=true → core's loop self-stops
  setSession(session)
  return session
}

function requestSession(mode: XRSessionMode, init?: XRSessionInit) {
  if (!navigator.xr) throw new Error("S3: WebXR unavailable (navigator.xr is undefined)")
  return navigator.xr.requestSession(mode, init)
}
```

`requestSession` is the only transient-activation-gated step, and it is first with nothing awaited before it. The post-request wiring is unconstrained by activation. `isSupported` (below) is the consumer's button-gating call and is **never** awaited inside `enter`.

### `exit` and `isSupported`

```ts
async function exit() {
  await session()?.end()   // fires sessionend → the effect's onEnd tears down; core resumes the window loop
}

function isSupported(mode: XRSessionMode): Promise<boolean> {
  return navigator.xr?.isSessionSupported(mode) ?? Promise.resolve(false)
}
```

`exit` only calls `end()`; all teardown flows through the `sessionend` listener, keeping one teardown path. `isSupported` is a thin guarded pass-through; consumers wrap it in `createResource` for reactive button gating.

## Canvas change (the only core edit)

`canvas.tsx` declares `ref?: Ref<Context>` (line 20) but **never invokes it** — the prop is currently dead. This design wires it, and widens it to allow an optional cleanup return (the React 19 cleanup-callback-ref shape):

```ts
// types: widen the ref beyond Solid's Ref<T> (= T | (val => void))
ref?: Context | ((context: Context) => void | (() => void))

// canvas.tsx, inside onMount, after `const context = createThree(canvas, props)`:
const cleanup = props.ref?.(context)
if (typeof cleanup === "function") onCleanup(cleanup)
```

`onCleanup` inside `onMount` registers on the component owner, firing on Canvas unmount. This is XR-blind — "a ref may return a cleanup" is a generic Canvas capability — and it fixes an existing dead prop so `ref<Context>` becomes functional for all consumers, not just XR.

## `forceWebGL`

Untouched, and deliberately invisible to the hook. Driving `WebGPURenderer` XR through a WebGL2 backend on three ≤ r184 is a `<Canvas gl={…}>` / renderer-config concern the consumer owns. The hook contains no backend detection and no dev warning — that would re-introduce the family-specific coupling the decoupling exists to remove. The r ≤ r184 limitation is documented, not enforced in code.

## Usage

DOM "Enter XR" button (the primary case):

```tsx
function App() {
  const xr = createXR()
  return (
    <>
      <button onClick={() => xr.enter("immersive-vr")}>Enter VR</button>
      <Show when={xr.isPresenting()}>
        <button onClick={() => xr.exit()}>Exit</button>
      </Show>
      <Canvas ref={xr.connect}>
        <Scene />
      </Canvas>
    </>
  )
}
```

AR with feature descriptors, support-gated:

```tsx
const xr = createXR()
const [supported] = createResource(() => xr.isSupported("immersive-ar"))

<Show when={supported()}>
  <button onClick={() => xr.enter("immersive-ar", {
    requiredFeatures: ["local-floor"],
    optionalFeatures: ["hand-tracking", "depth-sensing"],
  })}>Enter AR</button>
</Show>
```

In-scene (no `createXR` needed — `useFrame` forwards the `XRFrame`):

```tsx
function Player() {
  useFrame((ctx, delta, frame) => {
    if (!frame) return  // present only during an XR session
    // read XRFrame poses, move the rig, etc.
  })
  return null
}
```

## Testing

Browser mode (Playwright + Chromium, software WebGL via SwiftShader); jsdom unsupported; no headset. The real WebGPU `setSession` snapshot cannot be exercised here — that residual gap is the same one the decoupling carries, and correctness of the snapshot interaction rests on source reading, not E2E.

Tests, against a renderer with a writable `isPresenting` and a dispatchable `xr` event target (same surface the decoupling tests already use):

1. `enter(mode)` calls `setAnimationLoop` **before** `setSession` (order assertion — the Edge 1 guard).
2. `enter(mode)` calls `requestSession` before any `await` / before touching `gl` (Edge 3 guard).
3. `isPresenting()` / `session()` track dispatched `sessionstart` / `sessionend`.
4. `sessionend` calls `setAnimationLoop(null)` (Edge 2 — the double-render regression guard).
5. listeners detach and re-attach on renderer swap (the `context.gl` reactivity).
6. `enter(existingSession)` wires without calling `requestSession`.
7. `enter()` before connect throws the clear error.
8. Canvas invokes a cleanup-returning ref, and runs the returned cleanup on unmount (the Canvas edit).

## Decisions and rejected alternatives

- **`createXR()` object over `<XRProvider>` / `useXR(ctxAccessor)` / `<Canvas xr={…}>`.** The store-created-outside, connected-by-`ref` shape solves the DOM-button case with the least surface and keeps Canvas XR-blind. A provider (`useXR()` everywhere) and a dedicated `xr` prop are both viable sugar but were rejected for day one: the provider adds a wrapper + connect wire for in-scene access that `useFrame` largely already covers, and the dedicated prop is the one option that teaches core Canvas about XR.
- **Hook owns the full lifecycle, forwarding (not wrapping) `requestSession`.** `enter` passes `mode` + `sessionInit` straight to `navigator.xr.requestSession`, so the large, spec-churning feature surface is never modeled here. The pre-made-session overload covers the wire-only case without a second exported primitive.
- **Reactive state from three's `xr` events**, not a hook-local boolean, so it reflects true renderer state and stays consistent with core.
- **Renderer swap = reset**, no attempt to migrate a live session across renderers (impossible anyway); listeners re-attach via the `context.gl` reactive read.
- **No automatic, hook-free path.** Earlier analysis confirmed an `always`-mode-only auto-path is possible (core permanently holding `setAnimationLoop(context.render)`), but it re-breaks in `demand`/`never` modes and the only rescue re-couples core to divergent per-family loop semantics. Single explicit path chosen.
