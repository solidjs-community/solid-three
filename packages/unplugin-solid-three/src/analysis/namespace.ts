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

  // Use the namespace identifier's TYPE (the `typeof import("…")` namespace type).
  // Its properties are the module's fully-resolved exports — unlike
  // Symbol.getExports(), this flattens `export *` re-exports (which is how the
  // `three` types are structured, so getExports() would miss almost everything).
  const names = new Set<string>()
  for (const prop of node.getType().getProperties()) {
    const name = prop.getName()
    if (!name.startsWith("__")) names.add(name) // skip compiler-internal helpers
  }
  return names.size ? names : null
}
