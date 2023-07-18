import {
  Accessor,
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

export interface Catalogue {
  [name: string]: ConstructorRepresentation
}

export type Args<T> = T extends ConstructorRepresentation ? ConstructorParameters<T> : any[]

export interface InstanceProps<T = any, P = any> {
  args?: Args<P>
  object?: T
  visible?: boolean
  dispose?: null
  attach?: AttachType<T>
}

export interface Instance<O = any> {
  root: RootState
  type: string
  parent: Instance | null
  children: Instance[]
  props: InstanceProps<O> & Record<string, unknown>
  object: O & { __r3f?: Instance<O> }
  eventCount: number
  handlers: Partial<EventHandlers>
  attach?: AttachType<O>
  previousAttach?: any
  isHidden: boolean
  autoRemovedBeforeAppend?: boolean
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
        const el = prepare(new source(...(props.args ?? [])), store, '', {}) as Instance
        el.root = store
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

export function useInstance<T extends THREE.Object3D | THREE.Material>(getInstance: () => Instance<T>, props: any) {
  const getParent = useContext(ParentContext)
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])

  /* Assign ref */
  createRenderEffect(() => props.ref instanceof Function && local.ref(getInstance().object))

  /* Apply the props to THREE-instance */
  createRenderEffect(() => applyProps(getInstance().object, instanceProps))

  /* Connect to parent */
  createRenderEffect(() => {
    const child = getInstance()
    const parent = getParent!()

    if (child.object instanceof THREE.Object3D && parent.object instanceof THREE.Object3D) {
      parent.object.add(child.object)
      onCleanup(() => parent.object.remove(child.object as THREE.Object3D))
    }
    child.parent = parent

    if (!parent.children.includes(child)) parent.children.push(child)

    onCleanup(() => {
      const index = parent.children.indexOf(child)
      if (index > -1) {
        parent.children.splice(index, 1)
      }
    })
  })

  /* Attach */
  createRenderEffect(() => {
    const child = getInstance().object
    const parent = getParent!().object

    let attach: string | undefined = local.attach
    if (!attach) {
      if (child instanceof THREE.Material) attach = 'material'
      else if (child instanceof THREE.BufferGeometry) attach = 'geometry'
      else if (child instanceof THREE.Fog) attach = 'fog'
    }

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
  createRenderEffect(() => {
    const object = getInstance().object
    if ('dispose' in object) onCleanup(() => object.dispose())
  })

  createEffect(() => props.helper && useHelper(getInstance, props.helper))
}

export function Primitive(props: { object: any; children?: JSXElement }) {
  const store = useThree()

  /* Prepare instance */
  const instance = createMemo(() => {
    const obj = prepare(props.object, store, '', props)
    obj.root = store
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
