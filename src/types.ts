import type { Accessor, JSX } from "solid-js"
import type {
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
import type { CanvasProps } from "./create-canvas.tsx"
import type { EventRaycaster } from "./raycasters.tsx"
import type { Measure } from "./utils/use-measure.ts"

/**********************************************************************************/
/*                                                                                */
/*                                      Utils                                     */
/*                                                                                */
/**********************************************************************************/

export type AccessorMaybe<T> = T | Accessor<T>

/** Generic constructor. Returns instance of given type. Defaults to any. */
export type Constructor<T = any> = new (...args: any[]) => T

/** Extracts the instance from a constructor. */
export type InstanceOf<T> = T extends Constructor<infer TObject> ? TObject : T

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

/**********************************************************************************/
/*                                                                                */
/*                                       Meta                                     */
/*                                                                                */
/**********************************************************************************/

export type Meta<T = unknown> = T & {
  [$S3C]: Data<T>
}

/** Metadata of a `solid-three` instance. */
export type Data<T> = {
  props: Props<InstanceOf<T>> & Record<string, any>
  parent: any
  children: Set<Meta<any>>
  plugins: Plugin[]
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
  registerPlugin(
    plugin: Plugin,
  ): (element: any) => Record<string, undefined | ((args: any) => void)>
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

/** Generic `solid-three` props of a given class. */
export type Props<T, TPlugins extends Plugin[] | undefined = Plugin[]> = Partial<
  Overwrite<
    [
      MapToRepresentation<InstanceOf<T>>,
      {
        args: T extends Constructor ? ConstructorOverloadParameters<T> : undefined
        attach: string | ((parent: object, self: Meta<InstanceOf<T>>) => () => void)
        children: JSX.Element
        key?: string
        onUpdate: (self: Meta<InstanceOf<T>>) => void
        // ref: Ref<Meta<InstanceOf<T>>>
        /**
         * Prevents the Object3D from being cast by the ray.
         * Object3D can still receive events via propagation from its descendants.
         */
        raycastable: boolean
        plugins: TPlugins
      },
      TPlugins extends Plugin[] ? InferPluginProps<InstanceOf<T>, TPlugins> : {},
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
type ConstructorOverloadParameters<T extends Constructor> = T extends {
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

export interface Plugin<TFn = (element: any) => any> {
  (context: Context): TFn
}

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

  /**
   * Creates a plugin with access to setup context.
   *
   * The setup function runs once when the plugin is initialized and receives
   * the Three.js context. The returned data is passed to all plugin methods.
   *
   * @param setupFn - Function that receives the Three.js context and returns setup data
   * @returns Object with 'then' method to define the plugin behavior
   */
  setup<const TSetupContext extends object>(
    setupFn: (context: Context) => TSetupContext,
  ): {
    then: {
      /**
       * Creates a global plugin with setup context.
       *
       * @param methods - Function that receives element and setup context, returns plugin methods
       * @returns Plugin that applies to all elements with setup context
       */
      <const Methods extends Record<string, any>>(
        methods: (element: any, context: TSetupContext) => Methods,
      ): Plugin<(element: any) => Methods>

      /**
       * Creates a filtered plugin with setup context using constructor array.
       *
       * @param Constructors - Array of constructor functions to filter by
       * @param methods - Function that receives filtered element and setup context, returns plugin methods
       * @returns Plugin that applies only to matching constructor types with setup context
       */
      <const T extends readonly Constructor[], const Methods extends Record<string, any>>(
        Constructors: T,
        methods: (
          element: T extends readonly Constructor<infer U>[] ? U : never,
          context: TSetupContext,
        ) => Methods,
      ): Plugin<{
        (element: T extends readonly Constructor<infer U>[] ? U : never): Methods
      }>

      /**
       * Creates a filtered plugin with setup context using type guard.
       *
       * @param condition - Type guard function that determines if plugin applies
       * @param methods - Function that receives filtered element and setup context, returns plugin methods
       * @returns Plugin that applies only to elements matching the type guard with setup context
       */
      <const T, const Methods extends Record<string, any>>(
        condition: (element: unknown) => element is T,
        methods: (element: T, context: TSetupContext) => Methods,
      ): Plugin<{
        (element: T): Methods
      }>
    }
  }
}

type PluginReturn<TPlugin, TKind> = TPlugin extends Plugin<infer TFn>
  ? TFn extends { (element: infer P): infer R }
    ? TKind extends P
      ? R
      : {}
    : {}
  : {}

/**
 * Resolves plugin props for a specific element type T
 * This allows plugins to provide conditional methods based on the actual element type
 */
export type InferPluginProps<T, TPlugins extends Plugin[]> = Merge<{
  [K in keyof TPlugins]: PluginReturn<TPlugins[K], T> extends infer Methods extends Record<
    string,
    any
  >
    ? {
        [M in keyof Methods]: Methods[M] extends (value: infer V) => any ? V : never
      }
    : {}
}>
