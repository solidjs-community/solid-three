import * as THREE from 'three'
import { EventHandlers } from './events'
import { RootState } from './store'

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

export type AttachFnType = (parent: Instance, self: Instance) => () => void
export type AttachType = string | AttachFnType

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

export type InstanceProps = {
  [key: string]: unknown
} & {
  args?: any[]
  object?: object
  visible?: boolean
  dispose?: null
  attach?: AttachType
}

interface Catalogue {
  [name: string]: {
    new (...args: any): Instance
  }
}

let catalogue: Catalogue = {}
let extend = (objects: object): void => void (catalogue = { ...catalogue, ...objects })

export { extend }
