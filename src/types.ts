import type { Accessor, JSX, Owner } from "solid-js"
import type {
  Clock,
  ColorRepresentation,
  Intersection,
  Loader,
  Object3D,
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
import type { WebGPURenderer } from "three/webgpu"
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
export type PromiseMaybe<T> = T | Promise<T>

/**
 * A ref that is a value sink, a callback, or a callback returning a cleanup
 * (the React-19 cleanup-callback-ref shape). The cleanup runs when the ref's
 * reactive owner disposes or the ref value changes.
 */
export type RefWithCleanup<T> = T | ((value: T) => void | (() => void))

export type ClassInstance<T extends object> = T & { constructor: Function }

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

/** Intersect a tuple of types: `Intersect<[A, B, C]>` → `A & B & C`. */
export type Intersect<T extends any[]> = T extends [infer U, ...infer Rest]
  ? Rest["length"] extends 0
    ? U
    : U & Intersect<Rest>
  : T

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

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

export type LoaderData<T extends Loader<any, any>> =
  T extends Loader<infer TData, any> ? TData : never

export type LoaderUrl<T extends Loader<any, any>> = T extends Loader<any, infer TUrl> ? TUrl : never

/**********************************************************************************/
/*                                                                                */
/*                                  RendererLike                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Minimal structural interface for renderers (`SVGRenderer`, `CSS2DRenderer`,
 * user-built). Concrete three renderers (`WebGLRenderer`, `WebGPURenderer`)
 * structurally satisfy this too, but the {@link Renderer} union prefers their
 * exact types so the WebGL-specific `WebXRManager` / `WebGLShadowMap` surface
 * is reachable in user code.
 */
export interface RendererLike {
  render(scene: any, camera: any): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  /**
   * Element the renderer outputs to — a `<canvas>` for WebGL/WebGPU, a
   * `<div>` for CSS2D/3D, an `<svg>` for SVGRenderer. This is the natural
   * target for pointer-event capture (orbit controls, picking).
   */
  domElement: Element
  /** Optional — DOM-based renderers (CSS2D/3D, SVG) have no pixel-ratio knob. */
  setPixelRatio?(value: number): void
  /** Optional — DOM-based renderers (CSS2D/3D, SVG) have no pixel-ratio knob. */
  getPixelRatio?(): number
  /**
   * Optional vendor XR manager. Typed as the union of three's two concrete
   * managers (WebXR + WebGPU XR). solid-three's built-in xr wiring duck-types
   * to `WebXRManager` at runtime; custom renderers may leave this `undefined`.
   */
  xr?: WebGLRenderer["xr"] | WebGPURenderer["xr"]
  /** Optional shadow map (WebGL/WebGPU vary). */
  shadowMap?: WebGLRenderer["shadowMap"] | WebGPURenderer["shadowMap"]
  /** Async initializer — awaited once before the first render (WebGPURenderer). */
  init?(): Promise<void>
  /** Returns true if `init()` has already completed. WebGPURenderer exposes this. */
  hasInitialized?(): boolean
}

/**
 * Anything `<Canvas>` accepts as a renderer: a concrete three renderer (gets
 * full three typing for `xr` / `shadowMap` etc.) or a custom `RendererLike`.
 * Inspired by r3f's `Renderer` interface in store.ts, extended with the two
 * concrete classes so the common cases keep exact types.
 */
export type Renderer = WebGLRenderer | WebGPURenderer | RendererLike

/**
 * Module-augmentation point. Defaults to `WebGLRenderer` — the common case.
 * Declare a different concrete renderer in a project-local `.d.ts` to swap or
 * widen it; `useThree().gl`, `Context.gl`, and the `<Canvas gl>` prop all
 * narrow/widen project-wide.
 *
 * @example
 * ```ts
 * // src/solid-three.d.ts — switching to WebGPU
 * import type { WebGPURenderer } from "three/webgpu"
 *
 * declare module "solid-three" {
 *   interface Register {
 *     renderer: WebGPURenderer
 *   }
 * }
 * ```
 *
 * With this declaration, `useThree().gl.init()` is typed (no narrowing
 * needed) and accidentally passing a `WebGLRenderer` to `<Canvas gl>`
 * becomes a type error.
 *
 * To widen back to the open {@link Renderer} union (e.g. for a library that
 * needs to support any renderer), declare `renderer: Renderer`.
 *
 * Without augmentation, the default is `WebGLRenderer`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Register {}

/** Effective renderer type — narrowed by user augmentation, defaults to `WebGLRenderer`. */
export type ResolvedRenderer = Register extends { renderer: infer R } ? R : WebGLRenderer

/**********************************************************************************/
/*                                                                                */
/*                                     Context                                    */
/*                                                                                */
/**********************************************************************************/

/**********************************************************************************/
/*                                     Plugin                                     */
/**********************************************************************************/

// Intersect a union of method-prop objects into one object. UnionToIntersection
// (rather than a recursive tuple merge) is deliberate: TS can evaluate it *during*
// JSX generic inference, so `<Entity plugins={[…]} contributedProp={…}/>` infers
// `TPlugins` from the prop. A recursive merge over the plugin tuple is too heavy to
// evaluate at inference time and silently defaults the type-param (investigated
// empirically — see docs/superpowers/notes). The plugin-tuple constraints are
// `readonly` because a `const`-inferred JSX array is a readonly tuple.
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never

/**
 * A composable extension: a function `(element) => methods`. A contributed
 * method's first-param type becomes the element's prop type (see {@link PluginPropsOf}).
 * Created via {@link PluginFn} (`plugin()`); a non-matching element yields `undefined`.
 */
export type Plugin<TFn = (element: any) => any> = TFn

/** The three `plugin()` creation forms: global, class-filtered, type-guard. */
export interface PluginFn {
  <const Methods extends Record<string, any>>(
    methods: (element: any) => Methods,
  ): Plugin<(element: any) => Methods>
  <const T extends readonly Constructor[], const Methods extends Record<string, any>>(
    Constructors: T,
    methods: (element: T extends readonly Constructor<infer U>[] ? U : never) => Methods,
  ): Plugin<(element: T extends readonly Constructor<infer U>[] ? U : never) => Methods>
  <const T, const Methods extends Record<string, any>>(
    condition: (element: unknown) => element is T,
    methods: (element: T) => Methods,
  ): Plugin<(element: T) => Methods>
}

type PluginReturn<TKind, TPlugin> =
  TPlugin extends Plugin<infer TFn>
    ? TFn extends { (element: infer TElement): infer TReturnType }
      ? TKind extends TElement
        ? TReturnType
        : {}
      : {}
    : {}

/**
 * An element's full prop type: its base {@link BaseProps} plus the props contributed by
 * `TPlugins` for this element class. `PluginPropsOf` is intersected DIRECTLY (a plain
 * top-level intersection, not nested in `Props`'s `Overwrite`) so `TPlugins` stays
 * inferable at the JSX/usage site — see the inference notes. Used by `createT`'s
 * element proxy and `<Entity>`.
 */
export type Props<T, TPlugins extends readonly Plugin[]> = BaseProps<T> &
  Partial<PluginPropsOf<InstanceOf<T>, TPlugins>>

/** Resolves the contributed props for element type `TKind` across `TPlugins`. */
export type PluginPropsOf<TKind, TPlugins extends readonly Plugin[]> = UnionToIntersection<
  {
    [K in keyof TPlugins]: PluginReturn<TKind, TPlugins[K]> extends infer Methods extends Record<
      string,
      any
    >
      ? { [M in keyof Methods]: Methods[M] extends (value: infer V) => any ? V : never }
      : {}
  }[number]
>

export interface Context {
  bounds: Measure
  /** The Canvas's reactive owner — plugin setup runs under it (see Plugin). */
  owner: Owner | null
  /** Plugins whose `setup` has already run in this context (lazy-trigger dedup). */
  initializedPlugins: Set<Plugin>
  canvas: HTMLCanvasElement
  clock: Clock
  camera: CameraKind
  /** Objects carrying any pointer handler; raycast by the pointer system. */
  eventRegistry: Object3D[]
  raycaster: Raycaster | EventRaycaster
  dpr: number
  gl: Meta<ResolvedRenderer>
  props: CanvasProps
  render: (timestamp: number, frame?: XRFrame) => void
  requestRender: () => void
  scene: Meta<Scene>
  setCamera(camera: CameraKind): () => void
  setRaycaster(camera: Raycaster): () => void
  viewport: Viewport
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

export type ThreeEvent<
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
  onClick: Prettify<ThreeEvent<MouseEvent>>
  onClickMissed: Prettify<ThreeEvent<MouseEvent, { stoppable: false; intersections: false }>>
  onDoubleClick: Prettify<ThreeEvent<MouseEvent>>
  onDoubleClickMissed: Prettify<ThreeEvent<MouseEvent, { stoppable: false; intersections: false }>>
  onContextMenu: Prettify<ThreeEvent<MouseEvent>>
  onContextMenuMissed: Prettify<ThreeEvent<MouseEvent, { stoppable: false; intersections: false }>>
  onPointerUp: Prettify<ThreeEvent<PointerEvent>>
  onPointerDown: Prettify<ThreeEvent<PointerEvent>>
  onPointerMove: Prettify<ThreeEvent<PointerEvent>>
  onPointerEnter: Prettify<ThreeEvent<PointerEvent, { stoppable: false }>>
  onPointerLeave: Prettify<ThreeEvent<PointerEvent, { stoppable: false }>>
  onWheel: Prettify<ThreeEvent<WheelEvent>>
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
/*                           Solid Three Representation                           */
/*                                                                                */
/**********************************************************************************/

interface ThreeMathRepresentation {
  set(...args: number[]): any
}
interface ThreeVectorRepresentation extends ThreeMathRepresentation {
  setScalar(s: number): any
}

/** Map given type to `solid-three` representation. */
export type Representation<T> = T extends ThreeColor
  ? ConstructorParameters<typeof ThreeColor> | ColorRepresentation
  : T extends ThreeVectorRepresentation | ThreeLayers | ThreeEuler
    ? T | Parameters<T["set"]> | number
    : T extends ThreeMathRepresentation
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
/*                                  Three To JSX                                  */
/*                                                                                */
/**********************************************************************************/

export type Meta<T = unknown> = T & {
  [$S3C]: Data<T>
}

/** Metadata of a `solid-three` instance. */
export type Data<T> = {
  props: BaseProps<InstanceOf<T>>
  parent: any
  children: Set<Meta<any>>
}

/** Maps properties of given type to their `solid-three` representations. */
export type MapToRepresentation<T> = {
  [TKey in keyof T]: Representation<T[TKey]>
}

/**
 * Generic `solid-three` props of a given class. Plugin-contributed props are NOT
 * baked in here — they're intersected directly at the composition sites (`createT`
 * proxy + `<Entity>`) via {@link PluginPropsOf}, which keeps `TPlugins` inferable at
 * those sites (burying it in this `Overwrite` defeats inference — see notes).
 */
export type BaseProps<T> = Partial<
  Overwrite<
    [
      MapToRepresentation<InstanceOf<T>>,
      EventHandlers,
      {
        args: T extends Constructor ? ConstructorOverloadParameters<T> : undefined
        attach: string | ((parent: object, self: Meta<InstanceOf<T>>) => () => void)
        children: JSX.Element
        key?: string
        onUpdate: (self: Meta<InstanceOf<T>>) => void
        ref: InstanceOf<T> | ((value: Meta<InstanceOf<T>>) => void)
        /**
         * Prevents the Object3D from being cast by the ray.
         * Object3D can still receive events via propagation from its descendants.
         */
        raycastable: boolean
      },
    ]
  >
>
