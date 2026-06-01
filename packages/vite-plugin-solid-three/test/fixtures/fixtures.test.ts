import { describe, expect, it } from "vitest"
import { buildFixture } from "./_harness.ts"

describe("fixture matrix", () => {
  it("namespace: narrows createT(THREE) to the used class", async () => {
    const code = await buildFixture("namespace")
    expect(code).toContain("Mesh")
    expect(code).not.toContain("BoxGeometry")
  })
})
