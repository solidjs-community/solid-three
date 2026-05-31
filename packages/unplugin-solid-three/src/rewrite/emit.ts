import type { ResolvedEntry } from "../types.ts"

/** A getter/method provider is emitted verbatim; a value provider as `key: value`. */
function entryText(entry: ResolvedEntry): string {
  const trimmed = entry.valueText.trimStart()
  if (
    trimmed.startsWith("get ") ||
    trimmed.startsWith("set ") ||
    trimmed.startsWith(`${entry.key}(`)
  ) {
    return entry.valueText
  }
  return `${entry.key}: ${entry.valueText}`
}

export function entriesToObjectLiteral(entries: ResolvedEntry[]): string {
  if (entries.length === 0) return "{}"
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key))
  return `{ ${sorted.map(entryText).join(", ")} }`
}
