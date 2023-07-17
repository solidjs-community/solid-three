import {
  Component,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  JSXElement,
  onCleanup,
  splitProps,
  useContext,
} from 'solid-js'
import * as THREE from 'three'

import { useThree } from './hooks'
import { applyProps, prepare, useHelper } from './utils'

import type { ThreeElement } from '../three-types'
import { EventHandlers } from './events'
import { RootState } from './store'

export type AttachFnType<O = any> = (parent: any, self: O) => () => void
export type AttachType<O = any> = string | AttachFnType<O>

export type ConstructorRepresentation = new (...args: any[]) => any

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
export interface Catalogue {
  [name: string]: ConstructorRepresentation
}

/**
 * If **T** contains a constructor, @see ConstructorParameters must be used, otherwise **T**.
 */
export type Args<T> = T extends new (...args: any) => any ? ConstructorParameters<T> : T

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

export const catalogue: Catalogue = {}
export const extend = (objects: Partial<Catalogue>): void => void Object.assign(catalogue, objects)

export const ParentContext = createContext<() => Instance>()

export type Constructor<Instance = any> = { new (...args: any[]): Instance }

export type ThreeComponent<Source extends Constructor> = Component<ThreeElement<Source>>
type ThreeComponentProxy<Source> = {
  [K in keyof Source]: Source[K] extends Constructor ? ThreeComponent<Source[K]> : undefined
}

export const makeThreeComponent = <TSource extends Constructor>(source: TSource): ThreeComponent<TSource> => {
  const Component = (props: any) => {
    const store = useThree()

    /* Create instance */
    const getInstance = createMemo(() => {
      try {
        const el = prepare(new source(...(props.args ?? []))) as Instance
        el.__r3f.root = store
        return el
      } catch (e) {
        console.error(e)
        throw new Error('')
      }
    })

    useInstance(getInstance, props)

    return <ParentContext.Provider value={getInstance}>{props.children}</ParentContext.Provider>
  }

  return Component
}

export function useInstance(getInstance: () => Instance, props: any) {
  const getParent = useContext(ParentContext)
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])

  /* Assign ref */
  createRenderEffect(() => props.ref instanceof Function && local.ref(getInstance()))

  /* Apply the props to THREE-instance */
  createRenderEffect(() => applyProps(getInstance(), instanceProps))

  /* Connect to parent */
  createRenderEffect(() => {
    const child = getInstance()
    const parent = getParent!()
    if (child instanceof THREE.Object3D && parent instanceof THREE.Object3D) {
      parent.add(child)
      onCleanup(() => parent.remove(child))
    }
    child.__r3f.parent = parent
    if (!parent.__r3f.objects.includes(child)) parent.__r3f.objects.push(child)

    onCleanup(() => {
      const index = parent.__r3f.objects.indexOf(child)
      if (index > -1) {
        parent.__r3f.objects.splice(index, 1)
      }
    })
  })

  /* Attach */
  createRenderEffect(() => {
    const child = getInstance()
    let attach: string | undefined = local.attach
    if (!attach) {
      if (child instanceof THREE.Material) attach = 'material'
      else if (child instanceof THREE.BufferGeometry) attach = 'geometry'
      else if (child instanceof THREE.Fog) attach = 'fog'
    }

    const parent = getParent!()

    /* If the instance has an "attach" property, attach it to the parent */
    if (attach) {
      if (attach in parent) {
        parent[attach] = child
        onCleanup(() => void (parent[attach!] = undefined))
      } else {
        console.error(`Property "${attach}" does not exist on parent "${parent.constructor.name}"`)
      }
    }
  })

  /* Automatically dispose */
  if ('dispose' in getInstance()) onCleanup(() => getInstance().dispose?.())

  createEffect(() => props.helper && useHelper(getInstance, props.helper))
}

export function Primitive<T extends Instance>(props: { object: T; children?: JSXElement }) {
  const store = useThree()

  /* Prepare instance */
  const instance = createMemo(() => {
    const obj = prepare(props.object)
    obj.__r3f.root = store
    return obj
  })

  useInstance(instance, props)

  return <ParentContext.Provider value={instance}>{props.children}</ParentContext.Provider>
}

const cache = {} as Record<string, ThreeComponent<any>>

export function makeThreeComponentProxy<Source extends Record<string, any>>(
  source: Source,
): ThreeComponentProxy<Source> {
  return new Proxy<ThreeComponentProxy<Source>>({} as ThreeComponentProxy<Source>, {
    get: (_, name: string) => {
      /* Create and memoize a wrapper component for the specified property. */
      if (!cache[name]) {
        /* Try and find a constructor within the THREE namespace. */
        const constructor = source[name as keyof Source]

        /* If nothing could be found, bail. */
        if (!constructor) return undefined

        /* Otherwise, create and memoize a component for that constructor. */
        cache[name] = makeThreeComponent(constructor)
      }

      return cache[name]
    },
  })
}

/**
 * The `solid-three` reactor. For every class exposed by `THREE`, this object contains a
 * `solid-three` component that wraps the class.
 */
export const T = /*#__PURE__*/ makeThreeComponentProxy(THREE)
