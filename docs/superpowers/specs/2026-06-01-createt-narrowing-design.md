# solid-three catalogue narrowing — bundler-as-analyzer design

**Date:** 2026-06-01
**Status:** Design, spike-validated. Supersedes and replaces the earlier ts-morph / unplugin / alias-resolution / soundness-guard design (deleted).
**Scope:** A Vite plugin that makes `createT(THREE)` tree-shakeable, by letting the **bundler itself** compute which catalogue members are used.

## The problem

`solid-three` exposes a concise factory: `const T = createT(THREE)`, used as `<T.Mesh/>`, `<T.BoxGeometry/>`, … `createT` returns an opaque runtime **Proxy** over the catalogue. Because `import * as THREE from "three"` flows into that proxy **as a whole value**, the bundler cannot see which classes are reached through `T`, so it retains *all* of three. Concise to write; terrible to bundle.

The goal: ship only the three (or custom) classes actually reached through `T`, **without** changing the `createT` API or its dynamism.

## The key insight

Modern bundlers (Rollup, and Vite which builds on Rollup) **already** tree-shake namespace imports: `import * as NS from "x"; NS.Mesh` retains only `Mesh` — *as long as `NS` is never used as a whole value*. The proxy is the only thing defeating this.

So instead of reimplementing cross-file usage analysis ourselves (the old ts-morph approach), we **borrow the bundler's**: transiently turn `T` into a real namespace, let the bundler tree-shake it, and read back which members survived. The bundler is the analyzer — and it is exact, whole-program, and handles dynamic imports, code-splitting, renames, and re-exports natively.

### Division of labor

- **"Which keys are used"** — the hard, cross-file question → **the bundler measures it.** It follows `T` across every module, takes the union of accessed members, and (critically) **deoptimizes soundly**: any dynamic access or escape makes it keep *everything*.
- **"What provides each key"** — the catalogue's contents → read **locally** from the `createT(<arg>)` expression at the call site. A single expression; no cross-file resolution, no aliases, no module graph. This is the only analysis code we keep.

## Validation (spikes, Rollup + Vite)

All confirmed empirically before committing to the design:

| Case | Result |
| --- | --- |
| Cross-file namespace access (`export * as T` and `import * as T; export {T}`) | tree-shakes; unused members dropped across the file boundary |
| Cross-file **union** (file A uses `T.A`, file B uses `T.B`) | exactly `A,B` kept; `C` dropped; `renderedExports = ["A","B"]` |
| **Dynamic** `T[expr]` | **keeps all** (sound deopt) |
| **Escape** (`T` passed to a function) | **keeps all** (sound deopt) |
| **Spread** `{...T}` | **keeps all** (sound deopt) |
| **Custom object literal** `createT({MyMesh, Other})`, only `T.MyMesh` used | baseline (opaque) retains all; narrowed emit drops the unused custom class |
| **Override / precedence** `createT({...THREE, Mesh: Custom})`, `T.Mesh`+`T.Group` used | emit `createT({Group: THREE.Group, Mesh: Custom})` → `THREE.Mesh` **dropped** (overridden), `THREE.Group` kept, `Custom` kept |

The measurement signal is Rollup's `chunk.modules[id].renderedExports` (the exports that survived tree-shaking) — a first-class API, not a hack.

## Architecture — two passes

The plugin runs only on **production builds** (dev keeps the untouched runtime proxy). It keeps `createT` in the shipped output (debugging and runtime semantics unchanged — the namespace form is internal-only). That requires two passes:

### Pass 1 — measure

For each analyzable `createT(<arg>)` call:

1. Read `<arg>` locally to derive the **key universe** (all keys the catalogue *could* provide) — see provider-map below.
2. Rewrite the result binding into a **namespace import of a throwaway scaffold module**: `const T = createT(THREE)` → `import * as T from "\0solid-three:measure:<callId>"` (plus the original `export`, if any). The scaffold module (virtual, per call) has one droppable named export per key in the universe (`export const Mesh = 0`, …).
3. Build. In `generateBundle`, read `renderedExports` of each scaffold module → the **exact used-key set** for that call.

The scaffold is never shipped; its only job is to make the bundler report usage. Its export *values* are irrelevant (they're droppable placeholders); only the export *names* matter.

### Pass 2 — emit

For each `createT(<arg>)` call, rewrite `<arg>` to an explicit object containing only the used keys, each mapped to its locally-resolved provider:

```js
// createT(THREE), used = {Mesh, Group}
createT({ Mesh: THREE.Mesh, Group: THREE.Group })
```

`createT` stays in the output; runtime shape (proxy/object/identity — whatever `createT` does) is unchanged. The bundler then tree-shakes three down to the referenced members.

## The provider-map (the only local analysis we keep)

Reading `<arg>` at the call site yields, for each key, the expression that provides it. Rules (v1's logic, re-validated):

| `<arg>` shape | key universe | provider for key `K` |
| --- | --- | --- |
| namespace import `THREE` (`import * as THREE from "three"`) | the module's exports | `THREE.K` |
| custom namespace (`import * as W from "three/webgpu"`) | that module's exports | `W.K` |
| object literal `{ K: expr, … }` | the literal's keys | `expr` |
| spread `{ ...THREE, K: expr }` | union of namespace + explicit keys | **last writer wins** (walk in source order) |
| getter/method `{ get K(){…} }` | `K` | the getter/method, **copied verbatim** |

**Bail (leave `createT(...)` completely untouched → full, dynamic, sound):**

- `createT(store)` / `createT(someVar)` — key set not statically enumerable.
- `createT({ [computed]: x })` — computed key.
- `createT({ ...someRuntimeObject })` — spread of a non-namespace value.

A usage-site dynamic access (`T[expr]`) is **not** a bail — the bundler deopts that catalogue to keep-all in pass 1, so it measures as fully-used and pass 2 emits the full set. Sound, just unoptimized.

Deriving the key universe for a namespace requires reading that module's export names: for `three`/`three/webgpu` (node-resolvable) we enumerate exports directly; for a custom namespace module we resolve and read its exports (one module, via the bundler — not a graph walk).

## Soundness

Narrowing ships only the keys the bundler reports as used. The bundler reports exactly what survived tree-shaking, and **deopts to keep-all on any access it cannot statically resolve** — so it never under-reports usage for reachable code. The only condition is that the measurement build and the real build see the **same module graph**; they do, because the measurement build uses the **same resolved Vite config and entries**, and the namespace rewrite touches only the `createT` call sites (it does not change which app modules are reachable). The deopt direction is always *over-retain*, never *under-retain* — so a broken bundle cannot ship.

No guard, no completeness proof, no alias replication: soundness is a property of the bundler's own tree-shaking, which we measure rather than reconstruct.

## Orchestration

The two passes run inside one plugin invocation:

- `configResolved(config)` captures the resolved config (root, entries, plugins).
- `buildStart` of the real build triggers a **measurement sub-build** via Vite's JS API with the *same resolved config* plus a measure-mode flag (apply the pass-1 namespace rewrite, `write: false`, capture `renderedExports` in `generateBundle`). A re-entrancy guard prevents the sub-build from recursing.
- The captured used-key sets are handed to the real build's `transform`, which applies the pass-2 emit.

Cost: ~2× build, production-only. This is the one piece of real engineering left — and it is far smaller than the deleted ts-morph + resolution-host + guard surface.

Parsing the `createT` argument needs a TS/JSX-aware parse of a *single module* (to find the call and read `<arg>`) — not a project Program. Options: the bundler's `this.parse`, or a small standalone parse (oxc/acorn-with-jsx/babel). To be settled in the plan.

## What this deletes (vs the old design)

Gone: ts-morph whole-project `Program`, `findReferencesAsNodes` symbol following, the source-glob discovery, the custom resolution host, Vite `resolve.alias` replication, the resolution-agreement guard, and **unplugin** (Vite-only now). The cross-file engine is replaced by the bundler; only the local provider-map reader and the two-pass orchestration remain.

## Non-goals

- No change to the `createT` runtime API or its dynamism. Dynamic catalogues stay fully dynamic (we bail).
- No cross-bundler support. Vite only. (The mechanism is Rollup-native, so a Rollup plugin is a later possibility, but not a goal.)
- No dev-mode narrowing — dev keeps the runtime proxy.

## Open questions

- **Orchestration details:** nested `build()` ergonomics, re-entrancy flag mechanism, and threading `renderedExports` from sub-build to real build. The main thing to prototype.
- **Multiple `createT` calls / multiple catalogues:** one scaffold + used-set per call; confirm per-call isolation in the measurement build.
- **`createT` argument parser:** `this.parse` vs a bundled parser; must handle TS/JSX at `enforce: "pre"`.
- **2× build cost:** acceptable for production? Possible mitigations (lighter measure build: no minify, skip non-essential plugins) — but the measure graph must match the real graph, so prune carefully.
- **Single-pass fast path (deferred):** if the wrapped-namespace form were ever an acceptable shipped runtime, `createT(THREE)` could skip pass 2 entirely. Rejected for now (debugging clarity; keep `createT`), but the mechanism supports it.

## Test strategy

- The spikes become **fixtures**: real `vite build` of small consumer projects asserting the right classes drop/survive, plus the deopt cases (dynamic/escape/spread → keep-all) and the override/precedence case.
- The browser **soundness oracle** (mount a scene through the mocked `solid-three`, assert every class requested at runtime is in the narrowed catalogue) remains the release gate.
- Unit-test the local provider-map reader (namespace / literal / spread-precedence / getter-verbatim / bail cases) directly.
