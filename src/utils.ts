import type { Accessor } from "solid-js"
import {
  createMemo,
  createRenderEffect,
  getOwner,
  merge,
  onCleanup,
  untrack,
  type Ref,
} from "solid-js"
import {
  Camera,
  Loader,
  Material,
  Object3D,
  OrthographicCamera,
  Texture,
  Vector3,
} from "three"
import type { BufferGeometry, Fog, WebGLShadowMap, WebXRManager } from "three"
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
  Renderer,
  RendererLike,
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

/**
 * Returns true when `value` is an already-built renderer instance.
 */
export function isRenderer(value: unknown): value is Renderer {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Renderer).render === "function" &&
    typeof (value as Renderer).setSize === "function"
  )
}

/**
 * Returns true when `gl` can drive a WebXR-shaped session: `gl.xr` is an event
 * target (has `addEventListener`) and `gl.setAnimationLoop` exists on the
 * renderer. Unifies WebGL and WebGPU: WebGLRenderer.xr has setAnimationLoop,
 * but WebGPURenderer's `XRManager` doesn't — both, however, expose
 * `setAnimationLoop` on the renderer itself. Always call `_gl.setAnimationLoop`
 * (not `_gl.xr.setAnimationLoop`) to stay portable.
 */
export function canDriveXR(
  gl: unknown,
): gl is { xr: WebXRManager; setAnimationLoop: (cb: XRFrameRequestCallback | null) => void } {
  if (!gl || typeof gl !== "object") return false
  const xr = (gl as { xr?: unknown }).xr
  const setLoop = (gl as { setAnimationLoop?: unknown }).setAnimationLoop
  return (
    !!xr &&
    typeof (xr as { addEventListener?: unknown }).addEventListener === "function" &&
    typeof setLoop === "function"
  )
}

/**
 * Duck-typed narrow to `WebGLShadowMap`. `needsUpdate` is the discriminator
 * — WebGPURenderer's `shadowMap` is `{ enabled, type }` without it.
 */
export function isWebGLShadowMap(value: unknown): value is WebGLShadowMap {
  return !!value && "needsUpdate" in (value as object)
}

/**
 * Duck-typed three.js class checks. These match three's own internal
 * pattern (`obj.isMaterial`, `obj.isObject3D`, etc.) and survive cases
 * where the `Material` / `Object3D` class identities differ across
 * module instances — e.g. `three/webgpu`'s `MeshBasicNodeMaterial`
 * doesn't share class identity with `three`'s `Material`, but both set
 * `isMaterial = true`.
 */
export function isMaterial(value: unknown): value is Material {
  return !!value && (value as { isMaterial?: boolean }).isMaterial === true
}
export function isBufferGeometry(value: unknown): value is BufferGeometry {
  return !!value && (value as { isBufferGeometry?: boolean }).isBufferGeometry === true
}
export function isFog(value: unknown): value is Fog {
  return !!value && (value as { isFog?: boolean }).isFog === true
}
export function isObject3D(value: unknown): value is Object3D {
  return !!value && (value as { isObject3D?: boolean }).isObject3D === true
}
export function isWritable(object: object, propertyName: string) {
  return Object.getOwnPropertyDescriptor(object, propertyName)?.writable
}

/**
 * Returns the renderer's `init()` if it both exists and hasn't been called yet,
 * else `undefined`. Used to await async setup (e.g. WebGPURenderer.init) before
 * the first render.
 */
export function getPendingInit(renderer: Renderer): (() => Promise<void>) | undefined {
  const r = renderer as RendererLike
  const initFn = r.init
  if (!initFn) return undefined
  if (typeof r.hasInitialized === "function" && r.hasInitialized()) return undefined
  return () => initFn.call(r)
}

/**********************************************************************************/
/*                                                                                */
/*                                  Auto Dispose                                  */
/*                                                                                */
/**********************************************************************************/

export function autodispose<T>(object: T): T {
  const candidate = object as { dispose?: () => void } | null | undefined
  if (candidate && typeof candidate.dispose === "function") {
    onCleanup(() => candidate.dispose?.())
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
  // `merge` preserves getters on `augmentation` (e.g.
  // `get props() { ... }`) without invoking them at merge time. The
  // earlier `{ ..., ...augmentation }` form ran every getter once and
  // froze the value — which both lost reactivity downstream AND tracked
  // every signal the getter touched into whatever scope `meta()` was
  // called from.
  _instance[$S3C] = merge(
    { children: new Set(), parent: undefined },
    augmentation,
  ) as Data<T>
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
/*                                Shallow Equal                                   */
/*                                                                                */
/**********************************************************************************/


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
 *        debug("topic", () => data)
 *        debug("topic", () => data, { trace: true })  // also prints full call stack
 */
export const createDebug = !import.meta.env.DEV
  ? (title: string, enabled: boolean) =>
      (topic: string, data?: (() => any) | undefined, options?: DebugOptions) => {}
  : (title: string, enabled: boolean) => {
      return (topic: string, data?: (() => any) | undefined, options?: DebugOptions) => {
        if (!enabled) {
          return
        }
        const resolved = data !== undefined ? untrack(data) : undefined
        console.log(`[${title}] ${topic}`, ...(resolved !== undefined ? [resolved] : []))
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
