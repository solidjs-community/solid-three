import { Resource, createMemo, createResource, onCleanup, untrack, useContext } from 'solid-js'
import * as THREE from 'three'
import { LoadingManager } from 'three'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader'

import { buildGraph } from '../core/utils'
import { Stages } from './stages'
import { context } from './store'

import type { ObjectMap } from '../core/utils'
import type { UpdateCallback } from './stages'
import type { RenderCallback, StageTypes } from './store'

export interface Loader<T> extends THREE.Loader {
  load(
    url: string,
    onLoad?: (result: T) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): unknown
}

export type Extensions = (loader: THREE.Loader) => void
export type LoaderResult<T> = T extends any[] ? Loader<T[number]> : Loader<T>
export type ConditionalType<Child, Parent, Truthy, Falsy> = Child extends Parent ? Truthy : Falsy
export type BranchingReturn<T, Parent, Coerced> = ConditionalType<T, Parent, Coerced, T>

/**
 * Accesses R3F's internal state, containing renderer, canvas, scene, etc.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#usethree
 */
export function useThree() {
  const store = useContext(context)
  if (!store) throw new Error('R3F: Hooks can only be used within the Canvas component!')
  return store
}

/**
 * Executes a callback before render in a shared frame loop.
 * Can order effects with render priority or manually render with a positive priority.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#useframe
 */

export function useFrame(callback: RenderCallback, renderPriority: number = 0): void {
  const store = useThree()
  const subscribe = store.internal.subscribe
  const cleanup = subscribe(
    (state, delta, frame) => untrack(() => callback(state, delta, frame)),
    renderPriority,
    store,
  )

  onCleanup(cleanup)
}

/**
 * Executes a callback in a given update stage.
 * Uses the stage instance to indetify which stage to target in the lifecycle.
 */
export function useUpdate(callback: UpdateCallback, stage: StageTypes = Stages.Update) {
  const store = useThree()
  const stages = store.internal.stages
  // Throw an error if a stage does not exist in the lifecycle
  if (!stages.includes(stage)) throw new Error(`An invoked stage does not exist in the lifecycle.`)
  // Subscribe on mount, unsubscribe on unmount
  const cleanup = stage.add((state, delta, frame) => untrack(() => callback(state, delta, frame)), store)
  onCleanup(cleanup)
}

/**
 * Returns a node graph of an object with named nodes & materials.
 * @see https://docs.pmnd.rs/react-three-fiber/api/hooks#usegraph
 */
export function useGraph(object: THREE.Object3D) {
  return createMemo(() => buildGraph(object))
}

function loadingFn<T>(extensions?: Extensions, onProgress?: (event: ProgressEvent<EventTarget>) => void) {
  return function (Proto: new () => LoaderResult<T>, ...input: string[]) {
    // Construct new loader and run extensions
    const loader = new Proto()
    if (extensions) extensions(loader)
    // Go through the urls and load them
    return Promise.all(
      input.map(
        (input) =>
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
          ),
      ),
    )
  }
}

const cache = new Map()

/**
 * Synchronously loads and caches assets with a three loader.
 *
 */
export function useLoader<T, U extends string | string[]>(
  Proto: new (manager?: LoadingManager) => LoaderResult<T>,
  input: U,
  extensions?: Extensions,
  onProgress?: (event: ProgressEvent<EventTarget>) => void,
): U extends any[]
  ? Resource<BranchingReturn<T, GLTF, GLTF & ObjectMap>[]>
  : Resource<BranchingReturn<T, GLTF, GLTF & ObjectMap>> {
  const keys = (Array.isArray(input) ? input : [input]) as string[]

  return createResource(
    () => [Proto, ...keys] as const,
    async ([Proto, ...keys]) => {
      if (cache.has([Proto.name, ...keys].join('-'))) {
        console.log('getting from cache', [Proto.name, ...keys].join('-'))
        return cache.get([Proto.name, ...keys].join('-'))
      }
      const data = await loadingFn(extensions, onProgress)(Proto as any, ...(keys as any))
      cache.set([Proto.name, ...keys].join('-'), Array.isArray(input) ? data : data[0])
      if (Array.isArray(input)) return data
      return data[0]
    },
  )[0]
}

// /**
//  * Preloads an asset into cache as a side-effect.
//  */
// useLoader.preload = function <T, U extends string | string[]>(
//   Proto: new () => LoaderResult<T>,
//   input: U,
//   extensions?: Extensions,
// ) {
//   const keys = (Array.isArray(input) ? input : [input]) as string[]
//   return preload(loadingFn<T>(extensions), [Proto, ...keys])
// }

/**
 * Removes a loaded asset from cache.
 */
useLoader.clear = function <T, U extends string | string[]>(Proto: new () => LoaderResult<T>, input: U) {
  const keys = (Array.isArray(input) ? input : [input]) as string[]
  return cache.delete([Proto.name, ...keys].join('-'))
}
