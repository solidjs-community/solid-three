import type { Accessor, JSX, Ref } from "solid-js"
import type {
  Clock,
  ColorRepresentation,
  Intersection,
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
import type { Intersect } from "../playground/controls/type-utils.ts"
import type { CanvasProps } from "./canvas.tsx"
import type { $S3C } from "./constants.ts"
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
  props: Props<InstanceOf<T>>
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
  registerPlugin(plugin: Plugin): (element: any) => void
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

/** Possible camera types. */
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
/*                                      Event                                     */
/*                                                                                */
/**********************************************************************************/

export type When<T, U> = T extends false ? (T extends true ? U : unknown) : U

export type Event<
  TEvent,
  TConfig extends { stoppable?: boolean; intersections?: boolean } = {
    stoppable: true
    intersections: true
  },
> = Intersect<
  [
    { nativeEvent: TEvent },
    When<
      TConfig["stoppable"],
      {
        stopped: boolean
        stopPropagation: () => void
      }
    >,
    When<
      TConfig["intersections"],
      {
        currentIntersection: Intersection
        intersection: Intersection
        intersections: Intersection[]
      }
    >,
  ]
>

type EventHandlersMap = {
  onClick: Prettify<Event<MouseEvent>>
  onClickMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onDoubleClick: Prettify<Event<MouseEvent>>
  onDoubleClickMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onContextMenu: Prettify<Event<MouseEvent>>
  onContextMenuMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onMouseDown: Prettify<Event<MouseEvent>>
  onMouseEnter: Prettify<Event<MouseEvent, { stoppable: false }>>
  onMouseLeave: Prettify<Event<MouseEvent, { stoppable: false }>>
  onMouseMove: Prettify<Event<MouseEvent>>
  onMouseUp: Prettify<Event<MouseEvent>>
  onPointerUp: Prettify<Event<PointerEvent>>
  onPointerDown: Prettify<Event<PointerEvent>>
  onPointerMove: Prettify<Event<PointerEvent>>
  onPointerEnter: Prettify<Event<PointerEvent, { stoppable: false }>>
  onPointerLeave: Prettify<Event<PointerEvent, { stoppable: false }>>
  onWheel: Prettify<Event<WheelEvent>>
}

export type EventHandlers = {
  [TKey in keyof EventHandlersMap]: (event: EventHandlersMap[TKey]) => void
}

export type CanvasEventHandlers = {
  [TKey in keyof EventHandlersMap]: (
    event: Prettify<Omit<EventHandlersMap[TKey], "currentIntersection">>,
  ) => void
}

/** The names of all `EventHandlers` */
export type EventName = keyof EventHandlersMap

/**********************************************************************************/
/*                                                                                */
/*                                  Representations                               */
/*                                                                                */
/**********************************************************************************/

/** Maps properties of given type to their `solid-three` representations. */
type MapToRepresentation<T> = {
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
        ref: Ref<Meta<InstanceOf<T>>>
        /**
         * Prevents the Object3D from being cast by the ray.
         * Object3D can still receive events via propagation from its descendants.
         */
        raycastable: boolean
        plugins: TPlugins
      },
      TPlugins extends Plugin[] ? PluginPropsOf<InstanceOf<T>, TPlugins> : {},
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

export interface PluginFn {
  // No setup - direct usage with one argument (global)
  <Methods extends Record<string, any>>(methods: (element: any) => Methods): Plugin<
    (element: any) => Methods
  >

  // No setup - direct usage with two arguments (array of constructors)
  <T extends readonly Constructor[], Methods extends Record<string, any>>(
    Constructors: T,
    methods: (element: T extends readonly Constructor<infer U>[] ? U : never) => Methods,
  ): Plugin<{
    (element: T extends readonly Constructor<infer U>[] ? U : never): Methods
    (element: any): {}
  }>

  // No setup - direct usage with two arguments (type guard)
  <T, Methods extends Record<string, any>>(
    condition: (element: unknown) => element is T,
    methods: (element: T) => Methods,
  ): Plugin<{
    (element: T): Methods
    (element: any): {}
  }>

  // Setup function
  setup<TSetupContext extends object>(
    setupFn: (context: Context) => TSetupContext,
  ): {
    then: {
      // With setup - one argument (global)
      <Methods extends Record<string, any>>(
        methods: (element: any, context: TSetupContext) => Methods,
      ): Plugin<(element: any) => Methods>

      // With setup - two arguments (array of constructors)
      <T extends readonly Constructor[], Methods extends Record<string, any>>(
        Constructors: T,
        methods: (
          element: T extends readonly Constructor<infer U>[] ? U : never,
          context: TSetupContext,
        ) => Methods,
      ): Plugin<{
        (element: T extends readonly Constructor<infer U>[] ? U : never): Methods
        (element: any): {}
      }>

      // With setup - two arguments (type guard)
      <T, Methods extends Record<string, any>>(
        condition: (element: unknown) => element is T,
        methods: (element: T, context: TSetupContext) => Methods,
      ): Plugin<{
        (element: T): Methods
        (element: any): {}
      }>
    }
  }
}

export type InferPluginProps<TPlugins extends Plugin[]> = Merge<{
  [TKey in keyof TPlugins]: TPlugins[TKey] extends () => (element: any) => infer U
    ? { [TKey in keyof U]: U[TKey] extends (callback: infer V) => any ? V : never }
    : never
}>

/**
 * Helper type to resolve overloaded function returns
 * Matches overloads from most specific to least specific
 */
type ResolvePluginReturn<TFn, TTarget> = TFn extends {
  (element: infer P1): infer R1
  (element: infer P2): infer R2
  (element: infer P3): infer R3
  (element: infer P4): infer R4
  (element: infer P5): infer R5
}
  ? TTarget extends P1
    ? R1
    : TTarget extends P2
    ? R2
    : TTarget extends P3
    ? R3
    : TTarget extends P4
    ? R4
    : TTarget extends P5
    ? R5
    : never
  : TFn extends {
      (element: infer P1): infer R1
      (element: infer P2): infer R2
      (element: infer P3): infer R3
      (element: infer P4): infer R4
    }
  ? TTarget extends P1
    ? R1
    : TTarget extends P2
    ? R2
    : TTarget extends P3
    ? R3
    : TTarget extends P4
    ? R4
    : never
  : TFn extends {
      (element: infer P1): infer R1
      (element: infer P2): infer R2
      (element: infer P3): infer R3
    }
  ? TTarget extends P1
    ? R1
    : TTarget extends P2
    ? R2
    : TTarget extends P3
    ? R3
    : never
  : TFn extends { (element: infer P1): infer R1; (element: infer P2): infer R2 }
  ? TTarget extends P1
    ? R1
    : TTarget extends P2
    ? R2
    : never
  : TFn extends { (element: infer P): infer R }
  ? TTarget extends P
    ? R
    : never
  : never

/**
 * Resolves what a plugin returns for a specific element type T
 * Handles both simple functions and overloaded functions
 */
type PluginReturn<TPlugin, TKind> = TPlugin extends Plugin<infer TFn>
  ? TFn extends (...args: any[]) => any
    ? ResolvePluginReturn<TFn, TKind> extends infer TResult
      ? TResult extends never
        ? TFn extends (element: TKind) => infer R
          ? R
          : TFn extends (element: any) => infer R
          ? R
          : {}
        : TResult
      : {}
    : {}
  : {}

/**
 * Resolves plugin props for a specific element type T
 * This allows plugins to provide conditional methods based on the actual element type
 */
export type PluginPropsOf<T, TPlugins extends Plugin[]> = Merge<{
  [K in keyof TPlugins]: PluginReturn<TPlugins[K], T> extends infer Methods
    ? Methods extends Record<string, any>
      ? {
          [M in keyof Methods]: Methods[M] extends (value: infer V) => any ? V : never
        }
      : {}
    : {}
}>
