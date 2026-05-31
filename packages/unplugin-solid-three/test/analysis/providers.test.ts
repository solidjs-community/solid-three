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
    expect(map.providers?.get("Mesh")).toBe("THREE.Mesh")
    expect(map.providers?.get("Group")).toBe("THREE.Group")
  })

  it("object literal shorthand keys map to themselves", () => {
    const map = providersFor("{ Mesh, Group }")
    expect(map.providers?.get("Mesh")).toBe("Mesh")
  })

  it("object literal value expressions are kept verbatim", () => {
    const map = providersFor("{ Mesh: THREE.Mesh }")
    expect(map.providers?.get("Mesh")).toBe("THREE.Mesh")
  })

  it("last spread wins on a shadowed key", () => {
    const map = providersFor(
      "{ ...THREE, MeshNormalMaterial: THREE.MeshNormalMaterial }",
      ["Mesh", "MeshNormalMaterial"],
    )
    expect(map.providers?.get("Mesh")).toBe("THREE.Mesh")
    expect(map.providers?.get("MeshNormalMaterial")).toBe("THREE.MeshNormalMaterial")
  })

  it("getter entries are kept verbatim as their full text", () => {
    const map = providersFor("{ get XYZ() { return THREE.Mesh } }")
    expect(map.providers?.get("XYZ")).toContain("get XYZ()")
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
