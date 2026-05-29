# Decouple XR from the render loop: design

**Date:** 2026-05-29
**Area:** `src/create-three.tsx`, `src/utils.ts`, `src/types.ts`
**Status:** design approved, pending spec review

## Problem

solid-three currently tries to *manage* the WebXR session lifecycle internally: it
auto-connects `sessionstart`/`sessionend` listeners and, on `sessionstart`, toggles
`renderer.setAnimationLoop(handleXRFrame)` to take over the frame loop
(`create-three.tsx:133-166`).

This breaks on `WebGPURenderer`. The two three.js renderer families wire the XR frame
callback completely differently:

| | `WebGLRenderer` (`WebXRManager`) | `WebGPURenderer` (`XRManager`) |
|---|---|---|
| `renderer.setAnimationLoop(cb)` | live + XR-aware: also calls `xr.setAnimationLoop(cb)` (three.module.js:16600) | dumb: only sets `renderer._animation` (three.webgpu.js:57227) |
| how the XR frame callback is captured | `xr.setAnimationLoop` stores it live — settable any time | `setSession` **snapshots** `renderer._animation.getAnimationLoop()` at call time (three.webgpu.js:54525), then installs its own `_onAnimationFrame` wrapper |
| per-frame XR work | `WebXRManager.onAnimationFrame` binds the XR framebuffer, then calls the stored cb | `_onAnimationFrame` does `setOutputRenderTarget(xrRenderTarget)` (54...), then calls the snapshot (`_currentAnimationLoop`, 55242) |

Because solid-three installs its loop **after** `setSession` (on the `sessionstart`
event, which three dispatches *after* the snapshot at 54663-54665), the WebGPU manager
has already snapshotted the wrong loop, and solid-three's later
`renderer.setAnimationLoop(...)` overwrites the manager's own `_onAnimationFrame`. The
result: `setOutputRenderTarget(xrRenderTarget)` never runs, `gl.render` draws to the
default target, the XR layer is never submitted → "Not all layers submitted" every frame
+ headset hang.

r3f has the same gap: it toggles `gl.xr.setAnimationLoop` on `sessionstart`, but the
WebGPU `XRManager` has no `setAnimationLoop` method at all (verified on three r184 and
`dev`). Its v10 branch casts to `any` and would throw at runtime. No released r3f
supports WebGPU-backend XR.

## Key insight

There is exactly **one rule that satisfies both renderer families**, derived from three's
source (not from r3f):

> Call `renderer.setAnimationLoop(advance)` **before** `setSession`.

- `WebGLRenderer`: routes `advance` into the live `xr.setAnimationLoop` immediately.
- `WebGPURenderer`: `advance` is on `renderer._animation` when `setSession` snapshots it,
  so it becomes `_currentAnimationLoop` and is wrapped by `_onAnimationFrame`.

Whoever owns "enter XR" is the natural place to obey this rule — and that is the
**consumer**, because they own the AR/VR button (`navigator.xr.requestSession` →
`renderer.xr.setSession`). solid-three never sees that call, which is precisely why
reacting to `sessionstart` is always too late.

**Decision: hand the XR wiring to the consumer.** solid-three core stops managing the XR
lifecycle and shrinks to a single responsibility: *don't double-drive the frame loop
while a session is presenting.*

## Design goal: insulate core from diverging, moving-target renderer semantics

The deeper motivation is not this one bug — it is that **`WebGLRenderer` and
`WebGPURenderer` expose XR through two separately-evolving managers whose exact semantics
diverge and are still actively changing.** The current breakage is just the first place
that divergence surfaced. Evidence the WebGPU XR surface is a live moving target:

- The classic `WebXRManager` (WebGL) is mature and live-routed; the common `XRManager`
  (WebGPU) is newer, snapshot-based, and lacks methods the classic one has (e.g. no
  `xr.setAnimationLoop`).
- WebGPU-backend XR threw outright on r181–r184 (`getContextAttributes` before the
  `isWebGPUBackend` guard); native WebGPU-backend XR (`_isWebGPUSession` /
  `_initWebGPUSession`) only merged to three's `dev` post-r184 and is still unreleased.
- r3f has not caught up: its v10 branch calls `gl.xr.setAnimationLoop` (nonexistent on the
  WebGPU manager) and casts to `any`; no released r3f supports WebGPU-backend XR.

If solid-three core encodes *how* either manager wires its loop — which method to call,
on which object, at which lifecycle event, per renderer family — then core is coupled to
internals that are guaranteed to keep shifting across three releases, and to new renderer
implementations (`RendererLike`, future backends) it has never seen.

So the decomposition's value is the **narrow, stable contract** it depends on. Core relies
on exactly two things both families already share and that are unlikely to churn:

1. `renderer.setAnimationLoop(cb)` exists, and a loop installed **before** `setSession` is
   the one invoked per XR frame (the single rule that already reconciles both families).
2. `renderer.xr?.isPresenting` is a readable boolean meaning "the session owns the loop."

Everything family-specific — snapshot vs. live routing, framebuffer binding, the XR camera
swap, layer submission — stays **inside three**, where it belongs and where it can change
freely. By pushing the *act* of installing the loop out to the consumer (who calls
`setSession` and therefore controls timing), core never has to know which manager it is
talking to. A new backend or a changed manager only has to honor those two points to work
with solid-three unchanged.

## `isPresenting`

`renderer.xr.isPresenting` is a plain boolean three.js maintains on the XR manager of
both renderer families (`false` initially; `true` set inside `setSession` right before the
`sessionstart` dispatch — three.module.js:13521 / three.webgpu.js:54663; back to `false`
on session end — 13272 / 55009). It means "a live XR session is driving this renderer
right now." It is the single renderer-agnostic selector for "the headset owns the frame
loop," and it is read-only as far as solid-three is concerned.

## Decomposition

**Unit A — `advance(timestamp, frame?)`: render exactly one frame.**
This is the existing internal `render(timestamp, frame)` (`create-three.tsx:176`): run
before-listeners → `gl.render(scene, camera)` → after-listeners, forwarding `frame` to
`useFrame((ctx, delta, frame) => …)`. It has no opinion about who calls it or how often.
It is the seam every frame source plugs into. It is exposed on the context as **`advance`**.

**Unit B — frame source (scheduler): when `advance` is called.**
Four mutually-exclusive sources; exactly one is active:
- `frameloop="always"` → continuous window rAF (`loop`, `create-three.tsx:574`)
- `frameloop="demand"` → window rAF on invalidation (`requestRender`, 193)
- `frameloop="never"` → manual only
- **presenting** → the XR session's rAF, via `renderer.setAnimationLoop(advance)`

The selector between "a window source" and "the XR source" is `gl.xr?.isPresenting`.

**Unit C — the transition, split by ownership:**
- **(c1) Consumer:** install `advance` + enable, *before* `setSession`.
- **(c2) Core:** the window rAF yields while presenting and resumes after.

## Consumer contract (no utilities)

The **renderer construction differs** per family (it's the consumer's `<Canvas gl>`
choice); the **enter/exit XR code is byte-identical** for both. That identity is the whole
payoff of the design — see the per-renderer trace below for why it lands the same.

### Renderer setup — `WebGLRenderer`

```tsx
// default: <Canvas> constructs a WebGLRenderer, or pass one explicitly
<Canvas gl={canvas => new WebGLRenderer({ canvas })}>
  <Scene />
</Canvas>
```

### Renderer setup — `WebGPURenderer`

```tsx
import { WebGPURenderer } from "three/webgpu"

// forceWebGL: true is required for XR on three ≤ r184 (WebGPU-backend XR throws;
// native WebGPU-backend XR is unreleased). Drop it once a release ships it.
<Canvas gl={canvas => new WebGPURenderer({ canvas, forceWebGL: true })}>
  <Scene />
</Canvas>
```

### Enter / exit XR — identical for both renderers

```ts
const { gl, advance } = useThree()

// enter XR — BEFORE the AR/VR button calls setSession:
gl.setAnimationLoop(advance)
gl.xr.enabled = true
const session = await navigator.xr.requestSession('immersive-vr', sessionInit)
await gl.xr.setSession(session)   // typically performed by three's ARButton/VRButton

// exit XR:
gl.setAnimationLoop(null)
gl.xr.enabled = false
```

### Why the same code lands correctly on each

Same call, two internal paths, both ending at `advance(time, frame)`:

- **`WebGLRenderer`:** `gl.setAnimationLoop(advance)` routes `advance` into the live
  `xr.setAnimationLoop` immediately (three.module.js:16600). `setSession` then starts the
  session loop; each frame the manager binds the XR framebuffer and calls `advance`.
- **`WebGPURenderer`:** `gl.setAnimationLoop(advance)` only sets `renderer._animation`.
  `setSession` **snapshots** that loop into `_currentAnimationLoop` (three.webgpu.js:54525)
  and wraps it in `_onAnimationFrame`; each frame `_onAnimationFrame` calls
  `setOutputRenderTarget(xrRenderTarget)` then the snapshot `advance`. This only works
  because `advance` was installed *before* `setSession` ran.

No utilities ship in this iteration. A convenience helper (`solid-three/xr` entry, or a
`createXRSession` / `<XRSession>` built on these primitives) is deferred; it would be pure
userland sugar over the contract above and can be designed later without changing core.

## Core changes

### `src/create-three.tsx`

**Delete** the entire current XR block (133-166):
- `handleXRFrame`
- `handleSessionChange` (the `_gl.setAnimationLoop(...)` toggle)
- the `xr` object (`connect` / `disconnect`)
- `warnNonXR`

**Add** core's only remaining XR responsibility — keep its own window loop out of the
headset's way. A render effect that, for the current renderer exposing an event-target
`xr`, attaches two listeners that manage *core's own* loop (never the renderer's):

```ts
createRenderEffect(() => {
  const _gl = gl()
  const xr = (_gl as { xr?: EventTarget & { isPresenting?: boolean } }).xr
  if (!xr || typeof xr.addEventListener !== "function") return

  const stop = () => pendingLoopRequest && cancelAnimationFrame(pendingLoopRequest)
  const resume = () => {
    if (canvasProps.frameloop === "always") pendingLoopRequest = requestAnimationFrame(loop)
    else requestRender() // one repaint so the flat canvas reflects post-XR state
  }
  xr.addEventListener("sessionstart", stop)
  xr.addEventListener("sessionend", resume)
  onCleanup(() => {
    xr.removeEventListener("sessionstart", stop)
    xr.removeEventListener("sessionend", resume)
  })
})
```

**Guard the window schedulers only** against presenting, so a stray
`requestRender`/invalidation during XR can't sneak in a window render. The guard goes in
the *schedulers*, never in `advance` itself — the XR session calls `advance` precisely
while `isPresenting` is true, so guarding `advance` would blank the headset:

- `loop` (574): `if (context.gl?.xr?.isPresenting) return` before `context.render(value)`
  (also fixes the existing latent `frameloop="always"` + XR double-drive bug).
- `requestRender` (193): same guard before scheduling the rAF.
- `advance` (the per-frame fn at 176): **no guard** — it must run on demand from any source.

**Expose** the per-frame primitive on the context as `advance` (the function currently
named `render` internally and exposed on `Context` as `render`). Internal callers
(`loop`) invoke it directly.

### `src/types.ts`

- `Context`: rename `render` → `advance`; remove `xr` (the `connect`/`disconnect` object,
  ~240). `gl.xr` (the three manager) is what consumers now use directly. `requestRender`
  stays.
- Keep `FrameListenerCallback = (context, delta, frame?: XRFrame) => void` (259) — the
  `XRFrame` already flows to listeners; unchanged.

### `src/utils.ts`

- Remove `canDriveXR` (~292) and its usages — core no longer branches on whether a
  renderer "can host an XR session." Any renderer with a `setAnimationLoop` and an
  event-target `xr` works; renderers without simply never present, and the
  `isPresenting` guard reads `undefined` (falsy) on them.

## Behavior changes

- **Breaking:** `context.xr.connect()/disconnect()` removed; `context.render` →
  `context.advance`. (Target branch is unreleased `next`, so acceptable.)
- `frameloop="never"` no longer suppresses XR frames. Previously `handleXRFrame`
  early-returned on `"never"`; now the consumer drives `advance` directly via the session,
  so the headset always renders regardless of `frameloop`. This is the correct behavior —
  `frameloop` governs the *window* loop, not the headset.
- `frameloop="always"` + XR no longer double-renders.
- Core no longer emits the `warnNonXR` console warning.

## Testing

Per project convention, tests run in real Chromium via vitest browser mode (no jsdom).
A real headset/WebXR session can't be driven in CI, so tests target Unit B (the
scheduler) against a **stub renderer** that satisfies the duck-type:

- Stub renderer with `xr` as an `EventTarget` exposing a mutable `isPresenting` and
  `setAnimationLoop`/`render` spies.
- Assert: while `isPresenting === true` (after dispatching a synthetic `sessionstart`),
  the window `loop`/`requestRender` does **not** call `gl.render`.
- Assert: dispatching `sessionend` resumes the window loop (`always`) or issues exactly
  one repaint (`demand`).
- Assert: `useFrame` callbacks receive the `frame` argument when `advance(t, frame)` is
  invoked.
- Assert: swapping the renderer detaches old listeners and attaches new ones (no leak).

Real WebGL/WebGPU XR session rendering is verified manually on-device (Quest 3) — this is
the original report that motivated the work.

## Out of scope

- Convenience helper / `solid-three/xr` entry (deferred — pure sugar over the contract).
- Native WebGPU-backend XR (three merged it to `dev` post-r184, unreleased; this design is
  forward-compatible because it only depends on `setAnimationLoop` + `isPresenting`, both
  present on the new path).
- Controller/hand model ergonomics — consumers use three's addons directly via `gl.xr`.

## Open question

- Final name of the per-frame primitive: `advance(timestamp?, frame?)` (recommended,
  matches "advance one frame") vs. keeping `render`. Everything else is settled.
