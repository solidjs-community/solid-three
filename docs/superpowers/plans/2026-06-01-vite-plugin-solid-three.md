# vite-plugin-solid-three Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vite plugin that makes `createT(THREE)` tree-shakeable, by letting the bundler measure which catalogue keys are used (pass 1) and re-emitting `createT` narrowed to those keys (pass 2).

**Architecture:** Two passes inside one Vite plugin. The *analysis is single-file* — find `createT(<arg>)` in the catalog module, read its argument locally (namespace / object-literal / bail). Pass 1 rewrites the result binding into a namespace import of a throwaway scaffold; a nested measurement `build()` tree-shakes it and `renderedExports` reports the used keys. Pass 2 rewrites `<arg>` to `createT({ …used keys with locally-resolved providers })`. The bundler does all cross-file work.

**Tech Stack:** Vite 6 (peer), TypeScript 5 parser (`ts.createSourceFile`, peer), magic-string, vitest (Node + browser-oracle). No ts-morph, no unplugin, no glob, no resolution host, no guard.

**Design source:** `docs/superpowers/specs/2026-06-01-createt-narrowing-design.md`

**Spike-validated:** cross-file namespace tree-shaking, sound deopt, custom literals, spread/override precedence, and the two-pass orchestration (one nested build, no recursion, `renderedExports` captured and fed back).

---

## Core data model (used across tasks — defined in Task 2, referenced everywhere)

```ts
// A catalogue is an ordered list of sources (last writer wins on key collisions).
export type CatalogueSource =
  | { kind: "namespace"; localName: string; moduleId: string } // createT(THREE) or {...THREE}
  | { kind: "entry"; key: string; valueText: string }          // { Mesh: X } or { get Foo(){…} } (verbatim)

export interface CatalogueSite {
  binding: string            // result binding name, e.g. "T"
  exported: boolean          // was the binding statement `export`ed
  sources: CatalogueSource[] // empty is impossible for a non-bail site
  // char offsets into the module source:
  argStart: number           // start of the createT argument
  argEnd: number             // end of the createT argument
  statementStart: number     // start of `const T = createT(...)` (or `export const ...`)
  statementEnd: number       // end of that statement
  siteIndex: number          // 0-based index of this createT site within the module
}

export interface BailSite {
  siteIndex: number
  reason: string
}

export interface ModuleAnalysis {
  sites: CatalogueSite[]
  bails: BailSite[]
}
```

## File structure

- `packages/vite-plugin-solid-three/src/types.ts` — the model above.
- `packages/vite-plugin-solid-three/src/analyze.ts` — `analyzeModule(code, id): ModuleAnalysis` (single-file ts parse).
- `packages/vite-plugin-solid-three/src/scaffold.ts` — `scaffoldSource(keys): string`; scaffold id encode/decode helpers.
- `packages/vite-plugin-solid-three/src/namespace-keys.ts` — `enumerateNamespaceKeys(moduleId, root): Promise<string[]>`.
- `packages/vite-plugin-solid-three/src/rewrite.ts` — `rewriteMeasure(code, analysis, scaffoldIdFor)` and `rewriteEmit(code, analysis, usedKeysFor, keyUniverseFor)`.
- `packages/vite-plugin-solid-three/src/index.ts` — the Vite plugin + two-pass orchestration.
- `packages/vite-plugin-solid-three/test/**` — unit tests + `fixtures/` (real vite builds) + `oracle/` (browser gate).

---

## Task 1: Scaffold the package

**Files:**
- Create: `packages/vite-plugin-solid-three/package.json`
- Create: `packages/vite-plugin-solid-three/tsconfig.json`
- Create: `packages/vite-plugin-solid-three/vitest.config.ts`
- Create: `packages/vite-plugin-solid-three/src/index.ts` (placeholder)

- [ ] **Step 1: package.json**

```json
{
  "name": "vite-plugin-solid-three",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } } },
  "files": ["dist/**"],
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "test:oracle": "vitest run --config vitest.browser.config.ts",
    "test:ts": "tsc --noEmit -p tsconfig.json && vitest run"
  },
  "dependencies": { "magic-string": "^0.30.0" },
  "peerDependencies": { "typescript": ">=5.0.0", "vite": "^5 || ^6" },
  "devDependencies": {
    "@solidjs/testing-library": "^0.8.8",
    "@vitest/browser": "^4.1.7",
    "@vitest/browser-playwright": "^4.1.7",
    "playwright": "^1.60.0",
    "solid-js": "^1.8.17",
    "solid-three": "workspace:*",
    "three": "^0.181.2",
    "tsup": "^8.0.2",
    "typescript": "^5.4.5",
    "vite": "6.4.2",
    "vite-plugin-solid": "2.11.12",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ESNext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: vitest.config.ts** (Node unit + fixture builds)

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/oracle/**"],
    environment: "node",
    // real vite builds in fixtures are heavy; serialize and give headroom.
    fileParallelism: false,
    testTimeout: 60_000,
  },
})
```

- [ ] **Step 4: placeholder src/index.ts**

```ts
export const placeholder = true
```

- [ ] **Step 5: install + commit**

Run: `cd packages/vite-plugin-solid-three && pnpm install`
Expected: workspace links resolve.

```bash
git add packages/vite-plugin-solid-three
git commit -m "chore(vps3): scaffold vite-plugin-solid-three package"
```

---

## Task 2: Types + recognize `createT` calls and their result binding

**Files:**
- Create: `packages/vite-plugin-solid-three/src/types.ts` (the model above)
- Create: `packages/vite-plugin-solid-three/src/analyze.ts`
- Test: `packages/vite-plugin-solid-three/test/analyze.test.ts`

This task finds `createT(...)` calls (imported from `solid-three`, rename-aware) and records the result binding + statement offsets. Argument classification comes in Tasks 3–5.

- [ ] **Step 1: write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { analyzeModule } from "../src/analyze.ts"

describe("analyzeModule — call recognition", () => {
  it("finds createT, the binding, and export flag", () => {
    const code = `import { createT } from "solid-three"
import * as THREE from "three"
export const T = createT(THREE)`
    const { sites } = analyzeModule(code, "/catalog.ts")
    expect(sites).toHaveLength(1)
    expect(sites[0].binding).toBe("T")
    expect(sites[0].exported).toBe(true)
    expect(code.slice(sites[0].argStart, sites[0].argEnd)).toBe("THREE")
  })

  it("follows a renamed createT import", () => {
    const code = `import { createT as mk } from "solid-three"
import * as THREE from "three"
const T = mk(THREE)`
    const { sites } = analyzeModule(code, "/c.ts")
    expect(sites).toHaveLength(1)
    expect(sites[0].binding).toBe("T")
    expect(sites[0].exported).toBe(false)
  })

  it("ignores createT-looking calls not imported from solid-three", () => {
    const code = `function createT(x){return x}
const T = createT({})`
    expect(analyzeModule(code, "/c.ts").sites).toHaveLength(0)
  })
})
```

- [ ] **Step 2: run — fails (module missing)**

Run: `pnpm vitest run test/analyze.test.ts -t "call recognition"`
Expected: FAIL.

- [ ] **Step 3: implement types.ts** — exactly the "Core data model" block above.

- [ ] **Step 4: implement analyze.ts** (call recognition only; argument left empty for now)

```ts
import ts from "typescript"
import type { CatalogueSite, ModuleAnalysis } from "./types.ts"

const SOLID_THREE = "solid-three"
const FACTORY = "createT"

/** Local names that `createT` is bound to via `import { createT [as x] } from "solid-three"`. */
function factoryAliases(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  sf.forEachChild(node => {
    if (!ts.isImportDeclaration(node)) return
    if (!ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== SOLID_THREE) return
    const named = node.importClause?.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        if ((el.propertyName?.text ?? el.name.text) === FACTORY) names.add(el.name.text)
      }
    }
  })
  return names
}

export function analyzeModule(code: string, fileName: string): ModuleAnalysis {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aliases = factoryAliases(sf)
  const sites: CatalogueSite[] = []
  if (aliases.size === 0) return { sites, bails: [] }

  let siteIndex = 0
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      aliases.has(node.expression.text)
    ) {
      const site = siteFromCall(node, sf, siteIndex)
      if (site) {
        sites.push(site)
        siteIndex++
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { sites, bails: [] }
}

/** Build a partial site from a createT call: binding + statement offsets. Arg sources filled in later tasks. */
function siteFromCall(call: ts.CallExpression, sf: ts.SourceFile, siteIndex: number): CatalogueSite | undefined {
  const arg = call.arguments[0]
  if (!arg) return undefined

  // result binding: `const T = createT(...)` (optionally exported)
  const varDecl = call.parent
  if (!ts.isVariableDeclaration(varDecl) || !ts.isIdentifier(varDecl.name)) return undefined
  const varList = varDecl.parent
  const statement = varList.parent
  if (!ts.isVariableStatement(statement)) return undefined
  const exported = !!statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)

  return {
    binding: varDecl.name.text,
    exported,
    sources: [], // filled in Tasks 3–5
    argStart: arg.getStart(sf),
    argEnd: arg.getEnd(),
    statementStart: statement.getStart(sf),
    statementEnd: statement.getEnd(),
    siteIndex,
  }
}
```

- [ ] **Step 5: run — passes**

Run: `pnpm vitest run test/analyze.test.ts -t "call recognition"`
Expected: PASS (3).

- [ ] **Step 6: commit**

```bash
git add packages/vite-plugin-solid-three/src/types.ts packages/vite-plugin-solid-three/src/analyze.ts packages/vite-plugin-solid-three/test/analyze.test.ts
git commit -m "feat(vps3): recognize createT calls and result binding (single-file)"
```

---

## Task 3: Classify a namespace argument (`createT(THREE)`)

**Files:**
- Modify: `packages/vite-plugin-solid-three/src/analyze.ts`
- Test: `packages/vite-plugin-solid-three/test/analyze.test.ts` (append)

- [ ] **Step 1: failing test**

```ts
describe("analyzeModule — namespace arg", () => {
  it("records createT(THREE) as a namespace source pointing at the module", () => {
    const code = `import { createT } from "solid-three"
import * as THREE from "three"
export const T = createT(THREE)`
    const { sites } = analyzeModule(code, "/c.ts")
    expect(sites[0].sources).toEqual([{ kind: "namespace", localName: "THREE", moduleId: "three" }])
  })

  it("bails when the arg is a namespace alias it cannot resolve to an import", () => {
    const code = `import { createT } from "solid-three"
const T = createT(SOMETHING)`
    const { sites, bails } = analyzeModule(code, "/c.ts")
    expect(sites).toHaveLength(0)
    expect(bails[0].reason).toMatch(/not.*namespace|unresolved/i)
  })
})
```

- [ ] **Step 2: run — fails** (`sources` is empty).

- [ ] **Step 3: implement** — add a namespace-import index and argument classification. In `analyzeModule`, build a map of `import * as NS from "mod"`; pass it to `siteFromCall`. Add:

```ts
/** local namespace name -> module specifier, from `import * as NS from "mod"`. */
function namespaceImports(sf: ts.SourceFile): Map<string, string> {
  const map = new Map<string, string>()
  sf.forEachChild(node => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const named = node.importClause?.namedBindings
    if (named && ts.isNamespaceImport(named)) map.set(named.name.text, node.moduleSpecifier.text)
  })
  return map
}
```

Wire it through (`analyzeModule` builds `const namespaces = namespaceImports(sf)` and passes to `siteFromCall`). Then classify the argument inside `siteFromCall`, replacing the `sources: []` placeholder with a call to `classifyArg(arg, namespaces, sf)`, and have `siteFromCall` return either a site or push a bail. Refactor `siteFromCall` to return `CatalogueSite | { bail: string }`:

```ts
function classifyArg(
  arg: ts.Expression,
  namespaces: Map<string, string>,
  sf: ts.SourceFile,
): { sources: CatalogueSource[] } | { bail: string } {
  // createT(THREE)
  if (ts.isIdentifier(arg)) {
    const moduleId = namespaces.get(arg.text)
    if (moduleId) return { sources: [{ kind: "namespace", localName: arg.text, moduleId }] }
    return { bail: `argument ${arg.text} is not a resolvable namespace import` }
  }
  // object literals handled in Task 4
  if (ts.isObjectLiteralExpression(arg)) return classifyObject(arg, namespaces, sf)
  return { bail: `unsupported catalogue argument (${ts.SyntaxKind[arg.kind]})` }
}
```

Update `analyzeModule`'s visit to push to `bails` when `siteFromCall` returns a bail (carry `siteIndex`, increment on every recognized call). Add a stub `classifyObject` returning `{ bail: "object literals — Task 4" }` for now so it compiles.

- [ ] **Step 4: run — passes**

Run: `pnpm vitest run test/analyze.test.ts -t "namespace arg"`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/analyze.ts packages/vite-plugin-solid-three/test/analyze.test.ts
git commit -m "feat(vps3): classify namespace catalogue argument"
```

---

## Task 4: Classify object-literal arguments (entries, spreads, getters)

**Files:**
- Modify: `packages/vite-plugin-solid-three/src/analyze.ts`
- Test: `packages/vite-plugin-solid-three/test/analyze.test.ts` (append)

- [ ] **Step 1: failing test**

```ts
describe("analyzeModule — object arg", () => {
  it("reads explicit entries with verbatim value text", () => {
    const code = `import { createT } from "solid-three"
import { MyMesh } from "./x"
export const T = createT({ Mesh: MyMesh })`
    const { sites } = analyzeModule(code, "/c.ts")
    expect(sites[0].sources).toEqual([{ kind: "entry", key: "Mesh", valueText: "MyMesh" }])
  })

  it("reads a namespace spread then an overriding entry, in order", () => {
    const code = `import { createT } from "solid-three"
import * as THREE from "three"
import { Custom } from "./x"
export const T = createT({ ...THREE, Mesh: Custom })`
    const { sites } = analyzeModule(code, "/c.ts")
    expect(sites[0].sources).toEqual([
      { kind: "namespace", localName: "THREE", moduleId: "three" },
      { kind: "entry", key: "Mesh", valueText: "Custom" },
    ])
  })

  it("keeps a getter verbatim", () => {
    const code = `import { createT } from "solid-three"
export const T = createT({ get Foo(){ return Date.now() > 0 ? A : B } })`
    const { sites } = analyzeModule(code, "/c.ts")
    const src = sites[0].sources[0]
    expect(src).toMatchObject({ kind: "entry", key: "Foo" })
    expect((src as any).valueText).toContain("get Foo()")
  })
})
```

- [ ] **Step 2: run — fails** (object bails via stub).

- [ ] **Step 3: implement `classifyObject`** (replace the stub)

```ts
function classifyObject(
  obj: ts.ObjectLiteralExpression,
  namespaces: Map<string, string>,
  sf: ts.SourceFile,
): { sources: CatalogueSource[] } | { bail: string } {
  const sources: CatalogueSource[] = []
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) {
      if (!ts.isIdentifier(prop.expression)) return { bail: "spread of a non-identifier" }
      const moduleId = namespaces.get(prop.expression.text)
      if (!moduleId) return { bail: `spread of non-namespace ${prop.expression.text}` }
      sources.push({ kind: "namespace", localName: prop.expression.text, moduleId })
      continue
    }
    // computed keys are not statically enumerable
    const nameNode =
      ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) ||
      ts.isGetAccessorDeclaration(prop) || ts.isMethodDeclaration(prop)
        ? prop.name
        : undefined
    if (!nameNode) return { bail: "unsupported property" }
    if (ts.isComputedPropertyName(nameNode)) return { bail: "computed property key" }
    const key = ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) ? nameNode.text : undefined
    if (key === undefined) return { bail: "non-static property key" }

    if (ts.isPropertyAssignment(prop)) {
      sources.push({ kind: "entry", key, valueText: prop.initializer.getText(sf) })
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      sources.push({ kind: "entry", key, valueText: key })
    } else if (ts.isGetAccessorDeclaration(prop) || ts.isMethodDeclaration(prop)) {
      sources.push({ kind: "entry", key, valueText: prop.getText(sf) }) // verbatim getter/method
    } else {
      return { bail: "unsupported property" }
    }
  }
  if (sources.length === 0) return { bail: "empty catalogue" }
  return { sources }
}
```

- [ ] **Step 4: run — passes**

Run: `pnpm vitest run test/analyze.test.ts -t "object arg"`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/analyze.ts packages/vite-plugin-solid-three/test/analyze.test.ts
git commit -m "feat(vps3): classify object-literal catalogue (entries, spreads, getters)"
```

---

## Task 5: Bail cases (dynamic source / computed key / unknown spread)

**Files:**
- Test: `packages/vite-plugin-solid-three/test/analyze.test.ts` (append)

Implementation already covers these (Tasks 3–4); this task locks them with tests.

- [ ] **Step 1: failing/confirming test**

```ts
describe("analyzeModule — bails", () => {
  it.each([
    [`const T = createT(store)`, /not a resolvable namespace/i],
    [`const T = createT({ [k]: X })`, /computed property/i],
    [`const T = createT({ ...runtimeObj })`, /non-namespace/i],
    [`const T = createT(makeIt())`, /unsupported catalogue argument/i],
  ])("bails on %s", (body, reason) => {
    const code = `import { createT } from "solid-three"\n${body}`
    const { sites, bails } = analyzeModule(code, "/c.ts")
    expect(sites).toHaveLength(0)
    expect(bails[0].reason).toMatch(reason)
  })
})
```

- [ ] **Step 2: run — passes** (or fix any mismatched bail message in analyze.ts to satisfy the regexes).

Run: `pnpm vitest run test/analyze.test.ts`
Expected: PASS (all analyze tests).

- [ ] **Step 3: typecheck + commit**

Run: `pnpm tsc --noEmit -p tsconfig.json`

```bash
git add packages/vite-plugin-solid-three/test/analyze.test.ts
git commit -m "test(vps3): lock catalogue bail cases"
```

---

## Task 6: Scaffold module generator + id codec

**Files:**
- Create: `packages/vite-plugin-solid-three/src/scaffold.ts`
- Test: `packages/vite-plugin-solid-three/test/scaffold.test.ts`

The measurement scaffold is one droppable named export per key. Each scaffold module's id encodes the source module + site index, so `generateBundle` can map `renderedExports` back.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest"
import { scaffoldSource, encodeScaffoldId, decodeScaffoldId, isScaffoldId } from "../src/scaffold.ts"

describe("scaffold", () => {
  it("emits one droppable named export per key", () => {
    expect(scaffoldSource(["Mesh", "Group"])).toBe("export const Mesh = 0\nexport const Group = 0\n")
  })

  it("round-trips an id (module + site index)", () => {
    const id = encodeScaffoldId("/abs/catalog.ts", 2)
    expect(isScaffoldId(id)).toBe(true)
    expect(decodeScaffoldId(id)).toEqual({ moduleId: "/abs/catalog.ts", siteIndex: 2 })
  })
})
```

- [ ] **Step 2: run — fails.**

- [ ] **Step 3: implement scaffold.ts**

```ts
const PREFIX = "\0vps3-scaffold:"

export function scaffoldSource(keys: string[]): string {
  return keys.map(k => `export const ${k} = 0\n`).join("")
}

export function encodeScaffoldId(moduleId: string, siteIndex: number): string {
  return `${PREFIX}${siteIndex}:${encodeURIComponent(moduleId)}`
}

export function isScaffoldId(id: string): boolean {
  return id.startsWith(PREFIX)
}

export function decodeScaffoldId(id: string): { moduleId: string; siteIndex: number } {
  const rest = id.slice(PREFIX.length)
  const colon = rest.indexOf(":")
  return { siteIndex: Number(rest.slice(0, colon)), moduleId: decodeURIComponent(rest.slice(colon + 1)) }
}
```

- [ ] **Step 4: run — passes. Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/scaffold.ts packages/vite-plugin-solid-three/test/scaffold.test.ts
git commit -m "feat(vps3): scaffold module generator and id codec"
```

---

## Task 7: Enumerate a namespace module's export names

**Files:**
- Create: `packages/vite-plugin-solid-three/src/namespace-keys.ts`
- Test: `packages/vite-plugin-solid-three/test/namespace-keys.test.ts`

For a namespace catalogue we need the full key universe (so the scaffold has every possible key). We get it by importing the module in Node and reading its exports, resolved from the project root. Cached per (moduleId, root).

- [ ] **Step 1: failing test** (uses the real `three` dev dep)

```ts
import { describe, expect, it } from "vitest"
import { enumerateNamespaceKeys } from "../src/namespace-keys.ts"

describe("enumerateNamespaceKeys", () => {
  it("returns three's class names including Mesh and BoxGeometry", async () => {
    const keys = await enumerateNamespaceKeys("three", process.cwd())
    expect(keys).toContain("Mesh")
    expect(keys).toContain("BoxGeometry")
    expect(keys).not.toContain("default")
  })
})
```

- [ ] **Step 2: run — fails.**

- [ ] **Step 3: implement namespace-keys.ts**

```ts
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const cache = new Map<string, Promise<string[]>>()

/** Export names of a module, resolved from `root`, excluding `default` and internals. */
export function enumerateNamespaceKeys(moduleId: string, root: string): Promise<string[]> {
  const cacheKey = `${root}\0${moduleId}`
  let pending = cache.get(cacheKey)
  if (!pending) {
    pending = load(moduleId, root)
    cache.set(cacheKey, pending)
  }
  return pending
}

async function load(moduleId: string, root: string): Promise<string[]> {
  const require = createRequire(pathToFileURL(`${root}/package.json`))
  const resolved = require.resolve(moduleId)
  const ns = await import(pathToFileURL(resolved).href)
  return Object.keys(ns).filter(k => k !== "default" && !k.startsWith("__"))
}
```

- [ ] **Step 4: run — passes. Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/namespace-keys.ts packages/vite-plugin-solid-three/test/namespace-keys.test.ts
git commit -m "feat(vps3): enumerate namespace module export names"
```

---

## Task 8: Provider + key-universe helpers (pure, from sources + used keys)

**Files:**
- Create: `packages/vite-plugin-solid-three/src/providers.ts`
- Test: `packages/vite-plugin-solid-three/test/providers.test.ts`

Given a site's `sources` plus the resolved namespace key-sets, compute (a) the key universe (for the scaffold) and (b) the provider expression for each used key (last writer wins).

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest"
import { keyUniverse, providerFor } from "../src/providers.ts"
import type { CatalogueSource } from "../src/types.ts"

const nsKeys = new Map([["three", ["Mesh", "Group", "Box"]]])
const sources: CatalogueSource[] = [
  { kind: "namespace", localName: "THREE", moduleId: "three" },
  { kind: "entry", key: "Mesh", valueText: "Custom" },
]

describe("providers", () => {
  it("key universe = union of namespace keys and entry keys", () => {
    expect([...keyUniverse(sources, nsKeys)].sort()).toEqual(["Box", "Group", "Mesh"])
  })
  it("last writer wins: Mesh -> Custom, Group -> THREE.Group", () => {
    expect(providerFor("Mesh", sources, nsKeys)).toBe("Custom")
    expect(providerFor("Group", sources, nsKeys)).toBe("THREE.Group")
  })
  it("returns undefined for a key no source provides", () => {
    expect(providerFor("Nope", sources, nsKeys)).toBeUndefined()
  })
})
```

- [ ] **Step 2: run — fails. Step 3: implement providers.ts**

```ts
import type { CatalogueSource } from "./types.ts"

type NsKeys = Map<string, string[]> // moduleId -> export names

export function keyUniverse(sources: CatalogueSource[], nsKeys: NsKeys): Set<string> {
  const keys = new Set<string>()
  for (const s of sources) {
    if (s.kind === "namespace") for (const k of nsKeys.get(s.moduleId) ?? []) keys.add(k)
    else keys.add(s.key)
  }
  return keys
}

/** The provider expression for `key`, applying last-writer-wins over sources. */
export function providerFor(key: string, sources: CatalogueSource[], nsKeys: NsKeys): string | undefined {
  for (let i = sources.length - 1; i >= 0; i--) {
    const s = sources[i]
    if (s.kind === "entry" && s.key === key) return s.valueText
    if (s.kind === "namespace" && (nsKeys.get(s.moduleId) ?? []).includes(key)) return `${s.localName}.${key}`
  }
  return undefined
}
```

- [ ] **Step 4: run — passes. Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/providers.ts packages/vite-plugin-solid-three/test/providers.test.ts
git commit -m "feat(vps3): key-universe and last-write-wins provider resolution"
```

---

## Task 9: Rewrites — measure (pass 1) and emit (pass 2)

**Files:**
- Create: `packages/vite-plugin-solid-three/src/rewrite.ts`
- Test: `packages/vite-plugin-solid-three/test/rewrite.test.ts`

Both rewrites use magic-string against the analysis offsets, preserving sourcemaps.

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest"
import { analyzeModule } from "../src/analyze.ts"
import { rewriteMeasure, rewriteEmit } from "../src/rewrite.ts"

const CODE = `import { createT } from "solid-three"
import * as THREE from "three"
export const T = createT(THREE)`

describe("rewriteMeasure (pass 1)", () => {
  it("replaces the binding statement with a namespace import + re-export", () => {
    const { sites } = analyzeModule(CODE, "/c.ts")
    const out = rewriteMeasure(CODE, sites, () => "\0scaffold").code
    expect(out).toContain(`import * as T from "\0scaffold"`)
    expect(out).toContain(`export { T }`)
    expect(out).not.toContain("createT(THREE)")
  })
})

describe("rewriteEmit (pass 2)", () => {
  it("narrows the createT argument to used keys with resolved providers", () => {
    const { sites } = analyzeModule(CODE, "/c.ts")
    const nsKeys = new Map([["three", ["Mesh", "Group", "Box"]]])
    const out = rewriteEmit(CODE, sites, () => new Set(["Mesh", "Group"]), nsKeys).code
    expect(out).toContain("createT({ Mesh: THREE.Mesh, Group: THREE.Group })")
    expect(out).not.toContain("createT(THREE)")
  })
})
```

- [ ] **Step 2: run — fails. Step 3: implement rewrite.ts**

```ts
import MagicString from "magic-string"
import { keyUniverse, providerFor } from "./providers.ts"
import type { CatalogueSite } from "./types.ts"

export interface RewriteResult {
  code: string
  map: ReturnType<MagicString["generateMap"]>
}

/** Pass 1: turn each catalogue binding into a namespace import of its scaffold. */
export function rewriteMeasure(
  code: string,
  sites: CatalogueSite[],
  scaffoldIdFor: (site: CatalogueSite) => string,
): RewriteResult {
  const s = new MagicString(code)
  for (const site of sites) {
    const reexport = site.exported ? `\nexport { ${site.binding} }` : ""
    s.overwrite(
      site.statementStart,
      site.statementEnd,
      `import * as ${site.binding} from ${JSON.stringify(scaffoldIdFor(site))}${reexport}`,
    )
  }
  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}

/** Pass 2: narrow each createT argument to the used keys, resolving providers. */
export function rewriteEmit(
  code: string,
  sites: CatalogueSite[],
  usedKeysFor: (site: CatalogueSite) => Set<string>,
  nsKeys: Map<string, string[]>,
): RewriteResult {
  const s = new MagicString(code)
  for (const site of sites) {
    const used = usedKeysFor(site)
    const universe = keyUniverse(site.sources, nsKeys)
    const entries: string[] = []
    for (const key of used) {
      if (!universe.has(key)) continue // accessed key not in catalogue — leave to runtime (proxy semantics)
      const provider = providerFor(key, site.sources, nsKeys)
      if (provider !== undefined) entries.push(`${key}: ${provider}`)
    }
    s.overwrite(site.argStart, site.argEnd, `{ ${entries.join(", ")} }`)
  }
  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}
```

- [ ] **Step 4: run — passes. Step 5: commit**

```bash
git add packages/vite-plugin-solid-three/src/rewrite.ts packages/vite-plugin-solid-three/test/rewrite.test.ts
git commit -m "feat(vps3): measure (pass 1) and emit (pass 2) rewrites"
```

---

## Task 10: The Vite plugin + two-pass orchestration

**Files:**
- Modify: `packages/vite-plugin-solid-three/src/index.ts`
- Test (integration): `packages/vite-plugin-solid-three/test/fixtures/_harness.ts` + `test/fixtures/namespace/*` + `test/fixtures/fixtures.test.ts`

This is the de-risk task — productionize the spiked orchestration with real config capture. Module-level state coordinates the real build and its nested measurement build (re-entrancy via a flag; results via a shared map).

- [ ] **Step 1: implement index.ts**

```ts
import { build, type Plugin, type UserConfig } from "vite"
import { analyzeModule } from "./analyze.ts"
import { enumerateNamespaceKeys } from "./namespace-keys.ts"
import { keyUniverse } from "./providers.ts"
import { rewriteEmit, rewriteMeasure } from "./rewrite.ts"
import { decodeScaffoldId, encodeScaffoldId, isScaffoldId, scaffoldSource } from "./scaffold.ts"

// Module-level coordination between the real build and its nested measure build.
let measuring = false
// moduleId -> siteIndex -> used keys (filled by the measure build, read by the real build).
const measured = new Map<string, Map<number, Set<string>>>()

function normalize(id: string): string {
  return id.split("?")[0]
}

export default function solidThree(): Plugin {
  let userConfig: UserConfig = {}
  let root = process.cwd()
  // moduleId -> siteIndex -> scaffold key universe (built during the measure transform).
  const scaffoldKeys = new Map<string, Map<number, string[]>>()

  return {
    name: "vite-plugin-solid-three",
    enforce: "pre",
    apply: "build", // dev keeps the runtime proxy

    config(config) {
      userConfig = config
    },
    configResolved(resolved) {
      root = resolved.root
    },

    async buildStart() {
      if (measuring) return // we ARE the measurement build — don't recurse
      measuring = true
      try {
        await build({
          ...userConfig,
          configFile: false,
          logLevel: "silent",
          build: { ...userConfig.build, write: false },
        })
      } finally {
        measuring = false
      }
    },

    resolveId(id) {
      return isScaffoldId(id) ? id : null
    },
    load(id) {
      if (!isScaffoldId(id)) return null
      const { moduleId, siteIndex } = decodeScaffoldId(id)
      const keys = scaffoldKeys.get(moduleId)?.get(siteIndex) ?? []
      return scaffoldSource(keys)
    },

    async transform(code, id) {
      const file = normalize(id)
      const { sites } = analyzeModule(code, file)
      if (sites.length === 0) return null

      if (measuring) {
        // Pass 1: build scaffolds (need namespace key universes), rewrite to namespace imports.
        const perSite = new Map<number, string[]>()
        for (const site of sites) {
          const nsKeys = new Map<string, string[]>()
          for (const s of site.sources) {
            if (s.kind === "namespace") nsKeys.set(s.moduleId, await enumerateNamespaceKeys(s.moduleId, root))
          }
          perSite.set(site.siteIndex, [...keyUniverse(site.sources, nsKeys)])
        }
        scaffoldKeys.set(file, perSite)
        const result = rewriteMeasure(code, sites, site => encodeScaffoldId(file, site.siteIndex))
        return { code: result.code, map: result.map }
      }

      // Pass 2 (real build): narrow using the measured used-keys.
      const used = measured.get(file)
      if (!used) return null
      const nsKeys = new Map<string, string[]>()
      for (const site of sites)
        for (const s of site.sources)
          if (s.kind === "namespace" && !nsKeys.has(s.moduleId))
            nsKeys.set(s.moduleId, await enumerateNamespaceKeys(s.moduleId, root))
      const result = rewriteEmit(code, sites, site => used.get(site.siteIndex) ?? new Set(), nsKeys)
      return { code: result.code, map: result.map }
    },

    generateBundle(_opts, bundle) {
      if (!measuring) return // only the measure build records usage
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue
        for (const [mid, mod] of Object.entries(chunk.modules)) {
          if (!isScaffoldId(mid)) continue
          const { moduleId, siteIndex } = decodeScaffoldId(mid)
          const perSite = measured.get(moduleId) ?? new Map<number, Set<string>>()
          perSite.set(siteIndex, new Set(mod.renderedExports))
          measured.set(moduleId, perSite)
        }
      }
    },
  }
}
```

> Orchestration notes baked in: `measuring` guards recursion; `configFile: false` stops the sub-build re-reading the user's vite config file (we replay the captured `userConfig`, which already includes this plugin instance — the guard makes the nested instance behave as the measure pass). `measured`/`scaffoldKeys` are module-level so they survive across the two build instances in one process.
>
> **Fallback if instance-reuse misbehaves (the spike used two instances, not one):** the spike validated orchestration with a *separate* measure plugin instance. If replaying `userConfig` with the same plugin instance causes hook-state issues, switch to two plugins sharing the module-level `measured`/`scaffoldKeys`: the main plugin's `buildStart` builds with `plugins: [measurePlugin(root), ...userConfig.plugins.filter(p => p?.name !== "vite-plugin-solid-three")]` (drop ourselves, inject a fresh measure plugin that owns `resolveId`/`load`/pass-1 `transform`/`generateBundle`); the main plugin then only does config capture, `buildStart` orchestration, and pass-2 `transform`. No recursion guard needed because the measure build doesn't contain the main plugin. Decide empirically at Step 4 — both share all the pure modules (analyze/rewrite/scaffold/providers), so the choice is localized to `index.ts`.

- [ ] **Step 2: namespace fixture + harness**

`test/fixtures/_harness.ts`:

```ts
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { build } from "vite"
import solid from "vite-plugin-solid"
import solidThree from "../../src/index.ts"

const here = dirname(fileURLToPath(import.meta.url))

export async function buildFixture(name: string, entry = "scene.tsx"): Promise<string> {
  const root = resolve(here, name)
  const output = await build({
    root,
    logLevel: "silent",
    plugins: [solidThree(), solid()],
    build: { write: false, minify: false, lib: { entry: resolve(root, entry), formats: ["es"], fileName: "out" } },
  })
  const chunks = (Array.isArray(output) ? output : [output]).flatMap(o => ("output" in o ? o.output : []))
  return chunks.filter(c => c.type === "chunk").map(c => (c as { code: string }).code).join("\n")
}
```

`test/fixtures/namespace/catalog.ts`:

```ts
import * as THREE from "three"
import { createT } from "solid-three"
export const T = createT(THREE)
```

`test/fixtures/namespace/scene.tsx`:

```tsx
import { T } from "./catalog.ts"
export function Scene() {
  return <T.Mesh />
}
```

`test/fixtures/namespace/tsconfig.json`:

```json
{ "compilerOptions": { "jsx": "preserve", "jsxImportSource": "solid-js", "module": "ESNext", "moduleResolution": "bundler", "target": "ESNext", "allowImportingTsExtensions": true, "strict": true, "skipLibCheck": true } }
```

- [ ] **Step 3: failing test**

`test/fixtures/fixtures.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildFixture } from "./_harness.ts"

describe("fixture matrix", () => {
  it("namespace: narrows createT(THREE) to the used class", async () => {
    const code = await buildFixture("namespace")
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  })
})
```

- [ ] **Step 4: run — iterate to green**

Run: `pnpm vitest run test/fixtures/fixtures.test.ts -t "namespace"`
Expected: PASS — the measure sub-build records `Mesh`, the real build emits `createT({ Mesh: THREE.Mesh })`, `BoxGeometry` is dropped.

> This is the integration linchpin. If it hangs or recurses, check the `measuring` guard and `configFile: false`. If `BoxGeometry` survives, confirm `generateBundle` is reading scaffold `renderedExports` (log `measured`).

- [ ] **Step 5: typecheck + commit**

```bash
git add packages/vite-plugin-solid-three/src/index.ts packages/vite-plugin-solid-three/test/fixtures
git commit -m "feat(vps3): Vite plugin with two-pass measure/emit orchestration"
```

---

## Task 11: Fixture matrix — custom literal, override, dynamic-bail, union

**Files:**
- Create fixtures under `test/fixtures/{literal,override,dynamic,union}/`
- Modify: `test/fixtures/fixtures.test.ts`

Mirror the spikes. Each catalog/scene is tiny; assertions check drop/keep.

- [ ] **Step 1: literal** — `catalog.ts`: `export const T = createT({ Used: Box, Unused: Sphere })` (import `Box`/`Sphere` as custom classes from a local `classes.ts` that re-exports two distinct three classes); scene uses `T.Used`. Assert the `Used` class survives, `Unused` dropped.

- [ ] **Step 2: override** — `catalog.ts`: `export const T = createT({ ...THREE, Mesh: CustomMesh })`; scene uses `T.Mesh` + `T.Group`. Assert `CustomMesh` present, `THREE.Group` present, `THREE.Mesh` absent (overridden), other three classes absent.

- [ ] **Step 3: dynamic (bail)** — `scene.tsx` accesses `T[(globalThis as any).k]`. Assert the catalogue is NOT narrowed (a second unused class still present) and the build still succeeds.

- [ ] **Step 4: union** — two scenes importing the same `T`, one uses `T.Mesh`, the other `T.Group`; an aggregate entry imports both. Assert both `Mesh` and `Group` survive, a third unused class dropped.

- [ ] **Step 5: tests**

```ts
describe("fixture matrix — shapes", () => {
  it("literal: drops the unused custom class", async () => {
    const code = await buildFixture("literal")
    expect(code).toContain("USED_MARK"); expect(code).not.toContain("UNUSED_MARK")
  })
  it("override: last-write-wins drops the overridden THREE.Mesh", async () => {
    const code = await buildFixture("override")
    expect(code).toContain("CUSTOM_MESH"); expect(code).toContain("Group")
    expect(code).not.toContain("BoxGeometry")
  })
  it("dynamic: bails to full catalogue, build still works", async () => {
    const code = await buildFixture("dynamic")
    expect(code).toContain("BoxGeometry") // not narrowed
  })
  it("union: keeps the union across files", async () => {
    const code = await buildFixture("union", "entry.tsx")
    expect(code).toContain("Mesh"); expect(code).toContain("Group")
    expect(code).not.toContain("TorusKnotGeometry")
  })
})
```

- [ ] **Step 6: run — green; commit**

```bash
git add packages/vite-plugin-solid-three/test/fixtures
git commit -m "test(vps3): fixture matrix — literal, override, dynamic-bail, union"
```

---

## Task 12: Code-splitting / dynamic-import fixtures

**Files:**
- Create fixtures under `test/fixtures/{code-split,dynamic-import}/`
- Modify: `test/fixtures/fixtures.test.ts`

Proves the bundler-measurement handles split graphs natively (no special handling).

- [ ] **Step 1: code-split** — `lazy(() => import("./Heavy.tsx"))` where `Heavy` uses a class no eager module does. Assert that class survives.
- [ ] **Step 2: dynamic-import** — a scene loaded via `import(\`./scenes/${n}.tsx\`)` using a marker class. Assert it survives.
- [ ] **Step 3: tests + run + commit**

```ts
it("code-split: a class only in a lazy chunk survives", async () => {
  expect(await buildFixture("code-split")).toContain("DodecahedronGeometry")
})
it("dynamic-import: a class only in a dynamically-imported scene survives", async () => {
  expect(await buildFixture("dynamic-import")).toContain("TorusKnotGeometry")
})
```

```bash
git add packages/vite-plugin-solid-three/test/fixtures
git commit -m "test(vps3): code-split and dynamic-import fixtures"
```

---

## Task 13: Browser soundness oracle (release gate)

**Files:**
- Create: `packages/vite-plugin-solid-three/vitest.browser.config.ts`
- Create: `packages/vite-plugin-solid-three/test/oracle/{shim.ts,scene.fixture.tsx,oracle.test.tsx}`

Instrument the runtime `createT` proxy to record every key requested at render; assert that set ⊆ the narrowed catalogue produced for the same fixture. (Port the v1 oracle shape: mount `<Canvas><Scene/></Canvas>` from the same mocked `solid-three`; key recorded keys by name; swallow the incidental `boundingSphere` frameloop error.)

- [ ] **Step 1: browser vitest config** (Playwright + SwiftShader; `optimizeDeps.include: ["@solidjs/testing-library", "three"]`; `globalSetup` builds the namespace fixture through the plugin and writes the narrowed key set to a JSON the test reads).
- [ ] **Step 2: recording shim** wrapping the real `createT` (via `importOriginal`) to populate a `requestedKeys` set.
- [ ] **Step 3: oracle test** — render the fixture scene, collect `requestedKeys ∩ three`, assert `leaked = requested − narrowed` is empty, and that the render was non-vacuous.
- [ ] **Step 4: run + commit**

Run: `pnpm test:oracle`
Expected: PASS — no class used at runtime is missing from the narrowed catalogue.

```bash
git add packages/vite-plugin-solid-three/vitest.browser.config.ts packages/vite-plugin-solid-three/test/oracle
git commit -m "test(vps3): browser soundness oracle (release gate)"
```

---

## Task 14: README + final gate

**Files:**
- Create: `packages/vite-plugin-solid-three/README.md`
- Modify: `pnpm-workspace.yaml` only if needed (already globs `packages/*`).

- [ ] **Step 1: README** — install, Vite usage (`plugins: [solidThree(), solid()]`), how it works (two-pass, build-only, dev untouched), and the bail behavior (dynamic catalogues stay full + dynamic; usage `T[expr]` deopts to full). Keep it short.

- [ ] **Step 2: full gate**

Run: `pnpm tsc --noEmit -p tsconfig.json && pnpm vitest run && pnpm test:oracle && pnpm build`
Expected: all green.

- [ ] **Step 3: commit**

```bash
git add packages/vite-plugin-solid-three/README.md
git commit -m "docs(vps3): README"
```

---

## Self-review checklist (run after implementation)

- **Spec coverage:** single-file analysis (T2–5) · namespace/literal/spread/override/getter providers (T3,4,8) · bail scope (T5) · scaffold + measurement (T6,10) · key enumeration (T7) · two-pass orchestration (T10) · cross-file union & code-split via the bundler (T11,12) · oracle gate (T13).
- **Soundness direction:** every fixture asserts either "unused class dropped + used class kept" or "bail keeps full." No fixture asserts a used class is dropped.
- **Type consistency:** `CatalogueSource`/`CatalogueSite` defined once in `types.ts`; `analyzeModule` → `rewriteMeasure`/`rewriteEmit` consume the same offsets; `measured`/`scaffoldKeys` keys are `(normalized moduleId, siteIndex)` everywhere.
- **Orchestration:** confirm exactly one nested build per real build (no recursion), and that `measured` is populated before pass-2 transform runs (buildStart awaits the sub-build).

## Open items / deferred

- **2× build cost:** acceptable for v1; later optimize the measure build (drop non-essential plugins, skip minify — but keep the same module graph). Log if pursued.
- **Multiple `createT` calls per module / multiple catalogues:** handled by `siteIndex`; add a fixture if it proves common.
- **`three/webgpu` and other namespaces:** covered if node-resolvable for key enumeration; add a fixture when prioritized.
- **Config replay edge cases:** SSR/multiple environments, `build.rollupOptions.input` arrays — validate against a SolidStart-style config before release.

## Execution handoff

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — batch with checkpoints.

Task 10 (orchestration) is the highest-risk; review it carefully whichever path is chosen.
