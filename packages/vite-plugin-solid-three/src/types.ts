// A catalogue is an ordered list of sources (last writer wins on key collisions).
export type CatalogueSource =
  | { kind: "namespace"; localName: string; moduleId: string } // createT(THREE) or {...THREE}
  // `{ Mesh: X }` (valueText "X") or a verbatim member `{ get Foo(){…} }` / `{ m(){…} }`
  // (valueText is the whole member text and `verbatim` is true — it declares its own key).
  | { kind: "entry"; key: string; valueText: string; verbatim?: boolean }

export interface CatalogueSite {
  binding: string            // result binding name, e.g. "T"
  exported: boolean          // was the binding statement `export`ed
  sources: CatalogueSource[] // empty is impossible for a non-bail site
  // char offsets into the module source:
  argStart: number           // start of the createT argument
  argEnd: number             // end of the createT argument
  statementStart: number     // start of `const T = createT(...)` (or `export const ...`)
  statementEnd: number       // end of that statement
  siteIndex: number          // 0-based index of this createT site within the module
}

export interface BailSite {
  siteIndex: number
  reason: string
}

export interface ModuleAnalysis {
  sites: CatalogueSite[]
  bails: BailSite[]
}
