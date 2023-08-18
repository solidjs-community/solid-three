import { createLazyMemo } from '@solid-primitives/memo'
import {
  Accessor,
  InitializedResourceOptions,
  InitializedResourceReturn,
  JSX,
  NoInfer,
  Resource,
  ResourceFetcher,
  ResourceOptions,
  ResourceReturn,
  ResourceSource,
  Suspense,
  createContext,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  useContext,
} from 'solid-js'
import * as THREE from 'three'
import { resolveAccessor } from './proxy'
import type { RenderCallback, RootState } from './store'
import { context } from './store'
import type { ObjectMap } from './utils'
import { buildGraph } from './utils'

export interface Loader<T> extends THREE.Loader {
  load(
    url: string,
    onLoad?: (result: T) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): unknown
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<T>
}

export type LoaderProto<T> = new (...args: any[]) => Loader<T>
export type LoaderResult<T> = T extends { scene: THREE.Object3D } ? T & ObjectMap : T
export type Extensions<T> = (loader: Loader<T>) => void

/**
 * Accesses R3F's internal state, containing renderer, canvas, scene, etc.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#usethree
 */
export function useThree(): RootState
export function useThree<T>(callback: (value: RootState) => T): Accessor<T>
export function useThree(callback?: (value: RootState) => any)  {
  const store = useContext(context)
  if (!store) {
    // console.error('R3F: Hooks can only be used within the Canvas component!')
    throw new Error('R3F: Hooks can only be used within the Canvas component!')
  }
  if(callback) return () => callback(store)
  return store
}

export const suspenseContext = createContext<{
  addResource: (value: Resource<any>) => void
  resolved: boolean
}>(null!)

export function useSuspense() {
  return useContext(suspenseContext)
}

export function ThreeSuspense(props: { children: JSX.Element; fallback?: JSX.Element }) {
  const [resources, setResources] = createSignal<Resource<any>[]>([])

  return (
    <Suspense fallback={props.fallback}>
      {(() => {
        const resolved = createLazyMemo(() => {
          let resolved = true
          for (let resource of resources()) {
            const result = resource()
            if (!result) {
              resolved = false
              break
            }
          }
          return resolved
        })
        return (
          <suspenseContext.Provider
            value={{
              addResource: (resource) => {
                setResources((resources) => {
                  if (!resources.includes(resource)) return [...resources, resource]
                  return resources
                })
              },
              get resolved() {
                return resolved()
              },
            }}>
            {props.children}
          </suspenseContext.Provider>
        )
      })()}
    </Suspense>
  )
}

/**
 * Executes a callback before render in a shared frame loop.
 * Can order effects with render priority or manually render with a positive priority.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#useframe
 */

export function useFrame(callback: RenderCallback, renderPriority: number = 0): void {
  const store = useThree()
  let cleanup: () => void
  onMount(() => {
    cleanup = store.internal?.subscribe(
      (state, delta, frame) => untrack(() => callback(state, delta, frame)),
      renderPriority,
      store,
    )
    onCleanup(() => cleanup?.())
  })
}

/**
 * Returns a node graph of an object with named nodes & materials.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#usegraph
 */
export function useGraph(object: THREE.Object3D) {
  return createMemo(() => buildGraph(object))
}

function loadingFn<TSource extends any, TLoader extends LoaderProto<TSource>>(
  extensions?: Extensions<TLoader>,
  onProgress?: (event: ProgressEvent<EventTarget>) => void,
) {
  return function (Proto: TLoader, ...inputs: string[]) {
    // Construct new loader and run extensions
    const loader = new Proto()
    //@ts-ignore s3f
    if (extensions) extensions(loader)
    // Go through the urls and load them
    return Promise.all<TSource>(
      inputs.map(async (input) => {
        const cacheKey = Proto.name + input
        if (loaderCache.has(cacheKey)) {
          return loaderCache.get(cacheKey)
        }
        const result = await (() =>
          new Promise((res, reject) =>
            loader.load(
              input,
              (data: any) => {
                if (data.scene) Object.assign(data, buildGraph(data.scene))
                res(data)
              },
              onProgress,
              (error) => reject(new Error(`Could not load ${input}: ${error.message})`)),
            ),
          ))()
        loaderCache.set(cacheKey, result)
        return result
      }),
    )
  }
}

/**
 * A custom resource that works together with `<T.Suspense/>`.
 * Will prevent creation of THREE-elements
 */
export function createThreeResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options: InitializedResourceOptions<NoInfer<T>, true>,
): InitializedResourceReturn<T, R>
export function createThreeResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options?: ResourceOptions<NoInfer<T>, true>,
): ResourceReturn<T, R>
export function createThreeResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options: InitializedResourceOptions<NoInfer<T>, S>,
): InitializedResourceReturn<T, R>
export function createThreeResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options?: ResourceOptions<NoInfer<T>, S>,
): ResourceReturn<T, R>
export function createThreeResource(...args: any[]) {
  // @ts-ignore s3f
  const [_resource, ...rest] = createResource(...args)
  const resource = () => {
    const suspense = useSuspense()
    if (suspense) {
      suspense.addResource(_resource)
    }
    return _resource()
  }
  return [resource, ...rest]
}

const loaderCache = new Map()

/**
 * Synchronously loads and caches assets with a three loader.
 *
 */
export function useLoader<T, U extends string | string[] | string[][]>(
  Proto: LoaderProto<T>,
  input: U | Accessor<U>,
  extensions?: Extensions<T>,
  onProgress?: (event: ProgressEvent) => void,
) {
  // Use createResource to load async assets
  return createThreeResource(
    () => [Proto, resolveAccessor(input)] as const,
    async ([Proto, _keys]) => {
      const keys = (Array.isArray(_keys) ? _keys : [_keys]) as string[]
      //@ts-ignore s3f
      const results = await loadingFn(extensions, onProgress)(Proto, ...keys)
      return Array.isArray(_keys) ? (results as T[]) : (results[0] as T)
    },
  )[0] as Resource<U extends any[] ? T[] : T>
}

/**
 * Preloads an asset into cache as a side-effect.
 */
/* useLoader.preload = function <T, U extends string | string[]>(
  Proto: new () => LoaderResult<T>,
  input: U,
  extensions?: Extensions,
) {
  const keys = (Array.isArray(input) ? input : [input]) as string[]
  return preload(loadingFn<T>(extensions), [Proto, ...keys])
} */

/**
 * Removes a loaded asset from cache.
 */
useLoader.clear = function <T, U extends string | string[]>(Proto: new () => LoaderResult<T>, input: U) {
  const keys = (Array.isArray(input) ? input : [input]) as string[]
  return loaderCache.delete([Proto.name, ...keys].join('-'))
}
