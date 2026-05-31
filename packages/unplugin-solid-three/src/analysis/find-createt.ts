import { type CallExpression, Node, type Project } from "ts-morph"

const SOLID_THREE_MODULE = "solid-three"
const FACTORY_NAME = "createT"

/** Return every CallExpression whose callee resolves to solid-three's createT. */
export function findCreateTCalls(project: Project): CallExpression[] {
  const calls: CallExpression[] = []

  for (const sourceFile of project.getSourceFiles()) {
    for (const importDecl of sourceFile.getImportDeclarations()) {
      if (importDecl.getModuleSpecifierValue() !== SOLID_THREE_MODULE) continue

      for (const named of importDecl.getNamedImports()) {
        if (named.getName() !== FACTORY_NAME) continue

        // Local binding may be renamed (`createT as makeNamespace`).
        const localNode = named.getAliasNode() ?? named.getNameNode()
        for (const ref of localNode.findReferencesAsNodes()) {
          const parent = ref.getParent()
          if (Node.isCallExpression(parent) && parent.getExpression() === ref) {
            calls.push(parent)
          }
        }
      }
    }
  }

  return calls
}
