import { Accessor, createEffect, createRenderEffect, mapArray, on, onCleanup, splitProps } from 'solid-js'
import * as THREE from 'three'
import { Falsey } from '../utils/typeHelpers'

import { useThree } from './hooks'
import { constructors } from './proxy'

import { produce } from 'solid-js/store'
import type { AttachType, ConstructorRepresentation, Instance } from './proxy'
import type { Dpr, Renderer, RootState, Size } from './store'

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
export const getColorManagement = (): ColorManagementRepresentation | null =>
  (constructors as any).ColorManagement ?? null

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
export const getRootState = (obj: Instance['object']): RootState | undefined => obj.__r3f?.root

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

// Gets only instance props from proxy-component
export function getInstanceProps<T = any>(queue: any): Instance<T>['props'] {
  // SOLID-THREE-NOTE:  solid-three has to use splitProps so getters are not resolved
  const [_, props] = splitProps(queue, INTERNAL_PROPS)
  return props
}

// Each object in the scene carries a small LocalState descriptor
export function prepare<T = any>(target: T, root: RootState, type: string, props: Instance<T>['props']): Instance<T> {
  const object = target as unknown as Instance['object']

  // Create instance descriptor
  let instance = object?.__r3f
  if (!instance) {
    instance = {
      root,
      type,
      parent: null,
      children: [],
      props: getInstanceProps(props),
      object,
      eventCount: 0,
      handlers: {},
      isHidden: false,
    }
    if (object) {
      object.__r3f = instance
      if (type) applyProps(object, instance.props)
    }
  }

  return instance
}

export function resolve(root: any, key: string): { root: any; key: string; target: any } {
  let target = root[key]
  if (!key.includes('-')) return { root, key, target }

  // Resolve pierced target
  const chain = key.split('-')
  target = chain.reduce((acc, key) => acc[key], root)
  key = chain.pop()!

  // Switch root if atomic
  if (!target?.set) root = chain.reduce((acc, key) => acc[key], root)

  return { root, key, target }
}

// Checks if a dash-cased string ends with an integer
const INDEX_REGEX = /-\d+$/

export function attach(parent: Instance, child: Instance, type: AttachType): void {
  if (is.str(type)) {
    // If attaching into an array (foo-0), create one
    if (INDEX_REGEX.test(type)) {
      const index = type.replace(INDEX_REGEX, '')
      const { root, key } = resolve(parent.object, index)
      if (!Array.isArray(root[key])) root[key] = []
    }

    const { root, key } = resolve(parent.object, type)
    child.previousAttach = root[key]
    root[key] = child.object
  } else if (is.fun(type)) {
    child.previousAttach = type(parent.object, child.object)
  }
}

export function detach(parent: Instance, child: Instance, type: AttachType): void {
  if (is.str(type)) {
    const { root, key } = resolve(parent.object, type)
    const previous = child.previousAttach
    // When the previous value was undefined, it means the value was never set to begin with
    if (previous === undefined) delete root[key]
    // Otherwise set the previous value
    else root[key] = previous
  } else {
    child.previousAttach?.(parent.object, child.object)
  }

  delete child.previousAttach
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

export const applyProp = (object: Instance['object'], prop: string, value: any, needsUpdate: boolean) => {
  const rootState = (object as Instance<THREE.Object3D>['object']).__r3f?.root
  /* If the key contains a hyphen, we're setting a sub property. */
  if (prop.indexOf('-') > -1) {
    const [property, ...rest] = prop.split('-')
    applyProps(object[property], { [rest.join('-')]: value })
    return
  }
  if (needsUpdate && ((!object[prop] && value) || (object[prop] && !value))) object.needsUpdate = true
  /* If prop is an event-handler */
  if (rootState && /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(prop) && object.__r3f) {
    object.__r3f.handlers[prop] = value
    object.__r3f.eventCount = Object.keys(object.__r3f.handlers).length

    // Deal with pointer events, including removing them if undefined
    if (rootState.internal) {
      const index = rootState.internal.interaction.indexOf(object as unknown as THREE.Object3D)
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

  // Ignore setting undefined props
  if (value === undefined) return

  let target = object[prop]

  // Alias (output)encoding => (output)colorSpace (since r152)
  // https://github.com/pmndrs/react-three-fiber/pull/2829
  if (hasColorSpace(object)) {
    const sRGBEncoding = 3001
    const SRGBColorSpace = 'srgb'
    const LinearSRGBColorSpace = 'srgb-linear'

    if (prop === 'encoding') {
      prop = 'colorSpace'
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace
    } else if (prop === 'outputEncoding') {
      prop = 'outputColorSpace'
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace
    }
  }

  // Copy if properties match signatures
  if (target?.copy && target?.constructor === (value as ConstructorRepresentation)?.constructor) {
    target.copy(value)
  }
  // Layers have no copy function, we must therefore copy the mask property
  else if (target instanceof THREE.Layers && value instanceof THREE.Layers) {
    target.mask = value.mask
  }
  // Set array types
  else if (target?.set && Array.isArray(value)) {
    if (target.fromArray) target.fromArray(value)
    else target.set(...value)
  }
  // Set literal types, ignore undefined
  // https://github.com/pmndrs/react-three-fiber/issues/274
  else if (target?.set && typeof value !== 'object') {
    const isColor = target instanceof THREE.Color
    // Allow setting array scalars
    if (!isColor && target.setScalar && typeof value === 'number') target.setScalar(value)
    // Otherwise just set ...
    else if (value !== undefined) target.set(value)

    // For versions of three which don't support THREE.ColorManagement,
    // Auto-convert sRGB colors
    // https://github.com/pmndrs/react-three-fiber/issues/344
    if (!getColorManagement() && !rootState?.linear && isColor) target.convertSRGBToLinear()
  }
  // Else, just overwrite the value
  else {
    object[prop] = value

    // Auto-convert sRGB textures, for now ...
    // https://github.com/pmndrs/react-three-fiber/issues/344
    if (
      rootState &&
      object[prop] instanceof THREE.Texture &&
      // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
      object[prop].format === THREE.RGBAFormat &&
      object[prop].type === THREE.UnsignedByteType
    ) {
      const texture = object[prop] as THREE.Texture
      if (hasColorSpace(texture) && hasColorSpace(rootState.gl)) texture.colorSpace = rootState.gl.outputColorSpace
      else texture.encoding = rootState.gl.outputEncoding
    }
  }
}

const NEEDS_UPDATE = [
  'map',
  'envMap',
  'bumpMap',
  'normalMap',
  'transparent',
  'morphTargets',
  'skinning',
  'alphaTest',
  'useVertexColors',
  'flatShading',
]

// This function prepares a set of changes to be applied to the instance
export const applyProps = (object: Instance['object'], props: { [key: string]: any }) =>
  createRenderEffect(
    mapArray(
      () => Object.keys(props),
      (key) => {
        /* We wrap it in an effect only if a prop is a getter or a function */
        const descriptors = Object.getOwnPropertyDescriptor(props, key)
        const isDynamic = !!(descriptors?.get || typeof descriptors?.value === 'function')
        const needsUpdate = NEEDS_UPDATE.includes(key)
        const update = (value: any) => applyProp(object, key, value, needsUpdate)
        isDynamic ? createRenderEffect(on(() => props[key], update)) : update(props[key])
      },
    ),
  )

export function invalidateInstance(instance: Instance): void {
  const state = instance.root
  if (state && state.internal.frames === 0) state.invalidate()
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
  object3D: Accessor<Instance> | Falsey | undefined,
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

  return () => helper
}
