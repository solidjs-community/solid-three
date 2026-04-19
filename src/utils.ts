import { untrack } from "@solidjs/web"
import type { Accessor, Context, JSX } from "solid-js"
import { createMemo, createRenderEffect, getOwner, merge, onCleanup, type Ref } from "solid-js"
import {
  Camera,
  Loader,
  Material,
  Object3D,
  OrthographicCamera,
  Texture,
  Vector3,
  type Renderer,
} from "three"
import { $S3C } from "./constants.ts"
import type {
  CameraKind,
  ClassInstance,
  Constructor,
  Data,
  LoaderData,
  LoaderUrl,
  Meta,
  Prettify,
} from "./types.ts"
import type { Measure } from "./utils/use-measure.ts"

/**********************************************************************************/
/*                                                                                */
/*                                      Guards                                    */
/*                                                                                */
/**********************************************************************************/

export function isRecord(value: any): value is Record<string, any> {
  return !Array.isArray(value) && typeof value === "object"
}

export function isClassInstance<T extends object>(obj: any): obj is ClassInstance<T> {
  return (
    obj != null &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    obj.constructor !== Object &&
    Object.getPrototypeOf(obj) !== Object.prototype
  )
}

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
/*                                     Augment                                    */
/*                                                                                */
/**********************************************************************************/

/**
 * A utility to add metadata to a given instance.
 * This data can be accessed behind the `S3C` symbol and is used internally in `solid-three`.
 *
 * @param instance - `three` instance
 * @param augmentation - additional data: `{ props }`
 * @returns the `three` instance with the additional data
 */
export function meta<T>(instance: T, augmentation = { props: {} }) {
  if (hasMeta(instance)) {
    return instance
  }
  const _instance = instance as Meta<T>
  _instance[$S3C] = { children: new Set(), parent: undefined, ...augmentation }
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
/*                                Await Map Object                                */
/*                                                                                */
/**********************************************************************************/

export async function awaitMapObject<T extends object, U>(
  object: T,
  callback: (value: T[keyof T], key: keyof T) => Promise<U>,
) {
  const result = {} as {
    [TKey in keyof T]: U
  }
  for (const key in object) {
    result[key] = await callback(object[key], key)
  }
  return result
}

/**********************************************************************************/
/*                                                                                */
/*                                    Bubble Up                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Traverses up the tree from a given node to the root, executing a callback on each node.
 * @template T The type of data stored in the tree
 * @param node The starting node
 * @param callback Function to execute on each node during traversal
 * @internal
 */
export function bubbleUp<T extends { parent: any }>(
  node: T,
  callback: (node: T["parent"]) => void,
) {
  let current: T | undefined = node
  while (current) {
    callback(current)
    current = "parent" in current ? current.parent : undefined
  }
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

export function defaultProps<
  const T,
  const TDefaults extends Partial<Required<Pick<T, KeyOfOptionals<T>>>>,
>(props: T, defaults: TDefaults): Prettify<TDefaults & Omit<T, keyof TDefaults>> {
  // @ts-expect-error merge return type differs from declared Prettify<TDefaults & Omit<T, keyof TDefaults>>
  return merge(defaults, props)
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
  if (isConstructor(child)) {
    return child
  }
  if (typeof child === "function") {
    const value = (child as Accessor<T>)()
    if (recursive) {
      return resolve(value)
    }
    return value
  }
  return child
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
  // In Solid 2.x the context object IS the provider component (no .Provider).
  // The provider calls setContext from the correct signals version internally.
  // It returns a lazy children() memo — we must force evaluation so our callback runs.
  let result: TResult
  const memo = (context as any)({
    value,
    children: (() => {
      result = children()
      return ""
    }) as any as JSX.Element,
  })
  // Force lazy children memo to evaluate (triggers flatten → calls our fn)
  if (typeof memo === "function") memo()
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
  // Nest context providers (no .Provider in Solid 2.x — context IS the provider).
  // Each provider returns a lazy memo — we force the outermost to evaluate.
  let result: TResult

  untrack(() =>
    resolve(
      (values as [Context<any>, any][]).reduce(
        (acc, [Context, value], index) => {
          return () => {
            return resolve(
              Context({
                value,
                get children() {
                  return index === 0 ? (result = untrack(acc)) : untrack(acc)
                },
              }) as unknown as Accessor<unknown>,
            )
          }
        },
        children as () => any,
      ),
    ),
  )

  return result!
}

/**********************************************************************************/
/*                                                                                */
/*                                       Load                                     */
/*                                                                                */
/**********************************************************************************/

export type LoadInput<TLoader extends Loader<any, any>> =
  | LoaderUrl<TLoader>
  | Record<string, LoaderUrl<TLoader>>

export type LoadOutput<TLoader extends Loader<any, any>, TUrl> =
  // Check single-URL form first so tuple/array URLs (e.g. CubeTextureLoader's
  // `string[]`) don't fall through to the Record branch — a tuple technically
  // extends `Record<string, any>` because of its numeric keys.
  TUrl extends LoaderUrl<TLoader>
    ? LoaderData<TLoader>
    : TUrl extends Record<string, LoaderUrl<TLoader>>
      ? { [TKey in keyof TUrl]: LoaderData<TLoader> }
      : never

export async function load<
  const TLoader extends Loader<any, any>,
  TInput extends LoadInput<TLoader>,
>(loader: TLoader, input: TInput): Promise<LoadOutput<TLoader, TInput>> {
  if (isRecord(input)) {
    return (await awaitMapObject(input, path => load(loader, path))) as unknown as Promise<
      LoadOutput<TLoader, TInput>
    >
  }
  return new Promise((resolve, reject) => loader.load(input, resolve, undefined, reject))
}

/**********************************************************************************/
/*                                                                                */
/*                                     Use Ref                                    */
/*                                                                                */
/**********************************************************************************/

export function useRef<T>(props: { ref?: Ref<T> }, value: T | Accessor<T>) {
  createRenderEffect(
    () => (typeof value === "function" ? (value as Accessor<T>)() : value),
    (result: T) => {
      if (typeof props.ref === "function") {
        // @ts-expect-error
        props.ref(result)
      } else {
        props.ref = result
      }
    },
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                   When Memo                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Returns a memo that evaluates `fn(value)` when `accessor` is truthy, `undefined` otherwise.
 * Inlined replacement for `whenMemo` from `@bigmistqke/solid-whenever`.
 */
export function whenMemo<T, U>(
  accessor: Accessor<T | undefined | null | false>,
  fn: (value: T) => U,
): Accessor<U | undefined> {
  return createMemo(() => {
    const v = accessor()
    return v ? fn(v) : undefined
  })
}

/**
 * Runs `fn(value)` in a render effect only when `accessor` is truthy.
 * `fn` may return a cleanup function. Inlined replacement for `whenEffect`
 * from `@bigmistqke/solid-whenever`.
 */
export function whenEffect<T>(
  accessor: Accessor<T | undefined | null | false>,
  fn: (value: T) => void | (() => void),
) {
  createRenderEffect(
    () => accessor(),
    value => {
      if (!value) return
      return fn(value)
    },
  )
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

/**********************************************************************************/
/*                                                                                */
/*                                    Debug                                       */
/*                                                                                */
/**********************************************************************************/

type DebugOptions = { trace?: boolean }

/**
 * Returns a debug function. When `enabled` is false, the debug function is a no-op.
 * Usage: const debug = createDebug("my-module:function", true)
 *        debug("topic", data)
 *        debug("topic", data, { trace: true })  // also prints full call stack
 */
export const createDebug = !import.meta.env.DEV
  ? (title: string, enabled: boolean) => (topic: string, data?: any, options?: DebugOptions) => {}
  : (title: string, enabled: boolean) => {
      return (topic: string, data?: any, options?: DebugOptions) => {
        if (!enabled) {
          return
        }
        console.log(`[${title}] ${topic}`, ...(data !== undefined ? [data] : []))
        if (options?.trace) {
          const prev = (Error as any).stackTraceLimit
          ;(Error as any).stackTraceLimit = 50
          const stack = new Error().stack?.split("\n").slice(2).join("\n")
          ;(Error as any).stackTraceLimit = prev
          console.log(`[${title}] stack:\n${stack}`)
        }
      }
    }

/**
 * Returns a string describing the current reactive owner chain from getOwner() upward.
 * Each node shows: name, number of context keys, and transparent flag.
 */
export function describeOwnerChain(): string {
  let o = getOwner() as any
  if (!o) return "(no owner)"
  const parts: string[] = []
  while (o) {
    const ctxKeys = o._context ? Object.getOwnPropertySymbols(o._context).length : -1
    const transparent = o._transparent ? "(T)" : ""
    const name = o._name || o._component?.name || "(anon)"
    parts.push(`${name}[${ctxKeys}ctx]${transparent}`)
    o = o._parent
  }
  return parts.join(" -> ")
}

/**
 * Returns whether a given context id is present anywhere in the owner chain.
 */
export function hasContextInChain(contextId: symbol): boolean {
  let o = getOwner() as any
  while (o) {
    if (o._context && o._context[contextId] !== undefined) return true
    o = o._parent
  }
  return false
}

export function createResizeObserver(target: Element, callback: ResizeObserverCallback) {
  const observer = new ResizeObserver(callback)
  observer.observe(target)
  onCleanup(() => observer.disconnect())
}
