import { describe, expect, it } from "vitest"
import { enumerateNamespaceKeys } from "../src/namespace-keys.ts"

describe("enumerateNamespaceKeys", () => {
  it("returns three's class names including Mesh and BoxGeometry", async () => {
    const keys = await enumerateNamespaceKeys("three", process.cwd())
    expect(keys).toContain("Mesh")
    expect(keys).toContain("BoxGeometry")
    expect(keys).not.toContain("default")
  })
})
