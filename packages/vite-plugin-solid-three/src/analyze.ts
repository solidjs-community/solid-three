import ts from "typescript"
import type { BailSite, CatalogueSite, CatalogueSource, ModuleAnalysis } from "./types.ts"

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

/** local namespace name -> module specifier, from `import * as NS from "mod"`. */
function namespaceImports(sf: ts.SourceFile): Map<string, string> {
  const map = new Map<string, string>()
  sf.forEachChild(node => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const named = node.importClause?.namedBindings
    if (named && ts.isNamespaceImport(named)) map.set(named.name.text, node.moduleSpecifier.text)
  })
  return map
}

export function analyzeModule(code: string, fileName: string): ModuleAnalysis {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const aliases = factoryAliases(sf)
  const sites: CatalogueSite[] = []
  const bails: BailSite[] = []
  if (aliases.size === 0) return { sites, bails }

  const namespaces = namespaceImports(sf)
  let siteIndex = 0
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      aliases.has(node.expression.text)
    ) {
      const result = siteFromCall(node, sf, namespaces, siteIndex)
      if (result !== undefined) {
        if ("bail" in result) bails.push({ siteIndex, reason: result.bail })
        else sites.push(result)
        siteIndex++
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { sites, bails }
}

/** Returns a full site, a bail (recognized createT but unanalyzable arg), or undefined (no trackable binding). */
function siteFromCall(
  call: ts.CallExpression,
  sf: ts.SourceFile,
  namespaces: Map<string, string>,
  siteIndex: number,
): CatalogueSite | { bail: string } | undefined {
  const arg = call.arguments[0]
  if (!arg) return undefined

  // result binding: `const T = createT(...)` (optionally exported)
  const varDecl = call.parent
  if (!ts.isVariableDeclaration(varDecl) || !ts.isIdentifier(varDecl.name)) return undefined
  const varList = varDecl.parent
  const statement = varList.parent
  if (!ts.isVariableStatement(statement)) return undefined
  const exported = !!statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)

  const classified = classifyArg(arg, namespaces, sf)
  if ("bail" in classified) return { bail: classified.bail }

  return {
    binding: varDecl.name.text,
    exported,
    sources: classified.sources,
    argStart: arg.getStart(sf),
    argEnd: arg.getEnd(),
    statementStart: statement.getStart(sf),
    statementEnd: statement.getEnd(),
    siteIndex,
  }
}

function classifyArg(
  arg: ts.Expression,
  namespaces: Map<string, string>,
  sf: ts.SourceFile,
): { sources: CatalogueSource[] } | { bail: string } {
  // createT(THREE)
  if (ts.isIdentifier(arg)) {
    const moduleId = namespaces.get(arg.text)
    if (moduleId) return { sources: [{ kind: "namespace", localName: arg.text, moduleId }] }
    return { bail: `argument ${arg.text} is not a resolvable namespace import` }
  }
  // object literals: implemented in a later task
  if (ts.isObjectLiteralExpression(arg)) return classifyObject(arg, namespaces, sf)
  return { bail: `unsupported catalogue argument (${ts.SyntaxKind[arg.kind]})` }
}

/** Stub — replaced in Task 4. */
function classifyObject(
  _obj: ts.ObjectLiteralExpression,
  _namespaces: Map<string, string>,
  _sf: ts.SourceFile,
): { sources: CatalogueSource[] } | { bail: string } {
  return { bail: "object literals — Task 4" }
}
