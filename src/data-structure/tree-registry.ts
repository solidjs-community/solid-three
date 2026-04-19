import { SHOULD_DEBUG } from "../constants.ts"
import { bubbleUp, createDebug } from "../utils.ts"

const debugTreeRegistry = createDebug("tree-registry:TreeRegistry", SHOULD_DEBUG)

type TreeMap<T> = Map<string, TreeNode<T>>

interface TreeBase<T> {
  children: TreeMap<T>
  count: number
}

/**
 * A node in the tree structure that can hold data and have child nodes.
 * @template T The type of data stored in the node
 * @internal
 */
class TreeNode<T> implements TreeBase<T> {
  children: TreeMap<T> = new Map()
  count = 0
  data?: T

  constructor(
    public key: string,
    public parent: TreeNode<T> | TreeRegistry<T>,
  ) {}

  delete() {
    this.parent.children.delete(this.key)
  }
}

/**
 * A hierarchical tree registry that stores data at paths represented as string arrays.
 * Features automatic reference counting and cleanup of unused branches.
 *
 * @template T The type of data stored in the registry
 *
 * @example
 * ```ts
 * const registry = new TreeRegistry<string>()
 *
 * // Set data at a path
 * registry.set(['models', 'player', 'mesh'], 'player.glb')
 *
 * // Get data from a path
 * const mesh = registry.get(['models', 'player', 'mesh']) // 'player.glb'
 *
 * // Delete data and clean up empty branches
 * registry.delete(['models', 'player', 'mesh'])
 * ```
 */
export class TreeRegistry<T> implements TreeBase<T> {
  /** Map of child nodes at the root level */
  children: TreeMap<T> = new Map()
  /** Count of data nodes in this tree */
  count = 0

  /**
   * Resolves a path to a node, optionally creating nodes along the path.
   * @param input Path as a string or array of strings
   * @param autocreate Whether to create missing nodes (defaults to true)
   * @returns The resolved node or undefined if not found and autocreate is false
   * @private
   */
  #resolve(input: string | string[], autocreate: true): TreeNode<T>
  #resolve(input: string | string[], autocreate: boolean): TreeNode<T> | undefined
  #resolve(input: string | string[], autocreate: boolean): TreeNode<T> | undefined {
    const paths = Array.isArray(input) ? input : [input]

    let current: TreeRegistry<T> | TreeNode<T> = this

    for (let i = 0; i < paths.length; i++) {
      let node: TreeNode<T> | undefined = current.children.get(paths[i])

      if (!node) {
        if (!autocreate) {
          debugTreeRegistry("resolve", { action: "not-found", path: paths[i] })
          return undefined
        }

        debugTreeRegistry("resolve", { action: "create", path: paths[i] })
        
        node = new TreeNode(paths[i], current)
        current.children.set(paths[i], node)
      }

      current = node
    }

    if (current instanceof TreeRegistry) {
      throw new Error(`Invalid resolution: ${paths}`)
    }

    return current
  }

  /**
   * Retrieves data stored at the specified path.
   * @param input Path as a string or array of strings
   * @returns The data stored at the path, or undefined if not found
   */
  get(input: string | string[], warn = true) {
    const node = this.#resolve(input, false)

    if (!node) {
      if (warn) {
        console.warn("Invalid path", input)
      }
      debugTreeRegistry("get", { input, found: false })
      return undefined
    }

    debugTreeRegistry("get", { input, found: true })
    return node.data
  }

  /**
   * Stores data at the specified path, creating nodes as needed.
   * Automatically increments reference counts up the tree when storing new data.
   * @param input Path as a string or array of strings
   * @param data The data to store
   */
  set(input: string | string[], data: T) {
    const node = this.#resolve(input, true)

    if (!node.data) {
      debugTreeRegistry("set", { input, action: "new" })
      bubbleUp(node, node => node.count++)
    } else {
      debugTreeRegistry("set", { input, action: "update" })
    }

    node.data = data
  }

  /**
   * Deletes data at the specified path and cleans up empty branches.
   * Automatically decrements reference counts and removes nodes with zero references.
   * @param input Path as a string or array of strings
   */
  delete(input: string | string[]) {
    const node = this.#resolve(input, false)

    if (!node) {
      debugTreeRegistry("delete", { input, found: false })
      console.warn("Invalid path", input)
      return
    }

    debugTreeRegistry("delete", { input, found: true })

    bubbleUp(node, node => {
      node.count--
      if (node instanceof TreeNode && node.count === 0) {
        debugTreeRegistry("delete", { action: "pruned", key: node.key })
        node.delete()
      }
    })
  }
}
