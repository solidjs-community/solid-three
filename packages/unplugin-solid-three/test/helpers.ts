import type { Project } from "ts-morph"
import { createInlineProject } from "../src/analysis/project.ts"

/**
 * Build an inline project that already declares a minimal `solid-three`
 * module exporting `createT`, plus a `three` module exporting the given class
 * names — so fixtures can `import { createT } from "solid-three"` and
 * `import * as THREE from "three"` and resolve.
 */
export function fixtureProject(
  files: Record<string, string>,
  threeExports: string[] = ["Mesh", "Group", "BoxGeometry", "MeshNormalMaterial"],
): Project {
  const three = threeExports.map(n => `export class ${n} {}`).join("\n")
  return createInlineProject({
    "/node_modules/solid-three/index.d.ts": `export function createT(catalogue: any): any`,
    "/node_modules/three/index.d.ts": three,
    ...files,
  })
}
