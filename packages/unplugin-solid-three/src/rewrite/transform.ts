import MagicString from "magic-string"
import type { CallSite } from "../types.ts"
import { entriesToObjectLiteral } from "./emit.ts"

export interface RewriteResult {
  code: string
  map: ReturnType<MagicString["generateMap"]>
}

export function rewriteModule(code: string, sites: CallSite[]): RewriteResult | null {
  const narrowing = sites.filter(s => s.outcome.kind === "narrow")
  if (narrowing.length === 0) return null

  const s = new MagicString(code)
  for (const site of narrowing) {
    if (site.outcome.kind !== "narrow") continue
    s.overwrite(site.argStart, site.argEnd, entriesToObjectLiteral(site.outcome.entries))
  }

  return { code: s.toString(), map: s.generateMap({ hires: true }) }
}
