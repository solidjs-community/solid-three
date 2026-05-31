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
