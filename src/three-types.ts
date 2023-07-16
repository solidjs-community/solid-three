import { JSX } from 'solid-js/jsx-runtime'
import * as THREE from 'three'
import { Mutable } from 'utility-types'
import { RootState } from './core'
import { EventHandlers } from './core/events'

type ConstructorRepresentation = new (...args: any[]) => any

export type Root<TStore = RootState, T = {}> = T & { store: TStore }

export type LocalState = {
  type: string
  root: RootState
  // objects and parent are used when children are added with `attach` instead of being added to the Object3D scene graph
  objects: Instance[]
  parent: Instance | null
  primitive?: boolean
  eventCount: number
  handlers: Partial<EventHandlers>
  attach?: AttachType
  previousAttach: any
  memoizedProps: { [key: string]: any }
}

// This type clamps down on a couple of assumptions that we can make regarding native types, which
// could anything from scene objects, THREE.Objects, JSM, user-defined classes and non-scene objects.
// What they all need to have in common is defined here ...
export type BaseInstance = Omit<THREE.Object3D, 'children' | 'attach' | 'add' | 'remove' | 'raycast'> & {
  __r3f: LocalState
  children: Instance[]
  remove: (...object: Instance[]) => Instance
  add: (...object: Instance[]) => Instance
  raycast?: (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => void
}
export type Instance = BaseInstance & { [key: string]: any }

export interface InstanceProps<T = any, P = any> {
  args?: Args<P>
  object?: T
  visible?: boolean
  dispose?: null
  attach?: AttachType<T>
}

export interface Catalogue {
  [name: string]: {
    new (...args: any): Instance
  }
}

export type NonFunctionKeys<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T]
export type Overwrite<T, O> = Omit<T, NonFunctionKeys<O>> & O

export type AttachFnType<O = any> = (parent: any, self: O) => () => void
export type AttachType<O = any> = string | AttachFnType<O>

/**
 * If **T** contains a constructor, @see ConstructorParameters must be used, otherwise **T**.
 */
type Args<T> = T extends new (...args: any) => any ? ConstructorParameters<T> : T

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

type WithMathProps<P> = { [K in keyof P]: P[K] extends MathRepresentation | THREE.Euler ? MathType<P[K]> : P[K] }

interface RaycastableRepresentation {
  raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void
}
type EventProps<P> = P extends RaycastableRepresentation ? Partial<EventHandlers> : {}

export interface NodeProps<T> {
  attach?: AttachType
  /** Constructor arguments */
  args?: Args<T>
  children?: JSX.Element
  ref?: (() => T) | T
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
