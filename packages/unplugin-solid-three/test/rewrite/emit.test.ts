import { describe, expect, it } from "vitest"
import { entriesToObjectLiteral } from "../../src/rewrite/emit.ts"

describe("entriesToObjectLiteral", () => {
  it("emits a sorted object literal", () => {
    expect(
      entriesToObjectLiteral([
        { key: "Mesh", valueText: "THREE.Mesh" },
        { key: "BoxGeometry", valueText: "THREE.BoxGeometry" },
      ]),
    ).toBe("{ BoxGeometry: THREE.BoxGeometry, Mesh: THREE.Mesh }")
  })

  it("emits a verbatim getter as a property", () => {
    expect(
      entriesToObjectLiteral([{ key: "XYZ", valueText: "get XYZ() { return THREE.Mesh }" }]),
    ).toBe("{ get XYZ() { return THREE.Mesh } }")
  })

  it("emits empty object for no entries", () => {
    expect(entriesToObjectLiteral([])).toBe("{}")
  })
})
