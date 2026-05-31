import { createUnplugin } from "unplugin"
import { analyzeProject, type ProjectAnalysis } from "./analysis/analyze.ts"
import { buildProject } from "./analysis/project.ts"
import { reportDiagnostics } from "./diagnostics.ts"
import { type Options, resolveOptions } from "./options.ts"
import { rewriteModule, type RewriteResult } from "./rewrite/transform.ts"

/** Strip a query suffix (`?worker`, `?raw`, …) and normalize to the source path. */
function normalizeId(id: string): string {
  return id.split("?")[0]
}

export function transformModule(
  id: string,
  code: string,
  analysis: ProjectAnalysis,
): RewriteResult | null {
  const sites = analysis.callSitesByFile.get(normalizeId(id))
  if (!sites) return null
  return rewriteModule(code, sites)
}

export const unpluginSolidThree = createUnplugin<Options | undefined>(rawOptions => {
  const options = resolveOptions(rawOptions)
  let analysis: ProjectAnalysis | undefined

  return {
    name: "unplugin-solid-three",
    enforce: "pre",
    // Vite: only run for production builds; dev keeps the runtime proxy.
    vite: { apply: "build" },

    buildStart() {
      const tsconfig = options.tsconfig ?? "tsconfig.json"
      const project = buildProject(tsconfig)
      analysis = analyzeProject(project)
      // unplugin's build context has no warn/error; log directly and throw to
      // fail the build under strict (rejecting in buildStart aborts every bundler).
      const error = reportDiagnostics(analysis.diagnostics, options.strict, {
        warn: message => console.warn(message),
        info: message => console.info(message),
      })
      if (error) throw new Error(error)
    },

    transform(code, id) {
      if (!analysis) return null
      const result = transformModule(id, code, analysis)
      return result ? { code: result.code, map: result.map } : null
    },
  }
})

export const vitePlugin = unpluginSolidThree.vite
export const rollupPlugin = unpluginSolidThree.rollup
export const webpackPlugin = unpluginSolidThree.webpack
export const esbuildPlugin = unpluginSolidThree.esbuild
export const rspackPlugin = unpluginSolidThree.rspack
export type { Options } from "./options.ts"
