import { describe, expect, it } from "vitest"
import type { CallSite, Outcome, ResolvedEntry, UsedSet } from "../../src/types.ts"

describe("types", () => {
  it("constructs each shape", () => {
    const entry: ResolvedEntry = { key: "Mesh", valueText: "THREE.Mesh" }
    const narrow: Outcome = { kind: "narrow", entries: [entry] }
    const keep: Outcome = { kind: "keep", reason: "dynamic", ref: { filePath: "a.ts", line: 1, column: 1 } }
    const noop: Outcome = { kind: "noop", reason: "proxy" }
    const used: UsedSet = { kind: "closed", members: new Set(["Mesh"]) }
    const site: CallSite = { filePath: "a.ts", argStart: 0, argEnd: 5, outcome: narrow }
    expect([narrow, keep, noop, used, site]).toHaveLength(5)
    expect(entry.key).toBe("Mesh")
  })
})
