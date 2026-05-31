import { Node, type ObjectLiteralExpression } from "ts-morph"
import { enumerateNamespaceExports } from "./namespace.ts"

export interface ProviderMap {
  /** key → verbatim provider source text; null when the argument isn't enumerable. */
  providers: Map<string, string> | null
  /** A non-enumerable spread that might shadow keys was seen. */
  ambiguous: boolean
}

function fromObjectLiteral(object: ObjectLiteralExpression): ProviderMap {
  const providers = new Map<string, string>()
  let ambiguous = false

  // Source order: each property/spread overwrites earlier providers for its keys.
  for (const prop of object.getProperties()) {
    if (Node.isSpreadAssignment(prop)) {
      const expr = prop.getExpression()
      const names = enumerateNamespaceExports(expr)
      if (names) {
        const nsText = expr.getText()
        for (const name of names) providers.set(name, `${nsText}.${name}`)
        continue
      }
      // Spread of a traceable object literal?
      if (Node.isObjectLiteralExpression(expr)) {
        const inner = fromObjectLiteral(expr)
        if (inner.providers) {
          for (const [k, v] of inner.providers) providers.set(k, v)
          ambiguous ||= inner.ambiguous
          continue
        }
      }
      ambiguous = true // non-enumerable spread; provenance undeterminable
      continue
    }

    if (Node.isShorthandPropertyAssignment(prop)) {
      providers.set(prop.getName(), prop.getName())
      continue
    }

    if (Node.isPropertyAssignment(prop)) {
      const nameNode = prop.getNameNode()
      if (Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode)) {
        const key = Node.isStringLiteral(nameNode) ? nameNode.getLiteralValue() : nameNode.getText()
        providers.set(key, prop.getInitializerOrThrow().getText())
        continue
      }
      ambiguous = true // computed key
      continue
    }

    if (Node.isGetAccessorDeclaration(prop) || Node.isMethodDeclaration(prop)) {
      providers.set(prop.getName(), prop.getText()) // keep verbatim
      continue
    }

    ambiguous = true
  }

  return { providers, ambiguous }
}

export function buildProviderMap(arg: Node | undefined): ProviderMap {
  if (!arg) return { providers: null, ambiguous: false }

  const namespace = enumerateNamespaceExports(arg)
  if (namespace) {
    const nsText = arg.getText()
    const providers = new Map<string, string>()
    for (const name of namespace) providers.set(name, `${nsText}.${name}`)
    return { providers, ambiguous: false }
  }

  if (Node.isObjectLiteralExpression(arg)) return fromObjectLiteral(arg)

  // Identifier bound to a traceable object literal initializer.
  if (Node.isIdentifier(arg)) {
    const decl = arg.getSymbol()?.getDeclarations()?.[0]
    if (decl && Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer()
      if (init && Node.isObjectLiteralExpression(init)) return fromObjectLiteral(init)
    }
  }

  return { providers: null, ambiguous: false }
}
