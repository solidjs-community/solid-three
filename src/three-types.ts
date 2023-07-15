import * as THREE from 'three'
import { EventHandlers } from './core/events'
import { AttachType } from './core/renderer'

export type NonFunctionKeys<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
export type Overwrite<T, O> = Omit<T, NonFunctionKeys<O>> & O

/**
 * If **T** contains a constructor, @see ConstructorParameters must be used, otherwise **T**.
 */
type Args<T> = T extends new (...args: any) => any ? ConstructorParameters<T> : T

export type Euler = THREE.Euler | Parameters<THREE.Euler['set']>
export type Matrix4 = THREE.Matrix4 | Parameters<THREE.Matrix4['set']> | Readonly<THREE.Matrix4['set']>

/**
 * Turn an implementation of THREE.Vector in to the type that an r3f component would accept as a prop.
 */
type VectorLike<VectorClass extends THREE.Vector> =
  | VectorClass
  | Parameters<VectorClass['set']>
  | Readonly<Parameters<VectorClass['set']>>
  | Parameters<VectorClass['setScalar']>[0]

export type Vector2 = VectorLike<THREE.Vector2>
export type Vector3 = VectorLike<THREE.Vector3>
export type Vector4 = VectorLike<THREE.Vector4>
export type Color = ConstructorParameters<typeof THREE.Color> | THREE.Color | number | string // Parameters<T> will not work here because of multiple function signatures in three.js types
export type ColorArray = typeof THREE.Color | Parameters<THREE.Color['set']>
export type Layers = THREE.Layers | Parameters<THREE.Layers['set']>[0]
export type Quaternion = THREE.Quaternion | Parameters<THREE.Quaternion['set']>

export type AttachCallback = string | ((child: any, parentInstance: any) => void)

export interface NodeProps<T, P> {
  attach?: AttachType
  /** Constructor arguments */
  args?: Args<P>
  children?: React.ReactNode
  ref?: React.Ref<T>
  key?: React.Key
  onUpdate?: (self: T) => void
}

export type ExtendedColors<T> = { [K in keyof T]: T[K] extends THREE.Color | undefined ? Color : T[K] }
export type Node<T, P> = ExtendedColors<Overwrite<Partial<T>, NodeProps<T, P>>>

export type Object3DNode<T, P> = Overwrite<
  Node<T, P>,
  {
    position?: Vector3
    up?: Vector3
    scale?: Vector3
    rotation?: Euler
    matrix?: Matrix4
    quaternion?: Quaternion
    layers?: Layers
    dispose?: (() => void) | null
  }
> &
  EventHandlers