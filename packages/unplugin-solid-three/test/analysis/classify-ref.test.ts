import { describe, expect, it } from "vitest"
import { Node, type Project } from "ts-morph"
import { classifyRef } from "../../src/analysis/classify-ref.ts"
import { fixtureProject } from "../helpers.ts"

/** Grab the identifier `T` references that are NOT the declaration. */
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
  it("simple alias → alias", () => {
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
