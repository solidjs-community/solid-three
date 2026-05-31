import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { fixtureProject } from "../helpers.ts"

describe("findCreateTCalls", () => {
  it("finds a direct createT call", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)`,
    })
    const calls = findCreateTCalls(project)
    expect(calls).toHaveLength(1)
    expect(calls[0].getSourceFile().getFilePath()).toBe("/src/a.tsx")
  })

  it("follows a renamed import", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import * as THREE from "three"
import { createT as makeNamespace } from "solid-three"
const T = makeNamespace(THREE)`,
    })
    expect(findCreateTCalls(project)).toHaveLength(1)
  })

  it("ignores unrelated createT from other modules", () => {
    const project = fixtureProject({
      "/src/a.tsx": `import { createT } from "./local.ts"
export const T = createT({})`,
      "/src/local.ts": `export function createT(x: any) { return x }`,
    })
    expect(findCreateTCalls(project)).toHaveLength(0)
  })
})
