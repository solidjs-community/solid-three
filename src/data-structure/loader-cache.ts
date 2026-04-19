import { getOwner, onCleanup } from "solid-js"
import type { Loader } from "three"
import { SHOULD_DEBUG } from "../constants.ts"
import type { LoaderData, LoaderUrl, PromiseMaybe } from "../types.ts"
import { createDebug, isRecord } from "../utils.ts"
import { TreeRegistry } from "./tree-registry.ts"

const debugCache = createDebug("loader-cache:LoaderCache", SHOULD_DEBUG)

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

/**
 * Interface for Three.js loader resource registries.
 */
export interface LoaderRegistry {
  /**
   * Stores a resource promise/data in the registry.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @param data The resource promise or resolved data
   */
  set<TLoader extends Loader<object, any>>(
    loader: TLoader,
    url: LoaderUrl<TLoader>,
    data: PromiseMaybe<LoaderData<TLoader>>,
  ): void

  /**
   * Retrieves a resource from the registry.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @returns The resource promise, resolved data, or undefined if not found
   */
  get<TLoader extends Loader<object, any>>(
    loader: TLoader,
    url: LoaderUrl<TLoader>,
    warn?: boolean,
  ): PromiseMaybe<LoaderData<TLoader>> | undefined
}

/**********************************************************************************/
/*                                                                                */
/*                                 Loader Registry                                */
/*                                                                                */
/**********************************************************************************/

interface LoaderTreeRegistryMap extends Map<Loader<any, any>, any> {
  get<TLoader extends Loader<object, any>>(loader: TLoader): LoaderTreeRegistry<TLoader> | undefined
  set<TLoader extends Loader<object, any>>(loader: TLoader, data: LoaderTreeRegistry<TLoader>): this
}

interface LoaderTreeRegistry<TLoader extends Loader<object, any>> extends TreeRegistry<object> {
  get(paths: LoaderUrl<TLoader>, warn?: boolean): CacheNode<TLoader> | undefined
  set(paths: LoaderUrl<TLoader>, data: CacheNode<TLoader>): void
}

export class LoaderCache implements LoaderRegistry {
  /** Map of loader instances to their respective tree registries */
  #treeRegistryMap: LoaderTreeRegistryMap = new Map() as unknown as LoaderTreeRegistryMap
  /** Weak map for reverse lookup from data to cache nodes */
  #dataMap = new WeakMap<object, CacheNode<Loader<any, any>>>()

  /** Set of resources that do not have active references and can be safely cleaned up. */
  freeList = new Set<object>()

  /**
   * Gets or creates a tree registry for a specific loader.
   * @param loader The Three.js loader instance
   * @returns The tree registry for this loader
   * @private
   */
  #registry<TLoader extends Loader<object, any>>(loader: TLoader) {
    let registry = this.#treeRegistryMap.get(loader)
    if (!registry) {
      this.#treeRegistryMap.set(
        loader,
        (registry = new TreeRegistry() as LoaderTreeRegistry<TLoader>),
      )
    }
    return registry
  }

  /**
   * Deletes a cache node and its associated resource.
   * @param node The cache node to delete
   * @param options.force Force deletion even if not in free list
   * @private
   */
  #delete(node: CacheNode<Loader<any, any>>, { force }: { force?: boolean } = {}) {
    if (!force && !this.freeList.has(node.data)) {
      console.error(
        `Attempting to delete a non-freed resource. Use { force: true } if you are sure you want to dispose`,
        node.data,
      )
      return
    }

    debugCache("delete", { action: "dispose", force: !!force })
    node.dispose()
  }

  /**
   * Disposes all resources in the free list.
   * Should be called periodically to clean up unused resources.
   */
  disposeFreeList() {
    debugCache("disposeFreeList", { count: this.freeList.size })
    this.freeList.forEach(resource => this.#dataMap.get(resource)?.dispose())
  }

  /**
   * Manually deletes a specific resource from the cache.
   * @param resource The resource object to delete
   * @param options.force Force deletion even if resource has active references
   */
  disposeResource(resource: object, options?: { force?: boolean }) {
    const node = this.#dataMap.get(resource)

    if (!node) {
      console.error(`Error while deleting resource ${resource}. Could not find CacheNode.`)
      return
    }

    debugCache("disposeResource", { found: true, force: !!options?.force })
    this.#delete(node, options)
  }

  /**
   * Removes a resource from a specific loader's cache at the given path.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @param options.force Force deletion even if resource has active references
   */
  delete<TLoader extends Loader<object, any>>(
    loader: TLoader,
    url: LoaderUrl<TLoader>,
    options?: { force?: boolean },
  ) {
    const node = this.#registry(loader).get(url)

    if (!node) {
      console.error(`Error while deleting path ${url}. Could not find CacheNode.`)
      return
    }

    debugCache("delete", { url, force: !!options?.force })
    this.#delete(node, options)
  }

  /**
   * Retrieves a resource from the cache and tracks its usage.
   * Automatically integrates with Solid.js cleanup for reference counting.
   * @param loader The Three.js loader instance
   * @param url The URL or path to the resource
   * @returns The resource promise, resolved data, or undefined if not found
   */
  get<TLoader extends Loader<object, any>>(
    loader: TLoader,
    url: LoaderUrl<TLoader>,
    warn?: boolean,
  ): PromiseMaybe<LoaderData<TLoader>> | undefined {
    const node = this.#registry(loader).get(url, warn)

    if (!node) {
      debugCache("get", { url, hit: false })
      return undefined
    }

    debugCache("get", { url, hit: true })
    return node.data
  }

  /**
   * Stores a resource in the cache at the specified path.
   * @param loader The Three.js loader instance
   * @param path The URL or path to store the resource at
   * @param data The resource promise to cache
   * @param options.force Force update even if resource already exists
   * @returns The stored promise
   */
  set<TLoader extends Loader<object, any>>(
    loader: TLoader,
    path: LoaderUrl<TLoader>,
    data: PromiseMaybe<LoaderData<TLoader>>,
    options?: { force?: boolean },
  ) {
    const registry = this.#registry(loader)
    let node = registry.get(path, false)

    if (node) {
      debugCache("set", { path, action: "update" })
      node.update(data, options)
    } else {
      debugCache("set", { path, action: "create" })
      node = new CacheNode(this.freeList, registry, path, data)
      this.#dataMap.set(data, node)
      registry.set(path, node)
    }

    return data
  }
}

/**
 * Cache node that wraps a Three.js resource with reference counting and lifecycle management.
 * @template T The type of Three.js resource (must be an object)
 * @internal
 */
class CacheNode<TLoader extends Loader<any, any>> {
  /** Reference count for this resource */
  count = 0
  /** The cached resource (promise or resolved value) */
  data: PromiseMaybe<LoaderData<TLoader>>

  /**
   * Creates a new cache node.
   * @param free The global free list for deferred disposal
   * @param registry The tree registry containing this node
   * @param path The path where this resource is stored
   * @param promise The resource promise to cache
   */
  constructor(
    public free: Set<object>,
    public registry: LoaderTreeRegistry<TLoader>,
    public path: LoaderUrl<TLoader>,
    promise: PromiseMaybe<LoaderData<TLoader>>,
  ) {
    this.data = promise
    this.#set(promise)
  }

  /**
   * Sets the promise and handles resolution.
   * @param promise The resource promise
   * @private
   */
  #set(promise: PromiseMaybe<LoaderData<TLoader>>) {
    this.data = promise
    Promise.resolve(promise).then(value => {
      // Update data to resolved promise, if it hasn't been updated before
      if (this.data === promise) {
        this.data = value
      }
    })
  }

  /**
   * Disposes the Three.js resource if it has a dispose method.
   * @private
   */
  #dispose() {
    if (isRecord(this.data) && "dispose" in this.data && typeof this.data.dispose === "function") {
      this.data.dispose()
    }
  }

  /**
   * Deletes this node and disposes its resource.
   */
  dispose() {
    this.#dispose()
    this.registry.delete(this.path)
  }

  /**
   * Tracks usage of this resource within a Solid.js reactive context.
   * Automatically increments reference count and schedules cleanup on component unmount.
   */
  track() {
    if (this.count === 0) {
      debugCache("track", { path: this.path, action: "removed from free list" })
      this.free.delete(this.data)
    }

    this.count++
    debugCache("tracked", { path: this.path, count: this.count })

    if (!getOwner()) {
      console.warn(
        "Cached resources accessed outside of reactive context will not be automatically freed.",
        this,
      )
    } else {
      onCleanup(() => {
        this.count -= 1
        if (this.count <= 0) {
          this.free.add(this.data)
          debugCache("freed", { path: this.path, count: this.count })
        }
      })
    }
  }

  /**
   * Updates the cached resource with new data.
   * @param data The new resource promise
   * @param options.force Force update and dispose current resource (default: true)
   */
  update(data: PromiseMaybe<LoaderData<TLoader>>, { force = true }: { force?: boolean } = {}) {
    if (this.data !== data && !force) {
      console.error(
        "Attempted to update already set resource. To overwrite and dispose of current resource, use { force: true } instead.",
      )
    } else {
      if (this.data === data) {
        debugCache("updated", { path: this.path, reason: "same-data" })
      } else {
        debugCache("updated", { path: this.path, reason: "force-replace" })
        this.#dispose()
      }
      this.#set(data)
      this.registry.set(this.path, this)
    }
  }
}
