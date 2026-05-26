import type { Accessor, Context, JSX } from "solid-js"
import { createRenderEffect, mergeProps, onCleanup, type Ref } from "solid-js"
import {
  type BufferGeometry,
  Camera,
  type Fog,
  Loader,
  type Material,
  type Object3D,
  OrthographicCamera,
  Texture,
  Vector3,
  type WebGLShadowMap,
  type WebXRManager,
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

/**********************************************************************************/
/*                                                                                */
/*                                  Auto Dispose                                  */
/*                                                                                */
/**********************************************************************************/

export function autodispose<T extends { dispose?: () => void }>(object: T): T {
  if (object.dispose) {
    onCleanup(() => object.dispose?.())
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
  // `mergeProps` preserves getters on `augmentation` (e.g.
  // `get props() { ... }`) without invoking them at merge time. The
  // earlier `{ ..., ...augmentation }` form ran every getter once and
  // froze the value — which both lost reactivity downstream AND tracked
  // every signal the getter touched into whatever scope `meta()` was
  // called from.
  _instance[$S3C] = mergeProps(
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
>(
  props: T,
  defaults: TDefaults,
): Prettify<Omit<T, keyof TDefaults> & Required<Pick<T, Extract<keyof TDefaults, keyof T>>>> {
  return mergeProps(defaults, props) as any
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

/**
 * Shallow object equality. Used as the `equals` argument to `createMemo` so
 * a fresh-reference-same-content object (e.g. `{ antialias: true }` returned
 * by a JSX getter each tick) doesn't propagate downstream. Same keys + each
 * value `===` ⇒ equal.
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if ((a as Record<string, unknown>)[key] !== (b as Record<string, unknown>)[key]) return false
  }
  return true
}

/**
 * Duck-typed three.js class checks. These match three's own internal pattern
 * (`obj.isMaterial`, `obj.isObject3D`, etc.) and survive cases where the
 * `Material` / `Object3D` class identities differ across module instances
 * — e.g. `three/webgpu`'s `MeshBasicNodeMaterial` doesn't extend the same
 * `Material` as `three`'s `MeshBasicMaterial`, but both set
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
 * Returns true when `value` is an already-built renderer instance (anything
 * matching {@link Renderer}) rather than a config-props object or a factory.
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
 * Returns true if the renderer can host an XR session: its `xr` manager is an
 * event target (so we can subscribe to `sessionstart`/`sessionend`) and the
 * renderer itself exposes `setAnimationLoop` (the XR-aware loop driver, which
 * lives on the renderer in both WebGL and WebGPU builds — only the WebGL
 * `WebXRManager` *also* mirrors it).
 *
 * Unifies WebGL and WebGPU XR wiring: we always drive the loop via
 * `gl.setAnimationLoop(...)` rather than `gl.xr.setAnimationLoop(...)`, which
 * three's WebGPU `XRManager` doesn't expose.
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
 * Duck-typed narrow to `WebGLShadowMap`. `needsUpdate` is the WebGL-only
 * field we set; WebGPURenderer's `shadowMap` is `{ enabled, type }` without it.
 */
export function isWebGLShadowMap(value: unknown): value is WebGLShadowMap {
  return !!value && "needsUpdate" in (value as object)
}

/**
 * Returns the renderer's `init()` if it both exists and hasn't been called yet,
 * otherwise `undefined`. Used to await async setup (e.g. `WebGPURenderer.init`)
 * before the first render.
 *
 * Why a util: `Renderer = WebGLRenderer | WebGPURenderer | RendererLike`, but
 * `WebGLRenderer` has no `init` method at all — so direct union access errors
 * ("property `init` does not exist on type `WebGLRenderer`"). Narrowing through
 * `RendererLike` (where `init?` is optional) makes the access well-typed and
 * contains that cast to one place. As a bonus, it also resolves a secondary
 * return-type mismatch — three's `Renderer.init()` is `Promise<this>` while
 * `RendererLike.init?()` is `Promise<void>`; we discard the resolved value.
 *
 * Returns `undefined` when:
 * - the renderer has no `init` method (WebGLRenderer, custom static renderers)
 * - the renderer's `hasInitialized()` reports `true` (user passed a pre-built,
 *   pre-initialized renderer — matches r3f's #3651 fix)
 */
export function getPendingInit(renderer: Renderer): (() => Promise<unknown>) | undefined {
  const init = (renderer as RendererLike).init
  const hasInitialized = (renderer as RendererLike).hasInitialized
  if (typeof init !== "function") return undefined
  if (hasInitialized?.call(renderer)) return undefined
  return () => init.call(renderer)
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

export type LoadInput<TLoader extends Loader<any, any>> =
  | LoaderUrl<TLoader>
  | Record<string, LoaderUrl<TLoader>>

export type LoadOutput<TLoader extends Loader<any, any>, TUrl> = TUrl extends readonly any[]
  ? LoaderData<TLoader>
  : TUrl extends Record<string, any>
  ? { [TKey in keyof TUrl]: LoaderData<TLoader> }
  : LoaderData<TLoader>

export function load<const TLoader extends Loader<any, any>>(
  loader: TLoader,
  input: LoaderUrl<TLoader>,
): Promise<LoaderData<TLoader>>
export function load<const TLoader extends Loader<any, any>, TInput extends LoadInput<TLoader>>(
  loader: TLoader,
  input: TInput,
): Promise<LoadOutput<TLoader, TInput>>
export async function load<
  const TLoader extends Loader<any, any>,
  TInput extends LoadInput<TLoader>,
>(loader: TLoader, input: TInput): Promise<LoadOutput<TLoader, TInput>> {
  if (isRecord(input)) {
    return (await awaitMapObject(input, path => load(loader, path))) as LoadOutput<TLoader, TInput>
  }
  return new Promise((resolve, reject) => loader.load(input, resolve, undefined, reject))
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
