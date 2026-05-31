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
    expect(names && [...names].sort()).toEqual([
      "BoxGeometry",
      "Group",
      "Mesh",
      "MeshNormalMaterial",
    ])
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
