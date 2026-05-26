# Port `next` features to `next-solid-2`: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `next-solid-2` to feature parity with `next` — WebGPU/RendererLike, construction firewall, gl tuple form, duck-typed attach, useLoader+Suspense fix, Resource attach fix, regression tests — packaged as one PR with 14 logical commits.

**Architecture:** Branch `next-solid-2-port` in worktree `/Users/bigmistqke/Documents/GitHub/solid-three-port`, off `next-solid-2`. Port commits in dependency order. Mechanical diffs applied where safe (`types.ts`, `utils.ts`, `props.ts`, `components.tsx`, parts of `canvas.tsx`). Fresh re-implementation against `next-solid-2`'s `setContext`/`@solidjs/signals` idiom for `create-three.tsx`. After each commit: `tsc --noEmit` + `vitest run` must pass before moving on.

**Tech Stack:** Solid 2.x beta, `@solidjs/signals`, three ^0.181, TypeScript, vitest, jsdom.

**Reference spec:** `docs/superpowers/specs/2026-05-26-port-next-to-next-solid-2-design.md` (read first if context is missing — it has the architecture delta, per-feature intent, and risk register).

**Working directory:** All commands run from `/Users/bigmistqke/Documents/GitHub/solid-three-port` unless noted.

---

## Preflight

### Task 0: Verify worktree state

**Files:** none

- [ ] **Step 1: Confirm worktree and branch**

```bash
cd /Users/bigmistqke/Documents/GitHub/solid-three-port
git status
git log --oneline -1
```

Expected: clean tree on `next-solid-2-port`, HEAD at `99a428a fix: fix type errors` (or whatever `next-solid-2` tip was when the worktree was created).

- [ ] **Step 2: Confirm `fixes` is reachable as source-of-truth**

```bash
git show fixes:src/types.ts | head -5
```

Expected: prints first 5 lines of `src/types.ts` from the `fixes` branch.

- [ ] **Step 3: Establish baseline test pass**

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: both pass. If they don't, STOP — the port is starting from a broken base and needs investigation before continuing.

---

## Task 1: Bump three + @types/three to ^0.181

Source commit: `33d5a78`. Strategy: diff-port.

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (regenerated)
- Modify: `tests/web/__snapshots__/canvas.test.tsx.snap` (canvas `data-engine` attribute changes from `three.js r164` to `three.js r181`)
- Modify: `tests/core/renderer.test.tsx` (color-space test fixture: `gl.outputColorSpace = "test"` → use a valid-but-wrong value)

- [ ] **Step 1: Capture the fixes-branch versions of the relevant lines**

```bash
git show fixes:package.json | grep -E '"three"|@types/three'
```

Expected output (paste exact versions into next step):
```
    "@types/three": "^0.181.0",
    "three": "^0.181.0",
```

- [ ] **Step 2: Update package.json**

```bash
grep -n "three" package.json
```

Edit `package.json` to set `"three"` and `"@types/three"` to `^0.181.0` (use the exact versions from Step 1). Leave all other deps alone.

- [ ] **Step 3: Regenerate the lockfile**

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updates; no errors.

- [ ] **Step 4: Port the snapshot delta**

```bash
git diff next-solid-2-port..fixes -- tests/web/__snapshots__/canvas.test.tsx.snap
```

Apply only the `data-engine="three.js r164"` → `data-engine="three.js r181"` change. Other snapshot lines may differ for solid-2 reasons — leave those alone.

- [ ] **Step 5: Port the renderer.test.tsx color-space fixture**

```bash
git diff next-solid-2-port..fixes -- tests/core/renderer.test.tsx | grep -A2 -B2 "outputColorSpace"
```

Find the test that assigns `gl.outputColorSpace = "test"` (the sentinel that three 0.181 crashes on). Change to `gl.outputColorSpace = THREE.LinearSRGBColorSpace as any` (or matching the diff). This is a 1-line change.

- [ ] **Step 6: Type-check and run tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: both pass. If `tsc` reports new errors from `@types/three@0.181`, fix them inline (typically a `Camera` vs `PerspectiveCamera` narrowing or an `any` cast).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tests/web/__snapshots__/canvas.test.tsx.snap tests/core/renderer.test.tsx
git commit -m "chore(deps): bump three and @types/three to ^0.181"
```

---

## Task 2: Introduce RendererLike + Renderer union + Register augmentation

Source commits: `497eb60`, `2b678b3`, `79db70b`, `7cb2ecb`, `0bdaa7f` (+ `03fd4a6` DPR optionality on `RendererLike`). Strategy: diff-port. Pure type-level — no runtime behavior change yet.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils.ts` (1-line `hasColorSpace` generic widening)

- [ ] **Step 1: Read the target shape**

```bash
git show fixes:src/types.ts | sed -n '/RendererLike/,/^export/p' | head -80
```

This shows the final `RendererLike`, `Renderer`, `Register`, `ResolvedRenderer` declarations and their imports.

- [ ] **Step 2: Read the current `src/types.ts` to find insertion point**

```bash
sed -n '1,40p' src/types.ts
grep -n "WebGLRenderer\|Renderer" src/types.ts | head -10
```

- [ ] **Step 3: Add `WebGPURenderer` import**

Add to the three imports at the top:

```ts
import type { WebGPURenderer } from "three/webgpu"
```

(Some bundlers/types resolutions may need `import type` from `"three/webgpu"` only — `three` ^0.181 ships this subpath. If TypeScript can't find it, fall back to `import type { WebGPURenderer } from "three"`.)

- [ ] **Step 4: Add the type declarations**

Insert near the existing renderer types in `src/types.ts`:

```ts
/**
 * Structural contract for a renderer solid-three can drive. Covers what
 * solid-three actually calls (render, setSize, domElement) plus optional
 * fields that may or may not exist (xr, shadowMap, init, hasInitialized,
 * setPixelRatio, getPixelRatio).
 */
export interface RendererLike {
  render(scene: any, camera: any): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  domElement: Element
  setPixelRatio?(value: number): void
  getPixelRatio?(): number
  xr?: WebGLRenderer["xr"] | WebGPURenderer["xr"]
  shadowMap?: WebGLRenderer["shadowMap"] | WebGPURenderer["shadowMap"]
  init?(): Promise<void>
  hasInitialized?(): boolean
}

export type Renderer = WebGLRenderer | WebGPURenderer | RendererLike

/**
 * Module-augmentation point. Users declare their renderer choice in a
 * project-local .d.ts to type-narrow `useThree().gl` and `<Canvas gl>`
 * project-wide.
 *
 *   declare module "solid-three" {
 *     interface Register { renderer: WebGPURenderer }
 *   }
 */
export interface Register {}
export type ResolvedRenderer = Register extends { renderer: infer R } ? R : Renderer
```

- [ ] **Step 5: Widen `hasColorSpace` in utils.ts to accept `RendererLike`**

```bash
grep -n "hasColorSpace" src/utils.ts
```

Find the `hasColorSpace` generic. Change its constraint from `Renderer` (or whatever WebGL-specific bound it has) to `RendererLike`:

```ts
export const hasColorSpace = <T extends RendererLike | Texture>(value: T): value is T & { outputColorSpace: string } =>
  "outputColorSpace" in value
```

(Exact existing signature may differ slightly — preserve the function body, just widen the generic constraint and the import.)

Add `RendererLike` to the `types.ts` import block if not already there.

- [ ] **Step 6: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: passes. If errors surface in `canvas.tsx` because `gl` is now ambiguously typed — leave them; Task 3 fixes the canvas `gl` prop type.

If errors surface elsewhere (e.g. `WebGPURenderer` import unresolved), fix the import path. Try `"three/webgpu"` first, fall back to `"three"`.

- [ ] **Step 7: Run tests**

```bash
pnpm exec vitest run
```

Expected: passes (no runtime change yet).

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/utils.ts
git commit -m "feat(types): introduce RendererLike + Renderer union + Register augmentation"
```

---

## Task 3: Canvas runtime — accept RendererLike, await init, structural color mgmt, DOM-renderer DPR

Source commits: `14489dd`, `dcbab71`, `5338b52`, `03fd4a6`, `7bade2e`, `f47b7c2`. Strategy: **fresh** for `create-three.tsx` (must integrate with next-solid-2's `setContext`-style file); diff for `canvas.tsx` and `types.ts`-side typing.

**Files:**
- Modify: `src/canvas.tsx`
- Modify: `src/create-three.tsx`

- [ ] **Step 1: Read the fixes-branch Canvas gl prop type**

```bash
git show fixes:src/canvas.tsx | sed -n '/CanvasProps/,/^}/p' | head -40
```

The target shape for `gl`:

```ts
gl?:
  | (WebGLRenderer extends ResolvedRenderer
      ? Partial<Props<WebGLRenderer>>
      : never)
  | ((canvas: HTMLCanvasElement) => ResolvedRenderer)
  | ResolvedRenderer
```

(Tuple form is added in Task 9. Keep this Task 3's signature without the tuple to keep diffs reviewable.)

- [ ] **Step 2: Update `CanvasProps` in `src/canvas.tsx`**

Replace the existing `gl` field with the union above. Add `ResolvedRenderer` to the types.ts import.

- [ ] **Step 3: Read the fixes-branch gl memo in create-three.tsx**

```bash
git show fixes:src/create-three.tsx | sed -n '/const gl =/,/^  })/p' | head -60
```

Note the branch order: instance → factory → default WebGLRenderer.

- [ ] **Step 4: Read the current create-three.tsx gl memo for context**

```bash
grep -n "const gl\|createMemo.*gl\|new WebGLRenderer\|props.gl" src/create-three.tsx | head -20
```

Read ~30 lines around the gl memo to understand next-solid-2's structure (look for `setContext`, the `createMemo` ordering, debug calls).

- [ ] **Step 5: Rewrite the gl memo using solid-2 idiom**

Target behavior (do not copy verbatim from fixes — adapt to whatever pattern the surrounding create-three uses; preserve any `createDebug` calls already in place):

```ts
const gl = createMemo(() => {
  const propsGl = props.gl
  // Instance check first — recognise any RendererLike (incl. WebGPURenderer)
  // regardless of class, otherwise an `instanceof WebGLRenderer` would skip it.
  if (propsGl && typeof propsGl === "object" && !Array.isArray(propsGl)
      && typeof (propsGl as Renderer).render === "function"
      && typeof (propsGl as Renderer).setSize === "function") {
    return propsGl as Renderer
  }
  if (typeof propsGl === "function") {
    return autodispose(propsGl(canvas))
  }
  const renderer = autodispose(new WebGLRenderer({ canvas, antialias: true, alpha: true }))
  // Apply props from the config-object branch (only reachable when WebGLRenderer
  // extends ResolvedRenderer, i.e. Register is empty or registers WebGLRenderer).
  if (propsGl && typeof propsGl === "object" && !Array.isArray(propsGl)) {
    useProps(renderer, propsGl as Partial<Props<WebGLRenderer>>)
  }
  return renderer
})
```

(`autodispose` and `useProps` are already in next-solid-2's utils/props. The detection inline here will be replaced by `isRenderer()` in Task 4 — keeping it inline now keeps this commit focused on the runtime gate.)

- [ ] **Step 6: Add async init await before first render**

Find where `render()` is defined in create-three.tsx. Add a closure flag:

```ts
let glInitialized = true
```

Move it next to the existing `pendingRenderRequest`. Inside `render()`, add at the top:

```ts
if (!glInitialized) return
```

Add an effect that awaits init when the renderer swaps. Place it after the `gl` memo:

```ts
createRenderEffect(() => {
  const renderer = gl()
  glInitialized = false
  let cancelled = false
  onCleanup(() => { cancelled = true })

  const initFn = (renderer as RendererLike).init
  const hasInitialized = (renderer as RendererLike).hasInitialized
  const alreadyInitialized = hasInitialized?.call(renderer) === true

  if (!initFn || alreadyInitialized) {
    glInitialized = true
    return
  }

  // Pre-size the canvas backing buffer so WebGPU's depth attachment matches.
  const rect = canvas.getBoundingClientRect()
  const ratio = globalThis.devicePixelRatio || 1
  if (rect.width > 0 && rect.height > 0) {
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
  }

  initFn.call(renderer).then(() => {
    if (!cancelled) glInitialized = true
  })
})
```

(This async-effect form is intentional for Task 3 — Task 6 refactors it to `createResource`. Keeping it as-is keeps Task 3 small.)

- [ ] **Step 7: Switch color-mgmt and tone-mapping gates from `instanceof WebGLRenderer` to structural `in`**

Find the existing color-mgmt effect (`outputColorSpace`, `toneMapping`). Replace:

```ts
if (gl() instanceof WebGLRenderer) { ... }
```

with two separate structural gates:

```ts
createRenderEffect(() => {
  const renderer = gl()
  if (!("outputColorSpace" in renderer)) return
  ;(renderer as any).outputColorSpace = props.linear ? LinearSRGBColorSpace : SRGBColorSpace
})

createRenderEffect(() => {
  const renderer = gl()
  if (!("toneMapping" in renderer)) return
  ;(renderer as any).toneMapping = props.flat ? NoToneMapping : ACESFilmicToneMapping
})
```

Remove any `outputEncoding` setter (legacy r152 — three 0.181 doesn't need it).

- [ ] **Step 8: Make `setPixelRatio` optional + default `dpr` to 1**

Find the resize observer / size effect that calls `gl().setPixelRatio(...)`. Replace with optional call:

```ts
renderer.setPixelRatio?.(globalThis.devicePixelRatio || 1)
```

Find the `dpr` getter on `context` (likely a `get dpr()` in the `Context` object). Replace with:

```ts
get dpr() {
  return gl().getPixelRatio?.() ?? 1
}
```

- [ ] **Step 9: Type-check**

```bash
pnpm exec tsc --noEmit
```

Expected: passes. If `propsGl` flow narrows incorrectly, add `as Renderer` casts at the specific call sites — don't relax the types broadly.

- [ ] **Step 10: Run tests**

```bash
pnpm exec vitest run
```

Expected: existing tests pass. (Renderer-union-specific regression tests come in Task 14.)

- [ ] **Step 11: Manual sanity check (optional but recommended)**

In `next-solid-2-port`, start the playground dev server:

```bash
pnpm dev
```

Open a basic WebGL example. Confirm the scene renders and no console errors fire. Stop server.

- [ ] **Step 12: Commit**

```bash
git add src/canvas.tsx src/create-three.tsx
git commit -m "feat(canvas): accept RendererLike, await init, structural color mgmt, DOM-renderer DPR"
```

---

## Task 4: utils helpers + duck-typed manager narrows in create-three

Source commits: `da37a66` (manager narrows + getPendingInit), parts of `3c488ce` (isRenderer relocation — already inline in Task 3, but now formalised). Strategy: diff (utils) + fresh (create-three).

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/create-three.tsx`

- [ ] **Step 1: Read the target helpers from fixes**

```bash
git show fixes:src/utils.ts | sed -n '/isRenderer\|isWebXRManager\|isWebGLShadowMap\|getPendingInit/,/^}/p'
```

Target definitions (paste straight in — they're self-contained):

```ts
/**
 * Returns true when `value` is an already-built renderer instance.
 */
export function isRenderer(value: unknown): value is Renderer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Renderer).render === "function" &&
    typeof (value as Renderer).setSize === "function"
  )
}

/**
 * Duck-typed narrow to `WebXRManager`. `setAnimationLoop` is the discriminator
 * — three's WebGPU `XRManager` doesn't expose it.
 */
export function isWebXRManager(value: unknown): value is WebXRManager {
  return !!value && typeof (value as { setAnimationLoop?: unknown }).setAnimationLoop === "function"
}

/**
 * Duck-typed narrow to `WebGLShadowMap`. `needsUpdate` is the discriminator
 * — WebGPURenderer's `shadowMap` is `{ enabled, type }` without it.
 */
export function isWebGLShadowMap(value: unknown): value is WebGLShadowMap {
  return !!value && "needsUpdate" in (value as object)
}

/**
 * Returns the renderer's `init()` if it both exists and hasn't been called yet,
 * else `undefined`. Used to await async setup (e.g. WebGPURenderer.init) before
 * the first render.
 */
export function getPendingInit(renderer: Renderer): (() => Promise<void>) | undefined {
  const r = renderer as RendererLike
  if (typeof r.init !== "function") return undefined
  if (typeof r.hasInitialized === "function" && r.hasInitialized()) return undefined
  return () => r.init!.call(r)
}
```

- [ ] **Step 2: Add imports to `src/utils.ts`**

Add to the existing three imports:

```ts
import type { WebGLShadowMap, WebXRManager } from "three"
```

Add `Renderer` and `RendererLike` to the `./types.ts` import (likely already there from Task 2).

- [ ] **Step 3: Insert the helpers**

Place them alongside the existing `is*` family (after `isVector3` or wherever the cluster lives).

- [ ] **Step 4: Replace the inline detection in create-three.tsx gl memo with isRenderer**

In the `gl` memo from Task 3, replace the verbose inline check:

```ts
if (propsGl && typeof propsGl === "object" && !Array.isArray(propsGl)
    && typeof (propsGl as Renderer).render === "function"
    && typeof (propsGl as Renderer).setSize === "function") {
  return propsGl as Renderer
}
```

with:

```ts
if (isRenderer(propsGl)) {
  return propsGl
}
```

Add `isRenderer` to the utils import.

- [ ] **Step 5: Gate XR wiring on isWebXRManager**

Find the XR section (`handleSessionChange`, `xr.connect`, `xr.disconnect`, the effect that wires `sessionstart`/`sessionend` listeners). Gate each with:

```ts
function handleSessionChange() {
  const xrManager = context.gl.xr
  if (!isWebXRManager(xrManager)) return
  xrManager.enabled = xrManager.isPresenting
  xrManager.setAnimationLoop(xrManager.isPresenting ? handleXRFrame : null)
}

const xr = {
  connect() {
    const xrManager = context.gl.xr
    if (!isWebXRManager(xrManager)) return
    xrManager.addEventListener("sessionstart", handleSessionChange)
    xrManager.addEventListener("sessionend", handleSessionChange)
  },
  disconnect() {
    const xrManager = context.gl.xr
    if (!isWebXRManager(xrManager)) return
    xrManager.removeEventListener("sessionstart", handleSessionChange)
    xrManager.removeEventListener("sessionend", handleSessionChange)
  },
}
```

The connect-effect call that wires session listeners likewise gates on `isWebXRManager(context.gl.xr)`.

(The `console.warn` for no-op calls is added in Task 5 — leave silent here.)

- [ ] **Step 6: Adapt shadow-map effect**

Find the shadow-map effect. Change from a single `instanceof WebGLRenderer` guard to per-field gating:

```ts
createRenderEffect(() => {
  const shadowMap = gl().shadowMap
  if (!shadowMap) return

  // Common fields any renderer with shadowMap supports.
  if (props.shadows !== undefined) {
    shadowMap.enabled = !!props.shadows
    shadowMap.type = /* existing mapping from props.shadows to PCFShadowMap/etc. */
  }

  // WebGL-only: needsUpdate signals the renderer to re-bake.
  if (isWebGLShadowMap(shadowMap)) {
    shadowMap.needsUpdate = true
  }
})
```

(Preserve the existing `shadows` → shadow-map-type mapping logic; only gate the `needsUpdate` write.)

- [ ] **Step 7: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add src/utils.ts src/create-three.tsx
git commit -m "feat(utils): isRenderer + duck-typed manager narrows + getPendingInit"
```

---

## Task 5: Warn on no-op xr.connect/xr.disconnect

Source commit: `fa97fd6`. Strategy: fresh (1-line change inside Task 4's gated handlers).

**Files:** Modify `src/create-three.tsx`

- [ ] **Step 1: Add the warn helper**

Above the `xr` object, add:

```ts
function warnNonXR(method: string) {
  console.warn(
    `solid-three: ${method} is a no-op — the active renderer has no WebXRManager-shaped \`xr\` manager. Pass a WebGLRenderer (or a WebGPURenderer with three's XR layer) to enable XR.`,
  )
}
```

- [ ] **Step 2: Wire the warning into the gated guards**

Change `xr.connect` / `xr.disconnect` from silent return to warn-then-return:

```ts
connect() {
  const xrManager = context.gl.xr
  if (!isWebXRManager(xrManager)) return warnNonXR("xr.connect()")
  /* …existing wiring… */
},
disconnect() {
  const xrManager = context.gl.xr
  if (!isWebXRManager(xrManager)) return warnNonXR("xr.disconnect()")
  /* …existing wiring… */
},
```

Leave `handleSessionChange` silent (it's an internal callback, not user-facing).

- [ ] **Step 3: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/create-three.tsx
git commit -m "feat(xr): warn when context.xr.connect/disconnect is a no-op"
```

---

## Task 6: Use createResource for renderer init

Source commit: `addab6f`. Strategy: fresh (replaces Task 3's async-createEffect form).

**Files:** Modify `src/create-three.tsx`

- [ ] **Step 1: Locate the existing async-effect init block from Task 3**

```bash
grep -n "glInitialized\|cancelled" src/create-three.tsx
```

- [ ] **Step 2: Confirm createResource is available**

```bash
grep -n "createResource" src/create-three.tsx
```

If not yet imported, add to the `solid-js` import:

```ts
import { createMemo, createRenderEffect, createResource, createRoot, merge, onCleanup, /* … */ } from "solid-js"
```

- [ ] **Step 3: Replace the async-effect block with createResource**

Remove the `let glInitialized = true` declaration and the `createRenderEffect(() => { ...init... })` block.

Insert after the `gl` memo (and after the helper `getPendingInit` is imported):

```ts
const [rendererReady] = createResource(
  () => gl(),
  renderer => {
    const init = getPendingInit(renderer)
    if (!init) return true
    // Pre-size the canvas before init so WebGPU's depth attachment matches
    // the container — workaround for the 300×150 default backing buffer.
    const rect = canvas.getBoundingClientRect()
    const ratio = globalThis.devicePixelRatio || 1
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
    }
    return init().then(() => true)
  },
)
```

Add `getPendingInit` to the utils import.

- [ ] **Step 4: Update the render() gate**

Replace `if (!glInitialized) return` with:

```ts
if (rendererReady.state !== "ready") return
```

- [ ] **Step 5: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes. If a context-owner error fires from `createResource` (it can need access to the owner), wrap the resource setup inside the existing root or use `runWithOwner`:

```ts
const [rendererReady] = runWithOwner(rootOwner, () => createResource(...))
```

(Determine `rootOwner` from the surrounding create-three structure.)

- [ ] **Step 6: Commit**

```bash
git add src/create-three.tsx
git commit -m "refactor(create-three): use createResource for renderer init"
```

---

## Task 7: Fix meta() to preserve getters via `merge`

Source commits: `00c664d`, `aaeec88`. Strategy: diff (verify Solid 2 `merge` semantics).

**Files:** Modify `src/utils.ts`

- [ ] **Step 1: Read the current meta() implementation**

```bash
grep -n "export function meta\|defineProperties\|\\.\\.\\.augmentation" src/utils.ts
sed -n '/export function meta/,/^}/p' src/utils.ts | head -20
```

- [ ] **Step 2: Read the target from fixes**

```bash
git show fixes:src/utils.ts | sed -n '/export function meta/,/^}/p' | head -20
```

The fixes version uses `mergeProps`:

```ts
export function meta<T>(instance: T, augmentation = { props: {} }) {
  // ... existing setup that defines `data` (the metadata object) ...
  return mergeProps(instance, { [$S3C]: data }) as Meta<T>
}
```

`next-solid-2` uses `merge` (the Solid 2 rename). Same intent — getters preserved, no spread.

- [ ] **Step 3: Verify `merge` preserves getters identically**

Write a quick standalone smoke test in a scratch file or via `node -e`:

```bash
node --experimental-vm-modules -e '
import("solid-js").then(({ merge }) => {
  let called = 0
  const augmentation = { get props() { called++; return { name: "test" } } }
  const result = merge({ value: 1 }, augmentation)
  console.log("after merge, called:", called)  // should be 0
  console.log("result.props.name:", result.props.name)  // should be "test", called now 1
  console.log("after access, called:", called)
})
'
```

Expected output:
```
after merge, called: 0
result.props.name: test
after access, called: 1
```

If `called` is `1` immediately after merge, then `merge` invokes getters at merge-time and **the firewall in Task 8 will leak**. STOP and surface — the spec's risk #1 has materialised. Mitigation: implement `meta` using `Object.defineProperties` instead (the pre-`aaeec88` form):

```ts
export function meta<T>(instance: T, augmentation = { props: {} }) {
  const data = /* existing data object */
  const descriptors: PropertyDescriptorMap = {}
  for (const key of Object.keys(augmentation)) {
    const desc = Object.getOwnPropertyDescriptor(augmentation, key)
    if (desc) descriptors[key] = desc
  }
  Object.defineProperty(instance, $S3C, { value: data, enumerable: false })
  Object.defineProperties(data, descriptors)
  return instance as Meta<T>
}
```

- [ ] **Step 4: Update meta() to use the chosen primitive**

If `merge` passes the smoke test, change `meta()` to use it. If not, use `defineProperties`.

- [ ] **Step 5: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts
git commit -m "fix(utils): meta() preserves getters without invoking at merge-time"
```

---

## Task 8: Construction firewall memos

Source commit: `a31ee8c`. Strategy: fresh.

**Files:** Modify `src/create-three.tsx`

- [ ] **Step 1: Read the target firewall structure from fixes**

```bash
git show fixes:src/create-three.tsx | sed -n '/cameraIsInstance\|sceneIsInstance\|raycasterIsInstance\|glKind\|cameraInput\|sceneInput\|raycasterInput/p'
```

- [ ] **Step 2: Locate the existing camera, scene, raycaster, gl memos in create-three**

```bash
grep -n "createMemo\|const camera\|const scene\|const raycaster" src/create-three.tsx | head -20
```

Read ~30 lines around each to understand the current expression.

- [ ] **Step 3: Add boolean firewall memos**

Before the construction memos, add:

```ts
const cameraIsInstance = createMemo(() => props.camera instanceof Camera)
const orthographicFlag = createMemo(() => Boolean(props.orthographic))
const sceneIsInstance = createMemo(() => props.scene instanceof Scene)
const raycasterIsInstance = createMemo(() => props.raycaster instanceof Raycaster)
const glKind = createMemo<"factory" | "instance" | "default">(() => {
  const value = props.gl
  if (isRenderer(value)) return "instance"
  if (typeof value === "function") return "factory"
  return "default"
})
```

These are === comparable, so a JSX getter call producing the same category doesn't propagate.

- [ ] **Step 4: Rewrite the camera memo to depend only on firewall booleans**

```ts
const camera = createMemo(() => {
  if (cameraIsInstance()) {
    // Read the full prop here — instance identity matters.
    return props.camera as Camera
  }
  return autodispose(
    orthographicFlag()
      ? new OrthographicCamera()
      : new PerspectiveCamera(),
  )
})
```

Then apply config-object props in a separate effect, untracked from the camera memo's deps:

```ts
createRenderEffect(() => {
  const cam = camera()
  // Only apply config when the user passed a partial config-object (not an instance).
  if (cameraIsInstance()) return
  const cfg = untrack(() => props.camera)
  if (cfg && typeof cfg === "object") {
    useProps(cam, cfg as Partial<Props<Camera>>)
  }
})
```

(`untrack` is already imported in solid-2. The trick is: `cameraIsInstance` is the tracked dep — when it flips false (config-mode), the effect re-runs once; subsequent prop-content changes inside `useProps` are picked up by `useProps`'s own reactivity, not this effect's tracking.)

- [ ] **Step 5: Apply the same pattern to scene, raycaster, gl**

Mirror Step 4 for each. The `gl` memo's three branches:

```ts
const gl = createMemo(() => {
  const kind = glKind()
  if (kind === "instance") {
    return untrack(() => props.gl) as Renderer
  }
  if (kind === "factory") {
    const factory = untrack(() => props.gl) as (canvas: HTMLCanvasElement) => Renderer
    return autodispose(factory(canvas))
  }
  // default
  const renderer = autodispose(new WebGLRenderer({ canvas, antialias: true, alpha: true }))
  return renderer
})

// Config-object props applied via separate effect (gated to "default" kind only).
createRenderEffect(() => {
  if (glKind() !== "default") return
  const cfg = untrack(() => props.gl)
  if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
    useProps(gl(), cfg as Partial<Props<WebGLRenderer>>)
  }
})
```

- [ ] **Step 6: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes. (Firewall regression tests come in Task 14.)

- [ ] **Step 7: Commit**

```bash
git add src/create-three.tsx
git commit -m "feat(canvas): firewall construction memos against reactive prop content"
```

---

## Task 9: Accept [ctorArgs, properties] tuple for gl

Source commit: `a635c3c`. Strategy: diff (canvas type, shallowEqual) + fresh (create-three gl-tuple handling).

**Files:**
- Modify: `src/canvas.tsx`
- Modify: `src/utils.ts`
- Modify: `src/create-three.tsx`

- [ ] **Step 1: Add `shallowEqual` to utils.ts**

```bash
git show fixes:src/utils.ts | sed -n '/shallowEqual/,/^}/p' | head -15
```

Paste:

```ts
export function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}
```

- [ ] **Step 2: Extend the gl prop type in `src/canvas.tsx`**

Add the tuple form to the `gl?:` union (inside the same `WebGLRenderer extends ResolvedRenderer ? ... : never` conditional):

```ts
gl?:
  | (WebGLRenderer extends ResolvedRenderer
      ? Partial<Props<WebGLRenderer>>
        | readonly [
            constructorParameters: Partial<WebGLRendererParameters>,
            properties: Partial<Props<WebGLRenderer>>,
          ]
      : never)
  | ((canvas: HTMLCanvasElement) => ResolvedRenderer)
  | ResolvedRenderer
```

Add `WebGLRendererParameters` import from `three`.

- [ ] **Step 3: Update `glKind` to recognise the tuple**

Inside `glKind` from Task 8:

```ts
const glKind = createMemo<"factory" | "instance" | "tuple" | "default">(() => {
  const value = props.gl
  if (isRenderer(value)) return "instance"
  if (typeof value === "function") return "factory"
  if (Array.isArray(value)) return "tuple"
  return "default"
})
```

- [ ] **Step 4: Add a tuple[0] memo with shallowEqual recreation guard**

```ts
const glConstructorArgs = createMemo<Partial<WebGLRendererParameters>>(
  () => {
    if (glKind() !== "tuple") return {}
    return (untrack(() => props.gl) as readonly [Partial<WebGLRendererParameters>, unknown])[0]
  },
  { equals: shallowEqual },
)
```

- [ ] **Step 5: Wire the tuple branch into the gl memo**

```ts
const gl = createMemo(() => {
  const kind = glKind()
  if (kind === "instance") {
    return untrack(() => props.gl) as Renderer
  }
  if (kind === "factory") {
    const factory = untrack(() => props.gl) as (canvas: HTMLCanvasElement) => Renderer
    return autodispose(factory(canvas))
  }
  if (kind === "tuple") {
    // Construction is driven by tuple[0]; shallowEqual prevents recreation on
    // shape-equal but fresh-reference inputs (typical JSX getter output).
    const ctorArgs = glConstructorArgs()
    return autodispose(new WebGLRenderer({ canvas, ...ctorArgs }))
  }
  // default
  return autodispose(new WebGLRenderer({ canvas, antialias: true, alpha: true }))
})
```

- [ ] **Step 6: Apply tuple[1] as reactive properties**

Extend the config-effect from Task 8 to handle the tuple case:

```ts
createRenderEffect(() => {
  const kind = glKind()
  if (kind === "default") {
    const cfg = untrack(() => props.gl)
    if (cfg && typeof cfg === "object" && !Array.isArray(cfg)) {
      useProps(gl(), cfg as Partial<Props<WebGLRenderer>>)
    }
    return
  }
  if (kind === "tuple") {
    const tuple = untrack(() => props.gl) as readonly [unknown, Partial<Props<WebGLRenderer>>]
    useProps(gl(), tuple[1])
  }
})
```

- [ ] **Step 7: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add src/canvas.tsx src/utils.ts src/create-three.tsx
git commit -m "feat(canvas): accept [ctorArgs, properties] tuple for the gl prop"
```

---

## Task 10: Duck-type Material/Object3D/Fog/BufferGeometry attach checks

Source commit: `068b8a4`. Strategy: diff.

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/props.ts`

- [ ] **Step 1: Add the duck-type helpers to utils.ts**

```ts
export function isMaterial(value: unknown): value is Material {
  return !!value && (value as { isMaterial?: boolean }).isMaterial === true
}
export function isBufferGeometry(value: unknown): value is BufferGeometry {
  return !!value && (value as { isBufferGeometry?: boolean }).isBufferGeometry === true
}
export function isFog(value: unknown): value is Fog {
  return !!value && (value as { isFog?: boolean }).isFog === true
}
export function isObject3D(value: unknown): value is Object3D {
  return !!value && (value as { isObject3D?: boolean }).isObject3D === true
}
```

Add `type` imports for `Material`, `BufferGeometry`, `Fog`, `Object3D` from `"three"`.

- [ ] **Step 2: Update `src/props.ts` applySceneGraph**

```bash
grep -n "instanceof Material\|instanceof Object3D\|instanceof BufferGeometry\|instanceof Fog" src/props.ts
```

Replace each `instanceof` check with the corresponding `is*` helper:

```ts
// Before:
if (child instanceof Material) attachProp = "material"
else if (child instanceof BufferGeometry) attachProp = "geometry"
else if (child instanceof Fog) attachProp = "fog"

// After:
if (isMaterial(child)) attachProp = "material"
else if (isBufferGeometry(child)) attachProp = "geometry"
else if (isFog(child)) attachProp = "fog"
```

Similarly for the Object3D scene-graph sync block — `parent instanceof Object3D` → `isObject3D(parent)`.

Change `Material`, `Object3D`, `Fog`, `BufferGeometry` imports in `props.ts` to `import type` (since they're no longer used as runtime values).

Add `isMaterial`, `isObject3D`, `isFog`, `isBufferGeometry` to the utils.ts import.

- [ ] **Step 3: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/utils.ts src/props.ts
git commit -m "fix(props): duck-type Material/Object3D/Fog/BufferGeometry attach checks"
```

---

## Task 11: Drop merge() when calling useSceneGraph (useLoader+Suspense fix)

Source commit: `2ee594a`. Strategy: fresh.

**Files:** Modify `src/create-three.tsx`

- [ ] **Step 1: Locate the useSceneGraph call**

```bash
grep -n "useSceneGraph" src/create-three.tsx
```

Read ~10 lines around it. Expect to see something like:

```ts
useSceneGraph(
  context.scene,
  merge(props, { get children() { return c() } }),
)
```

(`merge` is the solid-2 rename of `mergeProps`.)

- [ ] **Step 2: Remove the merge() wrapper**

Replace with:

```ts
useSceneGraph(context.scene, { get children() { return c() } })
```

(`useSceneGraph` reads only `children` and an optional `onUpdate` that Canvas never passes — no reason to merge the full props surface, and the merge's `resolveSources` fallback chain to the user's raw children getter is what caused the Suspense crash.)

- [ ] **Step 3: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/create-three.tsx
git commit -m "fix(create-three): drop merge when calling useSceneGraph"
```

---

## Task 12: Resource attach via meta()

Source commit: `4ac1ac7`. Strategy: diff.

**Files:** Modify `src/components.tsx`

- [ ] **Step 1: Read the current Resource implementation**

```bash
grep -n "export function Resource\|useLoader\|useProps(resource" src/components.tsx
sed -n '/export function Resource/,/^}/p' src/components.tsx | head -30
```

- [ ] **Step 2: Replace the `resource → useProps → Show` flow with a meta-wrapped accessor**

Find:

```tsx
const resource = useLoader(...)
useProps(resource, rest)
return (
  <Show when={"children" in config && resource()} fallback={resource() as JSX.Element}>
    {resource => props.children?.(resource)}
  </Show>
)
```

Replace with:

```tsx
const resource = useLoader(...)

// Tag the loaded resource with meta so the surrounding scene graph reads
// `attach` (and other meta-driven props) off it when this is rendered as a JSX child.
const tagged = createMemo(() => {
  const value = resource()
  if (!value || typeof value !== "object") return value
  return hasMeta(value) ? value : meta(value as object, { props })
})

useProps(tagged, rest)

return (
  <Show when={"children" in config && tagged()} fallback={tagged() as JSX.Element}>
    {value => props.children?.(value as Accessor<LoadOutput<TLoader, LoaderUrl<TLoader>>>)}
  </Show>
)
```

Add `createMemo` to the solid-js import, and `hasMeta` + `meta` to the utils import (likely already present).

- [ ] **Step 3: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components.tsx
git commit -m "fix(Resource): tag loaded resource with meta so parent attach works"
```

---

## Task 13: Consolidate isWritable into utils.ts

Source commit: `3c488ce` (the isWritable half — isRenderer was already moved in Task 4). Strategy: diff.

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/props.ts`

- [ ] **Step 1: Locate isWritable in props.ts**

```bash
grep -n "function isWritable" src/props.ts
```

Note its definition (one line: `Object.getOwnPropertyDescriptor(object, propertyName)?.writable`).

- [ ] **Step 2: Move to utils.ts**

Delete from `src/props.ts`. Add to `src/utils.ts` (near the other `is*` helpers):

```ts
export function isWritable(object: object, propertyName: string) {
  return Object.getOwnPropertyDescriptor(object, propertyName)?.writable
}
```

- [ ] **Step 3: Update the props.ts import**

Add `isWritable` to the existing utils.ts import in `src/props.ts`.

- [ ] **Step 4: Type-check + tests**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/utils.ts src/props.ts
git commit -m "refactor(utils): consolidate isWritable into utils.ts"
```

---

## Task 14: Port regression tests

Source commits: `37903eb`, `5018338`, `03fd4a6`, `7bade2e`, `7cb2ecb`, `fa97fd6`, `a31ee8c`, `a635c3c`, `5338b52`, `f4d310b`, `2ee594a`, `5d27743`, `b78b048`, `068b8a4`, `dbbe477`. Strategy: diff per file, reconcile against any solid-2 test additions.

**Files:**
- Modify: `tests/core/renderer.test.tsx`
- Create: `tests/core/use-loader-suspense.test.tsx`
- Modify: `tests/core/hooks.test.tsx`
- Create: `tests/core/api-coverage.test.tsx`

- [ ] **Step 1: renderer.test.tsx — capture the fixes-branch additions**

```bash
git diff next-solid-2-port..fixes -- tests/core/renderer.test.tsx > /tmp/renderer-test-diff.patch
wc -l /tmp/renderer-test-diff.patch
```

Review `/tmp/renderer-test-diff.patch`. Group additions by topic:
- External RendererLike tests (instance, factory, init-await, hasInitialized skip)
- DPR-less renderer test
- domElement structural test
- Foreign Material attach (`f4d310b`)
- xr.connect/disconnect warn assertions (`fa97fd6`)
- Construction firewall tests (5 tests from `a31ee8c`)
- gl tuple tests (5 tests from `a635c3c`)
- getPendingInit unit tests (3 tests from `5018338`)
- XR-stub / shadowMap-stub integration tests (3 from `5018338`)
- Color-space split tests (`5338b52`)

- [ ] **Step 2: Read the current renderer.test.tsx structure**

```bash
grep -n "describe\|^  it\|RendererLike\|makeFakeRenderer" tests/core/renderer.test.tsx | head -40
```

- [ ] **Step 3: Apply renderer.test.tsx additions**

Add the new test blocks. Order them topically — group RendererLike tests together, firewall tests together, etc. Use the `makeFakeRenderer` helper from the fixes version (paste it once near the top of the relevant describe block).

If next-solid-2 has its own additions that conflict (e.g. test name collision), prefer the solid-2 version and skip the duplicate from fixes.

- [ ] **Step 4: Run renderer.test.tsx in isolation**

```bash
pnpm exec vitest run tests/core/renderer.test.tsx
```

Expected: all tests pass. If a firewall test fails, suspect Task 7's `merge` behavior — re-check the meta() implementation chosen.

- [ ] **Step 5: Create use-loader-suspense.test.tsx**

```bash
git show fixes:tests/core/use-loader-suspense.test.tsx > tests/core/use-loader-suspense.test.tsx
```

- [ ] **Step 6: Run use-loader-suspense.test.tsx**

```bash
pnpm exec vitest run tests/core/use-loader-suspense.test.tsx
```

Expected: 2 tests pass (no-fallback + explicit-fallback).

- [ ] **Step 7: Re-enable useLoader integration tests in hooks.test.tsx**

```bash
git diff next-solid-2-port..fixes -- tests/core/hooks.test.tsx > /tmp/hooks-test-diff.patch
```

Review. Apply the 3 useLoader test additions (single URL, record of URLs, onBeforeLoad). Replace any commented-out variants in the current solid-2 file.

- [ ] **Step 8: Run hooks.test.tsx**

```bash
pnpm exec vitest run tests/core/hooks.test.tsx
```

Expected: all tests pass including the new 3.

- [ ] **Step 9: Create api-coverage.test.tsx**

```bash
git show fixes:tests/core/api-coverage.test.tsx > tests/core/api-coverage.test.tsx
```

- [ ] **Step 10: Run api-coverage.test.tsx**

```bash
pnpm exec vitest run tests/core/api-coverage.test.tsx
```

Expected: 11 tests pass.

- [ ] **Step 11: Full suite final pass**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: all green.

- [ ] **Step 12: Commit**

```bash
git add tests/core/renderer.test.tsx tests/core/use-loader-suspense.test.tsx tests/core/hooks.test.tsx tests/core/api-coverage.test.tsx
git commit -m "test: port renderer + use-loader-suspense + hooks + api-coverage regression tests"
```

---

## Final verification

After all 14 tasks complete:

- [ ] **Step 1: Per-file diff sanity**

```bash
for f in src/types.ts src/canvas.tsx src/utils.ts src/props.ts src/components.tsx; do
  echo "=== $f ==="
  git diff next-solid-2-port..fixes -- "$f" | wc -l
done
```

Expected: each diff is small (under ~50 lines) and isolated to solid-2 idiom differences. Anything larger → revisit the port for that file.

- [ ] **Step 2: create-three.tsx diff review (expected large)**

```bash
git diff next-solid-2-port..fixes -- src/create-three.tsx | less
```

Review section-by-section. Each logical concern should be present in both versions, expressed in each branch's idiom. Specifically confirm:
- gl memo handles instance / factory / tuple / default
- XR wiring gated on `isWebXRManager`, warns on no-op
- shadow-map effect uses `isWebGLShadowMap` for needsUpdate
- Color-mgmt + tone-mapping use structural `in` checks
- Renderer init uses `createResource`
- Render gate is `rendererReady.state !== "ready"`
- Construction firewall memos in place (booleans + untracked content reads)
- useSceneGraph call has no `merge` wrapper

- [ ] **Step 3: Type-check + full test suite**

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: green.

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
```

Open in browser. Confirm:
- A basic WebGL example renders without errors.
- Console has no unexpected warnings (the new `xr.connect()` warn should NOT fire unless explicitly tested).

Stop the dev server.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u bigmistqke next-solid-2-port
gh pr create --repo solidjs-community/solid-three --base next-solid-2 --head bigmistqke:next-solid-2-port --title "feat: port WebGPU/RendererLike + construction firewall + fixes from next" --body "$(cat <<'EOF'
Ports the WebGPU/RendererLike stack, construction firewall, gl tuple form, duck-typed attach, useLoader+Suspense fix, Resource attach fix, and regression tests from `next` (now merged) onto `next-solid-2`.

See \`docs/superpowers/specs/2026-05-26-port-next-to-next-solid-2-design.md\` for the analysis and design.

## What's ported
- RendererLike + Renderer union + Register augmentation
- WebGPURenderer init() awaited via createResource
- Construction firewall memos (camera/scene/raycaster/gl no longer recreate on prop content changes)
- gl prop accepts [ctorArgs, properties] tuple
- Duck-typed Material/Object3D/Fog/BufferGeometry attach checks
- useLoader + no-fallback <Suspense> no longer crashes
- <Resource attach="..." /> propagates to parent
- isRenderer / isWritable consolidated to utils.ts
- Regression tests (~30 new tests across 4 files)

## What's NOT in this PR (followup)
- WebGPU / CSS3D / SVG playground examples
- README and CONTRIBUTING doc updates
- CI workflow updates (pnpm v11 allowBuilds, Node 22)

## Test plan
- [x] \`pnpm exec tsc --noEmit\` clean
- [x] \`pnpm exec vitest run\` green
- [ ] Manual: WebGL example renders, no console errors
EOF
)"
```

---

## Self-review checklist (run before considering plan done)

- **Spec coverage:** Every F1–F8 group in the spec maps to a task (F1→T2, F2→T3, F3→T4–6, F4→T7–9, F5→T10, F6→T11, F7→T12, F8→T13, F-TESTS→T14). ✓
- **Placeholder scan:** No "TBD", "implement later", or vague error-handling placeholders. ✓
- **Type consistency:** `isRenderer` signature reused across T3→T4→T8; `shallowEqual` signature consistent between T9 definition and T9 usage; `createResource` form in T6 matches the `getPendingInit` signature in T4. ✓
- **Solid-2 trap awareness:** T7 includes the explicit `merge` semantics smoke test with a fallback path. The risk register's #1 (merge-vs-mergeProps for getter preservation) has a concrete mitigation step. ✓
- **Reversibility:** Each commit is independently revertable; the per-commit `tsc + vitest` gate guarantees the branch stays green throughout. ✓
