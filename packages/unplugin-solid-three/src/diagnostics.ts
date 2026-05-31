import type { Diagnostic } from "./types.ts"

export interface Logger {
  warn: (message: string) => void
  info: (message: string) => void
}

export function formatDiagnostic(d: Diagnostic): string {
  const { filePath, line, column } = d.location
  return `[unplugin-solid-three] ${filePath}:${line}:${column} ${d.message}`
}

/**
 * Log all diagnostics. Returns an error message (to fail the build) when
 * `strict` and any warning is present; otherwise null.
 */
export function reportDiagnostics(
  diagnostics: Diagnostic[],
  strict: boolean,
  log: Logger,
): string | null {
  let firstWarning: string | null = null
  for (const d of diagnostics) {
    const text = formatDiagnostic(d)
    if (d.level === "warn") {
      log.warn(text)
      firstWarning ??= text
    } else {
      log.info(text)
    }
  }
  return strict && firstWarning ? `strict mode: ${firstWarning}` : null
}
