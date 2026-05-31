import { Project, ts } from "ts-morph"

const IN_MEMORY_COMPILER_OPTIONS = {
  jsx: ts.JsxEmit.Preserve,
  jsxImportSource: "solid-js",
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ESNext,
  allowImportingTsExtensions: true,
  strict: true,
  skipLibCheck: true,
} as const

/** Build a Project from a consumer tsconfig (used by the plugin at buildStart). */
export function buildProject(tsConfigFilePath: string): Project {
  return new Project({ tsConfigFilePath })
}

/** In-memory Project for tests: map of absolute path → source text. */
export function createInlineProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: IN_MEMORY_COMPILER_OPTIONS,
  })
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content)
  }
  return project
}
