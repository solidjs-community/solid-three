import { Accessor, createEffect, createRenderEffect, mapArray, onCleanup, untrack } from 'solid-js'
import * as THREE from 'three'
import { Falsey } from 'utility-types'

import { useThree, useUpdate } from './hooks'
import { Stages } from './stages'
import { catalogue } from './proxy'

import type { AttachType, Instance, LocalState } from './proxy'
import type { Dpr, Renderer, RootState, Size } from './store'
import { produce } from 'solid-js/store'

/**
 * Returns `true` with correct TS type inference if an object has a configurable color space (since r152).
 */
export const hasColorSpace = <
  T extends Renderer | THREE.Texture | object,
  P = T extends Renderer ? { outputColorSpace: string } : { colorSpace: string },
>(
  object: T,
): object is T & P => 'colorSpace' in object || 'outputColorSpace' in object

export type ColorManagementRepresentation = { enabled: boolean | never } | { legacyMode: boolean | never }

/**
 * The current THREE.ColorManagement instance, if present.
 */
export const getColorManagement = (): ColorManagementRepresentation | null => (catalogue as any).ColorManagement ?? null

export type NonFunctionKeys<P> = { [K in keyof P]-?: P[K] extends Function ? never : K }[keyof P]
export type Overwrite<P, O> = Omit<P, NonFunctionKeys<O>> & O
export type Properties<T> = Pick<T, NonFunctionKeys<T>>

export type Camera = (THREE.OrthographicCamera | THREE.PerspectiveCamera) & { manual?: boolean }
export const isOrthographicCamera = (def: Camera): def is THREE.OrthographicCamera =>
  def && (def as THREE.OrthographicCamera).isOrthographicCamera

/**
 * An SSR-friendly useLayoutEffect.
 *
 * React currently throws a warning when using useLayoutEffect on the server.
 * To get around it, we can conditionally useEffect on the server (no-op) and
 * useLayoutEffect elsewhere.
 *
 * @see https://github.com/facebook/react/issues/14927
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && (window.document?.createElement || window.navigator?.product === 'ReactNative')
    ? createRenderEffect
    : createEffect

export interface ObjectMap {
  nodes: { [name: string]: THREE.Object3D }
  materials: { [name: string]: THREE.Material }
}

export function calculateDpr(dpr: Dpr): number {
  // Err on the side of progress by assuming 2x dpr if we can't detect it
  // This will happen in workers where window is defined but dpr isn't.
  const target = typeof window !== 'undefined' ? window.devicePixelRatio ?? 2 : 1
  return Array.isArray(dpr) ? Math.min(Math.max(dpr[0], target), dpr[1]) : dpr
}

/**
 * Returns instance root state
 */
export const getRootState = (obj: THREE.Object3D): RootState | undefined => (obj as unknown as Instance).__r3f?.root

export interface EquConfig {
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
    // Check if a has all the keys of b
    for (i in a) if (!(i in b)) return false
    // Check if values between keys match
    if (isObj && arrays === 'shallow' && objects === 'shallow') {
      for (i in strict ? b : a) if (!is.equ(a[i], b[i], { strict, objects: 'reference' })) return false
    } else {
      for (i in strict ? b : a) if (a[i] !== b[i]) return false
    }
    // If i is undefined
    if (is.und(i)) {
      // If both arrays are empty we consider them equal
      if (isArr && a.length === 0 && b.length === 0) return true
      // If both objects are empty we consider them equal
      if (isObj && Object.keys(a).length === 0 && Object.keys(b).length === 0) return true
      // Otherwise match them by value
      if (a !== b) return false
    }
    return true
  },
}

// Collects nodes and materials from a THREE.Object3D
export function buildGraph(object: THREE.Object3D): ObjectMap {
  const data: ObjectMap = { nodes: {}, materials: {} }
  if (object) {
    object.traverse((obj: any) => {
      if (obj.name) data.nodes[obj.name] = obj
      if (obj.material && !data.materials[obj.material.name]) data.materials[obj.material.name] = obj.material
    })
  }
  return data
}

export interface Disposable {
  type?: string
  dispose?: () => void
}

// Disposes an object and all its properties
export function dispose<T extends Disposable>(obj: T): void {
  if (obj.type !== 'Scene') obj.dispose?.()
  for (const p in obj) {
    const prop = obj[p] as Disposable | undefined
    if (prop?.type !== 'Scene') prop?.dispose?.()
  }
}

export const INTERNAL_PROPS = ['children', 'ref']

// Gets only instance props from reconciler fibers
export function getInstanceProps<T = any>(queue: any): Instance['props'] {
  const props: Instance['props'] = {}

  for (const key in queue) {
    if (!INTERNAL_PROPS.includes(key)) props[key] = queue[key]
  }

  return props
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

export const RESERVED_PROPS = [
  ...INTERNAL_PROPS,
  // Instance props
  'args',
  'dispose',
  'attach',
  'object',
  // Behavior flags
  'dispose',
]

export const DEFAULTS = new Map()

export const applyProp = (object: Instance, props: { [key: string]: any }, key: string) => {
  const rootState = getRootState(object as any as THREE.Object3D)
  /* If the key contains a hyphen, we're setting a sub property. */
  if (key.indexOf('-') > -1) {
    const [property, ...rest] = key.split('-')
    applyProps(object[property], { [rest.join('-')]: props[key] })
    return
  }

  /* If the property exposes a `setScalar` function, we'll use that */
  if (object[key]?.setScalar && typeof props[key] === 'number') {
    object[key].setScalar(props[key])
    return
  }

  /* If the property exposes a `copy` function and the value is of the same type,
     we'll use that. (Vectors, Eulers, Quaternions, ...) */
  if (object[key]?.copy && object[key].constructor === props[key]?.constructor) {
    object[key].copy(props[key])
    return
  }

  /* If the property exposes a `set` function, we'll use that. */
  if (object[key]?.set) {
    Array.isArray(props[key]) ? object[key].set(...props[key]) : object[key].set(props[key])
    return
  }

  /* If we got here, we couldn't do anything special, so let's just check if the
     target property exists and assign it directly. */
  if (key in object) {
    object[key] = props[key]
  }

  if (!rootState) return

  /* If prop is an event-handler */
  if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key)) {
    object.__r3f.handlers[key] = props[key]
    object.__r3f.eventCount = Object.keys(object.__r3f.handlers).length

    if (rootState.internal && object.raycast) {
      const index = untrack(() => rootState.internal.interaction.indexOf(object as unknown as THREE.Object3D))
      if (object.__r3f.eventCount && index === -1) {
        rootState.set('internal', 'interaction', (arr) => [...arr, object as unknown as THREE.Object3D])
      } else if (!object.__r3f.eventCount && index !== -1) {
        rootState.set(
          'internal',
          'interaction',
          produce((arr) => arr.splice(index, 1)),
        )
      }
    }
  }
}

// This function prepares a set of changes to be applied to the instance
export const applyProps = (object: Instance, props: { [key: string]: any }) =>
  createRenderEffect(
    mapArray(
      () => Object.keys(props),
      (key) => {
        /* We wrap it in an effect only if a prop is a getter or a function */
        const descriptors = Object.getOwnPropertyDescriptor(props, key)
        const isDynamic = descriptors?.get || typeof descriptors?.value === 'function'
        const update = () => applyProp(object, props, key)
        isDynamic ? createRenderEffect(update) : update()
      },
    ),
  )

export function invalidateInstance(instance: Instance): void {
  const state = instance.__r3f?.root
  if (state && state.internal.frames === 0) state.invalidate()
}

export function updateInstance(instance: Instance) {
  instance.onUpdate?.(instance)
}

export function updateCamera(camera: Camera, size: Size): void {
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

/**
 * Get a handle to the current global scope in window and worker contexts if able
 * https://github.com/pmndrs/react-three-fiber/pull/2493
 */
export const globalScope =
  (typeof global !== 'undefined' && global) ||
  (typeof self !== 'undefined' && self) ||
  (typeof window !== 'undefined' && window)

export const isObject3D = (object: any): object is THREE.Object3D => object?.isObject3D

type Helper = THREE.Object3D & {
  update: () => void
}

type Constructor = new (...args: any[]) => any
// type Rest<T> = T extends [infer _, ...infer R] ? R : never

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
