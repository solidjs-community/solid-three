import type { Accessor, Context, JSX } from "solid-js"
import { createRenderEffect, type MergeProps, mergeProps, onCleanup, type Ref } from "solid-js"
import {
  Camera,
  Material,
  Object3D,
  OrthographicCamera,
  type Renderer,
  Texture,
  Vector3,
} from "three"
import { $S3C } from "./constants.ts"
import type { CameraKind, Constructor, Data, Loader, Meta, Plugin } from "./types.ts"
import type { Measure } from "./utils/use-measure.ts"

/**********************************************************************************/
/*                                                                                */
/*                                      Guards                                    */
/*                                                                                */
/**********************************************************************************/

export const isOrthographicCamera = (def: Camera): def is OrthographicCamera =>
  "isOrthographicCamera" in def && !!def.isOrthographicCamera

export const isVector3 = (def: object): def is Vector3 => "isVector3" in def && !!def.isVector3

/**********************************************************************************/
/*                                                                                */
/*                                  Auto Dispose                                  */
/*                                                                                */
/**********************************************************************************/

export function autodispose<T extends { dispose?: () => void }>(object: T): T {
  if (object.dispose) {
    onCleanup(object.dispose.bind(object))
  }
  return object
}

/**********************************************************************************/
/*                                                                                */
/*                                      Meta                                      */
/*                                                                                */
/**********************************************************************************/

interface MetaOptions<T extends object> {
  props?: Record<string, any>
  plugins?: Plugin[]
}

/**
 * A utility to add metadata to a given instance.
 * This data can be accessed behind the `S3C` symbol and is used internally in `solid-three`.
 *
 * @param instance - `three` instance
 * @param options - additional data: `{ props }`
 * @returns the `three` instance with the additional data
 */
export function meta<T extends object>(
  instance: T,
  { props = {}, plugins = [] }: MetaOptions<T> = {},
) {
  if (hasMeta(instance)) {
    return instance
  }

  const _instance = instance as Meta<T>

  _instance[$S3C] = {
    children: new Set(),
    parent: undefined,
    plugins,
    props,
  }

  return _instance
}

export function getMeta<T = any>(value: Meta<T>): Data<T>
export function getMeta<T = any>(value: object | Meta<T>): Data<T> | undefined
export function getMeta(value: any) {
  return hasMeta(value) ? value[$S3C] : undefined
}

export function hasMeta<T>(element: T): element is Meta<T> {
  return typeof element === "object" && element && $S3C in element
}

/**********************************************************************************/
/*                                                                                */
/*                                   Build Graph                                  */
/*                                                                                */
/**********************************************************************************/

export interface ObjectMap {
  nodes: Record<string, Object3D>
  materials: Record<string, Material>
}
// Collects nodes and materials from a THREE.Object3D
export function buildGraph(object: Object3D): ObjectMap {
  const data: ObjectMap = { nodes: {}, materials: {} }
  object.traverse((obj: any) => {
    if (obj.name) data.nodes[obj.name] = obj
    if (obj.material && !(obj.material.name in data.materials)) {
      data.materials[obj.material.name] = obj.material
    }
  })
  return data
}

/**********************************************************************************/
/*                                                                                */
/*                                  Default Props                                 */
/*                                                                                */
/**********************************************************************************/

/** Extracts the keys of the optional properties in T. */
type KeyOfOptionals<T> = keyof {
  [K in keyof T as T extends Record<K, T[K]> ? never : K]: T[K]
}

export function defaultProps<T, K extends KeyOfOptionals<T>>(
  props: T,
  defaults: Required<Pick<T, K>>,
): MergeProps<[Required<Pick<T, K>>, T]> {
  return mergeProps(defaults, props)
}

/**********************************************************************************/
/*                                                                                */
/*                                 Has Color Space                                */
/*                                                                                */
/**********************************************************************************/

/**
 * Returns `true` with correct TS type inference if an object has a configurable color space (since r152).
 */
export const hasColorSpace = <
  T extends Renderer | Texture | object,
  P = T extends Renderer ? { outputColorSpace: string } : { colorSpace: string },
>(
  object: T,
): object is T & P => "colorSpace" in object || "outputColorSpace" in object

/**********************************************************************************/
/*                                                                                */
/*                                   Is Guards                                    */
/*                                                                                */
/**********************************************************************************/

export function isConstructor<T>(value: T | Constructor): value is Constructor {
  return typeof value === "function" && value.prototype !== undefined
}

/**********************************************************************************/
/*                                                                                */
/*                            Remove Element From Array                           */
/*                                                                                */
/**********************************************************************************/

export const removeElementFromArray = (array: any[], value: any) => {
  const index = array.indexOf(value)
  if (index !== -1) array.splice(index, 1)
  return array
}

/**********************************************************************************/
/*                                                                                */
/*                                     Resolve                                    */
/*                                                                                */
/**********************************************************************************/

export function resolve<T>(child: Accessor<T> | T, recursive = false): T {
  return typeof child !== "function"
    ? child
    : recursive
    ? resolve((child as Accessor<T>)())
    : (child as Accessor<T>)()
}

/**********************************************************************************/
/*                                                                                */
/*                                   With Context                                 */
/*                                                                                */
/**********************************************************************************/

export type ContextProviderProps = {
  children?: JSX.Element
} & Record<string, unknown>
export type ContextProvider<T extends ContextProviderProps> = (
  props: { children: JSX.Element } & T,
) => JSX.Element
/**
 * A utility-function to provide context to components.
 *
 * @param children Accessor of Children
 * @param context Context<T>
 * @param value T
 *
 * @example
 * ```tsx
 * const NumberContext = createContext<number>
 *
 * const children = withContext(
 *    () => props.children,
 *    NumberContext,
 *    1
 * )
 * ```
 */

export function withContext<T, TResult>(
  children: Accessor<TResult>,
  context: Context<T>,
  value: T,
) {
  let result: TResult

  context.Provider({
    value,
    children: (() => {
      result = children()
      return ""
    }) as any as JSX.Element,
  })

  return result!
}

/**********************************************************************************/
/*                                                                                */
/*                              With Multi Contexts                               */
/*                                                                                */
/**********************************************************************************/

/**
 * A utility-function to provide multiple context to components.
 *
 * @param children Accessor of Children
 * @param values Array of tuples of `[Context<T>, value T]`.
 *
 * @example
 * ```tsx
 * const NumberContext = createContext<number>
 * const StringContext = createContext<string>
 * const children = withContext(
 *    () => props.children,
 *    [
 *      [NumberContext, 1],
 *      [StringContext, "string"]
 *    ]
 * )
 * ```
 */

export function withMultiContexts<TResult, T extends readonly [unknown?, ...unknown[]]>(
  children: () => TResult,
  values: {
    [K in keyof T]: readonly [Context<T[K]>, [T[K]][T extends unknown ? 0 : never]]
  },
) {
  let result: TResult
  ;(values as [Context<any>, any]).reduce((acc, [context, value], index) => {
    return () =>
      context.Provider({
        value,
        children: () => {
          if (index === 0) result = acc()
          else acc()
        },
      })
  }, children)()

  return result!
}

/**********************************************************************************/
/*                                                                                */
/*                                       Load                                     */
/*                                                                                */
/**********************************************************************************/

export function load<
  const TIn extends string | string[],
  const TPaths extends Record<string, TIn>,
  TOut extends object,
>(loader: Loader<TIn, TOut>, path: TPaths): Promise<{ [TKey in keyof TPaths]: Texture }>
export function load<TIn extends string | string[], TOut extends object>(
  loader: Loader<TIn, TOut>,
  path: TIn,
): Promise<TOut>
export async function load(loader: Loader<any, any>, path: any) {
  if (!Array.isArray(path) && typeof path === "object") {
    return Object.entries(
      await Promise.all(Object.keys(path).map(async path => [path, await load(loader, path)])),
    )
  }
  return new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject))
}

/**********************************************************************************/
/*                                                                                */
/*                                     Use Ref                                    */
/*                                                                                */
/**********************************************************************************/

export function useRef<T>(props: { ref?: Ref<T> }, value: T | Accessor<T>) {
  createRenderEffect(() => {
    const result =
      typeof value === "function"
        ? // @ts-expect-error
          value()
        : value
    if (typeof props.ref === "function") {
      // @ts-expect-error
      props.ref(result)
    } else {
      props.ref = result
    }
  })
}

/**********************************************************************************/
/*                                                                                */
/*                              Get Current Viewport                              */
/*                                                                                */
/**********************************************************************************/

const tempTarget = new Vector3()
const position = new Vector3()
export function getCurrentViewport(
  _camera: CameraKind,
  target: Vector3 | Parameters<Vector3["set"]>,
  { width, height, top, left }: Measure,
) {
  const aspect = width / height

  if (isVector3(target)) {
    tempTarget.copy(target)
  } else {
    tempTarget.set(...target)
  }

  const distance = _camera.getWorldPosition(position).distanceTo(tempTarget)

  if (isOrthographicCamera(_camera)) {
    return {
      width: width / _camera.zoom,
      height: height / _camera.zoom,
      top,
      left,
      factor: 1,
      distance,
      aspect,
    }
  }

  const fov = (_camera.fov * Math.PI) / 180 // convert vertical fov to radians
  const h = 2 * Math.tan(fov / 2) * distance // visible height
  const w = h * (width / height)
  return { width: w, height: h, top, left, factor: width / w, distance, aspect }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Binary Search                                 */
/*                                                                                */
/**********************************************************************************/

// Find where to insert target to keep array sorted
export function binarySearch(array: number[], target: number) {
  let left = 0
  let right = array.length

  while (left < right) {
    const mid = Math.floor((left + right) / 2)

    if (array[mid] < target) {
      left = mid + 1 // Target goes after mid
    } else {
      right = mid // Target goes at or before mid
    }
  }

  return left // Insertion point
}
