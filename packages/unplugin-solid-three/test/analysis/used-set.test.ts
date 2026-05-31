import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { collectUsedMembers } from "../../src/analysis/used-set.ts"
import { fixtureProject } from "../helpers.ts"

function usedSet(files: Record<string, string>) {
  const project = fixtureProject(files)
  const call = findCreateTCalls(project)[0]
  return collectUsedMembers(call)
}

describe("collectUsedMembers", () => {
  it("collects static members in one file", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh><T.BoxGeometry /></T.Mesh>`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") {
      expect([...result.members].sort()).toEqual(["BoxGeometry", "Mesh"])
    }
  })

  it("follows cross-file imports and renames", () => {
    const result = usedSet({
      "/src/cat.ts": `import * as THREE from "three"
import { createT } from "solid-three"
export const T = createT(THREE)`,
      "/src/scene.tsx": `import { T as Three } from "./cat.ts"
export default () => <Three.Group />`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Group"])
  })

  it("follows a simple alias", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
const U = T
export default () => <U.Mesh />`,
    })
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Mesh"])
  })

  it("returns open on a computed access", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare const k: string
export const x = T[k]`,
    })
    expect(result.kind).toBe("open")
  })

  it("returns open when T escapes into a function", () => {
    const result = usedSet({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare function setup(x: any): void
setup(T)`,
    })
    expect(result.kind).toBe("open")
  })
})
