import { type CallExpression } from "ts-morph"
import type { Outcome, ResolvedEntry, SourceLocation, UsedSet } from "../types.ts"
import { buildProviderMap } from "./providers.ts"

function callLocation(call: CallExpression): SourceLocation {
  const sf = call.getSourceFile()
  const { line, column } = sf.getLineAndColumnAtPos(call.getStart())
  return { filePath: sf.getFilePath(), line, column }
}

export function resolveCatalogue(call: CallExpression, used: UsedSet): Outcome {
  const arg = call.getArguments()[0]
  const map = buildProviderMap(arg)
  const argIsNarrowable = map.providers !== null

  if (used.kind === "open") {
    return argIsNarrowable
      ? { kind: "keep", reason: used.reason, ref: used.ref }
      : { kind: "noop", reason: "catalogue argument is not statically analyzable" }
  }

  // used.kind === "closed"
  if (!argIsNarrowable) {
    return { kind: "noop", reason: "catalogue argument is not statically analyzable" }
  }
  if (map.ambiguous) {
    return {
      kind: "keep",
      reason: "non-enumerable spread; provenance undeterminable",
      ref: callLocation(call),
    }
  }

  const entries: ResolvedEntry[] = []
  for (const key of used.members) {
    const valueText = map.providers?.get(key)
    // A used member with no provider means the user accesses something not in
    // their catalogue (their bug / undefined at runtime). Keep whole to be safe.
    if (valueText === undefined) {
      return {
        kind: "keep",
        reason: `accessed member "${key}" not present in catalogue`,
        ref: callLocation(call),
      }
    }
    entries.push({ key, valueText })
  }
  // Stable order for deterministic output.
  entries.sort((a, b) => a.key.localeCompare(b.key))
  return { kind: "narrow", entries }
}
