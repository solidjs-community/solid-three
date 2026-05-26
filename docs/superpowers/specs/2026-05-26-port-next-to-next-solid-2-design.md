# Port `next` → `next-solid-2`: design

**Date:** 2026-05-26
**Branch source:** `bigmistqke/fixes` (= `next` + #55 in-flight)
**Branch target:** `solidjs-community/next-solid-2`
**Worktree:** `/Users/bigmistqke/Documents/GitHub/solid-three-port` on `next-solid-2-port`
**End goal:** A Solid 2 release with feature parity to `next` (WebGPU/RendererLike, construction firewall, all fixes, regression tests).

## Phase 0 — Commit analysis

### Architecture delta between `next` and `next-solid-2`

`next-solid-2` diverged from a common ancestor (`3e6a661`) and refactored the runtime to Solid 2.x conventions. The most consequential differences for porting:

| Concern | `next` (source) | `next-solid-2` (target) |
|---|---|---|
| Context propagation | `createRoot(() => { ... withContext(...) ... })` wrappers | top-level `setContext()` from `@solidjs/signals` (no `createRoot` wrapper around the calls) |
| `mergeProps` | `mergeProps` from solid-js | `merge` from solid-js (Solid 2 renamed) |
| Reactivity primitives | `createEffect` / `createComputed` | mostly `createRenderEffect` + `createMemo`; `runWithOwner`/`omit`/`untrack` used in extra places |
| Debug instrumentation | none | `createDebug()` calls scattered (gated on `import.meta.env.DEV`) |
| `mapArray` lifecycle | passed inside lambda inside `createComputed` | created once and passed directly as the compute fn to `createRenderEffect` — preserves item-owners across re-runs |
| `useSceneGraph` | R3F-style two-pass (per-item lifecycle + scene-graph sync loop) | functionally equivalent but expressed via the Solid 2 pattern above |
| `whenMemo` / `whenEffect` | removed | still present (used by orbit-controls, etc.) |

**Implication:** anywhere a port commit touches `create-three.tsx`, the change must be expressed against the `setContext`-shaped file — do NOT reintroduce `withContext`/`createRoot`-wrapped context plumbing. Anywhere a port commit references `mergeProps`, swap to `merge`. Anywhere it adds new effects, prefer `createRenderEffect` to match the surrounding style.

### Already-in-next-solid-2 (skip during port)

These commits from the `fixes` lineage have already been ported (sometimes under a different SHA) into `next-solid-2`. Verified by reading the target files.

- `f10acf3` move `useRef` to end of create-three — present as `5edff06`
- `a7538f4` rename `defaultCamera`/`defaultRaycaster` → `camera`/`raycaster` — `src/canvas.tsx:32,34`
- `b2bd1c3` useSceneGraph R3F-style ordering — present in Solid 2 idiom (`props.ts:181+`)
- `7977b01` canvas-level `onClick`/`onClickMissed` not firing — fix present (`create-events.ts:187,253,278`)
- `d5bba33` autodispose T-components on unmount — present (`create-t.tsx:74`)
- `0e8afac` vitest config + jsdom setup — `vitest.config.ts` + `tests/setup.ts` exist
- `089a165` / `407678a` / `5f2e2b2` type-error sweep — `next-solid-2` has its own working test suite, so equivalent fixes are in place
- `e8312ac` Set.difference compat / `e7a96bb` Iterator.toArray compat — `src/` no longer uses these primitives
- Demo files (`f178466`, `b050815`, `f94a1ae`, `d03e0a0`, `3d0d678`, `31d10f8`) — present
- `2aac8a6` CONTRIBUTING rename — verify; if absent, mechanical port

### Must-port: features and fixes (the meat)

Grouped by logical feature. Each group is the unit of one port commit. Within each group, the **Final outcome** column is what matters — intermediate refinements are folded into the final state and not ported as their own commits.

#### F1. RendererLike type + Renderer union + Register augmentation

- **Intent:** Widen `<Canvas gl>`, `Context.gl`, and `useThree().gl` from `WebGLRenderer` to a tagged union (`WebGLRenderer | WebGPURenderer | RendererLike`) so users can supply any renderer matching a structural contract. Add a `Register` interface as a module-augmentation point for project-level renderer narrowing.
- **Source commits:** `497eb60`, `2b678b3`, `79db70b`, `7cb2ecb`, `0bdaa7f`, `f47b7c2`, `03fd4a6` (DPR optionality on `RendererLike`)
- **Final outcome (`src/types.ts`):**
  - `RendererLike` interface with `render`, `setSize`, `domElement: Element` (required); `setPixelRatio?`, `getPixelRatio?`, `xr?`, `shadowMap?`, `init?`, `hasInitialized?` (optional). `xr` and `shadowMap` typed as the union of WebGL and WebGPU equivalents so union access doesn't need `'field' in gl`.
  - `Renderer = WebGLRenderer | WebGPURenderer | RendererLike`.
  - `interface Register {}` (empty) + `ResolvedRenderer = Register extends { renderer: infer R } ? R : Renderer`.
- **Iteration notes:** `2b678b3` and `7cb2ecb` are loosening passes after the initial design — fold into the final shape. `497eb60`'s downstream `domElement` removal was reverted by `7cb2ecb`; keep `domElement` required.
- **Files:** `src/types.ts` (+~50 lines), `src/utils.ts` (1-line `hasColorSpace` generic widening), `src/canvas.tsx` (gl-prop type)
- **Dependencies:** none — pure type-level foundation.

#### F2. Canvas runtime: accept RendererLike + await init + structural color mgmt + DOM-renderer support

- **Intent:** Make `gl` prop accept any RendererLike instance, factory, or default-config. Await `renderer.init()` before the first frame (WebGPU). Switch `instanceof WebGLRenderer` color/tone-mapping gates to `'prop' in gl` structural checks so WebGPU also gets color management. Mark `setPixelRatio`/`getPixelRatio` optional for DOM renderers (CSS3D/SVG). Default `context.dpr` to `1` when the renderer has no `getPixelRatio()`. Lock out the config-object `gl` shorthand when `Register` narrows the renderer to something other than `WebGLRenderer`.
- **Source commits:** `14489dd`, `dcbab71`, `5338b52`, `03fd4a6`, `7bade2e`, `f47b7c2`
- **Final outcome (`src/canvas.tsx` + `src/create-three.tsx`):**
  - Canvas `gl` prop types: union of `Partial<Props<WebGLRenderer>>` (only when `WebGLRenderer extends ResolvedRenderer`), tuple form (F4), factory returning `ResolvedRenderer`, or instance.
  - `gl` memo in `create-three.tsx` orders branches by detection: instance first (`isRenderer(value)`), then factory, then default WebGLRenderer.
  - Color-mgmt effect gates on `'outputColorSpace' in gl` / `'toneMapping' in gl` (not `instanceof WebGLRenderer`).
  - `outputEncoding` setter removed (legacy r152 API).
  - Resize observer calls `setPixelRatio?.(...)`.
  - `context.dpr` getter returns `gl.getPixelRatio?.() ?? 1`.
- **Iteration notes:** `7bade2e` overrides `03fd4a6`'s `globalThis.devicePixelRatio` fallback with `1`. Port the `1` version.
- **Files:** `src/canvas.tsx`, `src/create-three.tsx` (the `gl` memo + color-mgmt + resize effects), `src/types.ts` (gl-prop signature)
- **Dependencies:** F1 (Renderer union types).

#### F3. create-three: duck-typed manager narrows + getPendingInit + isRenderer + xr warning + createResource init

- **Intent:** Reconcile the WebGL/WebGPU divergence at the manager level. Add duck-typed `isWebXRManager` (`setAnimationLoop` discriminator) and `isWebGLShadowMap` (`needsUpdate` discriminator) so XR session wiring and shadow-map writes gate cleanly without `instanceof`-importing manager classes. Add `getPendingInit(renderer)` to detect `init`/`hasInitialized` once. Add `isRenderer(value)` for renderer-instance detection (used by the F2 `gl` memo). Warn (console.warn) when `xr.connect`/`xr.disconnect` is called on a renderer without a WebXR-shaped `xr` manager. Refactor renderer init from async-createEffect-with-cancelled-flag to `createResource` (idiomatic tracked-async with built-in cancellation).
- **Source commits:** `da37a66`, `fa97fd6`, `3c488ce` (`isRenderer` consolidation), `addab6f`
- **Final outcome:**
  - `src/utils.ts`:
    - `isRenderer(value)` — `render` + `setSize` are functions.
    - `isWebXRManager(value)` — `setAnimationLoop` is a function.
    - `isWebGLShadowMap(value)` — has `needsUpdate` property.
    - `getPendingInit(renderer)` — returns `() => Promise<void>` or `undefined`.
  - `src/create-three.tsx`:
    - XR wiring (`handleSessionChange`, `xr.connect`, `xr.disconnect`, the connect effect) gated on `isWebXRManager(context.gl.xr)`; emits `console.warn` on no-op.
    - Shadow-map effect: writes `enabled` + `type` for any renderer; writes `needsUpdate = true` only when `isWebGLShadowMap` matches.
    - Renderer init driven by `createResource(() => gl(), renderer => { const init = getPendingInit(renderer); if (!init) return true; pre-size canvas; return init().then(() => true) })`. `render()` early-returns on `rendererReady.state !== "ready"`.
- **Iteration notes:** `addab6f` is the final form — earlier `dcbab71`'s manual-cancellation flag is superseded. Port `addab6f` directly, not `dcbab71`.
- **Files:** `src/utils.ts` (+~70 lines), `src/create-three.tsx` (XR section + render gate + init resource)
- **Dependencies:** F1, F2.

#### F4. Construction firewall + gl tuple form

- **Intent:** Stop `<Canvas camera={{ position: pos() }}>` from re-running construction memos (and reallocating the camera) on every prop-content change. Each construction memo branches on a cheap derived memo of the input *kind* (`cameraIsInstance`/`sceneIsInstance`/`raycasterIsInstance` booleans, `orthographicFlag`, `glKind: "factory" | "instance" | "default"`). The full prop object is read only inside the instance branch where the identity matters. Adds `[constructorArgs, properties]` tuple form for `gl`: tuple[0] drives construction (shallow-equality recreation), tuple[1] applied reactively. Also fixes a pre-existing bug where `meta()`'s augmentation spread invoked getters at merge-time, leaking signal tracking into the caller.
- **Source commits:** `00c664d` (meta-getter fix), `a31ee8c` (firewall), `aaeec88` (meta uses mergeProps), `a635c3c` (gl tuple)
- **Final outcome:**
  - `src/utils.ts`:
    - `meta(instance, augmentation)` uses `mergeProps`/`merge` so getters in `augmentation` are not invoked at meta-construction time. In `next-solid-2` this means `merge(data, augmentation)` (verify against solid-2's `merge` semantics — must preserve getters identically).
    - `shallowEqual(a, b)` (re-exported; used by the F4 gl-tuple memo).
  - `src/create-three.tsx`:
    - `cameraIsInstance = createMemo(() => props.camera instanceof Camera)`.
    - `orthographicFlag = createMemo(() => Boolean(props.orthographic))`.
    - `sceneIsInstance = createMemo(() => props.scene instanceof Scene)`.
    - `raycasterIsInstance = createMemo(() => props.raycaster instanceof Raycaster)`.
    - `glKind = createMemo(() => isRenderer(props.gl) ? "instance" : typeof props.gl === "function" ? "factory" : "default")`.
    - Construction memos depend only on these booleans; the full prop body is read in untracked spots within each branch.
    - `gl` memo accepts tuple `[ctorArgs, properties]`: `glConstructorArgs = createMemo(() => tuple[0], { equals: shallowEqual })`. tuple[1] feeds `useProps` reactively. Previous renderer is disposed when solid-three built it (factory/instance-supplied left alone).
- **Iteration notes:** `aaeec88` supersedes `00c664d`'s `defineProperties` approach. Port the `mergeProps`/`merge`-based form.
- **Files:** `src/utils.ts`, `src/create-three.tsx`, `src/canvas.tsx` (gl-prop tuple type), `src/types.ts` (if `shallowEqual` lives there — confirm during port)
- **Dependencies:** F1, F2, F3 (`isRenderer`). Also depends on the meta-getter fix being landed first (otherwise firewall memos leak signal tracking).

#### F5. Duck-typed Material/Object3D/Fog/BufferGeometry attach checks

- **Intent:** Replace `instanceof Material`/`Object3D`/`Fog`/`BufferGeometry` in `applySceneGraph` with `isMaterial`/`isObject3D`/`isFog`/`isBufferGeometry` duck-type helpers (mirroring three.js's own `is*` markers). Survives cases where a class comes from a separate module instance of three (e.g. `three/webgpu`'s `MeshBasicNodeMaterial` doesn't share class identity with the `Material` base imported from `three`).
- **Source commits:** `068b8a4`
- **Final outcome:**
  - `src/utils.ts`: `isMaterial`, `isObject3D`, `isBufferGeometry`, `isFog` (each: `!!value && value.is<X> === true`).
  - `src/props.ts`: `instanceof` checks replaced; three imports become type-only.
- **Files:** `src/utils.ts`, `src/props.ts`
- **Dependencies:** F1 (only because `next-solid-2` props.ts has its own structure to integrate into; no type dependency).

#### F6. useLoader + Suspense fix (drop mergeProps in useSceneGraph call)

- **Intent:** Fix "Hooks can only be used within the Canvas component" crash when `useLoader` resolves inside a no-fallback `<Suspense>`. Root cause: `useSceneGraph(context.scene, mergeProps(props, { get children() { return c() } }))` — `mergeProps`'s `resolveSources` fell through to the user's raw `<Canvas>` JSX children getter when `c()` transiently returned `undefined`, invoking it in an owner outside solid-three's Provider tree.
- **Source commits:** `2ee594a`
- **Final outcome (`src/create-three.tsx`):**
  - One-line change in the canvas's `useSceneGraph` call: pass a plain object literal `{ get children() { return c() } }` — no `mergeProps`/`merge` wrapper.
- **Files:** `src/create-three.tsx` (1 line)
- **Dependencies:** none. Independent fix.
- **Solid-2 note:** Confirm the equivalent call site uses `merge` in `next-solid-2`. The same crash should apply, since `merge` builds an analogous fallback chain. Port the fix to the equivalent call shape.

#### F7. Resource attach via meta()

- **Intent:** `<Resource attach="map" />` was a no-op. `useProps(resource, rest)` split `attach` into `local` but never wrote it to the resource's meta; when the resource was rendered as a JSX child, the parent's `applySceneGraph` fell through to the auto-attach fallbacks and ignored the prop. Fix: wrap the resolved value with `meta(value, { props })` so the parent reads `attach` off the child's meta.
- **Source commits:** `4ac1ac7`
- **Final outcome (`src/components.tsx`):**
  - `Resource`: introduce `tagged = createMemo(() => { const value = resource(); return hasMeta(value) ? value : meta(value, { props }) })`. Use `tagged` in both `useProps` and the `<Show>` fallback.
- **Files:** `src/components.tsx`
- **Dependencies:** F4 (meta-getter fix must be in place so this wrapping doesn't leak signals).

#### F8. isWritable consolidation

- **Intent:** Move `isWritable` (one-line `Object.getOwnPropertyDescriptor(...).writable`) from `props.ts` to `utils.ts`, alongside the other `is*` helpers.
- **Source commits:** `3c488ce` (the `isWritable` half — the `isRenderer` half lives in F3)
- **Final outcome:** `isWritable` exported from `utils.ts`; `props.ts` imports it.
- **Note:** `next-solid-2`'s `props.ts` already defines `isWritable` at line 37. Port = relocate it. Trivial.
- **Dependencies:** none.

### Must-port: tests

Tests landed alongside features in `next`; in the port we collapse them into a single test-additions commit (F-TESTS) at the end so each feature commit stays focused on src changes.

Test files to add or augment in `next-solid-2-port`:

- `tests/core/renderer.test.tsx` — many additions across `37903eb`, `5018338`, `03fd4a6`, `7bade2e`, `7cb2ecb`, `fa97fd6`, `a31ee8c`, `a635c3c`, `5338b52`, `f4d310b`. The final state on `fixes` is the target.
- `tests/core/use-loader-suspense.test.tsx` — new file from `2ee594a` + `b78b048`.
- `tests/core/hooks.test.tsx` — three useLoader tests re-enabled (`5d27743`).
- `tests/core/api-coverage.test.tsx` — new file from `dbbe477`.

**Reconciliation:** `next-solid-2` likely has its own additions to `renderer.test.tsx` and possibly other files (it has been advancing independently). Resolve per-file at the F-TESTS commit by reading both versions and merging. Add only the new test blocks; don't touch existing solid-2-specific tests.

### Must-port: docs

- `2aac8a6` CONTRIBUTING.md rename + trim — verify if already done in `next-solid-2`; if not, port mechanically.
- README updates: `6a9f2d6`, `3d43146`, `bf5dd8f`, `e2d4ad5`. Diff the `README.md` sections that touch `useThree.gl`, `dpr`, Canvas `gl` shorthand, custom renderers, `Register` augmentation. Apply only the parts not already in `next-solid-2`.
- Playground examples: `3c349f3` (webgpu-simple, webgpu-tsl), `bccecd3` (subpath swap), `0c49e4f` (CSS3D), `d5e0cb8` (CSS3D JSX cleanup), `0907cd5` (SVG). All new files; mechanical add.

### Must-port: CI / deps

- `33d5a78` three + @types/three → `^0.181`. Affects `package.json` + `pnpm-lock.yaml` + `tests/web/__snapshots__/canvas.test.tsx.snap` (`data-engine` attribute) + `renderer.test.tsx` (color-space sentinel).
- `b02bf03` Node 22 in CI workflow.
- `aa7eded` pnpm v11 `allowBuilds` in `pnpm-workspace.yaml`. (Earlier intermediate commits `e292d53`, `f639594`, `92b339d` are superseded — port only the final `aa7eded` form.)
- `f4b7bfb` CI typecheck + test steps before build.

### Skipped commits (no port action)

- `b02bf03`'s rationale (corepack pulling pnpm 11) may not apply if `next-solid-2` is already on Node 22 — verify, otherwise port.
- `f4b7bfb` — `next-solid-2` likely already runs typecheck/test in CI. Confirm by reading the workflow.
- `e7a96bb`, `e8312ac` — Node 20 compat shims. Confirm `next-solid-2`'s `src/` doesn't use `Iterator.toArray`/`Set.difference`; if clean, skip.

## Phase 1 — Port plan (14 commits)

In dependency order. Each row = one commit. The "fresh" strategy means: write the change in solid-2 idiom against the current `next-solid-2-port` file, using the `next` version only as semantic reference.

| # | Commit message | Files | Strategy | Source feature |
|---|---|---|---|---|
| 1 | `chore(deps): bump three and @types/three to ^0.181` | `package.json`, `pnpm-lock.yaml`, snapshot, color-space test fixture | diff | `33d5a78` |
| 2 | `feat(types): RendererLike + Renderer union + Register augmentation` | `src/types.ts` (+ tiny `hasColorSpace` widening in `src/utils.ts`) | diff | F1 |
| 3 | `feat(canvas): accept RendererLike, await init, structural color mgmt, DOM-renderer DPR` | `src/canvas.tsx`, `src/create-three.tsx` (gl memo + color/tone effects + resize) | **fresh** in create-three | F2 |
| 4 | `feat(utils): isRenderer + isWebXRManager + isWebGLShadowMap + getPendingInit + duck-typed manager narrows in create-three` | `src/utils.ts`, `src/create-three.tsx` (XR section + shadow-map effect) | diff (utils) + **fresh** (create-three) | F3 (first half) |
| 5 | `feat(xr): warn when context.xr.connect/disconnect is a no-op` | `src/create-three.tsx` | **fresh** | F3 (warn) |
| 6 | `refactor(create-three): use createResource for renderer init` | `src/create-three.tsx` (init section + render gate) | **fresh** | F3 (createResource) |
| 7 | `fix(utils): meta() preserves getters via merge` | `src/utils.ts` | diff (verify Solid 2 `merge` semantics) | F4 (meta) |
| 8 | `feat(canvas): construction firewall memos against reactive prop content` | `src/create-three.tsx` | **fresh** | F4 (firewall) |
| 9 | `feat(canvas): accept [ctorArgs, properties] tuple for the gl prop` | `src/canvas.tsx`, `src/create-three.tsx`, `src/utils.ts` (shallowEqual) | diff (canvas/utils) + **fresh** (create-three) | F4 (tuple) |
| 10 | `fix(props): duck-type Material/Object3D/Fog/BufferGeometry attach checks` | `src/utils.ts`, `src/props.ts` | diff | F5 |
| 11 | `fix(create-three): drop merge when calling useSceneGraph` | `src/create-three.tsx` (1 line) | **fresh** | F6 |
| 12 | `fix(Resource): tag loaded resource with meta so parent attach works` | `src/components.tsx` | diff | F7 |
| 13 | `refactor(utils): consolidate isWritable into utils.ts` | `src/utils.ts`, `src/props.ts` | diff | F8 |
| 14 | `test: port renderer + use-loader-suspense + hooks + api-coverage tests` | `tests/core/renderer.test.tsx`, `tests/core/use-loader-suspense.test.tsx`, `tests/core/hooks.test.tsx`, `tests/core/api-coverage.test.tsx` | diff per file, reconcile against any solid-2 test additions | F-TESTS |

**Docs + playground + CI** are deferred to a separate follow-up commit (or two), not blocking the feature port. They are mechanical adds.

## Phase 2 — Execution discipline

Per commit:
1. Read the current `next-solid-2-port` version of each touched file.
2. Read the `fixes` version (`git show fixes:<path>`) as reference for the desired final outcome.
3. For **diff** strategy: extract the relevant chunks from `git diff next-solid-2-port..fixes -- <path>` and apply, accepting solid-2 idiom where it differs.
4. For **fresh** strategy: write the change directly in `create-three.tsx`'s solid-2 patterns. Verify intent against the `next` reference, but do not copy.
5. Run `pnpm exec tsc --noEmit`. If fail: fix or stop and surface.
6. Run `pnpm exec vitest run`. If fail: fix or stop and surface.
7. Commit. Move to next.

**Do not batch commits.** If commit N's tests pass but commit N+1's fail, the bisect point is unambiguous.

**Solid-2-specific traps to watch for:**
- `merge` vs `mergeProps`: name differs; check semantics around `undefined` fallback are equivalent before relying on them in F6's reasoning.
- `setContext` is called top-level, not inside `createRoot` — adding a new effect that uses `useThree()` from a different owner may not see the context. Verify with `describeOwnerChain()` if in doubt.
- `createDebug()`-style instrumentation: when porting `create-three.tsx`, do NOT remove the existing debug calls; add new ones if helpful, in the same style.

## Phase 3 — Final verification

After all 14 commits land:

1. **Per-file diff sanity:**
   ```
   git diff next-solid-2-port..fixes -- \
     src/types.ts src/canvas.tsx src/utils.ts src/props.ts src/components.tsx
   ```
   Should be **small** and limited to solid-2 idiom differences (setContext imports, merge vs mergeProps, debug helpers, etc.). Any large diff in these files indicates a missing port.

2. **`create-three.tsx` diff is expected to be large** (different architecture). Validate by reviewing the diff and confirming each section in `next-solid-2-port`'s version implements the same logical concern as the `fixes` version.

3. **Test suite passes** on `next-solid-2-port`: `pnpm exec vitest run`.

4. **Type-check passes:** `pnpm exec tsc --noEmit`.

5. **Manual smoke test** (recommended for createResource):
   - Open WebGL playground example; confirm scene renders.
   - Open WebGPU playground example (after porting `3c349f3`); confirm scene renders.
   - Open CSS3D playground example (after porting `0c49e4f`); confirm carousel rotates.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `merge` from solid-js doesn't preserve getters the same way `mergeProps` does, breaking F4's firewall | Medium | High (firewall doesn't fire) | Smoke-test F7 (meta fix) standalone before F8 (firewall). Add a focused test that asserts `meta()` does NOT track signals in its augmentation getters. |
| `setContext` ordering with `createResource` — calling `createResource` inside an effect that uses context may need extra `runWithOwner` | Medium | Medium | If F6 (createResource) fails owner-chain checks, wrap in `runWithOwner(rootOwner, () => ...)`. |
| F2's `'outputColorSpace' in gl` structural check fails when `next-solid-2`'s renderer narrows differently | Low | Low | Type-only concern; runtime semantics identical. Reconcile at commit time. |
| Tests reference `mergeProps` directly | Low | Low | Find-replace to `merge`; verify import. |
| `WebGL2RenderingContext` shim in `src/testing/index.tsx` doesn't expose what r0.181 expects | Medium | Medium | Diagnostic step — if `vitest` fails post-three-bump, inspect the shim and add missing methods (likely `getParameter` constants). |

## Out of scope

- Backporting `next-solid-2`-specific improvements (debug helpers, `@solidjs/signals`-based context) to `next`.
- Refactoring `next-solid-2`'s pre-existing patterns to match `next` (one-way port).
- Fixing pre-existing `next-solid-2` bugs unrelated to the port.
- Publishing a release. The port produces a green branch; release tagging is a separate decision.

## Estimated effort

- Phase 0 (this doc): done.
- Phase 1 (commits 1–14): 6–10 hours.
  - Commits 1, 2, 7, 10, 12, 13: ~15 min each (diff-port).
  - Commits 3, 4, 5, 6, 8, 9, 11: ~30–90 min each (fresh-port; commits 3, 6, 8 are the heaviest).
  - Commit 14: ~1–2 hours (test reconciliation).
- Phase 2 verification per commit: ~5 min (tsc + vitest).
- Phase 3 final verification: ~30 min including manual smoke test.

Followup (not blocking): docs/playground/CI ports — ~1 hour.
