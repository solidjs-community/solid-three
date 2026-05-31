import { describe, expect, it } from "vitest"
import { analyzeProject } from "../src/analysis/analyze.ts"
import { transformModule } from "../src/index.ts"
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

  it("normalizes a query suffix on the module id", () => {
    const code = `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`
    const project = fixtureProject({ "/src/a.tsx": code })
    const analysis = analyzeProject(project)
    expect(transformModule("/src/a.tsx?t=123", code, analysis)?.code).toContain(
      "createT({ Mesh: THREE.Mesh })",
    )
  })
})
