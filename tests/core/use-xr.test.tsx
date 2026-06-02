import { createRoot } from "solid-js"
import { describe, expect, it } from "vitest"
import { useXR } from "../../src/create-xr.tsx"

describe("useXR", () => {
  it("throws when used outside <xr.Provider>", () => {
    createRoot(dispose => {
      expect(() => useXR()).toThrow(/useXR must be used within/)
      dispose()
    })
  })
})
