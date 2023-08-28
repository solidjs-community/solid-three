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

import type { ThreeElement } from '../three-types'
import { AllConstructorParameters, MapToComponents } from '../utils/typeHelpers'
import { EventHandlers } from './events'
import { ThreeSuspense, useThree } from './hooks'
import { Portal } from './renderer'
import { RootState } from './store'
import { applyProps, attach, detach, prepare } from './utils'

export type AttachFnType<O = any> = (parent: any, self: O) => () => void
export type AttachType<O = any> = string | AttachFnType<O>

export type ConstructorRepresentation = new (...args: any[]) => any

export type Args<T> = T extends ConstructorRepresentation ? AllConstructorParameters<T> : any[]
export interface InstanceProps<T = any, P = any> {
  args?: Args<P>
  object?: T
  visible?: boolean
  dispose?: null
  attach?: AttachType<T>
}

// s3f: any way we can write this more generally?
export interface Instance<O = THREE.Object3D> {
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

export const intrinsicElements: SolidThree.IntrinsicElements = {}
export const intrinsicComponents: SolidThree.IntrinsicComponents = {
  Suspense: ThreeSuspense,
  Primitive,
  Portal,
}
export const extend = (objects: Record<string, ConstructorRepresentation>): void =>
  void Object.assign(intrinsicElements, objects)

export const ParentContext = createContext<() => Instance>()

export type Constructor<Instance = any> = { new (...args: any[]): Instance }

export type ThreeComponent<Source extends Constructor> = Component<ThreeElement<Source>>
type ThreeComponentProxy<Source> = {
  [K in keyof Source]: Source[K] extends Constructor ? ThreeComponent<Source[K]> : undefined
}

export const createThreeComponent = <TSource extends Constructor>(source: TSource): ThreeComponent<TSource> => {
  const Component = (props: any) => {
    const store = useThree()
    const memo = createMemo(() => {
      try {
        const instance = prepare(new source(...(props.args ?? [])), store, '', props) as Instance<THREE.Object3D>
        instance.root = store
        return instance.object
      } catch (e) {
        console.error(e)
        throw new Error('')
      }
    })
    manageProps(memo, props)
    return memo as unknown as JSX.Element
  }

  return Component
}

/* <Show/> and <For/> return signals */
export function resolveAccessor<T>(child: Accessor<T> | T, recursive = false): T {
  return typeof child !== 'function'
    ? child
    : recursive
    ? resolveAccessor((child as Accessor<T>)())
    : (child as Accessor<T>)()
}

/* manages the relationship between parent and children */
export function manageChildren(getParent: Accessor<Instance<any>['object'] | undefined>, children: Accessor<any>) {
  const memo = createMemo(() => {
    const result = resolveAccessor(children, true)
    return Array.isArray(result) ? result : [result]
  })

  createRenderEffect(
    mapArray(memo as unknown as Accessor<(Instance['object'] | Accessor<Instance['object']>)[]>, (_child) => {
      createRenderEffect(() => {
        const parent = getParent()
        const child = resolveAccessor(_child, true)

        // s3f    This code is a bit fragile since neither child's or parent's `__r3f` are reactive values.
        if (!child?.__r3f || !parent?.__r3f) return

        /* set parent/children property in __r3f-metadata */
        child.__r3f.parent = parent.__r3f
        if (!parent.__r3f.children.includes(child.__r3f)) parent.__r3f.children.push(child.__r3f)

        /* cleanup parent/children property in __r3f-metadata */
        onCleanup(() => {
          if (!child.__r3f || !parent.__r3f) return
          const index = parent.__r3f.children.indexOf(child.__r3f)
          if (index > -1) {
            parent.__r3f.children.splice(index, 1)
          }
        })

        /* Connect children */
        if (child instanceof THREE.Object3D && parent instanceof THREE.Object3D && !parent.children.includes(child)) {
          parent.add(child)
          onCleanup(() => parent.remove(child as THREE.Object3D))
          return
        }

        /* Attach children */
        let type = child!.__r3f.props.attach
        if (!type) {
          if (child instanceof THREE.Material) type = 'material'
          else if (child instanceof THREE.BufferGeometry) type = 'geometry'
          else if (child instanceof THREE.Fog) type = 'fog'
        }

        /* If the instance has an "attach" property, attach it to the parent */
        if (type) {
          // @ts-ignore s3f
          attach(parent.__r3f, child.__r3f, type)
          // @ts-ignore s3f
          onCleanup(() => detach(parent.__r3f!, child.__r3f, type))
        }
      })
    }),
  )
}

export function manageProps<T>(getObject: () => Instance<T>['object'] | undefined, props: any) {
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])

  /* Assign ref */
  /*
    Needs to be done first so that
      <Parent ref={parent}>
        <Child parent={parent}/>
      </Parent>
    Child will receive parent.
  */
  createRenderEffect(() => {
    if (local.ref instanceof Function) local.ref(getObject())
    else local.ref = getObject()
  })

  /* Connect or assign children to THREE-instance */
  const getChildren = children(() => props.children)
  createRenderEffect(() => manageChildren(getObject, getChildren))

  /* Apply the props to THREE-instance */
  createRenderEffect(() => applyProps(getObject, instanceProps))

  /* Automatically dispose */
  // @ts-ignore s3f
  onCleanup(() => getObject()?.dispose?.())
}

export function Primitive<T>(
  props: Omit<Partial<T>, 'object' | 'children' | 'ref'> & {
    object: T
    children?: JSXElement
    ref?: T | ((value: T) => void)
  },
) {
  const store = useThree()

  const memo = createMemo<Instance<T>['object'] | undefined>((prev) => {
    if (!props.object) return prev
    /* Prepare instance */
    const instance = prepare(props.object, store, '', props)
    instance.root = store
    return instance.object
  })

  manageProps(memo, props)

  return memo as unknown as JSX.Element
}

const cache = new Map<string, Component<any>>(Object.entries(intrinsicComponents))

declare global {
  namespace SolidThree {
    interface IntrinsicComponents {
      Suspense: typeof ThreeSuspense
      Primitive: typeof Primitive
      Portal: typeof Portal
    }
    interface IntrinsicElements {}
  }
}

export type SolidThreeElements = SolidThree.IntrinsicComponents & MapToComponents<SolidThree.IntrinsicElements>

export function createThreeComponentProxy<Source extends Record<string, any>>(source: Source) {
  Object.assign(intrinsicElements, source)
  return new Proxy<ThreeComponentProxy<Source> & SolidThreeElements>({} as any, {
    get: (_, name: string) => {
      /* Create and memoize a wrapper component for the specified property. */
      if (!cache.has(name)) {
        /* Try and find a constructor within the THREE namespace. */
        const constructor = source[name as keyof Source] ?? intrinsicElements[name]

        /* If nothing could be found, bail. */
        if (!constructor) return undefined

        /* Otherwise, create and memoize a component for that constructor. */
        cache.set(name, createThreeComponent(constructor))
      }

      return cache.get(name)
    },
  })
}

/**
 * The `solid-three` reactor. For every class exposed by `THREE`, this object contains a
 * `solid-three` component that wraps the class.
 */
export const T = /*#__PURE__*/ createThreeComponentProxy(THREE)
