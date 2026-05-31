export interface SourceLocation {
  filePath: string
  line: number
  column: number
}

/** A single narrowed catalogue entry: `key: valueText`. */
export interface ResolvedEntry {
  key: string
  /** Verbatim source text of the provider expression, e.g. `THREE.Mesh` or a copied getter. */
  valueText: string
}

export type Outcome =
  | { kind: "narrow"; entries: ResolvedEntry[] }
  /** Narrowable-looking but defeated (dynamic access / escape). Keep verbatim, WARN. */
  | { kind: "keep"; reason: string; ref: SourceLocation }
  /** Argument not statically analyzable (proxy/store/call). Keep verbatim, INFO. */
  | { kind: "noop"; reason: string }

export type UsedSet =
  | { kind: "closed"; members: Set<string> }
  | { kind: "open"; reason: string; ref: SourceLocation }

export interface CallSite {
  filePath: string
  /** Offsets of the catalogue ARGUMENT node within its source file. */
  argStart: number
  argEnd: number
  outcome: Outcome
}

export interface Diagnostic {
  level: "warn" | "info"
  message: string
  location: SourceLocation
}
