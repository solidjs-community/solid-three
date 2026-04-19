import { type Accessor, createContext, createMemo, getOwner, merge, useContext } from "solid-js"
import { type Loader } from "three"
import { SHOULD_DEBUG } from "./constants.ts"
import { LoaderCache, type LoaderRegistry } from "./data-structure/loader-cache.ts"
import type {
  AccessorMaybe,
  Constructor,
  Context,
  FrameListener,
  LoaderUrl,
  PromiseMaybe,
} from "./types.ts"
import {
  awaitMapObject,
  createDebug,
  describeOwnerChain,
  isRecord,
  load,
  type LoadInput,
  type LoadOutput,
  resolve,
} from "./utils.ts"

const debugUseFrame = createDebug("hooks:useFrame", SHOULD_DEBUG)
const debugUseThree = createDebug("hooks:useThree", SHOULD_DEBUG)
const debugUseLoader = createDebug("hooks:useLoader", SHOULD_DEBUG)
const debugResolveUrls = createDebug("hooks:resolveUrls", SHOULD_DEBUG)

/**********************************************************************************/
/*                                                                                */
/*                                    Use Frame                                   */
/*                                                                                */
/**********************************************************************************/

export const frameContext = createContext<FrameListener>()

/**
 * Hook to register a callback that will be executed on each animation frame within the `<Canvas/>` component.
 * This hook must be used within a component that is a descendant of the `<Canvas/>` component.
 *
 * @param callback - The callback function to be executed on each frame.
 * @throws Throws an error if used outside of the Canvas component context.
 */
export const useFrame: FrameListener = (callback, options) => {
  const addFrameListener = useContext(frameContext)
  if (!addFrameListener) {
    debugUseFrame("failed", { reason: "no frame context" })
    throw new Error("S3: Hooks can only be used within the Canvas component!")
  }
  debugUseFrame("register", { stage: options?.stage ?? "before", priority: options?.priority ?? 0 })
  return addFrameListener(callback, options)
}

/**********************************************************************************/
/*                                                                                */
/*                                    Use Three                                   */
/*                                                                                */
/**********************************************************************************/

export const threeContext = createContext<Context>(null!)

/**
 * Custom hook to access all necessary Three.js objects needed to manage a 3D scene.
 * This hook must be used within a component that is a descendant of the `<Canvas/>` component.
 *
 * @template T The expected return type after applying the callback to the context.
 * @param [callback] - Optional callback function that processes and returns a part of the context.
 * @returns Returns `Context` directly, or as a selector if a callback is provided.
 * @throws Throws an error if used outside of the Canvas component context.
 */
export function useThree(): Context
export function useThree<T>(callback: (value: Context) => T): Accessor<T>
export function useThree(callback?: (value: Context) => any) {
  // Guard: outside reactive context (e.g. Vitest deepClone traversing $S3C.props.children getter)
  if (!getOwner()) {
    debugUseThree("skipped", { reason: "no owner" })

    return (callback ? () => undefined : undefined) as any
  }
  const store = useContext(threeContext)
  if (!store) {
    debugUseThree(
      "failed",
      { reason: "no context", ownerChain: describeOwnerChain() },
      { trace: true },
    )

    throw new Error("S3: Hooks can only be used within the Canvas component!")
  }

  debugUseThree("call", { shape: callback ? "selector" : "direct" })

  if (callback) {
    return () => callback(store)
  }
  return store
}

/**********************************************************************************/
/*                                                                                */
/*                                   Use Loader                                   */
/*                                                                                */
/**********************************************************************************/

/** Global cache of loader instances to prevent duplicates */
const LOADER_CACHE = new Map<
  Constructor<Loader<object, string | string[]>>,
  Loader<object, string | string[]>
>()

/**
 * Configuration options for the useLoader hook.
 */
export interface UseLoaderOptions<
  TLoader extends Loader<any, any>,
  TInput extends LoadInput<TLoader>,
> {
  /** Base URL to resolve relative paths against */
  base?: string
  /**
   * Whether to use caching.
   * - `true` | `undefined`: Use the default global cache, adjustable via `useLoader.cache`
   * - `LoaderRegistry`: Use a custom cache instance
   * - `false`: No caching
   */
  cache?: boolean | LoaderRegistry
  /**
   * Event Listener scheduled right before loading the resource
   * @param loader
   */
  onBeforeLoad?(loader: TLoader): void
  /**
   * Event Listener scheduled right after loading the resource
   * @param loader
   */
  onLoad?(resource: LoadOutput<TLoader, TInput>): void
}

/**
 * Resolves URLs relative to a base URL, handling strings, arrays, and nested objects.
 * @param base The base URL to resolve against
 * @param url The URL(s) to resolve
 * @returns The resolved URL(s) in the same structure as the input
 * @internal
 */
function resolveUrls<T>(base: string, url: T): T {
  if (Array.isArray(url)) {
    debugResolveUrls("resolved", { kind: "array", count: url.length })

    return url.map(url => new URL(url, base).href) as T
  } else if (isRecord(url)) {
    debugResolveUrls("resolved", { kind: "record", count: Object.keys(url).length })

    return Object.fromEntries(
      Object.entries(url).map(([key, url]) => [key, resolveUrls(base, url)] as const),
    ) as T
  } else if (typeof url === "string") {
    debugResolveUrls("resolved", { kind: "string" })
    
    return new URL(url, base).href as T
  }
  throw new Error("Unexpected type")
}

/**
 * Hook for loading Three.js resources with automatic caching (see useLoader.cache)
 *
 * @template TLoader The Three.js loader type
 * @template TInput The URL type - depends on what the loader expects (string or string[]),
 *                 or a record mapping keys to URLs
 * @param constructor Three.js loader constructor (can be a value or accessor)
 * @param url URL(s) to load - accepts what the loader expects (string/string[]) or a record of URLs (can be a value or accessor)
 * @param options Configuration options
 * @returns Solid.js resource containing the loaded data in the same structure as the input URL(s)
 *
 * @example
 * ```tsx
 * // Load a single texture (automatically cached)
 * const texture = useLoader(TextureLoader, 'textures/wood.jpg')
 *
 * // Load a cube texture (CubeTextureLoader expects string[])
 * const envMap = useLoader(CubeTextureLoader, [
 *   'px.png', 'nx.png',
 *   'py.png', 'ny.png',
 *   'pz.png', 'nz.png'
 * ])
 *
 * // Load multiple textures as a record
 * const textures = useLoader(TextureLoader, {
 *    diffuse: 'textures/wood-diffuse.jpg',
 *    normal: 'textures/wood-normal.jpg'
 * })
 *
 * // With reactive URLs
 * const [theme, setTheme] = createSignal({
 *    diffuse: 'textures/wood-diffuse.jpg',
 *    normal: 'textures/wood-normal.jpg'
 * })
 * const textures = useLoader(TextureLoader, theme)
 *
 * return (
 *   <Loading>
 *     <T.MeshStandardMaterial map={textures()?.diffuse} normalMap={textures()?.normal} />
 *   </Loading>
 * )
 * ```
 */
export function useLoader<
  const TLoader extends Loader<any, any>,
  const TInput extends LoadInput<TLoader>,
>(
  constructor: AccessorMaybe<Constructor<TLoader>>,
  url: AccessorMaybe<TInput>,
  options?: UseLoaderOptions<TLoader, TInput>,
): Accessor<LoadOutput<TLoader, TInput>> {
  const config = merge({ cache: true }, options ?? {})
  debugUseLoader("call", {
    cache: config.cache === true ? "default" : config.cache === false ? "off" : "custom",
    hasBase: !!config.base,
  })

  const loader = createMemo(() => {
    const _constructor = resolve(constructor)

    let loader = LOADER_CACHE.get(_constructor) as TLoader

    if (!loader) {
      LOADER_CACHE.set(_constructor, (loader = new _constructor()))
      debugUseLoader("loader", { action: "created", constructor: _constructor.name })
    } else {
      debugUseLoader("loader", { action: "reused", constructor: _constructor.name })
    }

    return loader
  })

  /**
   * Gets a resource from cache or loads and caches it.
   * @param registry The cache registry to use
   * @param loader The Three.js loader instance
   * @param input The URL(s) to load
   * @returns Promise resolving to the loaded resource
   * @internal
   */
  function getOrInsert<TLoader extends Loader<any, any>, TInput extends LoadInput<TLoader>>(
    registry: LoaderRegistry,
    loader: TLoader,
    input: TInput,
  ): PromiseMaybe<LoadOutput<TLoader, TInput>> {
    if (isRecord(input)) {
      debugUseLoader("cache", { kind: "record", keyCount: Object.keys(input).length })
      return awaitMapObject(input, value =>
        Promise.resolve(getOrInsert(registry, loader, value)),
      ) as unknown as Promise<LoadOutput<TLoader, TInput>>
    } else {
      const _input = input as LoaderUrl<TLoader>

      const cachedPromise = registry.get(loader, _input, false)

      if (cachedPromise) {
        debugUseLoader("cache", { action: "hit", url: _input })
        return cachedPromise as PromiseMaybe<LoadOutput<TLoader, TInput>>
      }

      debugUseLoader("cache", { action: "miss", url: _input })
      const promise = load(loader, input)
      registry.set(loader, _input, promise as unknown as Promise<any>)

      return promise as Promise<LoadOutput<TLoader, TInput>>
    }
  }

  function loadUrl<TInput extends LoadInput<TLoader>>(
    url: TInput,
  ): PromiseMaybe<LoadOutput<TLoader, TInput>> {
    if (config.cache === true) {
      if (!useLoader.cache) {
        debugUseLoader("load", { cache: "disabled" })
        return load(loader(), url)
      }

      return getOrInsert(useLoader.cache, loader(), url)
    }

    if (config.cache) {
      debugUseLoader("load", { cache: "custom" })
      return getOrInsert(config.cache, loader(), url)
    }

    debugUseLoader("load", { cache: "off" })
    return load(loader(), url)
  }

  const resource = createMemo(async () => {
    const _url = resolve(url)
    const _loader = loader()
    const base = config.base
    config.onBeforeLoad?.(_loader)
    const resolvedUrl = base ? resolveUrls(base, _url) : _url
    const result = await loadUrl(resolvedUrl)
    config.onLoad?.(result)
    return result
  })

  return resource
}

/**
 * A caching system for `three.js` loader resources with automatic memory management
 * By default, `useLoader.cache` is set to `solid-three`'s `LoaderCache`:
 * - resources are automatically reference-counted
 * - added to a free-list when no longer actively in use
 * - different methods to dispose the resources:
 *     - `dispose(loader, path)`
 *     - `disposeResource(resource)`
 *     - `disposeFreeList()`
 *
 * `useLoader.cache` can be safely overwritten
 * - by a custom cache implementation implementing the `LoaderRegistry` interface
 * - by setting it to `undefined`, then no resources will be cached
 *
 * @example
 * ```ts
 * function Image(props){
 *    const resource = useLoader(TextureLoader, 'image.png')
 *    return <Entity from={resource()} {...props} />
 * }
 *
 * function App(){
 *    const [visible, setVisible] = createSignal(true)
 *
 *    onSettled(() => {
 *      // ❌ Texture will not be disposed because it is still referenced
 *      useLoader.cache.disposeFreeList()
 *
 *      setVisible(false)
 *
 *      // ✅ Texture will be disposed because it is not referenced anymore
 *      useLoader.cache.disposeFreeList()
 *    })
 *
 *    return (
 *      <Show when={visible}>
 *        <Image/>
 *      </Show>
 * }
 *
 * ```
 */
useLoader.cache = new LoaderCache()
