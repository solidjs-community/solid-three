import { describe, expect, it } from "vitest"
import { scaffoldSource, encodeScaffoldId, decodeScaffoldId, isScaffoldId } from "../src/scaffold.ts"

describe("scaffold", () => {
  it("emits one droppable named export per key", () => {
    expect(scaffoldSource(["Mesh", "Group"])).toBe("export const Mesh = 0\nexport const Group = 0\n")
  })

  it("round-trips an id (module + site index)", () => {
    const id = encodeScaffoldId("/abs/catalog.ts", 2)
    expect(isScaffoldId(id)).toBe(true)
    expect(decodeScaffoldId(id)).toEqual({ moduleId: "/abs/catalog.ts", siteIndex: 2 })
  })
})
