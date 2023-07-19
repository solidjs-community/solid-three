import {
  Accessor,
  children,
  Component,
  createContext,
  createMemo,
  createRenderEffect,
  JSX,
  JSXElement,
  mapArray,
  onCleanup,
  splitProps,
} from 'solid-js'
import * as THREE from 'three'

import { useThree } from './hooks'
import { applyProps, prepare } from './utils'

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

export const createThreeComponent = <TSource extends Constructor>(source: TSource): ThreeComponent<TSource> => {
  const Component = (props: any) => {
    const store = useThree()

    /* Create instance */
    const getObject = createMemo(() => {
      try {
        const el = prepare(new source(...(props.args ?? [])), store, '', {}) as Instance<THREE.Object3D>
        el.root = store
        return el.object
      } catch (e) {
        console.error(e)
        throw new Error('')
      }
    })

    useObject(getObject, props)

    return getObject as unknown as JSX.Element
  }

  return Component
}

/* <Show/> and <For/> return signals */
function resolve<T>(child: Accessor<T> | T) {
  return typeof child !== 'function' ? child : resolve((child as Accessor<T>)())
}

/* manages the relationship between parent and children */
export const parentChildren = (getObject: Accessor<Instance<THREE.Object3D>['object']>, props: any) => {
  const memo = children(() => {
    const result = resolve(props.children)
    return Array.isArray(result) ? result : [result]
  })
  const parent = getObject()
  createRenderEffect(
    mapArray(memo as unknown as Accessor<(Instance | Accessor<Instance>)[]>, (_child) => {
      const child = resolve(_child)

      /* <Show/> will return undefined if it's hidden */
      if (!child?.__r3f || !parent.__r3f) return

      /* Connect children */
      if (child instanceof THREE.Object3D && parent instanceof THREE.Object3D && !parent.children.includes(child)) {
        parent.add(child)
        onCleanup(() => parent.remove(child as THREE.Object3D))
      }

      child.__r3f.parent = parent.__r3f
      if (!parent.__r3f.children.includes(child.__r3f)) parent.__r3f.children.push(child.__r3f)

      onCleanup(() => {
        if (!child.__r3f || !parent.__r3f) return
        const index = parent.__r3f.children.indexOf(child.__r3f)
        if (index > -1) {
          parent.__r3f.children.splice(index, 1)
        }
      })

      /* Attach children */
      let attach: string | undefined = props.attach
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
    }),
  )
}

export function useObject(getObject: () => Instance['object'], props: any) {
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])

  /* Manage children */
  parentChildren(getObject, local)

  /* Assign ref */
  createRenderEffect(() => props.ref instanceof Function && local.ref(getObject()))

  /* Apply the props to THREE-instance */
  createRenderEffect(() => applyProps(getObject(), instanceProps))

  /* Automatically dispose */
  createRenderEffect(() => {
    const object = getObject()
    onCleanup(() => object?.dispose?.())
  })

  // createEffect(() => props.helper && useHelper(getInstance, props.helper))
}

export function Primitive<T>(props: T & { object: T; children?: JSXElement; ref: T | ((value: T) => void) }) {
  const store = useThree()

  /* Prepare instance */
  const getObject = createMemo(() => {
    const obj = prepare(props.object, store, '', props)
    obj.root = store
    return obj.object
  })

  useObject(getObject, props)

  return getObject
}

const cache = {} as Record<string, ThreeComponent<any>>

export function createThreeComponentProxy<Source extends Record<string, any>>(
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
        cache[name] = createThreeComponent(constructor)
      }

      return cache[name]
    },
  })
}

/**
 * The `solid-three` reactor. For every class exposed by `THREE`, this object contains a
 * `solid-three` component that wraps the class.
 */
export const T = /*#__PURE__*/ createThreeComponentProxy(THREE)
