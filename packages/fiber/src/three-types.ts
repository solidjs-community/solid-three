import { JSX } from 'solid-js/jsx-runtime'
import * as THREE from 'three'
import { AttachType, InstanceProps } from './core'
import { EventHandlers } from './core/events'
import { Args, ConstructorRepresentation, T } from './core/proxy'
import { RootState } from './core/store'
import { Mutable } from './utils/typeHelpers'

export type Root<TStore = RootState, T = {}> = T & { store: TStore }

export type NonFunctionKeys<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
export type Overwrite<T, O> = Omit<T, NonFunctionKeys<O>> & O

export interface MathRepresentation {
  set(...args: number[]): any
}
export interface VectorRepresentation extends MathRepresentation {
  setScalar(s: number): any
}

export type Matrix4 = THREE.Matrix4 | Parameters<THREE.Matrix4['set']> | Readonly<THREE.Matrix4['set']>

/**
 * Turn an implementation of THREE.Vector in to the type that an r3f component would accept as a prop.
 */
export type MathType<T extends MathRepresentation | THREE.Euler> = T extends THREE.Color
  ? ConstructorParameters<typeof THREE.Color> | THREE.ColorRepresentation
  : T extends VectorRepresentation | THREE.Layers | THREE.Euler
  ? T | Parameters<T['set']> | number
  : T | Parameters<T['set']>

export type Vector2 = MathType<THREE.Vector2>
export type Vector3 = MathType<THREE.Vector3>
export type Vector4 = MathType<THREE.Vector4>
export type Color = MathType<THREE.Color>
export type Layers = MathType<THREE.Layers>
export type Quaternion = MathType<THREE.Quaternion>
export type Euler = MathType<THREE.Euler>

export type WithMathProps<P> = { [K in keyof P]: P[K] extends MathRepresentation | THREE.Euler ? MathType<P[K]> : P[K] }

interface RaycastableRepresentation {
  raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void
}
export type EventProps<P> = P extends RaycastableRepresentation ? Partial<EventHandlers> : {}

export interface NodeProps<T> {
  attach?: AttachType
  /** Constructor arguments */
  args?: Args<T>
  children?: JSX.Element
  ref?: ((children: T) => void) | T
  key?: string
  onUpdate?: (self: T) => void
}

export type ElementProps<T extends ConstructorRepresentation, P = InstanceType<T>> = Partial<
  Overwrite<WithMathProps<P>, NodeProps<P> & EventProps<P>>
>

export type ThreeElement<T extends ConstructorRepresentation> = Mutable<
  Overwrite<ElementProps<T>, Omit<InstanceProps<InstanceType<T>, T>, 'object'>>
>

export type ExtendedColors<T> = { [K in keyof T]: T[K] extends THREE.Color | undefined ? Color : T[K] }
export type Node<T> = ExtendedColors<Overwrite<Partial<T>, NodeProps<T>>>

export type Object3DNode<T> = Overwrite<
  Node<T>,
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

export type ThreeProps<TKey extends keyof typeof T> = (typeof T)[TKey] extends (...args: any[]) => any
  ? Parameters<(typeof T)[TKey]>[0]
  : undefined
