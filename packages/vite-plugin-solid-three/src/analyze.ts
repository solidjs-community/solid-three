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

function classifyObject(
  obj: ts.ObjectLiteralExpression,
  namespaces: Map<string, string>,
  sf: ts.SourceFile,
): { sources: CatalogueSource[] } | { bail: string } {
  const sources: CatalogueSource[] = []
  for (const prop of obj.properties) {
    if (ts.isSpreadAssignment(prop)) {
      if (!ts.isIdentifier(prop.expression)) return { bail: "spread of a non-identifier" }
      const moduleId = namespaces.get(prop.expression.text)
      if (!moduleId) return { bail: `spread of non-namespace ${prop.expression.text}` }
      sources.push({ kind: "namespace", localName: prop.expression.text, moduleId })
      continue
    }
    // computed keys are not statically enumerable
    const nameNode =
      ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop) ||
      ts.isGetAccessorDeclaration(prop) || ts.isMethodDeclaration(prop)
        ? prop.name
        : undefined
    if (!nameNode) return { bail: "unsupported property" }
    if (ts.isComputedPropertyName(nameNode)) return { bail: "computed property key" }
    const key = ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) ? nameNode.text : undefined
    if (key === undefined) return { bail: "non-static property key" }

    if (ts.isPropertyAssignment(prop)) {
      sources.push({ kind: "entry", key, valueText: prop.initializer.getText(sf) })
    } else if (ts.isShorthandPropertyAssignment(prop)) {
      sources.push({ kind: "entry", key, valueText: key })
    } else if (ts.isGetAccessorDeclaration(prop) || ts.isMethodDeclaration(prop)) {
      // verbatim getter/method — its text already declares its own key
      sources.push({ kind: "entry", key, valueText: prop.getText(sf), verbatim: true })
    } else {
      return { bail: "unsupported property" }
    }
  }
  if (sources.length === 0) return { bail: "empty catalogue" }
  return { sources }
}
