import type { Accessor, Component, JSX, ParentProps, Ref } from "solid-js"
import type {
  Camera,
  Clock,
  ColorRepresentation,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Color as ThreeColor,
  Euler as ThreeEuler,
  Layers as ThreeLayers,
  Matrix3 as ThreeMatrix3,
  Matrix4 as ThreeMatrix4,
  Quaternion as ThreeQuaternion,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
  Vector4 as ThreeVector4,
  WebGLRenderer,
} from "three"
import type { $S3C } from "./constants.ts"

/**********************************************************************************/
/*                                                                                */
/*                                      Utils                                     */
/*                                                                                */
/**********************************************************************************/

export type AccessorMaybe<T> = T | Accessor<T>

/** Generic constructor. Returns instance of given type. Defaults to any. */
export type Constructor<T = any> = new (...args: any[]) => T

/** Extracts the instance from a constructor. */
export type InstanceOfMaybe<T> = T extends Constructor<infer TObject> ? TObject : T

export type Overwrite<T extends unknown[]> = T extends [infer First, ...infer Rest]
  ? Rest extends []
    ? First
    : Overwrite<Rest> extends infer Result
    ? Omit<First, keyof Result> & Result
    : never
  : never

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Intersect<T extends any[]> = T extends [infer U, ...infer Rest]
  ? Rest["length"] extends 0
    ? U
    : U & Intersect<Rest>
  : T

export type When<T, U> = T extends false ? (T extends true ? U : unknown) : U

export type Args<T> = T extends new (...args: any) => any ? ConstructorParameters<T> : T

export type Mandatory<T, K extends keyof T> = T & { [P in K]-?: T[P] }

export type KeyOfOptionals<T> = keyof {
  [K in keyof T as T extends Record<K, T[K]> ? never : K]: T[K]
}

/** Allows using a TS v4 labeled tuple even with older typescript versions */
export type NamedArrayTuple<T extends (...args: any) => any> = Parameters<T>

/**********************************************************************************/
/*                                                                                */
/*                                       Misc                                     */
/*                                                                                */
/**********************************************************************************/

export interface Measure {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/**********************************************************************************/
/*                                                                                */
/*                                       Meta                                     */
/*                                                                                */
/**********************************************************************************/

export type Meta<T = unknown> = T & {
  [$S3C]: Data
}

/** Metadata of a `solid-three` instance. */
export type Data = {
  props: Record<string, any>
  parent: any
  children: Set<Meta<any>>
  plugins: Plugin[]
}

/**********************************************************************************/
/*                                                                                */
/*                                    Raycaster                                   */
/*                                                                                */
/**********************************************************************************/

export type RayEvent = PointerEvent | MouseEvent | WheelEvent

export interface EventRaycaster extends Raycaster {
  update(event: RayEvent, context: Context): void
}

/**********************************************************************************/
/*                                                                                */
/*                                   Canvas Props                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Props for the Canvas component, which initializes the Three.js rendering context and acts as the root for your 3D scene.
 */
export interface CanvasProps extends ParentProps {
  ref?: Ref<Context>
  class?: string
  contexts?: { Provider: Component<ParentProps> }[]
  /** Configuration for the camera used in the scene. */
  defaultCamera?: Partial<Props<PerspectiveCamera> | Props<OrthographicCamera>> | Camera
  /** Configuration for the Raycaster used for mouse and pointer events. */
  defaultRaycaster?: Partial<Props<EventRaycaster>> | EventRaycaster | Raycaster
  /** Element to render while the main content is loading asynchronously.  */
  fallback?: JSX.Element
  /** Toggles flat interpolation for texture filtering. */
  flat?: boolean
  /** Controls the rendering loop's operation mode. */
  frameloop?: "never" | "demand" | "always"
  /** Options for the WebGLRenderer or a function returning a customized renderer. */
  gl?:
    | Partial<Props<WebGLRenderer>>
    | ((canvas: HTMLCanvasElement) => WebGLRenderer)
    | WebGLRenderer
  /** Toggles linear interpolation for texture filtering. */
  linear?: boolean
  /** Toggles between Orthographic and Perspective camera. */
  orthographic?: boolean
  /** Configuration for the Scene instance. */
  scene?: Partial<Props<Scene>> | Scene
  /** Enables and configures shadows in the scene. */
  shadows?: boolean | "basic" | "percentage" | "soft" | "variance" | WebGLRenderer["shadowMap"]
  /** Custom CSS styles for the canvas container. */
  style?: JSX.CSSProperties
}

/**********************************************************************************/
/*                                                s                                */
/*                                     Context                                    */
/*                                                                                */
/**********************************************************************************/

export interface Context {
  bounds: Measure
  canvas: HTMLCanvasElement
  clock: Clock
  currentCamera: CameraKind
  currentRaycaster: Raycaster | EventRaycaster
  dpr: number
  gl: Meta<WebGLRenderer>
  props: CanvasProps
  render: (delta: number) => void
  requestRender: () => void
  scene: Meta<Scene>
  setCurrentCamera(camera: CameraKind): () => void
  setCurrentRaycaster(camera: Raycaster): () => void
  viewport: Viewport
  xr: {
    connect: () => void
    disconnect: () => void
  }
}

export interface Viewport {
  width: number
  height: number
  top: number
  left: number
  factor: number
  distance: number
  aspect: number
}

/** Possible camera kinds. */
export type CameraKind = PerspectiveCamera | OrthographicCamera

export type Loader<TSource, TResult extends object> = {
  setPath?(path: string): void
  load: (
    url: TSource,
    onLoad: (result: TResult) => void,
    onProgress: (() => void) | undefined,
    onReject: ((error: ErrorEvent | unknown) => void) | undefined,
  ) => unknown
}

export type FrameListenerCallback = (context: Context, delta: number, frame?: XRFrame) => void
export type FrameListenerOptions = { priority?: number; stage?: "before" | "after" }
export type FrameListener = (
  callback: FrameListenerCallback,
  options?: FrameListenerOptions,
) => () => void

/**********************************************************************************/
/*                                                                                */
/*                                  Representations                               */
/*                                                                                */
/**********************************************************************************/

/** Maps properties of given type to their `solid-three` representations. */
export type MapToRepresentation<T> = {
  [TKey in keyof T]: Representation<T[TKey]>
}

interface ThreeMath {
  set(...args: number[]): any
}
interface ThreeVector extends ThreeMath {
  setScalar(s: number): any
}

/** Map given type to `solid-three` representation. */
export type Representation<T> = T extends ThreeColor
  ? ConstructorParameters<typeof ThreeColor> | ColorRepresentation
  : T extends ThreeVector | ThreeLayers | ThreeEuler
  ? T | Parameters<T["set"]> | number
  : T extends ThreeMath
  ? T | Parameters<T["set"]>
  : T

export type Vector2 = Representation<ThreeVector2>
export type Vector3 = Representation<ThreeVector3>
export type Vector4 = Representation<ThreeVector4>
export type Color = Representation<ThreeColor>
export type Layers = Representation<ThreeLayers>
export type Quaternion = Representation<ThreeQuaternion>
export type Euler = Representation<ThreeEuler>
export type Matrix3 = Representation<ThreeMatrix3>
export type Matrix4 = Representation<ThreeMatrix4>

/**********************************************************************************/
/*                                                                                */
/*                                      Props                                     */
/*                                                                                */
/**********************************************************************************/

export type InferPluginProps<TPlugins extends Plugin[]> = Merge<{
  [TKey in keyof TPlugins]: TPlugins[TKey] extends (element: any) => infer U
    ? { [TKey in keyof U]: U[TKey] extends (callback: infer V) => any ? V : never }
    : never
}>

/** Generic `solid-three` props of a given class. */
export type Props<T, TPlugins extends Plugin[] = Plugin[]> = Partial<
  Overwrite<
    [
      MapToRepresentation<InstanceOfMaybe<T>>,
      {
        args: T extends Constructor ? ConstructorOverloadParameters<T> : undefined
        attach: string | ((parent: object, self: Meta<InstanceOfMaybe<T>>) => () => void)
        children: JSX.Element
        key: string
        onUpdate: (self: Meta<InstanceOfMaybe<T>>) => void
        ref: InstanceOfMaybe<T> | ((element: Meta<InstanceOfMaybe<T>>) => void)
        /**
         * Prevents the Object3D from being cast by the ray.
         * Object3D can still receive events via propagation from its descendants.
         */
        raycastable: boolean
      },
      InferPluginProps<TPlugins>,
    ]
  >
>

type Simplify<T> = T extends any
  ? {
      [K in keyof T]: T[K]
    }
  : T

type _Merge<T extends unknown[], Current = {}> = T extends [
  infer Next | (() => infer Next),
  ...infer Rest,
]
  ? _Merge<Rest, Override<Current, Next>>
  : T extends [...infer Rest, infer Next]
  ? Override<_Merge<Rest, Current>, Next>
  : T extends []
  ? Current
  : Current
export type Merge<T extends unknown[]> = Simplify<_Merge<T>>

type DistributeOverride<T, F> = T extends undefined ? F : T
type Override<T, U> = T extends any
  ? U extends any
    ? {
        [K in keyof T]: K extends keyof U ? DistributeOverride<U[K], T[K]> : T[K]
      } & {
        [K in keyof U]: K extends keyof T ? DistributeOverride<U[K], T[K]> : U[K]
      }
    : T & U
  : T & U

/**
 * Extracts the parameters of all possible overloads of a given constructor.
 *
 * @example
 * class Example {
 *   constructor(a: string);
 *   constructor(a: number, b: boolean);
 *   constructor(a: any, b?: any) {
 *     // Implementation
 *   }
 * }
 *
 * type ExampleParameters = ConstructorOverloadParameters<typeof Example>;
 * // ExampleParameters will be equivalent to: [string] | [number, boolean]
 */
export type ConstructorOverloadParameters<T extends Constructor> = T extends {
  new (...o: infer U): void
  new (...o: infer U2): void
  new (...o: infer U3): void
  new (...o: infer U4): void
  new (...o: infer U5): void
  new (...o: infer U6): void
  new (...o: infer U7): void
}
  ? U | U2 | U3 | U4 | U5 | U6 | U7
  : T extends {
      new (...o: infer U): void
      new (...o: infer U2): void
      new (...o: infer U3): void
      new (...o: infer U4): void
      new (...o: infer U5): void
      new (...o: infer U6): void
    }
  ? U | U2 | U3 | U4 | U5 | U6
  : T extends {
      new (...o: infer U): void
      new (...o: infer U2): void
      new (...o: infer U3): void
      new (...o: infer U4): void
      new (...o: infer U5): void
    }
  ? U | U2 | U3 | U4 | U5
  : T extends {
      new (...o: infer U): void
      new (...o: infer U2): void
      new (...o: infer U3): void
      new (...o: infer U4): void
    }
  ? U | U2 | U3 | U4
  : T extends {
      new (...o: infer U): void
      new (...o: infer U2): void
      new (...o: infer U3): void
    }
  ? U | U2 | U3
  : T extends {
      new (...o: infer U): void
      new (...o: infer U2): void
    }
  ? U | U2
  : T extends {
      new (...o: infer U): void
    }
  ? U
  : never

/**********************************************************************************/
/*                                                                                */
/*                                      Plugin                                    */
/*                                                                                */
/**********************************************************************************/

export type Plugin<TFn = (element: any) => any> = TFn

/**
 * Plugin function interface that defines all possible plugin creation patterns.
 *
 * Plugins extend solid-three components with additional functionality and can be:
 * - Global: apply to all elements
 * - Filtered: apply only to specific element types (via constructor array or type guard)
 * - With setup: access to the Three.js context during initialization
 *
 * @example
 * // Global plugin
 * const LogPlugin = plugin(element => ({
 *   log: (message: string) => console.log(`[${element.type}] ${message}`)
 * }))
 *
 * @example
 * // Filtered plugin with constructor array
 * const ShakePlugin = plugin([THREE.Camera, THREE.Mesh], element => ({
 *   shake: (intensity = 0.1) => {
 *     useFrame(() => {
 *       element.position.x += (Math.random() - 0.5) * intensity
 *     })
 *   }
 * }))
 *
 * @example
 * // Filtered plugin with type guard
 * const MaterialPlugin = plugin(
 *   (element): element is THREE.Mesh => element instanceof THREE.Mesh,
 *   element => ({
 *     setColor: (color: string) => element.material.color.set(color)
 *   })
 * )
 *
 * @example
 * // Plugin with setup context
 * const ContextPlugin = plugin
 *   .setup((context) => ({ scene: context.scene }))
 *   .then([THREE.Object3D], (element, context) => ({
 *     addToScene: () => context.scene.add(element)
 *   }))
 */
export interface PluginFn {
  /**
   * Creates a global plugin that applies to all elements.
   *
   * @param methods - Function that receives an element and returns plugin methods
   * @returns Plugin that applies to all elements
   */
  <const Methods extends Record<string, any>>(methods: (element: any) => Methods): Plugin<
    (element: any) => Methods
  >

  /**
   * Creates a filtered plugin that applies only to specific constructor types.
   *
   * @param Constructors - Array of constructor functions to filter by
   * @param methods - Function that receives a filtered element and returns plugin methods
   * @returns Plugin that applies only to matching constructor types
   */
  <const T extends readonly Constructor[], const Methods extends Record<string, any>>(
    Constructors: T,
    methods: (element: T extends readonly Constructor<infer U>[] ? U : never) => Methods,
  ): Plugin<{
    (element: T extends readonly Constructor<infer U>[] ? U : never): Methods
  }>

  /**
   * Creates a filtered plugin that applies only to elements matching a type guard.
   *
   * @param condition - Type guard function that determines if plugin applies
   * @param methods - Function that receives a filtered element and returns plugin methods
   * @returns Plugin that applies only to elements matching the type guard
   */
  <const T, const Methods extends Record<string, any>>(
    condition: (element: unknown) => element is T,
    methods: (element: T) => Methods,
  ): Plugin<{
    (element: T): Methods
  }>
}

type PluginReturn<TKind, TPlugin> = TPlugin extends Plugin<infer TFn>
  ? TFn extends { (element: infer TElement): infer TReturnType }
    ? TKind extends TElement
      ? TReturnType
      : {}
    : {}
  : {}

/**
 * Resolves plugin props for a specific element type TKind
 * This allows plugins to provide conditional methods based on the actual element type
 */
export type PluginPropsOf<TKind, TPlugins extends Plugin[]> = Merge<{
  [K in keyof TPlugins]: PluginReturn<TKind, TPlugins[K]> extends infer Methods extends Record<
    string,
    any
  >
    ? {
        [M in keyof Methods]: Methods[M] extends (value: infer V) => any ? V : never
      }
    : {}
}>
