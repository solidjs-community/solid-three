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
