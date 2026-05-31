import { Node } from "ts-morph"

/**
 * If `node` is an identifier bound to a namespace import (`import * as X from "…"`),
 * return the set of names that module exports. Otherwise null.
 */
export function enumerateNamespaceExports(node: Node | undefined): Set<string> | null {
  if (!node || !Node.isIdentifier(node)) return null

  const symbol = node.getSymbol()
  const decl = symbol?.getDeclarations()?.[0]
  if (!decl || !Node.isNamespaceImport(decl)) return null

  // The aliased symbol is the imported module; its exports are the namespace members.
  const moduleSymbol = symbol?.getAliasedSymbol()
  if (!moduleSymbol) return null

  const names = new Set<string>()
  for (const exp of moduleSymbol.getExports()) names.add(exp.getName())
  return names.size ? names : null
}
