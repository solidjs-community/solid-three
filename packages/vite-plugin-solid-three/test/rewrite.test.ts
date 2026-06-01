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
