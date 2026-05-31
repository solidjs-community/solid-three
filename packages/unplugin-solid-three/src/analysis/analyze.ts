import type { Project } from "ts-morph"
import type { CallSite, Diagnostic, SourceLocation } from "../types.ts"
import { findCreateTCalls } from "./find-createt.ts"
import { resolveCatalogue } from "./resolve.ts"
import { collectUsedMembers } from "./used-set.ts"

export interface ProjectAnalysis {
  callSitesByFile: Map<string, CallSite[]>
  diagnostics: Diagnostic[]
}

export function analyzeProject(project: Project): ProjectAnalysis {
  const callSitesByFile = new Map<string, CallSite[]>()
  const diagnostics: Diagnostic[] = []

  for (const call of findCreateTCalls(project)) {
    const arg = call.getArguments()[0]
    if (!arg) continue

    const outcome = resolveCatalogue(call, collectUsedMembers(call))
    const filePath = call.getSourceFile().getFilePath()

    const site: CallSite = {
      filePath,
      argStart: arg.getStart(),
      argEnd: arg.getEnd(),
      outcome,
    }
    const list = callSitesByFile.get(filePath) ?? []
    list.push(site)
    callSitesByFile.set(filePath, list)

    if (outcome.kind === "keep") {
      diagnostics.push({
        level: "warn",
        message: `createT catalogue could not be narrowed: ${outcome.reason}. Pass an explicit catalogue to narrow it.`,
        location: outcome.ref,
      })
    } else if (outcome.kind === "noop") {
      const sf = call.getSourceFile()
      const { line, column } = sf.getLineAndColumnAtPos(call.getStart())
      const location: SourceLocation = { filePath, line, column }
      diagnostics.push({
        level: "info",
        message: `createT catalogue is not statically analyzable (${outcome.reason}); skipping narrowing.`,
        location,
      })
    }
  }

  return { callSitesByFile, diagnostics }
}
