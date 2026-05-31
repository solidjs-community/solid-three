import { describe, expect, it } from "vitest"
import { createInlineProject } from "../../src/analysis/project.ts"

describe("createInlineProject", () => {
  it("creates source files from a record and resolves them", () => {
    const project = createInlineProject({
      "/src/a.ts": `export const x = 1`,
      "/src/b.ts": `import { x } from "./a.ts"; export const y = x + 1`,
    })
    expect(project.getSourceFiles().map(f => f.getFilePath()).sort()).toEqual([
      "/src/a.ts",
      "/src/b.ts",
    ])
  })
})
