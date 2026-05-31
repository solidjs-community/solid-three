import { type Identifier, Node } from "ts-morph"

export type RefClass =
  | { kind: "member"; name: string }
  | { kind: "members"; names: string[] }
  | { kind: "alias"; binding: Identifier }
  | { kind: "open"; reason: string }
  | { kind: "ignore" } // the declaration itself, or an export specifier

export function classifyRef(ref: Node): RefClass {
  const parent = ref.getParent()
  if (!parent) return { kind: "open", reason: "orphan reference" }

  // <T.Mesh /> tag name and value-position T.Mesh are both PropertyAccessExpression.
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
    return { kind: "member", name: parent.getName() }
  }

  if (Node.isElementAccessExpression(parent) && parent.getExpression() === ref) {
    const arg = parent.getArgumentExpression()
    if (arg && Node.isStringLiteral(arg)) return { kind: "member", name: arg.getLiteralValue() }
    return { kind: "open", reason: "computed element access T[expr]" }
  }

  // const X = T  (alias)  OR  const { ... } = T (destructure)
  if (Node.isVariableDeclaration(parent) && parent.getInitializer() === ref) {
    const nameNode = parent.getNameNode()
    if (Node.isIdentifier(nameNode)) return { kind: "alias", binding: nameNode }
    if (Node.isObjectBindingPattern(nameNode)) {
      const names: string[] = []
      for (const element of nameNode.getElements()) {
        if (element.getDotDotDotToken()) return { kind: "open", reason: "rest destructure" }
        const prop = element.getPropertyNameNode() ?? element.getNameNode()
        if (Node.isIdentifier(prop) || Node.isStringLiteral(prop)) {
          names.push(Node.isStringLiteral(prop) ? prop.getLiteralValue() : prop.getText())
        } else {
          return { kind: "open", reason: "computed destructure key" }
        }
      }
      return { kind: "members", names }
    }
    return { kind: "open", reason: "array/complex binding" }
  }

  if (Node.isExportSpecifier(parent) || Node.isExportAssignment(parent)) {
    // Re-export: findReferencesAsNodes already crosses it; nothing to collect here.
    return { kind: "ignore" }
  }

  // Anything else — spread, call arg, return, property value, JSX attr — escapes.
  return { kind: "open", reason: `T escapes via ${parent.getKindName()}` }
}
