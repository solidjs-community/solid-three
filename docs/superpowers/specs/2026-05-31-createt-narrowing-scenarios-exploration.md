# `createT` narrowing — real-life scenarios & analysis complexity

**Date:** 2026-05-31
**Status:** Exploration (pre-spec). Companion to
`2026-05-31-createt-catalogue-narrowing-design.md`.

## Why this doc exists

We're weighing two authoring models for a tree-shaking plugin:

- **`createT(catalogue)`** — flexible, dynamic, user supplies the catalogue.
  Powerful but the dynamism makes "did we see every access?" genuinely hard.
- **provided `import { T } from "…"`** — one shared catalogue, simple analysis,
  but a single global catalogue can't express per-chunk boundaries.

The key realization driving this exploration: **the dynamism of `createT` is
not just a tracking risk — it is the mechanism for code-splitting.** A separate
`createT` call is a catalogue boundary, and catalogue boundaries can become
chunk boundaries. A single global `T` pins every used class into one module,
which actively *defeats* lazy-loading. So before we decide, we need to see the
real scenarios and grade each one: can we narrow it safely, must we prune, or
must we bail?

Outcomes used throughout:

- **NARROW** — replace a namespace with `{ used members }`. Safe, full win.
- **PRUNE** — drop unused entries from an explicit object literal. Safe.
- **BAIL** — can't prove exhaustiveness → keep catalogue as-authored + warn
  (error under `strict`). Correct, no win.
- **NO-OP** — argument keys aren't statically enumerable → leave untouched.

---

## Axis 1 — the catalogue argument (what's passed to `createT`)

| # | Shape | Example | Tractability |
|---|-------|---------|--------------|
| 1 | Namespace import | `createT(THREE)` | **NARROW** — enumerate used members |
| 2 | Object literal, shorthand keys | `createT({ Mesh, Group })` | **PRUNE** unused |
| 3 | Object literal, member values | `createT({ Mesh: THREE.Mesh })` | **PRUNE** unused |
| 4 | Namespace spread + explicit | `createT({ ...THREE, MeshBasicNodeMaterial })` | **NARROW** the spread, **PRUNE** the explicit |
| 5 | Multiple namespace spreads | `createT({ ...THREE, ...EXTRA })` | **NARROW** each enumerable spread |
| 6 | Spread of non-namespace value | `createT({ ...someObj, Custom })` | **NO-OP** for the spread portion; prune the explicit only if rest is provably exhaustive, else **BAIL** |
| 7 | Variable reference | `const cat = {...}; createT(cat)` | resolve initializer: NARROW/PRUNE if it traces to a literal/namespace, else **NO-OP** |
| 8 | Function return | `createT(buildCatalogue())` | **NO-OP** — can't enumerate |
| 9 | Conditional | `createT(cond ? THREE : OTHER)` | union both branches (complex) or **BAIL** |
| 10 | Computed key in literal | `createT({ [name]: X })` | **BAIL** that entry |

Pattern 4 is **documented** (Tour ch. 09, webgpu). Patterns 1–4 cover essentially
all real usage; 6–10 are where we lean on BAIL/NO-OP + warnings.

---

## Axis 2 — the result binding (the "follow the symbol" problem)

This is where `createT`'s dynamism bites. The catalogue can only be narrowed
once we've found **every** access to the `T` it produces.

| # | Flow | Example | Tractability |
|---|------|---------|--------------|
| 1 | Module-local const | `const T = createT(THREE)` | **easy** — same-file refs |
| 2 | Exported, imported widely | `export const T = …` then `import { T }` | **tractable** — `findReferences` follows |
| 3 | Re-export / rename | `export { T as Three }`, `import { T as TT }` | **tractable** — symbol-level |
| 4 | Simple local alias | `const U = T` | **tractable** — recurse on `U` |
| 5 | Immediate destructure | `const { Mesh } = createT(THREE)` | **easy** — direct |
| 6 | Passed to a function | `setup(T)` | **BAIL** — escapes (no interprocedural) |
| 7 | Stored on object/array | `const ctx = { T }` / `[T]` | **BAIL** — escapes via property |
| 8 | Returned from factory fn | `function makeT(){ return createT(THREE) }` | **hard** — must follow every call site of `makeT`; **BAIL** unless trivially local |
| 9 | Put on Solid context | `<Ctx.Provider value={T}>` | **BAIL** — escapes entirely |

The honest boundary: we follow **assignments, exports, imports, renames, and
simple aliases** (symbol-resolvable with ts-morph). We **bail** the moment `T`
crosses a **function/property/context boundary**, because proving exhaustiveness
there is interprocedural and not worth the correctness risk.

---

## Axis 3 — the member access (how `T.X` is reached)

| # | Access | Example | Tractability |
|---|--------|---------|--------------|
| 1 | Member (value) | `T.Mesh` | **collect** `Mesh` |
| 2 | JSX member (dominant) | `<T.Mesh>` | **collect** `Mesh` |
| 3 | Literal element access | `T["Mesh"]` | **collect** `Mesh` |
| 4 | Static destructure | `const { Mesh, Group } = T` | **collect** both |
| 5 | Destructure w/ rename | `const { Mesh: m } = T` | **collect** `Mesh` |
| 6 | Computed access | `T[shape()]`, `T[type]` | **BAIL** |
| 7 | Rest destructure | `const { ...rest } = T` | **BAIL** — grabs everything |
| 8 | Reflection | `Object.keys(T)`, `for..in` | **BAIL** |
| 9 | Dynamic render | `<Dynamic component={T[type]} />` | **BAIL** (computed) |
| 10 | Spread of `T` | `{ ...T }` | **BAIL** |

Case 6/9 (computed member by a runtime string) is the **most common legitimate
BAIL** — data-driven scenes that pick a geometry/material by a type string. This
is precisely what the **escape hatch** (`force` config / `// solid-three-include`
directive) exists to rescue, so such code can still narrow + stay in `strict`.

---

## The code-splitting dimension (the real prize, and the real hazard)

Member-set tracking answers *which classes*. Code-splitting adds a second
question: *in which chunk*. This is where the global-`T` model breaks down.

### Scenario A — shared app catalogue (the common case)

```ts
// three.ts
export const T = createT(THREE)
```

Imported across many eagerly-loaded modules. Union of all accesses → one
narrowed catalogue. **NARROW.** No chunk hazard because everything's in the main
bundle anyway. This is the bread-and-butter win.

### Scenario B — lazy-loaded heavy component (the hazard)

```ts
const Heavy = lazy(() => import("./Heavy"))   // ./Heavy uses <T.SomeHeavyThing>
```

If `Heavy` uses the **shared** `T`, then `SomeHeavyThing` is part of the global
union catalogue — which lives in the **main** chunk. So the heavy class loads
eagerly even though the component is lazy. **A single global catalogue defeats
the code-split.** This is the core reason a provided global `T` is limiting.

To keep `SomeHeavyThing` inside the lazy chunk, the lazy module needs its **own
catalogue** that references the heavy class, so the only reference lives in the
lazy chunk:

```ts
// ./Heavy.tsx
const THeavy = createT({ SomeHeavyThing }, { extends: T })
```

A fresh `createT` here is a **user-declared chunk boundary**. This is why
`createT`'s dynamism matters: catalogue boundaries are how you control which
class lands in which chunk. The plugin should narrow **each catalogue by the
accesses reachable through its own symbol**, which — because `THeavy`'s symbol
is only referenced inside the lazy module — naturally keeps `SomeHeavyThing` in
the lazy chunk.

> **Hard truth about chunk-awareness:** the *optimal* narrowing depends on the
> bundler's chunk graph (which Rollup decides), but our ts-morph analysis is
> source/symbol-level and doesn't know chunk assignment. Two stances:
>
> - **Symbol-scoped (tractable):** narrow each catalogue by its own symbol's
>   reachable accesses. Correct, and the `extends`/multiple-`createT` pattern
>   lets the user align catalogue boundaries with chunk boundaries manually.
> - **Chunk-aware (hard):** integrate with the bundler module graph to scope
>   accesses per chunk automatically. Bundler-specific, much harder, deferred.
>
> The symbol-scoped stance + `extends` gets us the code-split wins without the
> plugin needing to understand chunks — the user expresses intent via catalogue
> structure. This is the strongest argument for keeping `createT` central.

---

## The `extends` composition API (`createT(additions, { extends: base })`)

### What it enables

- **Lazy extension** (Scenario B): a small shared base + a heavy addition
  referenced only from a lazy chunk.
- **Library + app composition:** a component lib ships a base `T`; the app
  extends it with app-specific classes without copying the base.
- **Layered domains:** a `core` catalogue extended by feature-area catalogues.

### Runtime semantics (assumed)

`TExt.X` resolves to `additions.X` if present, else falls through to `base.X`.
Inheritance is **by reference**, not copy — copying would pull `base`'s source
into `TExt`'s chunk and defeat the split.

### Analysis complexity it introduces

By-reference inheritance turns catalogues into a **dependency graph**:

- An access `TExt.Mesh` where `Mesh ∉ additions` is an **inherited** access — it
  must be attributed back to `base`, so `base`'s narrowed set must include
  `Mesh` even if no code accesses `base.Mesh` directly.
- So narrowing `base` requires unioning: (direct accesses on `base`) ∪
  (inherited accesses via every catalogue that `extends` it).
- This means the analyzer must build the `extends` graph first, resolve each
  catalogue's available key set (`keys(additions) ∪ keys(base)` transitively),
  classify each access as own-vs-inherited, then propagate inherited accesses up
  the chain before narrowing any node.
- Bail propagation: if `base` bails (kept whole), every catalogue extending it
  still works (inherited members are all present); only `additions` narrows.

This is tractable but is the most complex part of the whole design. It's also
**optional** — `extends` is a power feature; the base plugin can ship without it
and add it once the core narrowing is proven.

---

## Tractability summary

| Scenario | Outcome | Confidence |
|----------|---------|------------|
| Single-file scene | NARROW | high |
| Shared app catalogue (exported/imported) | NARROW (union) | high |
| Re-export / rename / alias | NARROW | high |
| Manual curated literal | PRUNE | high |
| WebGPU `{ ...THREE, NodeMaterial }` | NARROW + PRUNE | high |
| Lazy module w/ own `createT` | NARROW (per-symbol) | high |
| Lazy module sharing global `T` | class leaks to main chunk | inherent limit |
| `extends` composition | NARROW w/ graph propagation | medium (complex) |
| Computed `T[type]` / `<Dynamic>` | BAIL + escape hatch | high (correct, no win) |
| `T` passed to fn / context / stored | BAIL | high (correct, no win) |
| Factory-returned `T` | BAIL (unless trivial) | medium |
| `createT(variable / call())` | NO-OP / resolve-if-trivial | medium |

---

## What this tells us about the model choice

1. **`createT` has to stay central.** It's the only model that expresses
   per-chunk catalogue boundaries, which is what real code-splitting needs. A
   global provided `T` is genuinely limiting (Scenario B).
2. **The dynamism is bounded in practice.** The high-confidence rows cover the
   documented patterns and the dominant real usage. The BAIL rows are all either
   (a) legitimately dynamic code rescued by the escape hatch, or (b) `T`
   escaping analysis, where keeping the full catalogue is the *correct* answer.
3. **`extends` is the interesting frontier**, not the foundation. It unlocks the
   cleanest lazy-loading story but introduces graph propagation. Strong
   candidate for a phase 2.
4. **provided `T`** doesn't disappear so much as become a *special case*: it's a
   pre-made shared base catalogue. If we ever want it, it could literally be a
   `solid-three`-exported `createT(THREE)` that the same engine narrows — no
   separate mechanism. So we lose nothing by deferring it.

## Open questions

- Does `extends` already exist / is it planned in the runtime, or is this a net
  new API we'd be co-designing with the plugin?
- For BAIL on computed access: is per-`T` granularity enough, or do we want
  per-access escape-hatch precision (force-include just the dynamic members)?
- Factory-returned `T` (Axis 2 #8): worth following call sites, or always bail?
- How common is the lazy-extension pattern in the target apps — does it justify
  building `extends` analysis in v1, or is symbol-scoped narrowing of
  independent `createT` calls enough to start?
