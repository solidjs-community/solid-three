import ts from "typescript"
import type { CatalogueSite, ModuleAnalysis } from "./types.ts"

const SOLID_THREE = "solid-three"
const FACTORY = "createT"

/** Local names that `createT` is bound to via `import { createT [as x] } from "solid-three"`. */
function factoryAliases(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  sf.forEachChild(node => {
    if (!ts.isImportDeclaration(node)) return
    if (!ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== SOLID_THREE) return
    const named = node.importClause?.namedBindings
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) {
        if ((el.propertyName?.text ?? el.name.text) === FACTORY) names.add(el.name.text)
      }
    }
  })
  return names
}

export function analyzeModule(code: string, fileName: string): ModuleAnalysis {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aliases = factoryAliases(sf)
  const sites: CatalogueSite[] = []
  if (aliases.size === 0) return { sites, bails: [] }

  let siteIndex = 0
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      aliases.has(node.expression.text)
    ) {
      const site = siteFromCall(node, sf, siteIndex)
      if (site) {
        sites.push(site)
        siteIndex++
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { sites, bails: [] }
}

/** Build a partial site from a createT call: binding + statement offsets. Arg sources filled in later tasks. */
function siteFromCall(call: ts.CallExpression, sf: ts.SourceFile, siteIndex: number): CatalogueSite | undefined {
  const arg = call.arguments[0]
  if (!arg) return undefined

  // result binding: `const T = createT(...)` (optionally exported)
  const varDecl = call.parent
  if (!ts.isVariableDeclaration(varDecl) || !ts.isIdentifier(varDecl.name)) return undefined
  const varList = varDecl.parent
  const statement = varList.parent
  if (!ts.isVariableStatement(statement)) return undefined
  const exported = !!statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)

  return {
    binding: varDecl.name.text,
    exported,
    sources: [], // filled in later tasks
    argStart: arg.getStart(sf),
    argEnd: arg.getEnd(),
    statementStart: statement.getStart(sf),
    statementEnd: statement.getEnd(),
    siteIndex,
  }
}
