import { Accessor, createEffect, onCleanup } from 'solid-js'
import * as THREE from 'three'
import { Falsey } from 'utility-types'

import { useThree, useUpdate } from './hooks'
import { Stages } from './stages'

import type { AttachType, Instance, LocalState } from '../three-types'
import type { Dpr, RootState, Size } from './store'

export type Camera = THREE.OrthographicCamera | THREE.PerspectiveCamera
export const isOrthographicCamera = (def: Camera): def is THREE.OrthographicCamera =>
  def && (def as THREE.OrthographicCamera).isOrthographicCamera

export const DEFAULT = '__default'

export type DiffSet = {
  memoized: { [key: string]: any }
  changes: [key: string, value: unknown, isEvent: boolean, keys: string[]][]
}

export const isDiffSet = (def: any): def is DiffSet => def && !!(def as DiffSet).memoized && !!(def as DiffSet).changes
export type ClassConstructor = { new (): void }

export type ObjectMap = {
  nodes: { [name: string]: THREE.Object3D }
  materials: { [name: string]: THREE.Material }
}

export function calculateDpr(dpr: Dpr) {
  return Array.isArray(dpr) ? Math.min(Math.max(dpr[0], window.devicePixelRatio), dpr[1]) : dpr
}

/**
 * Returns instance root state
 */
export const getRootState = (obj: THREE.Object3D): RootState | undefined => (obj as unknown as Instance).__r3f?.root

export type EquConfig = {
  /** Compare arrays by reference equality a === b (default), or by shallow equality */
  arrays?: 'reference' | 'shallow'
  /** Compare objects by reference equality a === b (default), or by shallow equality */
  objects?: 'reference' | 'shallow'
  /** If true the keys in both a and b must match 1:1 (default), if false a's keys must intersect b's */
  strict?: boolean
}

// A collection of compare functions
export const is = {
  obj: (a: any) => a === Object(a) && !is.arr(a) && typeof a !== 'function',
  fun: (a: any): a is Function => typeof a === 'function',
  str: (a: any): a is string => typeof a === 'string',
  num: (a: any): a is number => typeof a === 'number',
  boo: (a: any): a is boolean => typeof a === 'boolean',
  und: (a: any) => a === void 0,
  arr: (a: any) => Array.isArray(a),
  equ(a: any, b: any, { arrays = 'shallow', objects = 'reference', strict = true }: EquConfig = {}) {
    // Wrong type or one of the two undefined, doesn't match
    if (typeof a !== typeof b || !!a !== !!b) return false
    // Atomic, just compare a against b
    if (is.str(a) || is.num(a)) return a === b
    const isObj = is.obj(a)
    if (isObj && objects === 'reference') return a === b
    const isArr = is.arr(a)
    if (isArr && arrays === 'reference') return a === b
    // Array or Object, shallow compare first to see if it's a match
    if ((isArr || isObj) && a === b) return true
    // Last resort, go through keys
    let i
    for (i in a) if (!(i in b)) return false
    for (i in strict ? b : a) if (a[i] !== b[i]) return false
    if (is.und(i)) {
      if (isArr && a.length === 0 && b.length === 0) return true
      if (isObj && Object.keys(a).length === 0 && Object.keys(b).length === 0) return true
      if (a !== b) return false
    }
    return true
  },
}

// Collects nodes and materials from a THREE.Object3D
export function buildGraph(object: THREE.Object3D) {
  const data: ObjectMap = { nodes: {}, materials: {} }
  if (object) {
    object.traverse((obj: any) => {
      if (obj.name) data.nodes[obj.name] = obj
      if (obj.material && !data.materials[obj.material.name]) data.materials[obj.material.name] = obj.material
    })
  }
  return data
}

// Disposes an object and all its properties
export function dispose<TObj extends { dispose?: () => void; type?: string; [key: string]: any }>(obj: TObj) {
  if (obj.dispose && obj.type !== 'Scene') obj.dispose()
  for (const p in obj) {
    ;(p as any).dispose?.()
    delete obj[p]
  }
}

// Each object in the scene carries a small LocalState descriptor
export function prepare<T = THREE.Object3D>(object: T, state?: Partial<LocalState>) {
  const instance = object as unknown as Instance
  if (state?.primitive || !instance.__r3f) {
    instance.__r3f = {
      type: '',
      root: null as unknown as RootState,
      previousAttach: null,
      memoizedProps: {},
      eventCount: 0,
      handlers: {},
      objects: [],
      parent: null,
      ...state,
    }
  }
  return object
}

function resolve(instance: Instance, key: string) {
  let target = instance
  if (key.includes('-')) {
    const entries = key.split('-')
    const last = entries.pop() as string
    target = entries.reduce((acc, key) => acc[key], instance)
    return { target, key: last }
  } else return { target, key }
}

// Checks if a dash-cased string ends with an integer
const INDEX_REGEX = /-\d+$/

export function attach(parent: Instance, child: Instance, type: AttachType) {
  if (is.str(type)) {
    // If attaching into an array (foo-0), create one
    if (INDEX_REGEX.test(type)) {
      const root = type.replace(INDEX_REGEX, '')
      const { target, key } = resolve(parent, root)
      if (!Array.isArray(target[key])) target[key] = []
    }

    const { target, key } = resolve(parent, type)
    child.__r3f.previousAttach = target[key]
    target[key] = child
  } else child.__r3f.previousAttach = type(parent, child)
}

export function detach(parent: Instance, child: Instance, type: AttachType) {
  if (is.str(type)) {
    const { target, key } = resolve(parent, type)
    const previous = child.__r3f.previousAttach
    // When the previous value was undefined, it means the value was never set to begin with
    if (previous === undefined) delete target[key]
    // Otherwise set the previous value
    else target[key] = previous
  } else child.__r3f?.previousAttach?.(parent, child)
  delete child.__r3f?.previousAttach
}

export function invalidateInstance(instance: Instance) {
  const state = instance.__r3f?.root
  if (state && state.internal.frames === 0) state.invalidate()
}

export function updateInstance(instance: Instance) {
  instance.onUpdate?.(instance)
}

export function updateCamera(camera: Camera & { manual?: boolean }, size: Size) {
  // https://github.com/pmndrs/react-three-fiber/issues/92
  // Do not mess with the camera if it belongs to the user
  if (!camera.manual) {
    if (isOrthographicCamera(camera)) {
      camera.left = size.width / -2
      camera.right = size.width / 2
      camera.top = size.height / 2
      camera.bottom = size.height / -2
    } else {
      camera.aspect = size.width / size.height
    }
    camera.updateProjectionMatrix()
    // https://github.com/pmndrs/react-three-fiber/issues/178
    // Update matrix world since the renderer is a frame late
    camera.updateMatrixWorld()
  }
}

type Helper = THREE.Object3D & {
  update: () => void
}

type Constructor = new (...args: any[]) => any
type Rest<T> = T extends [infer _, ...infer R] ? R : never

export function useHelper<T extends Constructor>(
  object3D: Accessor<Instance | THREE.Object3D | null | undefined> | Falsey | undefined,
  helperConstructor: T,
  // ...args: Rest<ConstructorParameters<T>>
) {
  let helper: Helper
  const store = useThree()

  createEffect(() => {
    if (object3D) {
      if (helperConstructor && object3D()) {
        helper = new (helperConstructor as any)(object3D() /* , ...args */)
        if (helper) {
          store.scene.add(helper)
          onCleanup(() => {
            if (helper) {
              store.scene.remove(helper)
            }
          })
        }
      }
    }

    /**
     * Dispose of the helper if no object 3D is passed
     */
    if (!object3D || (!object3D() && helper)) {
      store.scene.remove(helper!)
    }
  })

  useUpdate(() => {
    if (helper?.update) {
      helper.update()
    }
  }, Stages.Update)

  return () => helper
}
