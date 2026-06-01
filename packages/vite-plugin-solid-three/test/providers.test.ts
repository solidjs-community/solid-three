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
    expect(providerFor("Mesh", sources, nsKeys)).toEqual({ text: "Custom", verbatim: false })
    expect(providerFor("Group", sources, nsKeys)).toEqual({ text: "THREE.Group", verbatim: false })
  })
  it("marks a verbatim getter/method provider", () => {
    const withGetter: CatalogueSource[] = [{ kind: "entry", key: "Foo", valueText: "get Foo(){ return A }", verbatim: true }]
    expect(providerFor("Foo", withGetter, nsKeys)).toEqual({ text: "get Foo(){ return A }", verbatim: true })
  })
  it("returns undefined for a key no source provides", () => {
    expect(providerFor("Nope", sources, nsKeys)).toBeUndefined()
  })
})
