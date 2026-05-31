import { Project, ts } from "ts-morph"
import { describe, expect, it } from "vitest"
import { findCreateTCalls } from "../../src/analysis/find-createt.ts"
import { collectUsedMembers } from "../../src/analysis/used-set.ts"

/**
 * Pins the supported JS/JSX path: when `.js`/`.jsx` files are part of the
 * ts-morph Program (allowJs on), the analyzer follows `T` into them and
 * collects members exactly as for `.ts`/`.tsx`. A consumer whose tsconfig
 * does NOT include its JS files (allowJs off) is outside this guarantee — see
 * the README "Limitations" section and the bundler-graph guard follow-up.
 */
function jsProject(usageFile: string, usageSrc: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      jsxImportSource: "solid-js",
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: true,
      checkJs: true,
      target: ts.ScriptTarget.ESNext,
    },
  })
  project.createSourceFile("/node_modules/solid-three/index.d.ts", `export function createT(c: any): any`)
  project.createSourceFile("/node_modules/three/index.d.ts", `export class Mesh {}\nexport class Group {}`)
  project.createSourceFile(
    "/src/cat.ts",
    `import * as THREE from "three"\nimport { createT } from "solid-three"\nexport const T = createT(THREE)`,
  )
  project.createSourceFile(usageFile, usageSrc)
  const call = findCreateTCalls(project)[0]
  return collectUsedMembers(call)
}

describe("js/jsx support (files inside the Program)", () => {
  it("follows T into a .js file (value access)", () => {
    const result = jsProject("/src/u.js", `import { T } from "./cat"\nexport const x = T.Group`)
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Group"])
  })

  it("follows T into a .jsx file (JSX member access)", () => {
    const result = jsProject("/src/u.jsx", `import { T } from "./cat"\nexport default () => <T.Group />`)
    expect(result.kind).toBe("closed")
    if (result.kind === "closed") expect([...result.members]).toEqual(["Group"])
  })
})
