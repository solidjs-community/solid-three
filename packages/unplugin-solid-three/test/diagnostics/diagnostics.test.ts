import { describe, expect, it, vi } from "vitest"
import { reportDiagnostics } from "../../src/diagnostics.ts"
import { resolveOptions } from "../../src/options.ts"
import type { Diagnostic } from "../../src/types.ts"

const warn: Diagnostic = {
  level: "warn",
  message: "could not narrow",
  location: { filePath: "/src/a.tsx", line: 3, column: 11 },
}
const info: Diagnostic = {
  level: "info",
  message: "not analyzable",
  location: { filePath: "/src/b.tsx", line: 1, column: 1 },
}

describe("resolveOptions", () => {
  it("defaults strict to false and auto tsconfig", () => {
    expect(resolveOptions(undefined)).toEqual({ strict: false, tsconfig: undefined })
    expect(resolveOptions({ strict: true })).toMatchObject({ strict: true })
  })
})

describe("reportDiagnostics", () => {
  it("logs warn and info, returns no error when not strict", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const error = reportDiagnostics([warn, info], false, log)
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(error).toBeNull()
  })

  it("returns an error string under strict when warnings exist", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    const error = reportDiagnostics([warn, info], true, log)
    expect(error).toContain("could not narrow")
  })

  it("returns null under strict with only info", () => {
    const log = { warn: vi.fn(), info: vi.fn() }
    expect(reportDiagnostics([info], true, log)).toBeNull()
  })
})
