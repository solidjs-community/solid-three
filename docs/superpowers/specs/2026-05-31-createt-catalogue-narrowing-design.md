# `unplugin-solid-three` — static catalogue narrowing

**Date:** 2026-05-31
**Status:** Design approved, pending implementation plan
**Companion:** `2026-05-31-createt-narrowing-scenarios-exploration.md` (the
scenario/complexity catalogue this spec distills).

## Problem

`createT` accepts a catalogue object and returns a runtime `Proxy` that lazily
wraps catalogue constructors into Solid components:

```ts
import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)
//  <T.Mesh><T.BoxGeometry /><T.MeshNormalMaterial /></T.Mesh>
```

`import * as THREE from "three"` flows the entire namespace into `createT`.
Because the result is a `Proxy`, the bundler sees an opaque object consumed by a
function and cannot prove which classes are reachable, so it retains **all** of
THREE. Tree-shaking is defeated.

The same holds for a hand-written partial: each value statically references a
class, so the class is retained *because the literal references it* — even if
that member is never accessed through `T`.

## Value proposition: automate the documented curation

The Tour already prescribes the manual fix (chapter 1, "Your first scene"):

> In real apps you'd pass only the classes you use … so whatever you leave out
> tree-shakes away and your bundle stays small.

Hand-curation works but costs ongoing effort: you must keep the catalogue object
in sync with usage, and forgetting a class is a compile error. **This plugin
automates exactly that curation.** You keep writing the concise, fully-typed
`createT(THREE)` the Tour teaches; at build time the plugin rewrites it to the
curated catalogue you would have written by hand:

```ts
// source (unchanged): full type, full autocomplete, no sync burden
const T = createT(THREE)

// build output: only the classes actually reached via T
const T = createT({
  Mesh: THREE.Mesh,
  BoxGeometry: THREE.BoxGeometry,
  MeshNormalMaterial: THREE.MeshNormalMaterial,
})
```

The `import * as THREE` stays, but only static `THREE.Mesh`-style accesses
remain, so the bundler tree-shakes every untouched class. The `createT` runtime
is unchanged — the proxy just wraps a smaller object. The editor still sees the
full `T` type, because the source is untouched and the transform runs after
typecheck.

## Requirements

- **Exhaustive, symbol-accurate tracking.** The common shape is one shared
  module doing `export const T = createT(THREE)` imported across many files, but
  module-local, renamed, re-exported, and aliased forms must all work. Tracking
  follows the *symbol*, not text.
- **Conservative correctness.** A missed access means `T.Foo` returns
  `undefined` at runtime and the scene breaks. We narrow a catalogue **only**
  when narrowing is provably *sound* (see the narrowability definition below).
  Any uncertainty keeps the catalogue as-authored.
- **Code-splitting aware by construction.** Each `createT` call is a catalogue
  boundary that can become a chunk boundary. We narrow each catalogue by *its
  own symbol's* reachable accesses (symbol-scoped), never collapsing everything
  into one global catalogue — which would pin lazy-chunk classes into the main
  bundle. (See exploration doc, Scenario B.)
- **Diagnostics, not silent failure.** When a narrowable-looking catalogue can't
  be narrowed, say so and say why.

## Non-goals

- No change to the `createT` runtime or authoring model.
- No dev-server transformation (build-only; see Architecture).
- No type-level changes; editor experience is untouched.
- No global provided-`T` import in v1 (deferred; see "Deferred").
- No `extends`-graph propagation in v1 (deferred, but architecturally allowed).

## Distribution

A new workspace package, `packages/unplugin-solid-three`, published
independently with its own dependencies (`ts-morph`, `unplugin`). This isolates
ts-morph — a heavy build-only dependency — from runtime consumers of
`solid-three`, who must never be forced to install it. Built with the
[unplugin](https://github.com/unjs/unplugin) factory so one codebase emits
adapters for Vite, Rollup, webpack, esbuild, and rspack.

> Monorepo expansion: `pnpm-workspace.yaml` currently lists only `site`. It must
> gain a `packages/*` glob, and the new package needs its own build wiring.

## Architecture — two phases, build-only

Runs **only on production build** (`apply: 'build'` for Vite; the equivalent
build-only gate per bundler). The dev server keeps the raw proxy: instant HMR,
zero analysis cost, full namespace. Tree-shaking only matters for production
output.

- **Phase 1 — `buildStart` (whole-project analysis, once).** Build a ts-morph
  `Project` from the consumer's `tsconfig.json`. All symbol intelligence lives
  here. Produces, per `createT` call site, one of:
  - `{ kind: "narrow"; entries: ResolvedEntry[] }` — the sound, narrowed catalogue
  - `{ kind: "noop"; reason }` — argument not statically analyzable (INFO)
  - `{ kind: "keep"; reason; ref }` — narrowable-looking but defeated (WARN)
- **Phase 2 — `transform` (per-module rewrite).** For any module containing an
  analyzed `createT` call, splice in the rewritten catalogue using the Phase 1
  result. Modules with no `createT` call pass through untouched.

Whole-project-first is required: a call site can only be narrowed after every
reference to its `T` — possibly in other files — has been seen.

## Narrowability (the centerpiece)

Narrowing a catalogue expression `C` to `C'` is **sound** iff **all five** hold.
The definition is a *positive allowlist*: we admit only forms we can prove safe,
so anything exotic (proxies, reactive stores, dynamic values) is non-narrowable
*by construction*, never by enumerating hazards.

1. **Complete used-set.** Every access to the resulting `T` resolves to a
   statically-known literal key — no computed `T[expr]`, rest-destructure,
   reflection (`Object.keys`/`for..in`), or escape. If the used-set isn't
   provably closed, we drop nothing.
2. **Static enumerability.** Every key-contributing part of `C` has a
   statically-known key set: a namespace import (exports known via the checker),
   an object literal with identifier/string-literal keys, or a spread of one of
   those. *Allowlist, not blocklist.*
3. **Determinate provenance.** For each used key `K`, the winning provider is
   statically fixed by the last-write-wins walk over those known key sets.
4. **Purity of what we touch.** Providers we keep are pure to *reference*; parts
   we drop are pure to *omit* (omitting removes no observable side effect).
5. **No escape.** `C` is used solely as the `createT` argument — not aliased,
   enumerated, or passed elsewhere.

### Purity notes (clause 4)

- **ES-module namespaces are pure** — `THREE.Mesh` is a binding read with no user
  getter, so namespaces are always safe to narrow.
- **Getters are lazy.** An unaccessed getter never ran → safe to *drop*; a kept
  getter is copied verbatim (see opaque-value rule). Safe.
- **Eager value expressions are not always safe to drop.** `createT({ M: makeIt() })`
  runs `makeIt()` at construction; pruning that entry would skip the call. So an
  explicit entry is prunable only if its value is a *pure reference* (identifier,
  member access, getter/method definition) — not a call/await/etc.
- **Spreading a local object invokes its getters eagerly**, so a spread is
  narrowable only if the source's getters are pure. Namespaces and plain
  data/reference objects satisfy this; exotic sources → keep whole.

## Symbol tracking (Phase 1 detail)

1. **Find `createT`.** Resolve the `createT` import binding from `solid-three`,
   following renames (`import { createT as ct }`).
2. **Locate calls** of that binding. For each, take the symbol the result is
   bound to (`const T = …`).
3. **Collect references** via ts-morph `findReferences` — every reference across
   the project. This transparently follows re-exports (`export const T`),
   cross-file imports, renames, and aliases. This is "follow the whole symbol."
4. **Classify each reference** and collect the member name:
   - ✅ `T.Mesh` (member), `<T.Mesh>` (JSX member), `T["Mesh"]` (literal element
     access), `const { Mesh } = T` / `const { Mesh: m } = T` (static destructure)
   - ✅ simple local re-alias `const U = T` → recurse: re-run on `U`
   - ⛔ **bail (fails clause 1):** computed key `T[expr]`, rest-destructure
     `const { ...r } = T`, reflection, `<Dynamic component={T[type]} />`,
     spread `{ ...T }`
   - ⛔ **escape (fails clause 5):** `T` passed to a function, returned, stored on
     an object/array, or put on Solid context

The honest boundary: we follow assignments, exports, imports, renames, and
simple aliases (symbol-resolvable with ts-morph). We stop — keep the catalogue —
the moment `T` crosses a function/property/context boundary, because proving
exhaustiveness there is interprocedural and not worth the correctness risk.

## Rewrite rules

When narrowing is sound, replace `C` with `C'` built from the used-set. The
analysis (compute the used-set) is identical regardless of argument shape; only
the rewrite branches:

| Argument shape | Rewrite |
| --- | --- |
| Namespace import (`THREE`, `three/webgpu`) | emit `{ K: NS.K }` for each used member |
| Object literal (static keys, possibly with namespace/object spreads) | precedence walk → emit one resolved entry per used member; drop the rest |
| Anything failing clause 2 (proxy, store, call result, untraceable var, non-enumerable spread) | NO-OP — keep verbatim (INFO diagnostic) |

### Precedence-correct collapsing

The rewrite must **replay JS object-construction precedence**, not just collect
names. Walk `C`'s properties in source order; each declares a *provider* for the
keys it contributes (a spread → all its statically-known keys; an explicit entry
or getter → its one key). **Last write wins.** For each used key, emit a single
entry pointing at its winning provider:

```ts
// SOME = { Mesh, XYZ }, OTHER = { XYZ, Group }; used: Mesh, XYZ
createT({ ...SOME, ...OTHER })
// →
createT({ Mesh: SOME.Mesh, XYZ: OTHER.XYZ })   // XYZ in both → last spread wins
```

Because each emitted entry is already precedence-resolved, order among emitted
entries no longer matters. If a spread's contribution to a key is **ambiguous**
(a non-enumerable spread that *might* shadow a key), provenance is undeterminable
(clause 3 fails) → keep that ambiguous spread intact rather than risk the wrong
binding.

### Opaque-value rule

The plugin only ever does two rewrites: **(1)** replace a narrowable namespace
with resolved member entries, and **(2)** drop a provably-unused, pure explicit
entry. It **never rewrites the value expression of an explicit entry** — a
getter, method, ternary, function call, bare identifier, or `THREE.Mesh` access
are all opaque values, copied verbatim or dropped whole, never inspected. So
`createT({ get XYZ(){ return cond ? ZYX : XYZ } })` keeps the getter verbatim
when `T.XYZ` is reachable (both `ZYX` and `XYZ` correctly stay alive), and is
eligible for whole-entry pruning only under fully-static usage.

### Escape guard

Narrowing/pruning is safe only when the catalogue *expression* is used solely as
the `createT` argument. If the same object is aliased or passed elsewhere
(`const cat = {…}; createT(cat); other(cat)`), it escapes (clause 5) → keep whole.

## Diagnostics — two tiers

Curation **is** the escape hatch: there is no directive or `force` config in v1.
A catalogue that can't be auto-narrowed is fixed by the same first-class pattern
the docs already teach — pass an explicit catalogue, which the plugin keeps as
authored (a curated literal is already minimal, so a bail is harmless).

- **WARN** (→ error under `strict`): a *narrowable-looking namespace* catalogue
  (`createT(THREE)`) was defeated by a dynamic access or escape (clause 1 or 5).
  Actionable — the message points at the offending reference and suggests
  curating. `strict` makes this a build error so CI can enforce analyzability.
- **INFO**: the argument isn't statically analyzable at all (proxy, reactive
  store, call result; clause 2). Not necessarily wrong, but explains why the
  bundle didn't shrink.

Worked examples:

- `createStore(...)` → `createT(store)`: `store` traces to a destructuring from a
  call expression → fails clause 2 → **NO-OP, INFO.** (Independently also fails
  clause 4: store reads track dependencies; and clause 1: `setStore` can mutate
  keys.)
- `createT(new Proxy(THREE, h))`: fails clause 2 → **NO-OP, INFO.**
- `createT(THREE)` with `<Dynamic component={T[type]} />`: fails clause 1 →
  **keep full namespace, WARN** ("curate to narrow").

## Deferred (architecture must not preclude)

### Provided global `T`

`import { T } from "solid-three"` as zero-boilerplate sugar. Deferred: a single
global catalogue can't express per-chunk boundaries (it pins lazy-chunk classes
into the main bundle). When wanted, it's just a `solid-three`-exported
`createT(THREE)` that the *same* engine narrows — no separate mechanism — so
deferring costs nothing.

### `extends` composition

`createT(additions, { extends: base })` — does not exist in the runtime yet; a
future API for lazy extension (a small shared base + a heavy addition referenced
only from a lazy chunk). It introduces by-reference catalogue inheritance, which
makes catalogues a **dependency graph**: an inherited access (`TExt.Mesh` where
`Mesh ∈ base`) must propagate back into `base`'s narrowed set.

**v1 architecture constraint to keep this additive:** model each catalogue as a
*node* whose member set = *its own direct accesses* (+ later: accesses propagated
from catalogues that extend it). Do **not** hard-code "members = own direct
accesses only," and keep the rewrite per-call-site. Then the `extends` graph
layers on without reworking the engine.

## Config surface

```ts
interface Options {
  /** Turn WARN (un-narrowable namespace) into a build error. Default: false. */
  strict?: boolean
  /** Path to tsconfig for the ts-morph Project. Default: auto-detect. */
  tsconfig?: string
}
```

(No `force` / directive in v1 — curation is the escape hatch. A directive could
layer on later for the "concise form + dynamic access + still narrow" niche.)

## Testing — the suite *is* the correctness guarantee

Reliability here is unusually test-dependent. The failure mode is **silent and
catastrophic**: narrowing away a class that's actually used produces *no build
error* — `T.Foo` returns `undefined` and the scene breaks at runtime. So tests
are not after-the-fact validation; they are the safety net that makes unsound
narrowing impossible to ship. Two invariants, asymmetric in severity:

- **Soundness (must never fail):** every class reachable through `T` at runtime
  survives narrowing. A violation = broken scene.
- **Effectiveness (the value-prop):** unused classes are actually dropped. A
  violation = a bigger bundle, not a crash — important, but not dangerous.

The runtime library is browser-only (jsdom dropped; vitest browser mode in real
Chromium). The plugin itself is **pure Node**, so it gets its own Node-based
vitest project; the soundness oracle (layer 3) rides the existing browser suite.

### The linchpin — a soundness oracle

Instrument the `createT` proxy to record every key requested of it. For any
rendered fixture, assert:

```
{ keys requested of each T proxy during render } ⊆ { keys in that T's narrowed catalogue }
```

This is a *metamorphic* check that catches **any** unsound narrowing
automatically, regardless of how exotic the access path was. Because it rides a
real render, every browser test — including the actual `site`, `demo`, and
gallery scenes — doubles as a correctness check for the plugin at no extra
authoring cost. This invariant is the backstop behind every layer below.

### v1 layers (dense/fast → representative/slow)

1. **Analysis unit tests (densest).** Phase-1 output over a *fixture matrix* —
   the three axes (argument shape × `T`-flow × access shape) crossed with the
   narrowability clauses, one fixture per cell. Pure, fast, exhaustive. Assert
   the computed used-set, outcome kind, and diagnostic. Adversarial cells called
   out explicitly: proxy argument, `createStore` argument, opaque getter
   (verbatim keep + whole prune), eager-value-expression (no prune), spread
   shadowing precedence, ambiguous non-enumerable spread (keep), catalogue
   escape (keep), every bail/escape trigger.
2. **Rewrite snapshot tests.** Emitted code per argument shape; precedence
   collapsing picks the last provider; opaque values copied verbatim; escape
   guard keeps whole.
3. **Differential soundness oracle (browser).** Instrument the proxy and run the
   subset check over hand-written fixtures and the real `site`/`demo`/gallery
   scenes. The strongest guarantee in the suite — must be green before any
   release. (Cheap to add: it rides the existing browser suite.)
4. **End-to-end bundle assertions.** Bundle fixtures through the plugin; assert
   excluded class identifiers are absent from output and included ones present.
   **v1: Vite adapter only.** Other bundlers in the matrix (Rollup, esbuild,
   webpack, rspack) follow once the core is proven — see deferred.
5. **Diagnostics tests.** WARN on a namespace defeated by dynamic access; error
   under `strict`; INFO on proxy/store; no diagnostic on a curated literal.

### Deferred to follow-up (not v1)

These raise the ceiling on exhaustiveness but v1 reliability doesn't depend on
them, given the analysis matrix (1) and the soundness oracle (3):

- **Generative/fuzz testing** (full mechanics in "Generative testing" below) —
  a meaningful sub-project on its own (grammar, dual oracles, shrinking, seed
  management). High value *early* because of the silent failure mode, so it's
  the first follow-up — but not a v1 blocker.
- **Full bundler matrix** — extend layer 4 to Rollup/esbuild/webpack/rspack.
- **Mutation testing** — prove the suite is load-bearing once it has stabilized.

### Generative testing (deferred follow-up — design recorded here)

> Not v1. Captured now so the first follow-up has a blueprint; the v1 plan can
> skip this section.

This domain fits property-based testing unusually well: the input space is
structured and combinatorial, the *un-narrowed* build is a free exact oracle,
and the generator knows the truth by construction (it emits the accesses).

- **Grammar = the three axes as composable productions.** Sample a catalogue
  shape (namespace / literal / spreads / adversarial), a `T`-flow (local /
  exported+imported / re-export / rename / alias chain / escape), and a set of
  access shapes (member / JSX / element / destructure / computed / reflection).
  Draw class names from the **real `@types/three` exports** so generated
  programs typecheck and resolve through the TS checker (which the analyzer
  depends on) — the fuzzed namespace is the real catalogue, not a toy.
- **Two oracles, layered by cost.**
  - *White-box (cheap, thousands/run, every CI):* the generator records its
    known-used set and whether it injected a bail/escape trigger. Assert
    soundness (every known-used class survives), effectiveness on no-trigger
    cases (only those survive), and keep-whole on trigger cases. Analysis-only,
    pure Node — no bundling, no render.
  - *Black-box (expensive, sampled, nightly):* build twice (plugin on/off),
    render both in Chromium, assert identical scene graph + the proxy oracle.
    Catches indirect effects the white-box truth misses.
- **Metamorphic relations (no ground truth needed).** Behavior-preserving edits
  must not change the narrowed output: rename `T`→`T2` everywhere; move the
  `createT`+accesses behind a re-export in another file; add an *unused* class to
  the namespace; reorder independent accesses. Generate once, transform, diff the
  two outputs. These catch symbol-resolution and precedence bugs directly.
- **Shrinking.** Use a framework with automatic shrinking (`fast-check`) so a
  failing generated program collapses to a minimal reproducer. **Every shrunk
  failure is promoted to a permanent hand-fixture** — the regression corpus
  grows itself.
- **Why it matters:** hand-written fixtures cover each axis one at a time;
  generation covers their *product*, where precedence-×-symbol-resolution bugs
  hide. Since a soundness bug ships a silently-broken scene, dense sampling of
  the interaction space is the only honest route to "exhaustive."
- **Reproducibility:** pin a base seed in CI for determinism; log the seed and
  shrunk case on failure; a separate nightly job rotates seeds to explore more
  space and files any failure into the corpus.

### TypeScript-version matrix (v1, modest)

ts-morph rides the TS compiler; pin and test across a couple of TS versions so a
compiler behavior shift can't silently change reference resolution. (Mutation
testing — proving the suite is load-bearing — is a deferred follow-up; see
above.)

### Release gate

Soundness layers (1 analysis, 2 rewrite-keep paths, 3 oracle, 5 diagnostics)
must be green to release; effectiveness (4 absence assertions) failing blocks a
*quality* release but never ships a broken scene. CI fails the build on any
soundness-layer regression.

## Open questions

- Factory-returned `T` (`function makeT(){ return createT(THREE) }`): follow call
  sites, or always treat as escape/keep? (Lean: keep unless trivially local.)
- `Project` build cost on very large consumer apps; if it bottlenecks, cache
  references between builds or scope the Project to files reachable from `createT`.
