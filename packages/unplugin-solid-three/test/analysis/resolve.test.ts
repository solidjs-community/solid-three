import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { resolveCatalogue } from "../../src/analysis/resolve.ts"
import { collectUsedMembers } from "../../src/analysis/used-set.ts"
import { fixtureProject } from "../helpers.ts"

function resolve(files: Record<string, string>, threeExports?: string[]) {
  const project = fixtureProject(files, threeExports)
  const call = findCreateTCalls(project)[0]
  return resolveCatalogue(call, collectUsedMembers(call))
}

describe("resolveCatalogue", () => {
  it("narrows a namespace to the used members", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
export default () => <T.Mesh />`,
    })
    expect(out).toEqual({ kind: "narrow", entries: [{ key: "Mesh", valueText: "THREE.Mesh" }] })
  })

  it("prunes an object literal to the used members", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT({ Mesh: THREE.Mesh, Group: THREE.Group })
export default () => <T.Mesh />`,
    })
    expect(out).toEqual({ kind: "narrow", entries: [{ key: "Mesh", valueText: "THREE.Mesh" }] })
  })

  it("keeps + warns when a namespace is defeated by a computed access", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT(THREE)
declare const k: string
export const x = T[k]`,
    })
    expect(out.kind).toBe("keep")
  })

  it("noop + info for a proxy argument", () => {
    const out = resolve({
      "/src/a.tsx": `import { createT } from "solid-three"
const T = createT(new Proxy({} as any, {}))
export const x = (T as any).Mesh`,
    })
    expect(out.kind).toBe("noop")
  })

  it("keeps an ambiguous non-enumerable spread", () => {
    const out = resolve({
      "/src/a.tsx": `import * as THREE from "three"
import { createT } from "solid-three"
const T = createT({ ...(globalThis as any).extra, Mesh: THREE.Mesh })
export default () => <T.Mesh />`,
    })
    expect(out.kind).toBe("keep")
  })
})
