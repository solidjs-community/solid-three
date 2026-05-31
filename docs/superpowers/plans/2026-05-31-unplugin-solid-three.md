# `unplugin-solid-three` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a build-time plugin that rewrites `createT(THREE)` into a curated `createT({ Mesh: THREE.Mesh, … })` containing only the classes actually reached through `T`, so bundlers can tree-shake the rest.

**Architecture:** A new `packages/unplugin-solid-three` workspace package. Two phases via the unplugin factory: (1) `buildStart` builds a ts-morph `Project` from the consumer's tsconfig and computes, per `createT` call site, a narrowed catalogue / keep / noop outcome by following the result symbol's references; (2) `transform` splices the rewritten catalogue into each module with `magic-string`. Narrowing happens only when provably sound (the five-clause definition in the spec). Build-only; dev keeps the runtime proxy.

**Tech Stack:** TypeScript (ESM), ts-morph (symbol analysis), unplugin (bundler-agnostic factory), magic-string (source rewriting + sourcemaps), vitest (Node project for analysis/rewrite/bundle; Playwright browser for the soundness oracle), tsup (build).

**Spec:** `docs/superpowers/specs/2026-05-31-createt-catalogue-narrowing-design.md`

---

## File Structure

```
packages/unplugin-solid-three/
  package.json                 # deps: ts-morph, unplugin, magic-string; peer: typescript
  tsconfig.json                # extends root style; node lib
  tsup.config.ts               # build src/index.ts → dist (esm)
  vitest.config.ts             # node project (analysis/rewrite/bundle/diagnostics)
  vitest.browser.config.ts     # browser project (soundness oracle only)
  src/
    index.ts                   # createUnplugin factory + per-bundler exports
    options.ts                 # Options interface + resolveOptions() defaults
    types.ts                   # Outcome, ResolvedEntry, UsedSet, CallSite, Diagnostic
    analysis/
      project.ts               # buildProject(tsconfig) + createInlineProject() test helper
      find-createt.ts          # locate createT import binding (follow rename) + call sites
      classify-ref.ts          # classify ONE reference node → member | open(reason)
      used-set.ts              # collectUsedMembers(call) → UsedSet (closed | open)
      namespace.ts             # enumerateNamespace(node) → exported names or null
      providers.ts             # precedence walk of catalogue arg → provider map | ambiguous
      resolve.ts               # resolveCatalogue(call, usedSet) → Outcome (the 5 clauses)
      analyze.ts               # analyzeProject(opts) → Map<filePath, CallSite[]> + Diagnostic[]
    rewrite/
      emit.ts                  # entriesToObjectLiteral(entries) → source text
      transform.ts             # rewriteModule(code, callSites) → { code, map } via magic-string
    diagnostics.ts             # formatDiagnostic(), reportDiagnostics(diags, strict)
  test/
    helpers.ts                 # inlineProject(files) + analyze helpers
    analysis/*.test.ts         # used-set, classify, namespace, providers, resolve
    rewrite/*.test.ts          # emit snapshots, transform
    diagnostics/*.test.ts
    bundle/*.test.ts           # real `vite build` of fixtures, assert presence/absence
    oracle/
      shim.ts                  # instrumented createT recorder
      *.fixture.tsx            # scenes rendered in the browser
      oracle.test.tsx          # subset assertion (browser)
      global-setup.ts          # node: run analyzer over fixtures → oracle.generated.json
    fixtures/                  # multi-file fixture projects for analysis tests
```

---

## Task 1: Scaffold the workspace package

**Files:**
- Create: `packages/unplugin-solid-three/package.json`
- Create: `packages/unplugin-solid-three/tsconfig.json`
- Create: `packages/unplugin-solid-three/vitest.config.ts`
- Create: `packages/unplugin-solid-three/src/index.ts`
- Modify: `pnpm-workspace.yaml:1-3`

- [ ] **Step 1: Add the package to the workspace globs**

Modify `pnpm-workspace.yaml` so the `packages:` list becomes:

```yaml
packages:
  - "site"
  - "packages/*"
```

- [ ] **Step 2: Write `packages/unplugin-solid-three/package.json`**

```json
{
  "name": "unplugin-solid-three",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }
  },
  "files": ["dist/**"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:oracle": "vitest run --config vitest.browser.config.ts"
  },
  "dependencies": {
    "magic-string": "^0.30.0",
    "ts-morph": "^25.0.0",
    "unplugin": "^2.0.0"
  },
  "peerDependencies": { "typescript": ">=5.0.0" },
  "devDependencies": {
    "tsup": "^8.0.2",
    "typescript": "^5.4.5",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 3: Write `packages/unplugin-solid-three/tsconfig.json`**

```json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "lib": ["ESNext"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ESNext",
    "verbatimModuleSyntax": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Write `packages/unplugin-solid-three/tsup.config.ts`**

```ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  target: "node18",
  dts: true,
  clean: true,
})
```

- [ ] **Step 5: Write `packages/unplugin-solid-three/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/oracle/**"],
    environment: "node",
  },
})
```

- [ ] **Step 6: Write a placeholder `src/index.ts`**

```ts
export const PLACEHOLDER = true
```

- [ ] **Step 7: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: install completes; `unplugin-solid-three` appears as a workspace package.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml packages/unplugin-solid-three
git commit -m "feat(unplugin): scaffold unplugin-solid-three workspace package"
```

---

## Task 2: Shared types

**Files:**
- Create: `packages/unplugin-solid-three/src/types.ts`
- Test: `packages/unplugin-solid-three/test/analysis/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import type { CallSite, Outcome, ResolvedEntry, UsedSet } from "../../src/types.ts"

describe("types", () => {
  it("constructs each shape", () => {
    const entry: ResolvedEntry = { key: "Mesh", valueText: "THREE.Mesh" }
    const narrow: Outcome = { kind: "narrow", entries: [entry] }
    const keep: Outcome = { kind: "keep", reason: "dynamic", ref: { filePath: "a.ts", line: 1, column: 1 } }
    const noop: Outcome = { kind: "noop", reason: "proxy" }
    const used: UsedSet = { kind: "closed", members: new Set(["Mesh"]) }
    const site: CallSite = { filePath: "a.ts", argStart: 0, argEnd: 5, outcome: narrow }
    expect([narrow, keep, noop, used, site]).toHaveLength(5)
    expect(entry.key).toBe("Mesh")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/types.test.ts`
Expected: FAIL — `Cannot find module '../../src/types.ts'`.

- [ ] **Step 3: Write `src/types.ts`**

```ts
export interface SourceLocation {
  filePath: string
  line: number
  column: number
}

/** A single narrowed catalogue entry: `key: valueText`. */
export interface ResolvedEntry {
  key: string
  /** Verbatim source text of the provider expression, e.g. `THREE.Mesh` or a copied getter. */
  valueText: string
}

export type Outcome =
  | { kind: "narrow"; entries: ResolvedEntry[] }
  /** Narrowable-looking but defeated (dynamic access / escape). Keep verbatim, WARN. */
  | { kind: "keep"; reason: string; ref: SourceLocation }
  /** Argument not statically analyzable (proxy/store/call). Keep verbatim, INFO. */
  | { kind: "noop"; reason: string }

export type UsedSet =
  | { kind: "closed"; members: Set<string> }
  | { kind: "open"; reason: string; ref: SourceLocation }

export interface CallSite {
  filePath: string
  /** Offsets of the catalogue ARGUMENT node within its source file. */
  argStart: number
  argEnd: number
  outcome: Outcome
}

export interface Diagnostic {
  level: "warn" | "info"
  message: string
  location: SourceLocation
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/types.ts packages/unplugin-solid-three/test/analysis/types.test.ts
git commit -m "feat(unplugin): shared analysis types"
```

---

## Task 3: ts-morph Project + inline test helper

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/project.ts`
- Create: `packages/unplugin-solid-three/test/helpers.ts`
- Test: `packages/unplugin-solid-three/test/analysis/project.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { createInlineProject } from "../../src/analysis/project.ts"

describe("createInlineProject", () => {
  it("creates source files from a record and resolves them", () => {
    const project = createInlineProject({
      "/src/a.ts": `export const x = 1`,
      "/src/b.ts": `import { x } from "./a.ts"; export const y = x + 1`,
    })
    expect(project.getSourceFiles().map(f => f.getFilePath()).sort()).toEqual([
      "/src/a.ts",
      "/src/b.ts",
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/project.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/project.ts`**

```ts
import { Project, ts } from "ts-morph"

const IN_MEMORY_COMPILER_OPTIONS = {
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "solid-js",
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  allowImportingTsExtensions: true,
  strict: true,
  skipLibCheck: true,
} as const

/** Build a Project from a consumer tsconfig (used by the plugin at buildStart). */
export function buildProject(tsConfigFilePath: string): Project {
  return new Project({ tsConfigFilePath })
}

/** In-memory Project for tests: map of absolute path → source text. */
export function createInlineProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: IN_MEMORY_COMPILER_OPTIONS,
  })
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content)
  }
  return project
}
```

- [ ] **Step 4: Write `test/helpers.ts`** (used by later tasks)

```ts
import type { Project } from "ts-morph"
import { createInlineProject } from "../src/analysis/project.ts"

/**
 * Build an inline project that already declares a minimal `solid-three`
 * module exporting `createT`, plus a `three` module exporting the given class
 * names — so fixtures can `import { createT } from "solid-three"` and
 * `import * as THREE from "three"` and resolve.
 */
export function fixtureProject(
  files: Record<string, string>,
  threeExports: string[] = ["Mesh", "Group", "BoxGeometry", "MeshNormalMaterial"],
): Project {
  const three = threeExports.map(n => `export class ${n} {}`).join("\n")
  return createInlineProject({
    "/node_modules/solid-three/index.d.ts": `export function createT(catalogue: any): any`,
    "/node_modules/three/index.d.ts": three,
    ...files,
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/project.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/project.ts packages/unplugin-solid-three/test/helpers.ts packages/unplugin-solid-three/test/analysis/project.test.ts
git commit -m "feat(unplugin): ts-morph project builder and inline test helper"
```

---

## Task 4: Find `createT` call sites (follow rename)

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/find-createt.ts`
- Test: `packages/unplugin-solid-three/test/analysis/find-createt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { fixtureProject } from "../helpers.ts"

describe("findCreateTCalls", () => {
  it("finds a direct createT call", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)`,
    })
    const calls = findCreateTCalls(project)
    expect(calls).toHaveLength(1)
    expect(calls[0].getSourceFile().getFilePath()).toBe("/src/a.tsx")
  })

  it("follows a renamed import", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT as makeNamespace } from "solid-three"
const T = makeNamespace(THREE)`,
    })
    expect(findCreateTCalls(project)).toHaveLength(1)
  })

  it("ignores unrelated createT from other modules", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import { createT } from "./local.ts"
export const T = createT({})`,
      "/src/local.ts": `export function createT(x: any) { return x }`,
    })
    expect(findCreateTCalls(project)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/find-createt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/find-createt.ts`**

```ts
import { type CallExpression, Node, type Project } from "ts-morph"

const SOLID_THREE_MODULE = "solid-three"
const FACTORY_NAME = "createT"

/** Return every CallExpression whose callee resolves to solid-three's createT. */
export function findCreateTCalls(project: Project): CallExpression[] {
  const calls: CallExpression[] = []

  for (const sourceFile of project.getSourceFiles()) {
    for (const importDecl of sourceFile.getImportDeclarations()) {
      if (importDecl.getModuleSpecifierValue() !== SOLID_THREE_MODULE) continue

      for (const named of importDecl.getNamedImports()) {
        if (named.getName() !== FACTORY_NAME) continue

        // Local binding may be renamed (`createT as makeNamespace`).
        const localNode = named.getAliasNode() ?? named.getNameNode()
        for (const ref of localNode.findReferencesAsNodes()) {
          const parent = ref.getParent()
          if (
            Node.isCallExpression(parent) &&
            parent.getExpression() === ref
          ) {
            calls.push(parent)
          }
        }
      }
    }
  }

  return calls
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/find-createt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/find-createt.ts packages/unplugin-solid-three/test/analysis/find-createt.test.ts
git commit -m "feat(unplugin): locate createT call sites following renames"
```

---

## Task 5: Classify a single reference

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/classify-ref.ts`
- Test: `packages/unplugin-solid-three/test/analysis/classify-ref.test.ts`

`classify-ref` answers, for one reference node to `T`: is this a static member access (→ member name), an alias (`const U = T` → forward to U's declaration), or an open/escape (→ reason)?

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { Node, type Project } from "ts-morph"
import { classifyRef } from "../../src/analysis/classify-ref.ts"
import { fixtureProject } from "../helpers.ts"

/** Grab the identifier `T` reference at the given 1-based line that is NOT the declaration. */
function refsOfT(project: Project) {
  const file = project.getSourceFileOrThrow("/src/a.tsx")
  const decl = file.getVariableDeclarationOrThrow("T")
  return decl
    .getNameNode()
    .findReferencesAsNodes()
    .filter(n => n !== decl.getNameNode())
}

function single(src: string) {
  const project = fixtureProject({
    "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
${src}`,
  })
  const refs = refsOfT(project)
  return classifyRef(refs[0])
}

describe("classifyRef", () => {
  it("member access → member", () => {
    expect(single(`const m = T.Mesh`)).toEqual({ kind: "member", name: "Mesh" })
  })
  it("JSX member → member", () => {
    expect(single(`const el = <T.Mesh />`)).toEqual({ kind: "member", name: "Mesh" })
  })
  it("string element access → member", () => {
    expect(single(`const m = T["Group"]`)).toEqual({ kind: "member", name: "Group" })
  })
  it("computed element access → open", () => {
    expect(single(`declare const k: string; const m = T[k]`).kind).toBe("open")
  })
  it("static destructure → members", () => {
    expect(single(`const { Mesh, Group } = T`)).toEqual({
      kind: "members",
      names: ["Mesh", "Group"],
    })
  })
  it("rest destructure → open", () => {
    expect(single(`const { Mesh, ...rest } = T`).kind).toBe("open")
  })
  it("simple alias → alias (forwards to the new declaration name node)", () => {
    const result = single(`const U = T`)
    expect(result.kind).toBe("alias")
    if (result.kind === "alias") expect(Node.isIdentifier(result.binding)).toBe(true)
  })
  it("spread of T → open", () => {
    expect(single(`const o = { ...T }`).kind).toBe("open")
  })
  it("passed to a function → open (escape)", () => {
    expect(single(`declare function setup(x: any): void; setup(T)`).kind).toBe("open")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/classify-ref.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/classify-ref.ts`**

```ts
import { type Identifier, Node } from "ts-morph"

export type RefClass =
  | { kind: "member"; name: string }
  | { kind: "members"; names: string[] }
  | { kind: "alias"; binding: Identifier }
  | { kind: "open"; reason: string }
  | { kind: "ignore" } // the declaration itself, or an export specifier

export function classifyRef(ref: Node): RefClass {
  const parent = ref.getParent()
  if (!parent) return { kind: "open", reason: "orphan reference" }

  // <T.Mesh /> tag name and value-position T.Mesh are both PropertyAccessExpression.
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
    return { kind: "member", name: parent.getName() }
  }

  if (Node.isElementAccessExpression(parent) && parent.getExpression() === ref) {
    const arg = parent.getArgumentExpression()
    if (arg && Node.isStringLiteral(arg)) return { kind: "member", name: arg.getLiteralValue() }
    return { kind: "open", reason: "computed element access T[expr]" }
  }

  // const X = T  (alias)  OR  const { ... } = T (destructure)
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === ref) {
    const nameNode = parent.getNameNode()
    if (Node.isIdentifier(nameNode)) return { kind: "alias", binding: nameNode }
    if (Node.isObjectBindingPattern(nameNode)) {
      const names: string[] = []
      for (const element of nameNode.getElements()) {
        if (element.getDotDotDotToken()) return { kind: "open", reason: "rest destructure" }
        const prop = element.getPropertyNameNode() ?? element.getNameNode()
        if (Node.isIdentifier(prop) || Node.isStringLiteral(prop)) {
          names.push(Node.isStringLiteral(prop) ? prop.getLiteralValue() : prop.getText())
        } else {
          return { kind: "open", reason: "computed destructure key" }
        }
      }
      return { kind: "members", names }
    }
    return { kind: "open", reason: "array/complex binding" }
  }

  if (Node.isExportSpecifier(parent) || Node.isExportAssignment(parent)) {
    // Re-export: findReferencesAsNodes already crosses it; nothing to collect here.
    return { kind: "ignore" }
  }

  // Anything else — spread, call arg, return, property value, JSX attr — escapes.
  return { kind: "open", reason: `T escapes via ${parent.getKindName()}` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/classify-ref.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/classify-ref.ts packages/unplugin-solid-three/test/analysis/classify-ref.test.ts
git commit -m "feat(unplugin): classify a single T reference"
```

---

## Task 6: Collect the used-set (references + alias recursion + escape)

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/used-set.ts`
- Test: `packages/unplugin-solid-three/test/analysis/used-set.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { collectUsedMembers } from "../../src/analysis/used-set.ts"
import { fixtureProject } from "../helpers.ts"

function usedSet(files: Record<string, string>) {
  const project = fixtureProject(files)
  const call = findCreateTCalls(project)[0]
  return collectUsedMembers(call)
}

describe("collectUsedMembers", () => {
  it("collects static members in one file", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh><T.BoxGeometry /></T.Mesh>`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") {
      expect([...result.members].sort()).toEqual(["BoxGeometry", "Mesh"])
    }
  })

  it("follows cross-file imports and renames", () => {
    const result = usedSet({
      "/src/cat.ts": `import * as THREE from "three"
import { createT } from "solid-three"
export const T = createT(THREE)`,
      "/src/scene.tsx": `import { T as Three } from "./cat.ts"
export default () => <Three.Group />`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Group"])
  })

  it("follows a simple alias", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
const U = T
export default () => <U.Mesh />`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Mesh"])
  })

  it("returns open on a computed access", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare const k: string
export const x = T[k]`,
    })
    expect(result.kind).toBe("open")
  })

  it("returns open when T escapes into a function", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare function setup(x: any): void
setup(T)`,
    })
    expect(result.kind).toBe("open")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/used-set.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/used-set.ts`**

```ts
import { type CallExpression, type Identifier, Node } from "ts-morph"
import type { SourceLocation, UsedSet } from "../types.ts"
import { classifyRef } from "./classify-ref.ts"

function locationOf(node: Node): SourceLocation {
  const start = node.getStart()
  const sf = node.getSourceFile()
  const { line, column } = sf.getLineAndColumnAtPos(start)
  return { filePath: sf.getFilePath(), line, column }
}

/** Find the binding identifier that the createT call result is assigned to. */
function resultBinding(call: CallExpression): Identifier | undefined {
  const parent = call.getParent()
  if (Node.isVariableDeclaration(parent)) {
    const name = parent.getNameNode()
    if (Node.isIdentifier(name)) return name
  }
  return undefined
}

export function collectUsedMembers(call: CallExpression): UsedSet {
  const binding = resultBinding(call)
  if (!binding) {
    return { kind: "open", reason: "createT result is not bound to an identifier", ref: locationOf(call) }
  }

  const members = new Set<string>()
  const seen = new Set<Identifier>()
  const queue: Identifier[] = [binding]

  while (queue.length) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    for (const ref of current.findReferencesAsNodes()) {
      // Skip the declaration node of the binding we're following.
      if (ref === current) continue

      const result = classifyRef(ref)
      switch (result.kind) {
        case "member":
          members.add(result.name)
          break
        case "members":
          for (const n of result.names) members.add(n)
          break
        case "alias":
          queue.push(result.binding)
          break
        case "ignore":
          break
        case "open":
          return { kind: "open", reason: result.reason, ref: locationOf(ref) }
      }
    }
  }

  return { kind: "closed", members }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/used-set.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/used-set.ts packages/unplugin-solid-three/test/analysis/used-set.test.ts
git commit -m "feat(unplugin): collect closed/open used-set with alias recursion"
```

---

## Task 7: Enumerate a namespace's exports

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/namespace.ts`
- Test: `packages/unplugin-solid-three/test/analysis/namespace.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { Node } from "ts-morph"
import { enumerateNamespaceExports } from "../../src/analysis/namespace.ts"
import { fixtureProject } from "../helpers.ts"

function argNode(src: string) {
  const project = fixtureProject({
    "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(${src})`,
  })
  const decl = project.getSourceFileOrThrow("/src/a.tsx").getVariableDeclarationOrThrow("T")
  const call = decl.getInitializerOrThrow()
  if (!Node.isCallExpression(call)) throw new Error("expected call")
  return call.getArguments()[0]
}

describe("enumerateNamespaceExports", () => {
  it("returns export names for a namespace import identifier", () => {
    const names = enumerateNamespaceExports(argNode("THREE"))
    expect(names && [...names].sort()).toEqual(["BoxGeometry", "Group", "Mesh", "MeshNormalMaterial"])
  })

  it("returns null for a non-namespace identifier", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import { createT } from "solid-three"
const obj = { Mesh: 1 }
const T = createT(obj)`,
    })
    const decl = project.getSourceFileOrThrow("/src/a.tsx").getVariableDeclarationOrThrow("T")
    const call = decl.getInitializerOrThrow()
    if (!Node.isCallExpression(call)) throw new Error("expected call")
    expect(enumerateNamespaceExports(call.getArguments()[0])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/namespace.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/namespace.ts`**

```ts
import { Node } from "ts-morph"

/**
 * If `node` is an identifier bound to a namespace import (`import * as X from "…"`),
 * return the set of names that module exports. Otherwise null.
 */
export function enumerateNamespaceExports(node: Node | undefined): Set<string> | null {
  if (!node || !Node.isIdentifier(node)) return null

  const symbol = node.getSymbol()
  const decl = symbol?.getDeclarations()?.[0]
  if (!decl || !Node.isNamespaceImport(decl)) return null

  // The aliased symbol is the imported module; its exports are the namespace members.
  const aliased = node.getType().getSymbol() ?? symbol?.getAliasedSymbol()
  const moduleSymbol = symbol?.getAliasedSymbol() ?? aliased
  if (!moduleSymbol) return null

  const names = new Set<string>()
  for (const exp of moduleSymbol.getExports()) names.add(exp.getName())
  return names.size ? names : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/namespace.test.ts`
Expected: PASS (2 tests).

> If `getAliasedSymbol()` resolution differs in your ts-morph version, fall back
> to `node.getType().getProperties()` for the export names — the test pins the
> expected output either way.

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/namespace.ts packages/unplugin-solid-three/test/analysis/namespace.test.ts
git commit -m "feat(unplugin): enumerate namespace-import exports"
```

---

## Task 8: Provider precedence walk

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/providers.ts`
- Test: `packages/unplugin-solid-three/test/analysis/providers.test.ts`

`buildProviderMap` walks the catalogue argument in source order and returns, for each statically-known key, the verbatim provider text (last write wins) — or an `ambiguous` flag when a non-enumerable spread might shadow keys.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { Node } from "ts-morph"
import { buildProviderMap } from "../../src/analysis/providers.ts"
import { fixtureProject } from "../helpers.ts"

function providersFor(src: string, threeExports?: string[]) {
  const project = fixtureProject(
    {
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(${src})`,
    },
    threeExports,
  )
  const decl = project.getSourceFileOrThrow("/src/a.tsx").getVariableDeclarationOrThrow("T")
  const call = decl.getInitializerOrThrow()
  if (!Node.isCallExpression(call)) throw new Error("expected call")
  return buildProviderMap(call.getArguments()[0])
}

describe("buildProviderMap", () => {
  it("maps namespace members to NS.Member", () => {
    const map = providersFor("THREE", ["Mesh", "Group"])
    expect(map.ambiguous).toBe(false)
    expect(map.providers.get("Mesh")).toBe("THREE.Mesh")
    expect(map.providers.get("Group")).toBe("THREE.Group")
  })

  it("object literal shorthand keys map to themselves", () => {
    const map = providersFor("{ Mesh, Group }")
    expect(map.providers.get("Mesh")).toBe("Mesh")
  })

  it("object literal value expressions are kept verbatim", () => {
    const map = providersFor("{ Mesh: THREE.Mesh }")
    expect(map.providers.get("Mesh")).toBe("THREE.Mesh")
  })

  it("last spread wins on a shadowed key", () => {
    const map = providersFor(
      "{ ...THREE, MeshNormalMaterial: THREE.MeshNormalMaterial }",
      ["Mesh", "MeshNormalMaterial"],
    )
    expect(map.providers.get("Mesh")).toBe("THREE.Mesh")
    expect(map.providers.get("MeshNormalMaterial")).toBe("THREE.MeshNormalMaterial")
  })

  it("getter entries are kept verbatim as their full text", () => {
    const map = providersFor("{ get XYZ() { return THREE.Mesh } }")
    expect(map.providers.get("XYZ")).toContain("get XYZ()")
  })

  it("flags ambiguity on a non-enumerable spread", () => {
    const map = providersFor("{ ...(globalThis as any).x, Mesh: THREE.Mesh }")
    expect(map.ambiguous).toBe(true)
  })

  it("returns null map for a non-enumerable argument (proxy/store/call)", () => {
    const map = providersFor("new Proxy({} as any, {})")
    expect(map.providers).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/providers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/providers.ts`**

```ts
import { Node, type ObjectLiteralExpression } from "ts-morph"
import { enumerateNamespaceExports } from "./namespace.ts"

export interface ProviderMap {
  /** key → verbatim provider source text; null when the argument isn't enumerable. */
  providers: Map<string, string> | null
  /** A non-enumerable spread that might shadow keys was seen. */
  ambiguous: boolean
}

function fromObjectLiteral(object: ObjectLiteralExpression): ProviderMap {
  const providers = new Map<string, string>()
  let ambiguous = false

  // Source order: each property/spread overwrites earlier providers for its keys.
  for (const prop of object.getProperties()) {
    if (Node.isSpreadAssignment(prop)) {
      const expr = prop.getExpression()
      const names = enumerateNamespaceExports(expr)
      if (names) {
        const nsText = expr.getText()
        for (const name of names) providers.set(name, `${nsText}.${name}`)
        continue
      }
      // Spread of a traceable object literal?
      if (Node.isObjectLiteralExpression(expr)) {
        const inner = fromObjectLiteral(expr)
        if (inner.providers) {
          for (const [k, v] of inner.providers) providers.set(k, v)
          ambiguous ||= inner.ambiguous
          continue
        }
      }
      ambiguous = true // non-enumerable spread; provenance undeterminable
      continue
    }

    if (Node.isShorthandPropertyAssignment(prop)) {
      providers.set(prop.getName(), prop.getName())
      continue
    }

    if (Node.isPropertyAssignment(prop)) {
      const nameNode = prop.getNameNode()
      if (Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode)) {
        const key = Node.isStringLiteral(nameNode) ? nameNode.getLiteralValue() : nameNode.getText()
        providers.set(key, prop.getInitializerOrThrow().getText())
        continue
      }
      ambiguous = true // computed key
      continue
    }

    if (Node.isGetAccessorDeclaration(prop) || Node.isMethodDeclaration(prop)) {
      const name = prop.getName()
      providers.set(name, prop.getText()) // keep verbatim
      continue
    }

    ambiguous = true
  }

  return { providers, ambiguous }
}

export function buildProviderMap(arg: Node | undefined): ProviderMap {
  if (!arg) return { providers: null, ambiguous: false }

  const namespace = enumerateNamespaceExports(arg)
  if (namespace) {
    const nsText = arg.getText()
    const providers = new Map<string, string>()
    for (const name of namespace) providers.set(name, `${nsText}.${name}`)
    return { providers, ambiguous: false }
  }

  if (Node.isObjectLiteralExpression(arg)) return fromObjectLiteral(arg)

  // Identifier bound to a traceable object literal initializer.
  if (Node.isIdentifier(arg)) {
    const decl = arg.getSymbol()?.getDeclarations()?.[0]
    if (decl && Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer()
      if (init && Node.isObjectLiteralExpression(init)) return fromObjectLiteral(init)
    }
  }

  return { providers: null, ambiguous: false }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/providers.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/providers.ts packages/unplugin-solid-three/test/analysis/providers.test.ts
git commit -m "feat(unplugin): provider precedence walk with verbatim values"
```

---

## Task 9: Resolve the outcome (the five clauses)

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/resolve.ts`
- Test: `packages/unplugin-solid-three/test/analysis/resolve.test.ts`

`resolveCatalogue` combines the used-set and the provider map into an `Outcome`:
- used-set open + narrowable-looking arg → `keep` (WARN)
- used-set open + non-enumerable arg → `noop` (INFO)
- used-set closed + provider map null → `noop` (INFO; proxy/store/call)
- used-set closed + ambiguous spread → `keep` (provenance undeterminable)
- used-set closed + clean provider map → `narrow` (one entry per used member that has a provider)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { resolveCatalogue } from "../../src/analysis/resolve.ts"
import { collectUsedMembers } from "../../src/analysis/used-set.ts"
import { fixtureProject } from "../helpers.ts"

function resolve(files: Record<string, string>, threeExports?: string[]) {
  const project = fixtureProject(files, threeExports)
  const call = findCreateTCalls(project)[0]
  return resolveCatalogue(call, collectUsedMembers(call))
}

describe("resolveCatalogue", () => {
  it("narrows a namespace to the used members", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`,
    })
    expect(out).toEqual({ kind: "narrow", entries: [{ key: "Mesh", valueText: "THREE.Mesh" }] })
  })

  it("prunes an object literal to the used members", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT({ Mesh: THREE.Mesh, Group: THREE.Group })
export default () => <T.Mesh />`,
    })
    expect(out).toEqual({ kind: "narrow", entries: [{ key: "Mesh", valueText: "THREE.Mesh" }] })
  })

  it("keeps + warns when a namespace is defeated by a computed access", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare const k: string
export const x = T[k]`,
    })
    expect(out.kind).toBe("keep")
  })

  it("noop + info for a proxy argument", () => {
    const out = resolve({
      "/src/a.tsx": `import { createT } from "solid-three"
const T = createT(new Proxy({} as any, {}))
export const x = (T as any).Mesh`,
    })
    expect(out.kind).toBe("noop")
  })

  it("keeps an ambiguous non-enumerable spread", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT({ ...(globalThis as any).extra, Mesh: THREE.Mesh })
export default () => <T.Mesh />`,
    })
    expect(out.kind).toBe("keep")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/resolve.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/resolve.ts`**

```ts
import { type CallExpression, Node } from "ts-morph"
import type { Outcome, ResolvedEntry, SourceLocation, UsedSet } from "../types.ts"
import { buildProviderMap } from "./providers.ts"

function callLocation(call: CallExpression): SourceLocation {
  const sf = call.getSourceFile()
  const { line, column } = sf.getLineAndColumnAtPos(call.getStart())
  return { filePath: sf.getFilePath(), line, column }
}

export function resolveCatalogue(call: CallExpression, used: UsedSet): Outcome {
  const arg = call.getArguments()[0]
  const map = buildProviderMap(arg)
  const argIsNarrowable = map.providers !== null

  if (used.kind === "open") {
    return argIsNarrowable
      ? { kind: "keep", reason: used.reason, ref: used.ref }
      : { kind: "noop", reason: "catalogue argument is not statically analyzable" }
  }

  // used.kind === "closed"
  if (!argIsNarrowable) {
    return { kind: "noop", reason: "catalogue argument is not statically analyzable" }
  }
  if (map.ambiguous) {
    return { kind: "keep", reason: "non-enumerable spread; provenance undeterminable", ref: callLocation(call) }
  }

  const entries: ResolvedEntry[] = []
  for (const key of used.members) {
    const valueText = map.providers?.get(key)
    // A used member with no provider means the user accesses something not in
    // their catalogue (their bug / undefined at runtime). Keep whole to be safe.
    if (valueText === undefined) {
      return { kind: "keep", reason: `accessed member "${key}" not present in catalogue`, ref: callLocation(call) }
    }
    entries.push({ key, valueText })
  }
  // Stable order for deterministic output.
  entries.sort((a, b) => a.key.localeCompare(b.key))
  return { kind: "narrow", entries }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/resolve.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/resolve.ts packages/unplugin-solid-three/test/analysis/resolve.test.ts
git commit -m "feat(unplugin): resolve catalogue outcome via the five clauses"
```

---

## Task 10: Emit the narrowed object literal

**Files:**
- Create: `packages/unplugin-solid-three/src/rewrite/emit.ts`
- Test: `packages/unplugin-solid-three/test/rewrite/emit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { entriesToObjectLiteral } from "../../src/rewrite/emit.ts"

describe("entriesToObjectLiteral", () => {
  it("emits a sorted object literal", () => {
    expect(
      entriesToObjectLiteral([
        { key: "Mesh", valueText: "THREE.Mesh" },
        { key: "BoxGeometry", valueText: "THREE.BoxGeometry" },
      ]),
    ).toBe("{ BoxGeometry: THREE.BoxGeometry, Mesh: THREE.Mesh }")
  })

  it("emits a verbatim getter as a property", () => {
    expect(
      entriesToObjectLiteral([{ key: "XYZ", valueText: "get XYZ() { return THREE.Mesh }" }]),
    ).toBe("{ get XYZ() { return THREE.Mesh } }")
  })

  it("emits empty object for no entries", () => {
    expect(entriesToObjectLiteral([])).toBe("{}")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/rewrite/emit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/rewrite/emit.ts`**

```ts
import type { ResolvedEntry } from "../types.ts"

/** A getter/method provider is emitted verbatim; a value provider as `key: value`. */
function entryText(entry: ResolvedEntry): string {
  const trimmed = entry.valueText.trimStart()
  if (trimmed.startsWith("get ") || trimmed.startsWith("set ") || trimmed.startsWith(`${entry.key}(`)) {
    return entry.valueText
  }
  return `${entry.key}: ${entry.valueText}`
}

export function entriesToObjectLiteral(entries: ResolvedEntry[]): string {
  if (entries.length === 0) return "{}"
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key))
  return `{ ${sorted.map(entryText).join(", ")} }`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/rewrite/emit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/rewrite/emit.ts packages/unplugin-solid-three/test/rewrite/emit.test.ts
git commit -m "feat(unplugin): emit narrowed object literal text"
```

---

## Task 11: Analyze the whole project (Phase 1)

**Files:**
- Create: `packages/unplugin-solid-three/src/analysis/analyze.ts`
- Test: `packages/unplugin-solid-three/test/analysis/analyze.test.ts`

`analyzeProject` ties Tasks 4/6/9 together: for each call site, compute its `Outcome`, capture the catalogue argument offsets, and collect diagnostics. It accepts a pre-built `Project` so tests can inject inline projects.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { analyzeProject } from "../../src/analysis/analyze.ts"
import { fixtureProject } from "../helpers.ts"

describe("analyzeProject", () => {
  it("produces a narrow call site and no diagnostics", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`,
    })
    const { callSitesByFile, diagnostics } = analyzeProject(project)
    const sites = callSitesByFile.get("/src/a.tsx")
    expect(sites).toHaveLength(1)
    expect(sites?.[0].outcome.kind).toBe("narrow")
    // Offsets cover the `THREE` argument exactly.
    const code = project.getSourceFileOrThrow("/src/a.tsx").getFullText()
    expect(code.slice(sites![0].argStart, sites![0].argEnd)).toBe("THREE")
    expect(diagnostics).toHaveLength(0)
  })

  it("emits a warn diagnostic for a defeated namespace", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare const k: string
export const x = T[k]`,
    })
    const { diagnostics } = analyzeProject(project)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].level).toBe("warn")
  })

  it("emits an info diagnostic for a non-analyzable argument", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import { createT } from "solid-three"
const T = createT(new Proxy({} as any, {}))
export const x = (T as any).Mesh`,
    })
    const { diagnostics } = analyzeProject(project)
    expect(diagnostics[0].level).toBe("info")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/analyze.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/analysis/analyze.ts`**

```ts
import type { Project } from "ts-morph"
import type { CallSite, Diagnostic, SourceLocation } from "../types.ts"
import { findCreateTCalls } from "./find-createt.ts"
import { resolveCatalogue } from "./resolve.ts"
import { collectUsedMembers } from "./used-set.ts"

export interface ProjectAnalysis {
  callSitesByFile: Map<string, CallSite[]>
  diagnostics: Diagnostic[]
}

export function analyzeProject(project: Project): ProjectAnalysis {
  const callSitesByFile = new Map<string, CallSite[]>()
  const diagnostics: Diagnostic[] = []

  for (const call of findCreateTCalls(project)) {
    const arg = call.getArguments()[0]
    if (!arg) continue

    const outcome = resolveCatalogue(call, collectUsedMembers(call))
    const filePath = call.getSourceFile().getFilePath()

    const site: CallSite = {
      filePath,
      argStart: arg.getStart(),
      argEnd: arg.getEnd(),
      outcome,
    }
    const list = callSitesByFile.get(filePath) ?? []
    list.push(site)
    callSitesByFile.set(filePath, list)

    if (outcome.kind === "keep") {
      diagnostics.push({
        level: "warn",
        message: `createT catalogue could not be narrowed: ${outcome.reason}. Pass an explicit catalogue to narrow it.`,
        location: outcome.ref,
      })
    } else if (outcome.kind === "noop") {
      const sf = call.getSourceFile()
      const { line, column } = sf.getLineAndColumnAtPos(call.getStart())
      const location: SourceLocation = { filePath, line, column }
      diagnostics.push({
        level: "info",
        message: `createT catalogue is not statically analyzable (${outcome.reason}); skipping narrowing.`,
        location,
      })
    }
  }

  return { callSitesByFile, diagnostics }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/analysis/analyze.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/analysis/analyze.ts packages/unplugin-solid-three/test/analysis/analyze.test.ts
git commit -m "feat(unplugin): whole-project analysis (phase 1)"
```

---

## Task 12: Rewrite a module (Phase 2)

**Files:**
- Create: `packages/unplugin-solid-three/src/rewrite/transform.ts`
- Test: `packages/unplugin-solid-three/test/rewrite/transform.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { rewriteModule } from "../../src/rewrite/transform.ts"
import type { CallSite } from "../../src/types.ts"

const CODE = `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)`

function siteFor(): CallSite {
  const argStart = CODE.indexOf("THREE)") // the argument THREE
  return {
    filePath: "/src/a.tsx",
    argStart,
    argEnd: argStart + "THREE".length,
    outcome: { kind: "narrow", entries: [{ key: "Mesh", valueText: "THREE.Mesh" }] },
  }
}

describe("rewriteModule", () => {
  it("replaces the argument with the narrowed object", () => {
    const result = rewriteModule(CODE, [siteFor()])
    expect(result?.code).toContain("createT({ Mesh: THREE.Mesh })")
    expect(result?.map).toBeTruthy()
  })

  it("returns null when no site narrows", () => {
    const keep: CallSite = { ...siteFor(), outcome: { kind: "noop", reason: "x" } }
    expect(rewriteModule(CODE, [keep])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/rewrite/transform.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/rewrite/transform.ts`**

```ts
import MagicString from "magic-string"
import type { CallSite } from "../types.ts"
import { entriesToObjectLiteral } from "./emit.ts"

export interface RewriteResult {
  code: string
  map: ReturnType<MagicString["generateMap"]>
}

export function rewriteModule(code: string, sites: CallSite[]): RewriteResult | null {
  const narrowing = sites.filter(s => s.outcome.kind === "narrow")
  if (narrowing.length === 0) return null

  const s = new MagicString(code)
  for (const site of narrowing) {
    if (site.outcome.kind !== "narrow") continue
    s.overwrite(site.argStart, site.argEnd, entriesToObjectLiteral(site.outcome.entries))
  }

  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/rewrite/transform.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/src/rewrite/transform.ts packages/unplugin-solid-three/test/rewrite/transform.test.ts
git commit -m "feat(unplugin): rewrite module catalogue argument (phase 2)"
```

---

## Task 13: Options + diagnostics reporting

**Files:**
- Create: `packages/unplugin-solid-three/src/options.ts`
- Create: `packages/unplugin-solid-three/src/diagnostics.ts`
- Test: `packages/unplugin-solid-three/test/diagnostics/diagnostics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest"
import { reportDiagnostics } from "../../src/diagnostics.ts"
import { resolveOptions } from "../../src/options.ts"
import type { Diagnostic } from "../../src/types.ts"

const warn: Diagnostic = {
  level: "warn",
  message: "could not narrow",
  location: { filePath: "/src/a.tsx", line: 3, column: 11 },
}
const info: Diagnostic = {
  level: "info",
  message: "not analyzable",
  location: { filePath: "/src/b.tsx", line: 1, column: 1 },
}

describe("resolveOptions", () => {
  it("defaults strict to false and auto tsconfig", () => {
    expect(resolveOptions(undefined)).toEqual({ strict: false, tsconfig: undefined })
    expect(resolveOptions({ strict: true })).toMatchObject({ strict: true })
  })
})

describe("reportDiagnostics", () => {
  it("logs warn and info, returns no error when not strict", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const error = reportDiagnostics([warn, info], false, log)
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(error).toBeNull()
  })

  it("returns an error string under strict when warnings exist", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const error = reportDiagnostics([warn, info], true, log)
    expect(error).toContain("could not narrow")
  })

  it("returns null under strict with only info", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    expect(reportDiagnostics([info], true, log)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/diagnostics/diagnostics.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/options.ts`**

```ts
export interface Options {
  /** Turn "could not narrow a namespace" warnings into a build error. */
  strict?: boolean
  /** Path to the tsconfig used to build the ts-morph Project. Auto-detected if omitted. */
  tsconfig?: string
}

export interface ResolvedOptions {
  strict: boolean
  tsconfig: string | undefined
}

export function resolveOptions(options: Options | undefined): ResolvedOptions {
  return {
    strict: options?.strict ?? false,
    tsconfig: options?.tsconfig,
  }
}
```

- [ ] **Step 4: Write `src/diagnostics.ts`**

```ts
import type { Diagnostic } from "./types.ts"

export interface Logger {
  warn: (message: string) => void
  info: (message: string) => void
}

export function formatDiagnostic(d: Diagnostic): string {
  const { filePath, line, column } = d.location
  return `[unplugin-solid-three] ${filePath}:${line}:${column} ${d.message}`
}

/**
 * Log all diagnostics. Returns an error message (to fail the build) when
 * `strict` and any warning is present; otherwise null.
 */
export function reportDiagnostics(
  diagnostics: Diagnostic[],
  strict: boolean,
  log: Logger,
): string | null {
  let firstWarning: string | null = null
  for (const d of diagnostics) {
    const text = formatDiagnostic(d)
    if (d.level === "warn") {
      log.warn(text)
      firstWarning ??= text
    } else {
      log.info(text)
    }
  }
  return strict && firstWarning ? `strict mode: ${firstWarning}` : null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/diagnostics/diagnostics.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/unplugin-solid-three/src/options.ts packages/unplugin-solid-three/src/diagnostics.ts packages/unplugin-solid-three/test/diagnostics/diagnostics.test.ts
git commit -m "feat(unplugin): options resolution and diagnostics reporting"
```

---

## Task 14: unplugin factory wiring

**Files:**
- Modify: `packages/unplugin-solid-three/src/index.ts` (replace placeholder)
- Test: `packages/unplugin-solid-three/test/index.test.ts`

The factory builds the analysis once in `buildStart` and rewrites per module in `transform`. To keep `buildStart` testable without a real bundler, factor the work into `runAnalysis(options)` and a pure `transformModule(id, code, analysis)`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { transformModule } from "../src/index.ts"
import { analyzeProject } from "../src/analysis/analyze.ts"
import { fixtureProject } from "./helpers.ts"

describe("transformModule", () => {
  it("rewrites a module that has a narrow call site", () => {
    const code = `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`
    const project = fixtureProject({ "/src/a.tsx": code })
    const analysis = analyzeProject(project)
    const result = transformModule("/src/a.tsx", code, analysis)
    expect(result?.code).toContain("createT({ Mesh: THREE.Mesh })")
  })

  it("returns null for an unrelated module", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`,
    })
    const analysis = analyzeProject(project)
    expect(transformModule("/src/other.tsx", "export const x = 1", analysis)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/index.test.ts`
Expected: FAIL — `transformModule` not exported.

- [ ] **Step 3: Write `src/index.ts`**

```ts
import { createUnplugin } from "unplugin"
import { analyzeProject, type ProjectAnalysis } from "./analysis/analyze.ts"
import { buildProject } from "./analysis/project.ts"
import { reportDiagnostics } from "./diagnostics.ts"
import { type Options, resolveOptions } from "./options.ts"
import { rewriteModule, type RewriteResult } from "./rewrite/transform.ts"

/** Strip a query suffix (`?worker`, `?raw`, …) and normalize to the source path. */
function normalizeId(id: string): string {
  return id.split("?")[0]
}

export function transformModule(
  id: string,
  code: string,
  analysis: ProjectAnalysis,
): RewriteResult | null {
  const sites = analysis.callSitesByFile.get(normalizeId(id))
  if (!sites) return null
  return rewriteModule(code, sites)
}

export const unpluginSolidThree = createUnplugin<Options | undefined>((rawOptions, meta) => {
  const options = resolveOptions(rawOptions)
  let analysis: ProjectAnalysis | undefined

  return {
    name: "unplugin-solid-three",
    enforce: "pre",
    // Vite: only run for production builds; dev keeps the runtime proxy.
    vite: { apply: "build" },

    buildStart() {
      const tsconfig = options.tsconfig ?? "tsconfig.json"
      const project = buildProject(tsconfig)
      analysis = analyzeProject(project)
      const error = reportDiagnostics(analysis.diagnostics, options.strict, {
        warn: m => this.warn(m),
        info: m => console.info(m),
      })
      if (error) this.error(error)
    },

    transform(code, id) {
      if (!analysis) return null
      const result = transformModule(id, code, analysis)
      return result ? { code: result.code, map: result.map } : null
    },
  }
})

export const vitePlugin = unpluginSolidThree.vite
export const rollupPlugin = unpluginSolidThree.rollup
export const webpackPlugin = unpluginSolidThree.webpack
export const esbuildPlugin = unpluginSolidThree.esbuild
export const rspackPlugin = unpluginSolidThree.rspack
export type { Options } from "./options.ts"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the whole Node suite**

Run: `pnpm -C packages/unplugin-solid-three test`
Expected: all analysis/rewrite/diagnostics tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/unplugin-solid-three/src/index.ts packages/unplugin-solid-three/test/index.test.ts
git commit -m "feat(unplugin): unplugin factory wiring (buildStart + transform)"
```

---

## Task 15: End-to-end Vite bundle assertion

**Files:**
- Create: `packages/unplugin-solid-three/test/bundle/fixture/scene.tsx`
- Create: `packages/unplugin-solid-three/test/bundle/fixture/tsconfig.json`
- Create: `packages/unplugin-solid-three/test/bundle/bundle.test.ts`
- Modify: `packages/unplugin-solid-three/package.json` (add `vite`, `solid-js`, `three` devDeps)

This proves the rewrite actually drops classes from a real Vite production build. We bundle a fixture that uses only `T.Mesh` and assert an unused class name (`BoxGeometry`) is absent while `Mesh` survives.

- [ ] **Step 1: Add bundle-test devDependencies**

In `packages/unplugin-solid-three/package.json`, add to `devDependencies`:

```json
"vite": "6.4.2",
"vite-plugin-solid": "2.11.12",
"solid-js": "^1.8.17",
"three": "^0.181.2",
"solid-three": "workspace:*"
```

Run: `pnpm install`
Expected: install completes.

- [ ] **Step 2: Write the fixture**

`packages/unplugin-solid-three/test/bundle/fixture/scene.tsx`:

```tsx
import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)

export function Scene() {
  return T.Mesh
}
```

`packages/unplugin-solid-three/test/bundle/fixture/tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["scene.tsx"]
}
```

- [ ] **Step 3: Write the failing test**

`packages/unplugin-solid-three/test/bundle/bundle.test.ts`:

```ts
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { build } from "vite"
import solid from "vite-plugin-solid"
import { describe, expect, it } from "vitest"
import { vitePlugin } from "../../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = resolve(here, "fixture")

async function bundle(withPlugin: boolean): Promise<string> {
  const output = await build({
    root: fixture,
    logLevel: "silent",
    plugins: [
      ...(withPlugin ? [vitePlugin({ tsconfig: resolve(fixture, "tsconfig.json") })] : []),
      solid(),
    ],
    build: {
      write: false,
      lib: { entry: resolve(fixture, "scene.tsx"), formats: ["es"], fileName: "scene" },
      minify: false,
    },
  })
  const chunks = Array.isArray(output) ? output : [output]
  return chunks
    .flatMap(o => ("output" in o ? o.output : []))
    .filter(c => c.type === "chunk")
    .map(c => (c as { code: string }).code)
    .join("\n")
}

describe("vite bundle", () => {
  it("drops unused three classes when the plugin runs", async () => {
    const code = await bundle(true)
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  }, 60_000)

  it("retains all classes without the plugin (baseline)", async () => {
    const code = await bundle(false)
    expect(code).toContain("BoxGeometry")
  }, 60_000)
})
```

- [ ] **Step 4: Run test to verify it fails or passes meaningfully**

Run: `pnpm -C packages/unplugin-solid-three vitest run test/bundle/bundle.test.ts`
Expected: the baseline test passes; the plugin test passes once wiring is correct. If `BoxGeometry` still appears with the plugin, inspect the emitted chunk — the rewrite or the `apply: "build"` gate is the suspect.

> Note: `vite build` honors `apply: "build"`, so the plugin is active here. The
> `tsconfig` option points the ts-morph Project at the fixture.

- [ ] **Step 5: Commit**

```bash
git add packages/unplugin-solid-three/test/bundle packages/unplugin-solid-three/package.json
git commit -m "test(unplugin): end-to-end vite bundle drops unused classes"
```

---

## Task 16: Soundness oracle (browser)

**Files:**
- Create: `packages/unplugin-solid-three/vitest.browser.config.ts`
- Create: `packages/unplugin-solid-three/test/oracle/global-setup.ts`
- Create: `packages/unplugin-solid-three/test/oracle/shim.ts`
- Create: `packages/unplugin-solid-three/test/oracle/scene.fixture.tsx`
- Create: `packages/unplugin-solid-three/test/oracle/oracle.test.tsx`

The invariant: for every fixture, the set of keys requested of its `T` proxy during a real render must be a subset of the narrowed catalogue the analyzer computed. A Node `globalSetup` runs the analyzer over the oracle fixtures and writes the expected narrowed sets; the browser test renders with an instrumented `createT` and asserts the subset.

- [ ] **Step 1: Write the browser vitest config**

`packages/unplugin-solid-three/vitest.browser.config.ts`:

```ts
import { playwright } from "@vitest/browser-playwright"
import solid from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solid({ hot: false })],
  test: {
    include: ["test/oracle/**/*.test.tsx"],
    environment: "node",
    globalSetup: ["./test/oracle/global-setup.ts"],
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] },
      }),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
})
```

Add browser devDeps to `package.json` (`pnpm install` after):

```json
"@vitest/browser": "^4.1.7",
"@vitest/browser-playwright": "^4.1.7",
"playwright": "^1.60.0",
"@solidjs/testing-library": "^0.8.8"
```

- [ ] **Step 2: Write the analyzer global-setup (Node)**

`packages/unplugin-solid-three/test/oracle/global-setup.ts`:

```ts
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { writeFileSync } from "node:fs"
import { Project } from "ts-morph"
import { analyzeProject } from "../../src/analysis/analyze.ts"

const here = dirname(fileURLToPath(import.meta.url))

export default function setup() {
  const project = new Project({
    compilerOptions: {
      jsx: 4 /* Preserve */,
      jsxImportSource: "solid-js",
      moduleResolution: 100 /* Bundler */,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
    },
  })
  project.addSourceFilesAtPaths(resolve(here, "*.fixture.tsx"))

  const { callSitesByFile } = analyzeProject(project)
  const expected: Record<string, string[]> = {}
  for (const [filePath, sites] of callSitesByFile) {
    for (const site of sites) {
      if (site.outcome.kind === "narrow") {
        expected[filePath] = site.outcome.entries.map(e => e.key).sort()
      }
    }
  }
  writeFileSync(resolve(here, "oracle.generated.json"), JSON.stringify(expected, null, 2))
}
```

- [ ] **Step 3: Write the instrumented createT shim**

`packages/unplugin-solid-three/test/oracle/shim.ts`:

```ts
import { createT as realCreateT } from "solid-three"

export const requestedKeys = new Set<string>()

/** Wrap createT so every key requested of the resulting proxy is recorded. */
export function createT<T extends Record<string, unknown>>(catalogue: T) {
  const inner = realCreateT(catalogue)
  return new Proxy(inner as object, {
    get(target, prop: string) {
      if (typeof prop === "string") requestedKeys.add(prop)
      return (target as Record<string, unknown>)[prop]
    },
  }) as typeof inner
}
```

- [ ] **Step 4: Write a fixture scene (imports the shim createT)**

`packages/unplugin-solid-three/test/oracle/scene.fixture.tsx`:

```tsx
import * as THREE from "three"
import { createT } from "solid-three"

const T = createT(THREE)

export function Scene() {
  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}
```

> The fixture imports `createT` from `solid-three` so the analyzer (global-setup)
> recognizes it. The browser test below remaps that import to the shim via Vite
> aliasing so runtime keys are recorded — keeping the analyzer and the runtime
> looking at the same source.

- [ ] **Step 5: Write the oracle test**

`packages/unplugin-solid-three/test/oracle/oracle.test.tsx`:

```tsx
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { render } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import expected from "./oracle.generated.json"

// Record every key requested of any T proxy by routing createT through the shim.
import { requestedKeys } from "./shim.ts"
vi.mock("solid-three", async orig => {
  const real = await orig<typeof import("solid-three")>()
  const { createT } = await import("./shim.ts")
  return { ...real, createT }
})

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(here, "scene.fixture.tsx")

describe("soundness oracle", () => {
  it("every real class requested at runtime is present in the narrowed catalogue", async () => {
    const { Scene } = await import("./scene.fixture.tsx")
    requestedKeys.clear()
    render(() => <Scene />)

    const narrowed = new Set((expected as Record<string, string[]>)[fixturePath] ?? [])
    // Only a key that is an ACTUAL three export and was narrowed away is a
    // soundness violation. Framework property probes (`then`, `$$typeof`, …)
    // aren't catalogue members, so they're ignored.
    const leaked = [...requestedKeys].filter(k => k in THREE && !narrowed.has(k))
    expect(leaked).toEqual([])
  })
})
```

- [ ] **Step 6: Run the oracle**

Run: `pnpm -C packages/unplugin-solid-three test:oracle`
Expected: PASS — `requestedKeys` = {Mesh, BoxGeometry, MeshNormalMaterial} ⊆ narrowed set. If it fails, the analyzer narrowed away a class the render actually used — a soundness bug to fix before anything else.

> If the fixture path key in `oracle.generated.json` doesn't match
> `fixturePath` (ts-morph may store a different absolute form), normalize both
> with `resolve()` in step 2 and the test.

- [ ] **Step 7: Commit**

```bash
git add packages/unplugin-solid-three/vitest.browser.config.ts packages/unplugin-solid-three/test/oracle packages/unplugin-solid-three/package.json
git commit -m "test(unplugin): soundness oracle (instrumented proxy, subset assertion)"
```

---

## Task 17: TypeScript-version matrix (modest)

**Files:**
- Create: `packages/unplugin-solid-three/test/ts-version.md` (documented manual matrix)
- Modify: `packages/unplugin-solid-three/package.json` (add a script)

A full CI matrix is follow-up; v1 documents and scripts a two-version smoke run.

- [ ] **Step 1: Add a matrix script to `package.json`**

```json
"test:ts": "pnpm test"
```

- [ ] **Step 2: Document the matrix**

`packages/unplugin-solid-three/test/ts-version.md`:

```markdown
# TypeScript version matrix

ts-morph rides the TS compiler, so reference resolution can shift across
versions. Before a release, run the Node suite against the lowest supported and
latest TypeScript:

```bash
pnpm -C packages/unplugin-solid-three add -D typescript@5.4.5 && pnpm test
pnpm -C packages/unplugin-solid-three add -D typescript@latest && pnpm test
```

Both must pass. (CI automation of this matrix is a follow-up.)
```

- [ ] **Step 3: Verify the suite still runs**

Run: `pnpm -C packages/unplugin-solid-three test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/unplugin-solid-three/test/ts-version.md packages/unplugin-solid-three/package.json
git commit -m "test(unplugin): document the TypeScript-version matrix"
```

---

## Task 18: Package README and build verification

**Files:**
- Create: `packages/unplugin-solid-three/README.md`
- Verify build output

- [ ] **Step 1: Write `packages/unplugin-solid-three/README.md`**

````markdown
# unplugin-solid-three

Build-time tree-shaking for [`solid-three`](https://github.com/solidjs-community/solid-three).
Rewrites `createT(THREE)` into a curated catalogue containing only the classes
your app actually reaches through `T`, so your bundler can drop the rest.

## Install

```bash
pnpm add -D unplugin-solid-three
```

## Vite

```ts
// vite.config.ts
import { vitePlugin as solidThree } from "unplugin-solid-three"
import solid from "vite-plugin-solid"

export default {
  plugins: [solidThree(), solid()],
}
```

Other bundlers: `rollupPlugin`, `webpackPlugin`, `esbuildPlugin`, `rspackPlugin`.

## How it works

You keep writing the concise `const T = createT(THREE)`. On production builds the
plugin follows every `T.Foo` access across your project and rewrites the call to
`createT({ Foo: THREE.Foo, … })`. Dev is untouched (the runtime proxy is used).

Narrowing happens only when it is provably sound. When a catalogue can't be
narrowed (a dynamic `T[expr]`, or `T` escaping into a function), the plugin keeps
the full catalogue and warns. Pass `{ strict: true }` to turn those warnings into
build errors. The fix is always the same: pass an explicit catalogue.

## Options

```ts
solidThree({
  strict: false,    // warnings → build errors
  tsconfig: undefined, // path to tsconfig (auto-detected)
})
```
````

- [ ] **Step 2: Build the package**

Run: `pnpm -C packages/unplugin-solid-three build`
Expected: `dist/index.js` and `dist/index.d.ts` produced, no errors.

- [ ] **Step 3: Run the full Node suite once more**

Run: `pnpm -C packages/unplugin-solid-three test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/unplugin-solid-three/README.md
git commit -m "docs(unplugin): package README"
```

---

## Self-Review notes (for the executor)

- **Soundness gate:** Task 16's oracle is the release gate. If it ever fails, stop
  and fix the analyzer — never narrow `oracle.generated.json` to make it pass.
- **ts-morph API drift:** Tasks 7 (`getAliasedSymbol`) and 4
  (`findReferencesAsNodes`) are the spots most likely to differ across ts-morph
  versions; each test pins the expected output so you can adjust the
  implementation freely.
- **Real-corpus integration (follow-up):** once green, point a bundle test at the
  repo's own `site/` build and assert it succeeds with the plugin — the spec's
  real-corpus layer. Not required for v1 green.
- **Deferred per spec:** generative/fuzz testing, the full bundler matrix, and
  mutation testing are follow-ups, not part of this plan.
- **Known v1 limitations (spec clauses 4 & 5, both exotic — track as follow-ups):**
  - *Eager-value pruning (clause 4):* Task 9 drops any unused explicit entry,
    including one whose value is a side-effecting expression (`createT({ M: makeIt() })`).
    Real catalogues use pure class references, so this is safe in practice; to be
    fully spec-correct, only prune entries whose value is a pure reference
    (identifier / member access / getter), and keep eager call-expression values.
  - *Catalogue-escape guard (clause 5):* `buildProviderMap` traces an identifier
    to its object-literal initializer (Task 8) without checking the object isn't
    also aliased/used elsewhere (`const cat = {…}; createT(cat); other(cat)`).
    Add a guard that falls back to `noop` when the catalogue identifier has
    references beyond the `createT` argument.
