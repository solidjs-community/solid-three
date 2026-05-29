# XR Frameloop Decoupling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop solid-three from internally driving the WebXR frame loop; hand that wiring to the consumer and reduce core to a single responsibility — keep its own window render loop out of the way while an XR session is presenting.

**Architecture:** Core depends only on the stable cross-renderer contract: `renderer.setAnimationLoop(cb)` (installed by the consumer *before* `setSession`) and the read-only boolean `renderer.xr.isPresenting`. All family-specific XR mechanics stay inside three. Core's window loop self-stops via an `isPresenting` guard and resumes via one `sessionend` listener. Spec: `docs/superpowers/specs/2026-05-29-xr-frameloop-decoupling-design.md`.

**Tech Stack:** TypeScript, SolidJS, three.js (r181 in repo; consumers on r184), vitest browser mode (Playwright + Chromium, software WebGL via SwiftShader). jsdom unsupported.

**Commands:**
- Single test file: `pnpm exec vitest run tests/core/renderer.test.tsx`
- Filter by name: `pnpm exec vitest run tests/core/renderer.test.tsx -t "yields the window"`
- Full suite: `pnpm test`
- Typecheck: `pnpm lint:types`

---

### Task 1: Fix `Context.render` type to forward the XR frame

The consumer passes `context.render` to `renderer.setAnimationLoop`, which calls it with `(timestamp, frame)`. The type currently claims `(delta: number) => void`, dropping the frame. `XRFrame` is a global DOM type already used at `types.ts:259` (no import needed).

**Files:**
- Modify: `src/types.ts:234`

- [ ] **Step 1: Update the type**

In `src/types.ts`, change the `Context` member:

```ts
// before
  render: (delta: number) => void
// after
  render: (timestamp: number, frame?: XRFrame) => void
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm lint:types`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "fix(types): Context.render forwards the XRFrame argument"
```

---

### Task 2: Remove obsolete XR tests

Five tests in `tests/core/renderer.test.tsx` assert the behavior being removed (`context.xr.connect/disconnect`, the `setAnimationLoop`-on-`sessionstart` toggle, the `xr.enabled` toggle, the `canDriveXR` skip, and `frameloop="never"` suppression of core-driven XR frames). They are replaced by Task 3's tests. Note: the old "wire XR on a WebGPU-shaped renderer" test only checked that `setAnimationLoop` was *called* — never that it ran before `setSession` — which is exactly why the bug shipped green.

**Files:**
- Modify: `tests/core/renderer.test.tsx`

- [ ] **Step 1: Delete the five obsolete tests**

Delete these `it(...)` blocks in full (match by title):
1. `"should toggle render mode in xr"`
2. `'should respect frameloop="never" in xr'`
3. `"should no-op xr.connect/disconnect when renderer has no xr manager"`
4. `"should wire XR on a WebGPU-shaped renderer (setAnimationLoop on the renderer, not on xr)"`
5. `"should skip XR wiring when renderer.xr lacks setAnimationLoop (WebGPU-style stub)"`

Keep the `useFrame` import (Task 3 reuses it) and the `makeFakeRenderer` / `RendererLike` helpers (other tests use them).

- [ ] **Step 2: Verify the suite is still green (old core code unchanged)**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx`
Expected: PASS (fewer tests; remaining ones unaffected).

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm lint:types`
Expected: exit 0. (`state.xr` is no longer referenced in tests, but still exists on `Context` until Task 3 — so no type error yet.)

- [ ] **Step 4: Commit**

```bash
git add tests/core/renderer.test.tsx
git commit -m "test: remove obsolete internally-managed XR tests"
```

---

### Task 3: Decouple the XR frame loop (red → green)

This is the core change: delete the internal XR driver, reduce core to the `isPresenting` guard + one `sessionend` resume listener, and remove `canDriveXR` and `Context.xr`.

**Files:**
- Modify: `tests/core/renderer.test.tsx` (add helper + 3 tests)
- Modify: `src/create-three.tsx` (delete XR block 133-166; delete `canDriveXR` import line 54; delete auto-connect effect 507-512; guard `requestRender` 193 and `loop` 574; add resume effect after the render-loop block ~583)
- Modify: `src/types.ts` (remove `Context.xr`, lines ~240-243)
- Modify: `src/utils.ts` (remove `canDriveXR`, lines 279-301; drop now-unused imports)

- [ ] **Step 1: Add the `nextFrames` helper and three failing tests**

At the top of `tests/core/renderer.test.tsx` (after imports), add:

```ts
const nextFrames = (n: number) =>
  new Promise<void>(resolve => {
    let i = 0
    const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
```

Add these tests inside the existing top-level `describe(...)` block:

```ts
it("yields the window render loop while an XR session is presenting, resumes after", async () => {
  const state = test(() => <T.Group />, { frameloop: "always" })
  const gl = state.gl as unknown as THREE.WebGLRenderer
  await state.waitTillNextFrame() // ensure the loop is running normally

  const renderSpy = vi.spyOn(gl, "render")

  // Enter "presenting": the session now owns frames; the window loop must go quiet.
  gl.xr.isPresenting = true
  gl.xr.dispatchEvent({ type: "sessionstart" })
  await nextFrames(3)
  expect(renderSpy).not.toHaveBeenCalled()

  // Exit: window loop resumes.
  gl.xr.isPresenting = false
  gl.xr.dispatchEvent({ type: "sessionend" })
  await state.waitTillNextFrame()
  expect(renderSpy).toHaveBeenCalled()

  renderSpy.mockRestore()
})

it("does not touch gl.xr.enabled — the consumer owns it", async () => {
  const state = test(() => <T.Group />, { frameloop: "always" })
  const gl = state.gl as unknown as THREE.WebGLRenderer

  expect(gl.xr.enabled).toBe(false)
  gl.xr.isPresenting = true
  gl.xr.dispatchEvent({ type: "sessionstart" })
  // Core must leave enabled alone; the consumer sets it before setSession.
  expect(gl.xr.enabled).toBe(false)
})

it("forwards the XRFrame argument through to useFrame listeners", async () => {
  let received: XRFrame | undefined
  const fakeFrame = {} as XRFrame
  const state = test(() => {
    useFrame((_ctx, _delta, frame) => {
      received = frame
    })
    return <T.Group />
  })

  state.render(performance.now(), fakeFrame)
  expect(received).toBe(fakeFrame)
})
```

- [ ] **Step 2: Run the new tests — expect failures**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx -t "yields the window"` and `-t "does not touch gl.xr.enabled"`
Expected:
- "yields the window…" FAILS — old `"always"` `loop` has no guard, so `render` is still called while presenting.
- "does not touch gl.xr.enabled…" FAILS — old `handleSessionChange` sets `gl.xr.enabled = true` on `sessionstart`.
- "forwards the XRFrame…" PASSES already (guard/characterization test; old `render` forwards `frame`).

- [ ] **Step 3: Delete the internal XR driver in `src/create-three.tsx`**

Remove the entire XR block (lines 133-166): `handleXRFrame`, the `// Both WebGL and WebGPU…` comment, `warnNonXR`, `handleSessionChange`, and the `xr` object (`connect`/`disconnect`).

Remove `canDriveXR` from the import list (line 54).

Remove the auto-connect effect (lines 507-512):

```ts
// DELETE THIS:
      createEffect(() => {
        if (canDriveXR(gl())) context.xr.connect()
      })
```

Remove the `xr` member from the `context` object literal (the `xr,` entry near line 409).

- [ ] **Step 4: Guard the window schedulers in `src/create-three.tsx`**

`requestRender` (line 193) — add the guard first:

```ts
  function requestRender() {
    if (context.gl?.xr?.isPresenting) return
    if (pendingRenderRequest) return
    pendingRenderRequest = requestAnimationFrame(render)
  }
```

`loop` (line 574) — make the `"always"` chain self-stop while presenting:

```ts
  function loop(value: number) {
    if (context.gl?.xr?.isPresenting) {
      // The XR session drives advance() now; let this chain die.
      // The sessionend listener restarts it.
      pendingLoopRequest = undefined
      return
    }
    pendingLoopRequest = requestAnimationFrame(loop)
    context.render(value)
  }
```

- [ ] **Step 5: Add the resume listener in `src/create-three.tsx`**

Immediately after the render-loop `createRenderEffect` block (after line 583), add:

```ts
  // Core's sole XR responsibility: when the consumer-driven session ends,
  // revive the window loop (which self-stopped via the isPresenting guard).
  // No sessionstart listener needed — the guard handles stopping. Only
  // depends on `setAnimationLoop`+`isPresenting`, shared by both renderer
  // families, so no WebGL-vs-WebGPU branching.
  createRenderEffect(() => {
    const _gl = gl() as { xr?: EventTarget }
    const xr = _gl.xr
    if (!xr || typeof xr.addEventListener !== "function") return
    const resume = () => {
      if (canvasProps.frameloop === "always") {
        if (!pendingLoopRequest) pendingLoopRequest = requestAnimationFrame(loop)
      } else {
        requestRender() // one repaint so the flat canvas reflects post-XR state
      }
    }
    xr.addEventListener("sessionend", resume)
    onCleanup(() => xr.removeEventListener("sessionend", resume))
  })
```

If `createRenderEffect` / `onCleanup` are not already imported in this file, add them to the `solid-js` import.

- [ ] **Step 6: Remove `Context.xr` from `src/types.ts`**

Delete the `xr` member from the `Context` interface (lines ~240-243):

```ts
// DELETE THIS:
  xr: {
    connect: () => void
    disconnect: () => void
  }
```

- [ ] **Step 7: Remove `canDriveXR` from `src/utils.ts`**

Delete the doc comment and function (lines 279-301). Then remove any now-unused imports it required (`WebXRManager`, and `XRFrameRequestCallback` if unused elsewhere) — `pnpm lint:types`/eslint will flag them.

- [ ] **Step 8: Run the new tests — expect pass**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx -t "yields the window"` then `-t "does not touch gl.xr.enabled"` then `-t "forwards the XRFrame"`
Expected: all PASS.

- [ ] **Step 9: Run the full file + typecheck**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx` then `pnpm lint:types`
Expected: PASS, exit 0. (No remaining references to `context.xr` or `canDriveXR`.)

- [ ] **Step 10: Commit**

```bash
git add src/create-three.tsx src/types.ts src/utils.ts tests/core/renderer.test.tsx
git commit -m "refactor(xr): decouple XR loop ownership from core

Core no longer drives the WebXR frame loop. It keeps its own window loop
out of the way via an isPresenting guard + one sessionend resume listener,
and depends only on the stable cross-renderer contract
(setAnimationLoop-before-setSession + xr.isPresenting). The consumer wires
setAnimationLoop/enabled/setSession. Fixes WebGPURenderer XR (the old
sessionstart toggle ran too late for the WebGPU manager's setSession
snapshot) and the latent frameloop=always + XR double-render."
```

---

### Task 4 (optional): Renderer-swap listener cleanup test

Guards the `onCleanup` in the resume effect — swapping the `gl` prop must detach the old renderer's `sessionend` listener.

**Files:**
- Modify: `tests/core/renderer.test.tsx`

- [ ] **Step 1: Write the test**

```ts
it("detaches the sessionend listener when the renderer swaps", async () => {
  const first = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
  const second = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
  const removeSpy = vi.spyOn(first.xr, "removeEventListener")

  const [glAccessor, setGl] = createSignal<THREE.WebGLRenderer>(first)
  const state = test(() => <T.Group />, {
    get gl() {
      return glAccessor()
    },
  })
  expect(state.gl).toBe(first)

  setGl(second)
  await state.waitTillNextFrame()

  expect(removeSpy).toHaveBeenCalledWith("sessionend", expect.any(Function))

  first.dispose()
  first.forceContextLoss()
  second.dispose()
  second.forceContextLoss()
  removeSpy.mockRestore()
})
```

Ensure `createSignal` is imported from `solid-js` (it already is in this file).

- [ ] **Step 2: Run — expect pass**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx -t "detaches the sessionend"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/core/renderer.test.tsx
git commit -m "test(xr): verify sessionend listener detaches on renderer swap"
```

---

### Task 5 — DROPPED (naming decision: keep `render`)

Decision: keep `context.render` / `context.requestRender` as-is. The rename to `advance` would have broken the coherent `render`/`requestRender` pairing. No code change. This task is not performed.

<details>
<summary>Original (not pursued): rename `context.render` → `context.advance`</summary>

Functionally inert — `context.render` already works as the consumer's per-frame callback.

**Files:**
- Modify: `src/types.ts` (the `render` member), `src/create-three.tsx` (definition, the `context` literal entry, the `loop` call at 576), `src/canvas.tsx:106`, `tests/core/renderer.test.tsx` (the `state.render(...)` call in the frame-forward test).

- [ ] **Step 1: Rename in `src/types.ts`**

```ts
// before
  render: (timestamp: number, frame?: XRFrame) => void
// after
  advance: (timestamp: number, frame?: XRFrame) => void
```

- [ ] **Step 2: Rename in `src/create-three.tsx`**

Rename the internal `function render(...)` to `function advance(...)`; update the `context` literal (`render,` → `advance,` — note it's exposed as `advance` now); update the `loop` body call `context.render(value)` → `context.advance(value)`. Leave `requestRender` (which calls the internal fn) pointing at the renamed function.

- [ ] **Step 3: Rename the call in `src/canvas.tsx:106`**

```ts
// before
      context.render(performance.now())
// after
      context.advance(performance.now())
```

- [ ] **Step 4: Update the test**

In the "forwards the XRFrame…" test, `state.render(...)` → `state.advance(...)`.

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run tests/core/renderer.test.tsx` then `pnpm lint:types`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/create-three.tsx src/canvas.tsx tests/core/renderer.test.tsx
git commit -m "refactor(api): rename Context.render to Context.advance"
```

</details>

---

## Documentation follow-up (not code; do after Tasks 1-3 land)

The original consumer report (Scott / `vorth/webxr-poc`) needs the public guidance the spec describes. Add to the XR docs page: the consumer contract (both renderer setups + identical enter/exit block), the `forceWebGL: true` requirement for `WebGPURenderer` XR on three ≤ r184, and that solid-three no longer auto-manages sessions. Tracked separately from this code plan.

## Notes for the implementer

- `gl.xr.isPresenting` and `gl.xr.dispatchEvent` are real, writable members of three's `WebXRManager` — the deleted tests already used them, so the new tests rely on the same surface.
- Do not add an `isPresenting` guard to `render`/`advance` itself — the XR session calls it precisely while `isPresenting` is true; guarding it would blank the headset. The guard belongs only in `loop` and `requestRender`.
- `site/` build artifacts under `.output/`/`.nitro/` reference the old `canDriveXR`/`context.xr`; they are generated and regenerate on build — do not hand-edit them.
- The modified `site/vite.config.ts` in the working tree is unrelated to this work; leave it unstaged.
