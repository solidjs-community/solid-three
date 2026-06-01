import { describe, expect, it } from "vitest"
import { buildFixture } from "./_harness.ts"

describe("fixture matrix", () => {
  it("namespace: narrows createT(THREE) to the used class", async () => {
    const code = await buildFixture("namespace")
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  })
})

describe("fixture matrix — shapes", () => {
  it("literal: drops the unused custom class", async () => {
    const code = await buildFixture("literal")
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  })
  it("override: last-write-wins keeps CustomMesh + Group, drops unused three", async () => {
    const code = await buildFixture("override")
    expect(code).toContain("customMeshMarker")
    expect(code).toContain("Group")
    expect(code).not.toContain("BoxGeometry")
  })
  it("dynamic: bails to full catalogue, build still works", async () => {
    const code = await buildFixture("dynamic")
    expect(code).toContain("BoxGeometry") // not narrowed
  })
  it("union: keeps the union across files", async () => {
    const code = await buildFixture("union", "entry.tsx")
    expect(code).toContain("Mesh")
    expect(code).toContain("Group")
    expect(code).not.toContain("TorusKnotGeometry")
  })
})

describe("fixture matrix — code splitting", () => {
  it("code-split: a class only in a lazy chunk survives", async () => {
    expect(await buildFixture("code-split")).toContain("DodecahedronGeometry")
  })
  it("dynamic-import: a class only in a dynamically-imported scene survives", async () => {
    expect(await buildFixture("dynamic-import")).toContain("TorusKnotGeometry")
  })
})
