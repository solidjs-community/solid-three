# `unplugin-solid-three` — static catalogue narrowing

**Date:** 2026-05-31
**Status:** Design approved, pending implementation plan

## Problem

`createT` accepts a catalogue object and returns a runtime `Proxy` that lazily
wraps catalogue constructors into Solid components:

```ts
import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)

// usage, often in JSX:
//   <T.Mesh><T.BoxGeometry /><T.MeshNormalMaterial /></T.Mesh>
```

`import * as THREE from "three"` flows the entire namespace object into
`createT`. Because the result is a `Proxy`, the bundler sees an opaque object
consumed by a function and cannot prove which classes are reachable. It must
therefore retain **all** of THREE. Treeshaking is defeated.

The same holds for a hand-written partial catalogue: each value is a static
reference to a class, so the class is retained *because the object literal
references it* — even if that member is never accessed through `T`. The bundler
still can't see through the proxy to know the key is never read.

## Goal

A build-time tool that rewrites each `createT(...)` call so its catalogue
contains only the classes actually reached via `T`, turning dynamic proxy
access into static property access the bundler can prune:

```ts
// before
const T = createT(THREE)        // only T.Mesh / T.BoxGeometry / T.MeshNormalMaterial used

// after (build only)
const T = createT({
  Mesh: THREE.Mesh,
  BoxGeometry: THREE.BoxGeometry,
  MeshNormalMaterial: THREE.MeshNormalMaterial,
})
```

The `import * as THREE` stays, but only static `THREE.Mesh`-style accesses
remain, so Rollup/esbuild treeshake every untouched class. The `createT`
runtime is unchanged — the proxy just wraps a smaller object.

## Requirements

- **Exhaustive, symbol-accurate tracking.** The `createT`/`T` API is flexible;
  the common shape is one shared module doing `export const T = createT(THREE)`
  imported across many files, but module-local `const T = createT(THREE)` and
  renamed/re-exported forms must all work. Tracking must follow the *symbol*,
  not text — across re-exports, imports, and renames.
- **Conservative correctness.** A missed access means `T.Foo` returns
  `undefined` at runtime and the scene breaks. The tool narrows a catalogue
  **only** when it can prove it has seen every reachable member. Any
  uncertainty falls back to the safe (un-narrowed) behavior.
- **Bail with diagnostics.** When a call site can't be proven exhaustive, that
  one call site is left un-narrowed and a warning is emitted. A `strict` option
  turns the warning into a build error (for CI enforcement).

## Non-goals

- No change to the `createT` runtime or authoring model.
- No dev-server transformation (see "Build-only" below).
- No type-level changes; the editor experience is untouched.

## Distribution

A new workspace package, `packages/unplugin-solid-three`, published
independently with its own dependencies (`ts-morph`, `unplugin`). This isolates
ts-morph — a heavy build-only dependency — from runtime consumers of
`solid-three`, who must never be forced to install it.

Built with the [unplugin](https://github.com/unjs/unplugin) factory so a single
codebase emits adapters for Vite, Rollup, webpack, esbuild, and rspack. Since
`solid-three` is a distributed library, consumers on any bundler benefit, not
just Vite users.

> Expanding the monorepo: `pnpm-workspace.yaml` currently lists only `site`. It
> must gain a `packages/*` (or explicit `packages/unplugin-solid-three`) glob,
> and the new package needs its own build wiring (tsup or equivalent).

## Architecture — two phases, build-only

Runs **only on production build** (`apply: 'build'` for the Vite adapter; the
equivalent build-only gate per bundler). The dev server keeps the raw proxy:
instant HMR, zero analysis cost, full namespace. Treeshaking matters only for
production output.

### Phase 1 — `buildStart`: whole-project analysis (once)

Build a ts-morph `Project` from the consumer's `tsconfig.json`. All symbol
intelligence lives here. Produces a map:

```
callSite → { kind: "narrow"; members: Set<string> }
         | { kind: "noop" }                       // argument keys not enumerable
         | { kind: "bail"; reason: string; ref: SourceLocation }
```

Whole-project-first is required: a call site can only be narrowed *after* every
reference to its `T` — possibly in other files — has been seen.

### Phase 2 — `transform`: per-module rewrite

For any module containing an analyzed `createT` call, splice in the rewritten
catalogue using the Phase 1 result. Modules with no `createT` call pass through
untouched.

## Symbol tracking (Phase 1 detail — the heart of it)

1. **Find `createT`.** Resolve the `createT` import binding from `solid-three`,
   following renames (`import { createT as ct }`).
2. **Locate calls** of that binding. For each, take the symbol the result is
   bound to (`const T = …`).
3. **Collect references.** Use ts-morph `findReferences` to gather *every*
   reference to that symbol across the project. This transparently follows
   re-exports (`export const T`), cross-file imports, and aliases — this is what
   "follow the whole symbol" means.
4. **Classify each reference** and collect the member name:
   - ✅ `T.Mesh` (member access)
   - ✅ `<T.Mesh>` (JSX member access)
   - ✅ `T["Mesh"]` (element access with a string-literal key)
   - ✅ `const { Mesh } = T` (object destructuring with static keys)
   - ✅ simple local re-alias `const U = T` → recurse: re-run `findReferences`
     on `U` and merge its accesses
   - ⛔ **bail triggers:** computed key `T[expr]` (non-literal); spread
     `{ ...T }`; `T` passed as a call argument, returned, or otherwise stored
     where it escapes static analysis

### Bail = correctness fallback

When a bail trigger is hit for a call site, that call site is left un-narrowed
(namespace kept whole / literal kept as authored) and a warning is emitted
pointing at the unresolvable reference. In `strict` mode the warning becomes a
build error. Other call sites still optimize independently.

### Escape hatch (companion to bail/strict)

Because `strict` would otherwise block legitimately-dynamic usage, the tool
provides a way to force-include classes the analyzer can't see:

- config: `force: Record</* T identifier or call id */ string, string[]>`
- and/or a source directive, e.g. `// solid-three-include: GLTFLoader, Mesh`

Forced members are added to the narrowed set and suppress the corresponding
warning. (Included as a first-class part of this design; can be deferred to a
follow-up if the first version ships warn/strict only.)

## Rewrite rules — per argument shape

The analysis (compute the used-member set from `T`'s references) is **identical
regardless of argument shape.** Only the rewrite step branches:

| Argument                                  | Rewrite when fully analyzable                          | On bail                       |
| ----------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| Namespace import (`THREE`, `three/webgpu`)| emit `{ Mesh: THREE.Mesh, … }` for the used members    | keep full namespace           |
| Object literal with static keys           | **drop entries whose key ∉ used-set**                  | leave literal untouched       |
| Non-enumerable (variable, spread, call)   | can't enumerate keys → **genuine no-op**               | —                             |

Notes:

- A partial object literal is **not** automatically minimal — unused entries
  pin their classes. So literals are narrowed too, by dropping entries whose key
  is never accessed through `T`.
- The only true no-op is an argument whose contents can't be statically
  enumerated (`createT(someVar)`, `createT({ ...spread })`); we can't safely
  decide what to drop.
- This composes with bail: if any access is dynamic, analysis bails and the
  argument is left exactly as authored. A user who hand-wrote a partial as their
  *own* escape hatch for dynamic usage is therefore never broken — pruning only
  happens when every access is statically proven.

## Edge cases

- **Multiple `T` instances / multiple namespaces:** each `createT` call is
  analyzed independently and gets its own member set.
- **`three/webgpu` and custom namespaces:** any namespace import works; the rule
  keep is "is the argument's key set statically enumerable?", not "is it THREE?".
- **Type-level experience:** untouched. The transform runs at build, after
  typecheck, on bundler input. The editor still sees the full `T` type from the
  unmodified source.
- **Source on disk vs. transformed input:** ts-morph reads real source files via
  tsconfig. `createT`/`T` usage lives in real source, so this is accurate for a
  normal production build. Generated/virtual modules are out of scope (they
  don't author `T` usage).

## Config surface

```ts
interface Options {
  /** Turn bail warnings into build errors. Default: false. */
  strict?: boolean
  /** Force-include members the analyzer can't statically see. */
  force?: Record<string, string[]>
  /** Path to tsconfig used to build the ts-morph Project. Default: auto-detect. */
  tsconfig?: string
}
```

## Testing

The runtime library is browser-only (jsdom dropped; vitest browser mode in real
Chromium). This plugin is **pure Node**, so it gets its own Node-based vitest
project, separate from the runtime test suite:

1. **Analysis unit tests** — fixture consumer projects exercising each
   classification: member, JSX member, literal element access, destructure,
   simple alias recursion, cross-file re-export, rename, and each bail trigger.
   Assert the resulting member set or bail reason.
2. **Rewrite tests** — assert the emitted code for each argument shape
   (namespace narrow, literal prune, non-enumerable no-op, bail untouched).
3. **End-to-end bundle test** — bundle a fixture through the actual plugin and
   assert excluded classes are absent from the output, included ones present.
4. **Diagnostics tests** — warning emitted on bail; build error under `strict`;
   `force` / directive suppresses the warning and includes the member.

## Open questions / deferred

- Whether the escape hatch ships in v1 or as a fast follow.
- ts-morph `Project` build cost on very large consumer apps; if it becomes a
  bottleneck, cache references between builds or scope the Project to files
  reachable from `createT`.
