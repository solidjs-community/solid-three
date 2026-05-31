import { type CallExpression, type Identifier, Node } from "ts-morph"
import type { SourceLocation, UsedSet } from "../types.ts"
import { classifyRef } from "./classify-ref.ts"

function locationOf(node: Node): SourceLocation {
  const sf = node.getSourceFile()
  const { line, column } = sf.getLineAndColumnAtPos(node.getStart())
  return { filePath: sf.getFilePath(), line, column }
}

/** Find the binding identifier that the createT call result is assigned to. */
function resultBinding(call: CallExpression): Identifier | undefined {
  const parent = call.getParent()
  if (Node.isVariableDeclaration(parent)) {
    const name = parent.getNameNode()
    if (Node.isIdentifier(name)) return name
  }
  return undefined
}

export function collectUsedMembers(call: CallExpression): UsedSet {
  const binding = resultBinding(call)
  if (!binding) {
    return {
      kind: "open",
      reason: "createT result is not bound to an identifier",
      ref: locationOf(call),
    }
  }

  const members = new Set<string>()
  const seen = new Set<Identifier>()
  const queue: Identifier[] = [binding]

  while (queue.length) {
    const current = queue.shift()
    if (!current || seen.has(current)) continue
    seen.add(current)

    for (const ref of current.findReferencesAsNodes()) {
      // Skip the declaration node of the binding we're following.
      if (ref === current) continue

      const result = classifyRef(ref)
      switch (result.kind) {
        case "member":
          members.add(result.name)
          break
        case "members":
          for (const n of result.names) members.add(n)
          break
        case "alias":
          queue.push(result.binding)
          break
        case "ignore":
          break
        case "open":
          return { kind: "open", reason: result.reason, ref: locationOf(ref) }
      }
    }
  }

  return { kind: "closed", members }
}
