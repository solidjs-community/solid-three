import type { Accessor, JSX } from "solid-js"
import type {
  Clock,
  ColorRepresentation,
  Intersection,
  Loader,
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
export type PromiseMaybe<T> = T | Promise<T>

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

export type LoaderData<T extends Loader<object, any>> =
  T extends Loader<infer TData, any> ? TData : never

export type LoaderUrl<T extends Loader<object, any>> =
  T extends Loader<object, infer TUrl> ? TUrl : never

/**********************************************************************************/
/*                                                s                                */
/*                                     Context                                    */
/*                                                                                */
/**********************************************************************************/

export interface Context {
  bounds: Measure
  canvas: HTMLCanvasElement
  clock: Clock
  camera: CameraKind
  raycaster: Raycaster | EventRaycaster
  dpr: number
  gl: Meta<WebGLRenderer>
  props: CanvasProps
  render: (delta: number) => void
  requestRender: () => void
  scene: Meta<Scene>
  setCamera(camera: CameraKind): () => void
  setRaycaster(camera: Raycaster): () => void
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
  onMouseDown: Prettify<ThreeEvent<MouseEvent>>
  onMouseEnter: Prettify<ThreeEvent<MouseEvent, { stoppable: false }>>
  onMouseLeave: Prettify<ThreeEvent<MouseEvent, { stoppable: false }>>
  onMouseMove: Prettify<ThreeEvent<MouseEvent>>
  onMouseUp: Prettify<ThreeEvent<MouseEvent>>
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
  props: Props<InstanceOf<T>>
  parent: any
  children: Set<Meta<any>>
}

/** Maps properties of given type to their `solid-three` representations. */
export type MapToRepresentation<T> = {
  [TKey in keyof T]: Representation<T[TKey]>
}

/** Generic `solid-three` props of a given class. */
export type Props<T> = Partial<
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
