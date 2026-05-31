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
