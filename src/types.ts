import type { Accessor, JSX, Setter, Component as SolidComponent } from "solid-js"
import type * as THREE from "three"
import type { Portal, Primitive } from "./components.tsx"
import type { $S3C } from "./constants.ts"
import type {
  Constructor,
  ConstructorOverloadParameters,
  InstanceFromConstructor,
  Overwrite,
} from "./type-utils.ts"
import type { Measure } from "./utils/use-measure.ts"

declare global {
  namespace SolidThree {
    interface Components {
      Primitive: typeof Primitive
      Portal: typeof Portal
    }
    interface Elements {}
  }
}

interface ContextElements {
  camera: Instance<CameraType>
  setCamera: (camera: CameraType | Accessor<CameraType>) => () => void
  gl: Instance<THREE.WebGLRenderer>
  setGl: (gl: THREE.WebGLRenderer | Accessor<THREE.WebGLRenderer>) => () => void
  raycaster: Instance<THREE.Raycaster>
  setRaycaster: (raycaster: THREE.Raycaster | Accessor<THREE.Raycaster>) => () => void
  scene: Instance<THREE.Scene>
  setScene: (scene: THREE.Scene | Accessor<THREE.Scene>) => () => void
}

/** `solid-three` context. Accessible via `useThree`. */
export interface Context extends ContextElements {
  clock: THREE.Clock
  canvas: HTMLCanvasElement
  render: (delta: number) => void
  requestRender: () => void
  pointer: THREE.Vector2
  setPointer: Setter<THREE.Vector2>
  xr: {
    connect: () => void
    disconnect: () => void
  }
  bounds: Measure
  dpr: number
}

/** Possible camera types. */
export type CameraType = THREE.PerspectiveCamera | THREE.OrthographicCamera

/**********************************************************************************/
/*                                                                                */
/*                                      Event                                     */
/*                                                                                */
/**********************************************************************************/

/** Generic `solid-three` event. */
export type ThreeEvent<TEvent = Event, TStoppable = true> = TStoppable extends true
  ? {
      nativeEvent: TEvent
      stopped: boolean
      stopPropagation: () => void
    }
  : {
      nativeEvent: TEvent
    }

/** Event handlers for various `solid-three` events. */
export interface EventHandlers {
  onClick(event: ThreeEvent<MouseEvent>): void
  onClickMissed(event: ThreeEvent<MouseEvent, false>): void
  onDoubleClick(event: ThreeEvent<MouseEvent>): void
  onDoubleClickMissed(event: ThreeEvent<MouseEvent, false>): void
  onContextMenu(event: ThreeEvent<MouseEvent>): void
  onContextMenuMissed(event: ThreeEvent<MouseEvent, false>): void
  onMouseDown(event: ThreeEvent<MouseEvent>): void
  onMouseEnter(event: ThreeEvent<MouseEvent, false>): void
  onMouseLeave(event: ThreeEvent<MouseEvent, false>): void
  onMouseMove(event: ThreeEvent<MouseEvent>): void
  onMouseUp(event: ThreeEvent<MouseEvent>): void
  onPointerUp(event: ThreeEvent<MouseEvent>): void
  onPointerDown(event: ThreeEvent<MouseEvent>): void
  onPointerMove(event: ThreeEvent<MouseEvent>): void
  onPointerEnter(event: ThreeEvent<MouseEvent, false>): void
  onPointerLeave(event: ThreeEvent<MouseEvent, false>): void
  onWheel(event: ThreeEvent<WheelEvent>): void
}

/** The names of all `SolidThreeEventHandlers` */
export type EventName = keyof EventHandlers

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
type Representation<T> = T extends THREE.Color
  ? ConstructorParameters<typeof THREE.Color> | THREE.ColorRepresentation
  : T extends ThreeVectorRepresentation | THREE.Layers | THREE.Euler
  ? T | Parameters<T["set"]> | number
  : T extends ThreeMathRepresentation
  ? T | Parameters<T["set"]>
  : T

export type Vector2 = Representation<THREE.Vector2>
export type Vector3 = Representation<THREE.Vector3>
export type Vector4 = Representation<THREE.Vector4>
export type Color = Representation<THREE.Color>
export type Layers = Representation<THREE.Layers>
export type Quaternion = Representation<THREE.Quaternion>
export type Euler = Representation<THREE.Euler>
export type Matrix3 = Representation<THREE.Matrix3>
export type Matrix4 = Representation<THREE.Matrix4>

/**********************************************************************************/
/*                                                                                */
/*                                  Three To JSX                                  */
/*                                                                                */
/**********************************************************************************/

type ExtractConstructors<T> = T extends Constructor ? T : never
/** All constructors within the `THREE` namespace */
type ThreeConstructors = ExtractConstructors<(typeof THREE)[keyof typeof THREE]>

/** Generic instance of a given `Constructor`. */
export type ThreeInstance = InstanceFromConstructor<ThreeConstructors>

/** Instance of a given constructor augmented with `S3Metadata`. Defaults to `ThreeConstructor`*/
export type Instance<T = ThreeConstructors> = InstanceFromConstructor<T> & {
  [$S3C]: Metadata<T>
}

/** Metadata of a `solid-three` instance. */
export type Metadata<T> = {
  props?: ClassProps<InstanceFromConstructor<T>>
  children: Set<Instance>
}

/** Generic `solid-three` component. */
export type Component<T> = SolidComponent<ClassProps<T>>

/** Maps properties of given type to their `solid-three` representations. */
type MapToRepresentation<T> = {
  [TKey in keyof T]: Representation<T[TKey]>
}

/** Generic `solid-three` props of a given class. */
export type ClassProps<T> = Partial<
  Overwrite<
    MapToRepresentation<InstanceFromConstructor<T>>,
    {
      args: T extends Constructor ? ConstructorOverloadParameters<T> : unknown
      attach:
        | string
        | ((
            parent: Instance<THREE.Object3D>,
            self: Instance<InstanceFromConstructor<T>>,
          ) => () => void)
      children?: JSX.Element
      onUpdate: (self: Instance<InstanceFromConstructor<T>>) => void
    } & EventHandlers
  >
>

/** Generic `solid-three` props of a given type. */
export type Props<T extends keyof typeof THREE | keyof SolidThree.Elements> =
  T extends keyof typeof THREE
    ? ClassProps<(typeof THREE)[T]>
    : T extends keyof SolidThree.Elements
    ? ClassProps<SolidThree.Elements[T]>
    : never
