import { writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Project, ts } from "ts-morph"
import { analyzeProject } from "../../src/analysis/analyze.ts"

const here = dirname(fileURLToPath(import.meta.url))

/** Run the analyzer over the oracle fixtures and record each narrowed key set. */
export default function setup(): void {
  const project = new Project({
    compilerOptions: {
      jsx: ts.JsxEmit.Preserve,
      jsxImportSource: "solid-js",
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      strict: true,
    },
  })
  project.addSourceFilesAtPaths(resolve(here, "*.fixture.tsx"))

  const { callSitesByFile } = analyzeProject(project)
  // Key by basename so the browser test (no node:path) can look it up.
  const expected: Record<string, string[]> = {}
  for (const [filePath, sites] of callSitesByFile) {
    const basename = filePath.split("/").pop() ?? filePath
    for (const site of sites) {
      if (site.outcome.kind === "narrow") {
        expected[basename] = site.outcome.entries.map(e => e.key).sort()
      }
    }
  }
  writeFileSync(resolve(here, "oracle.generated.json"), JSON.stringify(expected, null, 2))
}
